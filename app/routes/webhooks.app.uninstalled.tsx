import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { markShopUninstalled } from "../lib/shop.server";
import { deleteAllSettings } from "../lib/settings.server";
import prisma from "../db.server";

/**
 * Webhook handler for app/uninstalled
 * 
 * Shopify sends this webhook when a merchant uninstalls the app.
 * 
 * Important considerations:
 * - Webhooks can be delivered multiple times (idempotency)
 * - Webhooks may arrive after session is deleted
 * - We mark shop as uninstalled but don't delete data (for analytics)
 * - Settings are cleaned up to free storage
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  try {
    // Get shop record to find shopId for settings cleanup
    const shopRecord = await prisma.shop.findUnique({
      where: { shopDomain: shop },
      select: { id: true },
    });

    if (shopRecord) {
      // Mark shop as uninstalled (preserves historical data)
      await markShopUninstalled(shop);

      // Clean up settings to free storage
      await deleteAllSettings(shopRecord.id);
    }

    // Note: Session cleanup is handled automatically by Shopify SDK
    // when session expires or is invalidated
  } catch (error) {
    // Log error but don't fail webhook
    // Shopify will retry if we return non-2xx, but we want idempotency
    console.error(`Error handling uninstall webhook for ${shop}:`, error);
  }

  // Always return 200 to acknowledge receipt
  // This ensures idempotency - multiple deliveries won't cause issues
  return new Response(null, { status: 200 });
};
