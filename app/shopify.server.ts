import "@shopify/shopify-app-react-router/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";
import { upsertShop } from "./lib/shop.server";

/**
 * Shopify app configuration with installation handling
 * 
 * The afterAuth hook is called:
 * 1. After initial app installation
 * 2. When access token is refreshed
 * 
 * We use it to persist shop data to our database for multi-tenant operations
 */
const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.October25,
  scopes: process.env.SHOPIFY_API_SCOPES?.split(",") || ["read_products"],
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  future: {
    expiringOfflineAccessTokens: true,
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
  hooks: {
    /**
     * Handle shop installation and token updates
     * This runs after OAuth completes, ensuring we have a valid session
     */
    afterAuth: async ({ session }) => {
      // Persist shop data to our database
      // This handles both new installs and token refreshes
      await upsertShop(session);

      // Note: Webhooks are registered via shopify.app.toml (app-specific webhooks)
      // This is preferred over shop-specific webhooks for better reliability
    },
  },
});

export default shopify;
export const apiVersion = ApiVersion.October25;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
