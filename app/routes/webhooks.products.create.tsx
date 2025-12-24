import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import {
  applyProductRulesForShop,
  saveProductToDatabase,
  type ProductWebhookPayload,
} from "../webhooks/products.server";

/**
 * products/create webhook handler.
 *
 * HMAC verification and basic webhook plumbing are handled by
 * authenticate.webhook. We only need to apply our business logic and
 * respond quickly.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload, admin } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // Always save product to database, even if admin context is missing
  const shopRecord = await prisma.shop.findUnique({
    where: { shopDomain: shop },
    select: { id: true },
  });

  if (shopRecord) {
    await saveProductToDatabase({
      shopId: shopRecord.id,
      payload: payload as ProductWebhookPayload,
    });
  } else {
    console.warn(`No Shop record found for domain ${shop}, skipping product save`);
  }

  if (!admin) {
    // When webhooks are triggered by the CLI, admin may be undefined.
    // In that case we skip tagging but still return 200 so Shopify
    // treats the delivery as successful.
    console.warn("Admin context missing for products/create webhook");
    return new Response(null, { status: 200 });
  }

  await applyProductRulesForShop({
    shopDomain: shop,
    admin,
    payload: payload as ProductWebhookPayload,
  });

  return new Response(null, { status: 200 });
};


