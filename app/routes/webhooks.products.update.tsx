import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import {
  applyProductRulesForShop,
  type ProductWebhookPayload,
} from "../webhooks/products.server";

/**
 * products/update webhook handler.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload, admin } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

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


