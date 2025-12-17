import prisma from "../db.server";
import {
  evaluateProductRules,
  getRulesForShop,
  mergeProductTags,
  type ProductForEvaluation,
} from "../lib/productRules.server";

// Minimal admin context type for GraphQL calls used in webhooks.
type AdminContext = {
  graphql: (
    query: string,
    options?: { variables?: unknown },
  ) => Promise<Response>;
};

/**
 * Product payload shape from REST webhooks.
 * We only declare the fields we actually depend on.
 */
export interface ProductWebhookPayload {
  id: number;
  vendor?: string | null;
  variants?: Array<{
    price?: string | null;
    inventory_quantity?: number | null;
  }>;
  tags?: string | null;
}

interface MappedProduct {
  shopifyProductId: string;
  productForEvaluation: ProductForEvaluation;
  existingTags: string[];
}

/**
 * Map REST webhook payload to the minimal shape we need for rule evaluation.
 */
export function mapWebhookPayloadToProduct(
  payload: ProductWebhookPayload,
): MappedProduct {
  const shopifyProductId = `gid://shopify/Product/${payload.id}`;

  const firstVariant = payload.variants?.[0];
  const price =
    firstVariant?.price != null ? Number.parseFloat(firstVariant.price) : null;

  const totalInventory =
    payload.variants?.reduce<number>((sum, variant) => {
      const qty = variant.inventory_quantity ?? 0;
      return sum + qty;
    }, 0) ?? null;

  const vendor = payload.vendor ?? null;

  const existingTags =
    payload.tags
      ?.split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0) ?? [];

  return {
    shopifyProductId,
    productForEvaluation: {
      price: Number.isNaN(price ?? NaN) ? null : price,
      totalInventory,
      vendor,
    },
    existingTags,
  };
}

/**
 * Apply product rules for a given shop + product payload.
 *
 * Idempotency:
 * - We only call productUpdate when at least one new tag would be added.
 * - Existing tags are preserved; we never remove tags.
 */
export async function applyProductRulesForShop(options: {
  shopDomain: string;
  admin: AdminContext;
  payload: ProductWebhookPayload;
}): Promise<void> {
  const { shopDomain, admin, payload } = options;

  const shopRecord = await prisma.shop.findUnique({
    where: { shopDomain },
    select: { id: true },
  });

  if (!shopRecord) {
    console.warn(`No Shop record found for domain ${shopDomain}`);
    return;
  }

  const rules = await getRulesForShop(shopRecord.id);
  if (rules.length === 0) {
    // No rules configured for this shop; nothing to do.
    return;
  }

  const { shopifyProductId, productForEvaluation, existingTags } =
    mapWebhookPayloadToProduct(payload);

  const ruleTags = evaluateProductRules(productForEvaluation, rules);
  if (ruleTags.length === 0) {
    return;
  }

  const mergedTags = mergeProductTags(existingTags, ruleTags);
  if (!mergedTags) {
    // No changes required; avoid an unnecessary write.
    return;
  }

  const mutation = `
    mutation AutoTagProduct($input: ProductInput!) {
      productUpdate(input: $input) {
        product {
          id
          tags
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const response = await admin.graphql(mutation, {
    variables: {
      input: {
        id: shopifyProductId,
        tags: mergedTags,
      },
    },
  });

  const json = (await response.json()) as {
    data?: {
      productUpdate?: {
        userErrors?: Array<{ field?: string[]; message: string }>;
      };
    };
  };

  const userErrors = json.data?.productUpdate?.userErrors ?? [];
  if (userErrors.length > 0) {
    console.error("AutoTagProduct userErrors", userErrors);
  }
}


