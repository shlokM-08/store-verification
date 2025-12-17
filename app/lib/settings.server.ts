import prisma from "../db.server";

/**
 * Settings operations for per-shop key/value configuration
 * All operations are scoped by shopId to ensure multi-tenant safety
 */

export interface SettingData {
  key: string;
  value: string;
}

/**
 * Get a setting value for a shop
 * Returns null if setting doesn't exist
 */
export async function getSetting(
  shopId: string,
  key: string,
): Promise<string | null> {
  const setting = await prisma.setting.findUnique({
    where: {
      shopId_key: {
        shopId,
        key,
      },
    },
  });

  return setting?.value ?? null;
}

/**
 * Get all settings for a shop
 * Returns an object with key-value pairs
 */
export async function getAllSettings(
  shopId: string,
): Promise<Record<string, string>> {
  const settings = await prisma.setting.findMany({
    where: { shopId },
  });

  return settings.reduce(
    (acc, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    },
    {} as Record<string, string>,
  );
}

/**
 * Set a setting value for a shop
 * Creates or updates the setting (upsert)
 */
export async function setSetting(
  shopId: string,
  key: string,
  value: string,
): Promise<void> {
  await prisma.setting.upsert({
    where: {
      shopId_key: {
        shopId,
        key,
      },
    },
    update: {
      value,
    },
    create: {
      shopId,
      key,
      value,
    },
  });
}

/**
 * Delete a setting for a shop
 */
export async function deleteSetting(shopId: string, key: string): Promise<void> {
  await prisma.setting.delete({
    where: {
      shopId_key: {
        shopId,
        key,
      },
    },
  });
}

/**
 * Delete all settings for a shop
 * Useful when shop is uninstalled
 */
export async function deleteAllSettings(shopId: string): Promise<void> {
  await prisma.setting.deleteMany({
    where: { shopId },
  });
}

