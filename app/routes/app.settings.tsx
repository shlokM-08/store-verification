import { useState, useEffect } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useLoaderData, useFetcher, useNavigation } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import prisma from "../db.server";
import { getAllSettings, setSetting } from "../lib/settings.server";

/**
 * Settings page - manage per-shop key/value settings
 * 
 * Provides a simple interface for merchants to configure app settings.
 * Settings are auto-saved as the user types (debounced).
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  // Get shop record to access shopId
  const shop = await prisma.shop.findUnique({
    where: { shopDomain: session.shop },
    select: { id: true },
  });

  if (!shop) {
    throw new Response("Shop not found", { status: 404 });
  }

  // Load all settings for this shop
  const settings = await getAllSettings(shop.id);

  return {
    shopId: shop.id,
    settings,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  // Get shop record
  const shop = await prisma.shop.findUnique({
    where: { shopDomain: session.shop },
    select: { id: true },
  });

  if (!shop) {
    throw new Response("Shop not found", { status: 404 });
  }

  const formData = await request.formData();
  const key = formData.get("key") as string;
  const value = formData.get("value") as string;
  const action = formData.get("_action") as string;

  if (!key || key.trim() === "") {
    return { error: "Setting key is required" };
  }

  // Handle deletion
  if (action === "delete") {
    const { deleteSetting } = await import("../lib/settings.server");
    await deleteSetting(shop.id, key.trim());
    return { success: true, deleted: true };
  }

  // Save setting
  await setSetting(shop.id, key.trim(), value || "");

  return { success: true };
};

export default function Settings() {
  const { shopId, settings: initialSettings } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const navigation = useNavigation();
  const shopify = useAppBridge();

  const [settings, setSettings] = useState<Record<string, string>>(
    initialSettings,
  );
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [debounceTimers, setDebounceTimers] = useState<
    Record<string, NodeJS.Timeout>
  >({});

  const isSaving = navigation.state === "submitting";

  // Show toast on save success
  useEffect(() => {
    if (fetcher.data?.success) {
      shopify.toast.show("Setting saved");
    }
    if (fetcher.data?.error) {
      shopify.toast.show(fetcher.data.error, { isError: true });
    }
  }, [fetcher.data, shopify]);

  // Auto-save with debounce
  const handleSettingChange = (key: string, value: string) => {
    // Update local state immediately
    setSettings((prev) => ({ ...prev, [key]: value }));

    // Clear existing timer for this key
    if (debounceTimers[key]) {
      clearTimeout(debounceTimers[key]);
    }

    // Set new timer for auto-save
    const timer = setTimeout(() => {
      const formData = new FormData();
      formData.append("key", key);
      formData.append("value", value);
      fetcher.submit(formData, { method: "POST" });
    }, 1000); // 1 second debounce

    setDebounceTimers((prev) => ({ ...prev, [key]: timer }));
  };

  const handleAddSetting = () => {
    if (!newKey.trim()) {
      shopify.toast.show("Setting key is required", { isError: true });
      return;
    }

    if (settings[newKey.trim()] !== undefined) {
      shopify.toast.show("Setting key already exists", { isError: true });
      return;
    }

    handleSettingChange(newKey.trim(), newValue);
    setNewKey("");
    setNewValue("");
  };

  const handleDeleteSetting = (key: string) => {
    const formData = new FormData();
    formData.append("key", key);
    formData.append("_action", "delete");
    fetcher.submit(formData, { method: "POST" });

    // Update local state optimistically
    const newSettings = { ...settings };
    delete newSettings[key];
    setSettings(newSettings);
  };

  return (
    <s-page heading="Settings">
      <s-section heading="App Settings">
        <s-paragraph>
          Configure your app settings. Changes are automatically saved.
        </s-paragraph>

        <s-stack direction="block" gap="base">
          {Object.entries(settings).map(([key, value]) => (
            <s-box
              key={key}
              padding="base"
              borderWidth="base"
              borderRadius="base"
            >
              <s-stack direction="block" gap="tight">
                <s-stack direction="inline" gap="base" alignment="space-between">
                  <s-text variant="headingSm">{key}</s-text>
                  <s-button
                    variant="tertiary"
                    onClick={() => handleDeleteSetting(key)}
                  >
                    Delete
                  </s-button>
                </s-stack>
                <s-text-field
                  label=""
                  value={value}
                  onChange={(e) =>
                    handleSettingChange(key, (e.target as HTMLInputElement).value)
                  }
                  autoComplete="off"
                />
              </s-stack>
            </s-box>
          ))}

          {Object.keys(settings).length === 0 && (
            <s-box padding="base" borderWidth="base" borderRadius="base">
              <s-text variant="bodyMd" tone="subdued">
                No settings configured. Add a new setting below.
              </s-text>
            </s-box>
          )}
        </s-stack>
      </s-section>

      <s-section heading="Add New Setting">
        <s-stack direction="block" gap="base">
          <s-text-field
            label="Setting Key"
            value={newKey}
            onChange={(e) => setNewKey((e.target as HTMLInputElement).value)}
            placeholder="e.g., api_endpoint"
            autoComplete="off"
            helpText="A unique identifier for this setting"
          />
          <s-text-field
            label="Setting Value"
            value={newValue}
            onChange={(e) => setNewValue((e.target as HTMLInputElement).value)}
            placeholder="Enter value"
            autoComplete="off"
          />
          <s-button onClick={handleAddSetting} variant="primary">
            Add Setting
          </s-button>
        </s-stack>
      </s-section>

      {isSaving && (
        <s-box padding="base" borderWidth="base" borderRadius="base">
          <s-text variant="bodyMd" tone="subdued">
            Saving...
          </s-text>
        </s-box>
      )}
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};

