/**
 * Backfill script to fetch all existing products from Shopify and save them to the database.
 * 
 * Usage:
 *   npx tsx scripts/backfill-products.ts [shopDomain]
 * 
 * If shopDomain is not provided, it will backfill products for all installed shops.
 */

import prisma from "../app/db.server.js";
import { saveProductToDatabase, type ProductWebhookPayload } from "../app/webhooks/products.server.js";

// Shopify Admin API GraphQL client setup
// Using stable API version 2024-10 (matches October24/October25)
async function createShopifyClient(shopDomain: string, accessToken: string) {
  const shopifyAdminUrl = `https://${shopDomain}/admin/api/2024-10/graphql.json`;

  return {
    graphql: async (query: string, variables?: unknown) => {
      const response = await fetch(shopifyAdminUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken,
        },
        body: JSON.stringify({ query, variables }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Shopify API error: ${response.status} ${response.statusText}`;
        
        // Try to parse error details if available
        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.errors) {
            errorMessage += `\n  Errors: ${JSON.stringify(errorJson.errors, null, 2)}`;
          }
        } catch {
          // If not JSON, include the raw text
          if (errorText) {
            errorMessage += `\n  Response: ${errorText.substring(0, 200)}`;
          }
        }
        
        throw new Error(errorMessage);
      }

      return response;
    },
  };
}

// GraphQL query to fetch products with pagination
const PRODUCTS_QUERY = `
  query GetProducts($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          title
          vendor
          status
          tags
          variants(first: 250) {
            edges {
              node {
                price
                inventoryQuantity
              }
            }
          }
        }
      }
    }
  }
`;

interface GraphQLProduct {
  id: string;
  title: string;
  vendor: string | null;
  status: string;
  tags: string[];
  variants: {
    edges: Array<{
      node: {
        price: string;
        inventoryQuantity: number | null;
      };
    }>;
  };
}

/**
 * Convert GraphQL product to webhook payload format
 */
function graphQLProductToWebhookPayload(
  product: GraphQLProduct,
): ProductWebhookPayload {
  // Extract numeric ID from GID (gid://shopify/Product/123456)
  const idMatch = product.id.match(/\/(\d+)$/);
  const id = idMatch ? parseInt(idMatch[1], 10) : 0;

  return {
    id,
    title: product.title || null,
    vendor: product.vendor || null,
    status: product.status?.toLowerCase() || null,
    tags: product.tags?.join(", ") || null,
    variants: product.variants.edges.map((edge) => ({
      price: edge.node.price || null,
      inventory_quantity: edge.node.inventoryQuantity || null,
    })),
  };
}

/**
 * Fetch all products for a shop using pagination
 */
async function fetchAllProducts(
  shopDomain: string,
  accessToken: string,
): Promise<ProductWebhookPayload[]> {
  const client = await createShopifyClient(shopDomain, accessToken);
  const allProducts: ProductWebhookPayload[] = [];
  let hasNextPage = true;
  let cursor: string | null = null;

  console.log(`Fetching products for ${shopDomain}...`);

  while (hasNextPage) {
    const response = await client.graphql(PRODUCTS_QUERY, {
      first: 250, // Maximum allowed by Shopify
      after: cursor,
    });

    const json = (await response.json()) as {
      data?: {
        products?: {
          pageInfo?: {
            hasNextPage: boolean;
            endCursor: string | null;
          };
          edges?: Array<{
            node: GraphQLProduct;
          }>;
        };
      };
      errors?: Array<{ message: string }>;
    };

    if (json.errors) {
      throw new Error(
        `GraphQL errors: ${json.errors.map((e) => e.message).join(", ")}`,
      );
    }

    const products = json.data?.products;
    if (!products) {
      throw new Error("No products data in response");
    }

    const pageInfo = products.pageInfo;
    const edges = products.edges || [];

    for (const edge of edges) {
      const payload = graphQLProductToWebhookPayload(edge.node);
      allProducts.push(payload);
    }

    hasNextPage = pageInfo?.hasNextPage ?? false;
    cursor = pageInfo?.endCursor ?? null;

    console.log(
      `  Fetched ${allProducts.length} products so far... (hasNextPage: ${hasNextPage})`,
    );
  }

  console.log(`  Total products fetched: ${allProducts.length}`);
  return allProducts;
}

/**
 * Backfill products for a specific shop
 */
async function backfillShop(shopDomain: string): Promise<void> {
  const shop = await prisma.shop.findUnique({
    where: { shopDomain },
    select: { id: true, uninstalledAt: true },
  });

  if (!shop) {
    console.error(`Shop not found: ${shopDomain}`);
    return;
  }

  if (shop.uninstalledAt) {
    console.warn(`Shop is uninstalled: ${shopDomain}, skipping...`);
    return;
  }

  // Get the latest session from Session table (has the most up-to-date access token)
  // Try offline session first (preferred for background scripts)
  let session = await prisma.session.findFirst({
    where: {
      shop: shopDomain,
      isOnline: false,
    },
    orderBy: {
      expires: 'desc',
    },
    select: {
      accessToken: true,
      expires: true,
    },
  });

  // Fallback to online session if no offline session found
  if (!session) {
    session = await prisma.session.findFirst({
      where: {
        shop: shopDomain,
        isOnline: true,
      },
      orderBy: {
        expires: 'desc',
      },
      select: {
        accessToken: true,
        expires: true,
      },
    });
  }

  if (!session || !session.accessToken) {
    console.error(`No valid session/access token found for shop: ${shopDomain}`);
    console.error(`  Please reinstall the app on this shop to refresh the access token.`);
    console.error(`  Or visit the app in your Shopify admin to trigger a new session.`);
    return;
  }

  // Check if session is expired (warn but still try)
  if (session.expires && new Date(session.expires) < new Date()) {
    console.warn(`  ⚠️  Session appears to be expired, but attempting anyway...`);
  }

  try {
    const products = await fetchAllProducts(shopDomain, session.accessToken);

    console.log(`Saving ${products.length} products to database...`);

    let saved = 0;
    let errors = 0;

    for (const product of products) {
      try {
        await saveProductToDatabase({
          shopId: shop.id,
          payload: product,
        });
        saved++;
        if (saved % 50 === 0) {
          console.log(`  Saved ${saved}/${products.length} products...`);
        }
      } catch (error) {
        errors++;
        console.error(
          `  Error saving product ${product.id}:`,
          error instanceof Error ? error.message : error,
        );
      }
    }

    console.log(
      `\n✅ Completed backfill for ${shopDomain}:`,
    );
    console.log(`   - Products saved: ${saved}`);
    console.log(`   - Errors: ${errors}`);
  } catch (error) {
    console.error(
      `❌ Error backfilling products for ${shopDomain}:`,
      error instanceof Error ? error.message : error,
    );
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  const shopDomain = process.argv[2];

  if (shopDomain) {
    // Backfill specific shop
    console.log(`Backfilling products for shop: ${shopDomain}\n`);
    await backfillShop(shopDomain);
  } else {
    // Backfill all installed shops
    console.log("Backfilling products for all installed shops...\n");

    const shops = await prisma.shop.findMany({
      where: {
        uninstalledAt: null,
      },
      select: {
        shopDomain: true,
      },
    });

    if (shops.length === 0) {
      console.log("No installed shops found.");
      return;
    }

    console.log(`Found ${shops.length} installed shop(s):\n`);

    for (const shop of shops) {
      console.log(`\n${"=".repeat(60)}`);
      await backfillShop(shop.shopDomain);
    }

    console.log(`\n${"=".repeat(60)}`);
    console.log("✅ Backfill completed for all shops!");
  }
}

// Run the script
main()
  .then(() => {
    console.log("\n✨ Script completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Script failed:", error);
    process.exit(1);
  });

