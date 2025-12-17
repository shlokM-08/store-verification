import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { getShop } from "../lib/shop.server";

/**
 * Dashboard route - displays shop information and installation status
 * 
 * This is the main app page that merchants see after installation.
 * Shows shop domain, installation date, and current status.
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  // Get shop data from our database
  const shop = await getShop(session.shop);

  if (!shop) {
    // Shop not found or uninstalled - this shouldn't happen if auth succeeded
    // but we handle it gracefully
    throw new Response("Shop not found", { status: 404 });
  }

  return {
    shopDomain: shop.shopDomain,
    installedAt: shop.installedAt.toISOString(),
    status: "Installed",
  };
};

export default function Dashboard() {
  const { shopDomain, installedAt, status } = useLoaderData<typeof loader>();

  const installDate = new Date(installedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <s-page heading="Dashboard">
      <s-section heading="Shop Information">
        <s-stack direction="block" gap="base">
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack direction="block" gap="tight">
              <s-text variant="headingMd">Shop Domain</s-text>
              <s-text variant="bodyLg">{shopDomain}</s-text>
            </s-stack>
          </s-box>

          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack direction="block" gap="tight">
              <s-text variant="headingMd">Installation Date</s-text>
              <s-text variant="bodyLg">{installDate}</s-text>
            </s-stack>
          </s-box>

          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack direction="block" gap="tight">
              <s-text variant="headingMd">Status</s-text>
              <s-badge status="success">{status}</s-badge>
            </s-stack>
          </s-box>
        </s-stack>
      </s-section>

      <s-section slot="aside" heading="Quick Links">
        <s-unordered-list>
          <s-list-item>
            <s-link href="/app/settings">Manage Settings</s-link>
          </s-list-item>
        </s-unordered-list>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
