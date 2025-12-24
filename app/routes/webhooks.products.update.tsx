import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import {
  applyProductRulesForShop,
  saveProductToDatabase,
  type ProductWebhookPayload,
} from "../webhooks/products.server";

/**
 * products/update webhook handler.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload, admin } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // Always save/update product in database, even if admin context is missing
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
    console.warn("Admin context missing for products/update webhook");
    return new Response(null, { status: 200 });
  }

  await applyProductRulesForShop({
    shopDomain: shop,
    admin,
    payload: payload as ProductWebhookPayload,
  });

  return new Response(null, { status: 200 });
};


