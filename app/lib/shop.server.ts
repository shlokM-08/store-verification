import type { Session } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "../db.server";

/**
 * Shop database operations for multi-tenant SaaS
 * All operations are scoped by shopDomain to ensure tenant isolation
 */

export interface ShopData {
  shopDomain: string;
  accessToken: string;
  installedAt: Date;
}

/**
 * Create or update shop record on installation
 * Prevents duplicate installs by using upsert
 */
export async function upsertShop(session: Session): Promise<ShopData> {
  const shopDomain = session.shop;
  const accessToken = session.accessToken;

  // Use upsert to handle both new installs and re-installs
  // If shop exists, update accessToken and reset uninstalledAt
  // For new installs, set installedAt; for re-installs, keep original installedAt
  const shop = await prisma.shop.upsert({
    where: { shopDomain },
    update: {
      accessToken,
      // Reset uninstalledAt if shop is being re-installed
      uninstalledAt: null,
    },
    create: {
      shopDomain,
      accessToken,
      installedAt: new Date(),
    },
  });

  return {
    shopDomain: shop.shopDomain,
    accessToken: shop.accessToken,
    installedAt: shop.installedAt,
  };
}

/**
 * Get shop by domain
 * Returns null if shop doesn't exist or is uninstalled
 */
export async function getShop(shopDomain: string): Promise<ShopData | null> {
  const shop = await prisma.shop.findUnique({
    where: { shopDomain },
  });

  if (!shop || shop.uninstalledAt) {
    return null;
  }

  return {
    shopDomain: shop.shopDomain,
    accessToken: shop.accessToken,
    installedAt: shop.installedAt,
  };
}

/**
 * Mark shop as uninstalled
 * Sets uninstalledAt timestamp but doesn't delete the record
 * This preserves historical data and allows for analytics
 */
export async function markShopUninstalled(
  shopDomain: string,
): Promise<void> {
  await prisma.shop.update({
    where: { shopDomain },
    data: {
      uninstalledAt: new Date(),
    },
  });
}

/**
 * Check if shop is installed
 * Returns true only if shop exists and is not uninstalled
 */
export async function isShopInstalled(shopDomain: string): Promise<boolean> {
  const shop = await prisma.shop.findUnique({
    where: { shopDomain },
    select: { uninstalledAt: true },
  });

  return shop !== null && shop.uninstalledAt === null;
}

