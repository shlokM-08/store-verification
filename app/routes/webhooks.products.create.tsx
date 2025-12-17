import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import {
  applyProductRulesForShop,
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


