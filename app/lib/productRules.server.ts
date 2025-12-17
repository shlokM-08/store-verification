import prisma from "../db.server";

// Supported fields and operators for v1
export type RuleField = "price" | "inventory" | "vendor";
export type RuleOperator = "gt" | "lt" | "eq";

export interface ProductRule {
  id: string;
  shopId: string;
  field: RuleField;
  operator: RuleOperator;
  value: string;
  tag: string;
  enabled: boolean;
  createdAt: Date;
}

export interface ProductForEvaluation {
  price?: number | null;
  totalInventory?: number | null;
  vendor?: string | null;
}

/**
 * Load all product rules for a specific shop.
 * Multi-tenant safety: always scoped by shopId.
 */
export async function getRulesForShop(shopId: string): Promise<ProductRule[]> {
  const rules = await prisma.productRule.findMany({
    where: { shopId },
    orderBy: { createdAt: "asc" },
  });

  return rules;
}

/**
 * Create a rule for a shop.
 */
export async function createRuleForShop(
  shopId: string,
  data: Omit<ProductRule, "id" | "shopId" | "createdAt">,
): Promise<ProductRule> {
  const created = await prisma.productRule.create({
    data: {
      shopId,
      field: data.field,
      operator: data.operator,
      value: data.value,
      tag: data.tag,
      enabled: data.enabled,
    },
  });

  return created;
}

/**
 * Toggle the enabled flag for a rule.
 * Multi-tenant safe: constraint on both id and shopId.
 */
export async function toggleRuleEnabled(
  shopId: string,
  ruleId: string,
  enabled: boolean,
): Promise<void> {
  await prisma.productRule.updateMany({
    where: { id: ruleId, shopId },
    data: { enabled },
  });
}

/**
 * Evaluate which tags should be applied for a given product.
 * This is deterministic and idempotent: same input -> same output.
 */
export function evaluateProductRules(
  product: ProductForEvaluation,
  rules: ProductRule[],
): string[] {
  const tags = new Set<string>();

  for (const rule of rules) {
    if (!rule.enabled) continue;

    if (evaluateSingleRule(product, rule)) {
      tags.add(rule.tag);
    }
  }

  return Array.from(tags);
}

function evaluateSingleRule(
  product: ProductForEvaluation,
  rule: ProductRule,
): boolean {
  switch (rule.field) {
    case "price": {
      if (product.price == null) return false;
      const target = parseFloat(rule.value);
      if (Number.isNaN(target)) return false;
      return compareNumeric(product.price, target, rule.operator);
    }
    case "inventory": {
      if (product.totalInventory == null) return false;
      const target = parseInt(rule.value, 10);
      if (Number.isNaN(target)) return false;
      return compareNumeric(product.totalInventory, target, rule.operator);
    }
    case "vendor": {
      if (!product.vendor) return false;
      if (rule.operator !== "eq") return false;
      return (
        product.vendor.trim().toLowerCase() ===
        rule.value.trim().toLowerCase()
      );
    }
    default:
      return false;
  }
}

function compareNumeric(
  actual: number,
  target: number,
  operator: RuleOperator,
): boolean {
  switch (operator) {
    case "gt":
      return actual > target;
    case "lt":
      return actual < target;
    case "eq":
      return actual === target;
    default:
      return false;
  }
}

/**
 * Decide final tag list given existing + rule-based tags.
 * Returns null if there is no change required (idempotent).
 */
export function mergeProductTags(
  existingTags: string[],
  ruleTags: string[],
): string[] | null {
  const set = new Set(existingTags);
  let changed = false;

  for (const tag of ruleTags) {
    if (!set.has(tag)) {
      set.add(tag);
      changed = true;
    }
  }

  return changed ? Array.from(set) : null;
}


