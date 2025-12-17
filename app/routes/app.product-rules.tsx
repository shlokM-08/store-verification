import { useState, useEffect } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useFetcher, useLoaderData, redirect } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import type { RuleField, RuleOperator } from "../lib/productRules.server";
import {
  createRuleForShop,
  getRulesForShop,
  toggleRuleEnabled,
} from "../lib/productRules.server";

type RuleRow = {
  id: string;
  field: RuleField;
  operator: RuleOperator;
  value: string;
  tag: string;
  enabled: boolean;
  createdAt: string;
};

type LoaderData = {
  shopId: string;
  rules: RuleRow[];
};

type ActionData = {
  error?: string;
  ok?: boolean;
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const shop = await prisma.shop.findUnique({
    where: { shopDomain: session.shop },
    select: { id: true },
  });

  if (!shop) {
    throw new Response("Shop not found", { status: 404 });
  }

  const rules = await getRulesForShop(shop.id);

  const data: LoaderData = {
    shopId: shop.id,
    rules: rules.map((rule) => ({
      id: rule.id,
      field: rule.field as RuleField,
      operator: rule.operator as RuleOperator,
      value: rule.value,
      tag: rule.tag,
      enabled: rule.enabled,
      createdAt: rule.createdAt.toISOString(),
    })),
  };

  return data;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const shop = await prisma.shop.findUnique({
    where: { shopDomain: session.shop },
    select: { id: true },
  });

  if (!shop) {
    throw new Response("Shop not found", { status: 404 });
  }

  const formData = await request.formData();
  const intent = formData.get("_intent");

  if (intent === "create") {
    const field = formData.get("field") as RuleField | null;
    const operator = formData.get("operator") as RuleOperator | null;
    const value = String(formData.get("value") ?? "").trim();
    const tag = String(formData.get("tag") ?? "").trim();

    if (!field || !operator || value.length === 0 || tag.length === 0) {
      return { error: "All fields are required." };
    }

    try {
      await createRuleForShop(shop.id, {
        field,
        operator,
        value,
        tag,
        enabled: true,
      });

      return { ok: true };
    } catch (error) {
      console.error("Error creating rule:", error);
      return { error: "Failed to create rule. Please try again." };
    }
  }

  if (intent === "toggle") {
    const ruleId = String(formData.get("ruleId") ?? "");
    const enabled = formData.get("enabled") === "true";

    if (!ruleId) {
      return { error: "Missing rule id." };
    }

    await toggleRuleEnabled(shop.id, ruleId, enabled);
    // Same pattern: refresh rules list after toggle.
    throw redirect("/app/product-rules");
  }

  return { ok: false };
};

export default function ProductRulesPage() {
  const { rules } = useLoaderData() as LoaderData;
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  const [field, setField] = useState<RuleField>("price");
  const [operator, setOperator] = useState<RuleOperator>("gt");
  const [value, setValue] = useState("");
  const [tag, setTag] = useState("");

  // Show toast on success/error
  useEffect(() => {
    if (fetcher.data?.ok) {
      shopify.toast.show("Rule created successfully");
      // Reset form
      setValue("");
      setTag("");
      // Reload the page data
      fetcher.load("/app/product-rules");
    }
    if (fetcher.data?.error) {
      shopify.toast.show(fetcher.data.error, { isError: true });
    }
  }, [fetcher.data, shopify]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.append("_intent", "create");
    fetcher.submit(formData, { method: "post" });
  };

  const handleToggle = (ruleId: string, enabled: boolean) => {
    const formData = new FormData();
    formData.append("_intent", "toggle");
    formData.append("ruleId", ruleId);
    formData.append("enabled", String(!enabled));
    fetcher.submit(formData, { method: "post" });
  };

  const isSubmitting = fetcher.state === "submitting" || fetcher.state === "loading";

  return (
    <s-page heading="Product rules">
      <s-section heading="Auto Product Tagger rules">
        <s-card>
          <s-data-table
            columnContentTypes={["text", "text", "text", "text", "text"]}
            headings={["Field", "Operator", "Value", "Tag", "Enabled"]}
            rows={rules.map((rule) => [
              rule.field,
              rule.operator,
              rule.value,
              rule.tag,
              <s-button
                key={rule.id}
                size="slim"
                variant="tertiary"
                onClick={() => handleToggle(rule.id, rule.enabled)}
              >
                {rule.enabled ? "Disable" : "Enable"}
              </s-button>,
            ])}
          />
          {rules.length === 0 && (
            <s-box padding="base">
              <s-text tone="subdued">
                No rules configured yet. Create your first rule below.
              </s-text>
            </s-box>
          )}
        </s-card>
      </s-section>

      <s-section heading="Add rule">
        <fetcher.Form method="post" onSubmit={handleSubmit}>
          <s-stack direction="block" gap="base">
            <s-inline-stack gap="base">
              <s-box>
                <s-text as="h3" variant="headingSm">
                  Field
                </s-text>
                <select
                  name="field"
                  value={field}
                  onChange={(event) =>
                    setField(event.currentTarget.value as RuleField)
                  }
                  style={{
                    minWidth: 160,
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "4px",
                    border: "1px solid #8c9196",
                    fontSize: "14px",
                    backgroundColor: "white",
                  }}
                >
                  <option value="price">Price</option>
                  <option value="inventory">Inventory</option>
                  <option value="vendor">Vendor</option>
                </select>
              </s-box>

              <s-box>
                <s-text as="h3" variant="headingSm">
                  Operator
                </s-text>
                <select
                  name="operator"
                  value={operator}
                  onChange={(event) =>
                    setOperator(event.currentTarget.value as RuleOperator)
                  }
                  style={{
                    minWidth: 120,
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "4px",
                    border: "1px solid #8c9196",
                    fontSize: "14px",
                    backgroundColor: "white",
                  }}
                >
                  <option value="gt">&gt;</option>
                  <option value="lt">&lt;</option>
                  <option value="eq">=</option>
                </select>
              </s-box>

              <s-text-field
                name="value"
                label="Value"
                value={value}
                onChange={(event: Event) =>
                  setValue((event.currentTarget as HTMLInputElement).value)
                }
                autoComplete="off"
              />
            </s-inline-stack>

            <s-text-field
              name="tag"
              label="Tag to apply"
              value={tag}
              onChange={(event: Event) =>
                setTag((event.currentTarget as HTMLInputElement).value)
              }
              autoComplete="off"
              helpText="Tag will be added when the rule matches a product."
            />

            {fetcher.data?.error && (
              <s-text tone="critical">{fetcher.data.error}</s-text>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                padding: "8px 16px",
                backgroundColor: isSubmitting ? "#ccc" : "#008060",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: isSubmitting ? "not-allowed" : "pointer",
                fontSize: "14px",
                fontWeight: "500",
              }}
            >
              {isSubmitting ? "Adding..." : "Add rule"}
            </button>
          </s-stack>
        </fetcher.Form>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) =>
  boundary.headers(headersArgs);


