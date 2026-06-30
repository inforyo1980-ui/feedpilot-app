import type {
  ProductGrowthOpportunity,
  ProductGrowthSnapshot,
} from "../types/productGrowth";
import {
  classifyProductGrowthIssues,
  type ProductGrowthProductInput,
  type ProductGrowthScanResult,
} from "./productGrowthClassifier";
import type { GrowthOpportunity } from "./growthOpportunityQueue";
import { getSafeFixDecision } from "./safeFixPolicy";

type SnapshotProductInput = ProductGrowthProductInput & {
  handle?: unknown;
  seoTitle?: unknown;
  metaDescription?: unknown;
  seo?: unknown;
  priceRange?: unknown;
  compareAtPrice?: unknown;
  compare_at_price?: unknown;
  variants?: unknown;
  images?: unknown;
  image?: unknown;
  featuredImage?: unknown;
};

type SnapshotOptions = {
  shop?: string;
  scannedAt?: string | Date;
  scanResult?: ProductGrowthScanResult;
};

type ProductVariantInput = {
  price?: unknown;
  compareAtPrice?: unknown;
  compare_at_price?: unknown;
  inventoryQuantity?: unknown;
  inventory_quantity?: unknown;
  available?: unknown;
};

type ProductImageInput = {
  alt?: unknown;
  altText?: unknown;
  imageAlt?: unknown;
};

const toText = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

const toFiniteNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

const toList = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

const readObjectValue = (source: unknown, key: string): unknown =>
  typeof source === "object" && source !== null
    ? (source as Record<string, unknown>)[key]
    : undefined;

const getDescription = (product: SnapshotProductInput) =>
  toText(product.description) ??
  toText(product.bodyHtml) ??
  toText(product.body_html) ??
  toText(product.descriptionHtml);

const getImages = (product: SnapshotProductInput): ProductImageInput[] => {
  const collectionImages = toList(product.images).filter(
    (image): image is ProductImageInput =>
      typeof image === "object" && image !== null,
  );
  const singleImages = [product.image, product.featuredImage].filter(
    (image): image is ProductImageInput =>
      typeof image === "object" && image !== null,
  );

  return [...collectionImages, ...singleImages];
};

const getVariants = (product: SnapshotProductInput): ProductVariantInput[] =>
  toList(product.variants).filter(
    (variant): variant is ProductVariantInput =>
      typeof variant === "object" && variant !== null,
  );

const imageMissingAlt = (image: ProductImageInput) => {
  const hasAltField =
    "alt" in image || "altText" in image || "imageAlt" in image;
  if (!hasAltField) return false;
  return (
    !toText(image.alt) && !toText(image.altText) && !toText(image.imageAlt)
  );
};

const getPrices = (
  product: SnapshotProductInput,
  variants: ProductVariantInput[],
) => {
  const prices = [
    toFiniteNumber(product.price),
    toFiniteNumber(readObjectValue(product.priceRange, "minVariantPrice")),
    toFiniteNumber(readObjectValue(product.priceRange, "maxVariantPrice")),
    ...variants.map((variant) => toFiniteNumber(variant.price)),
  ].filter((price): price is number => price !== undefined);

  return {
    minPrice: prices.length > 0 ? Math.min(...prices) : null,
    maxPrice: prices.length > 0 ? Math.max(...prices) : null,
  };
};

const getInventorySignal = (
  product: SnapshotProductInput,
  variants: ProductVariantInput[],
): ProductGrowthSnapshot["inventorySignal"] => {
  const totalInventory = toFiniteNumber(product.totalInventory);
  const inventoryQuantity = toFiniteNumber(product.inventoryQuantity);

  if ((totalInventory ?? inventoryQuantity ?? 0) > 0) return "available";
  if (totalInventory === 0 || inventoryQuantity === 0) return "unavailable";

  const variantSignals = variants.map((variant) => ({
    quantity:
      toFiniteNumber(variant.inventoryQuantity) ??
      toFiniteNumber(variant.inventory_quantity),
    available: variant.available,
  }));

  if (variantSignals.some((signal) => signal.quantity && signal.quantity > 0)) {
    return "available";
  }
  if (variantSignals.some((signal) => signal.available === true))
    return "available";
  if (
    variantSignals.length > 0 &&
    variantSignals.every(
      (signal) => signal.quantity === 0 || signal.available === false,
    )
  ) {
    return "unavailable";
  }

  return "unknown";
};

export function mapProductGrowthSnapshot(
  product: SnapshotProductInput,
  options: SnapshotOptions = {},
): ProductGrowthSnapshot {
  const scan = options.scanResult ?? classifyProductGrowthIssues(product);
  const images = getImages(product);
  const variants = getVariants(product);
  const prices = getPrices(product, variants);
  const tags = toList(product.tags)
    .map((tag) => toText(tag))
    .filter((tag): tag is string => Boolean(tag));

  return {
    shop: options.shop,
    productId:
      toText(product.productId) ??
      toText(product.id) ??
      scan.productId ??
      "unknown-product",
    title: toText(product.title) ?? scan.productTitle ?? "Untitled product",
    description: getDescription(product),
    productType: toText(product.productType) ?? toText(product.product_type),
    vendor: toText(product.vendor),
    tags,
    imageCount: images.length,
    imagesMissingAltCount: images.filter(imageMissingAlt).length,
    variantsCount: variants.length,
    minPrice: prices.minPrice,
    maxPrice: prices.maxPrice,
    compareAtPricePresent:
      Boolean(toFiniteNumber(product.compareAtPrice)) ||
      Boolean(toFiniteNumber(product.compare_at_price)) ||
      variants.some(
        (variant) =>
          toFiniteNumber(variant.compareAtPrice) !== undefined ||
          toFiniteNumber(variant.compare_at_price) !== undefined,
      ),
    inventorySignal: getInventorySignal(product, variants),
    handle: toText(product.handle),
    seoTitle:
      toText(product.seoTitle) ?? toText(readObjectValue(product.seo, "title")),
    metaDescription:
      toText(product.metaDescription) ??
      toText(readObjectValue(product.seo, "description")),
    seoHealthScore: scan.seoHealthScore,
    completenessScore: scan.completenessScore,
    feedReadinessScore: scan.feedReadinessScore,
    opportunityLevel: scan.opportunityLevel,
    issues: scan.issues,
    recommendedActions: scan.issues.map((issue) => issue.recommendedAction),
    scannedAt: options.scannedAt ?? new Date(),
  };
}

export function mapGrowthOpportunityToProductGrowthOpportunity(
  opportunity: GrowthOpportunity,
  options: { shop?: string; now?: string | Date } = {},
): ProductGrowthOpportunity {
  const decision = getSafeFixDecision(opportunity.issueCode, {
    plan: opportunity.planRequired,
  });

  return {
    id: opportunity.id,
    shop: options.shop,
    productId: opportunity.productId,
    productTitle: opportunity.productTitle,
    issueCode: opportunity.issueCode,
    category: opportunity.category,
    priority: opportunity.priority,
    title: opportunity.title,
    explanation: opportunity.explanation,
    whyItMatters: opportunity.whyItMatters,
    recommendedAction: opportunity.recommendedAction,
    actionType: opportunity.actionType,
    safeAutoFix: opportunity.safeAutoFix,
    requiresMerchantReview: decision.requiresMerchantReview,
    planRequired: opportunity.planRequired,
    status: opportunity.actionType === "monitor" ? "monitoring" : "open",
    createdAt: options.now,
    updatedAt: options.now,
  };
}

export function mapGrowthOpportunitiesToProductGrowthOpportunities(
  opportunities: GrowthOpportunity[],
  options: { shop?: string; now?: string | Date } = {},
): ProductGrowthOpportunity[] {
  return opportunities.map((opportunity) =>
    mapGrowthOpportunityToProductGrowthOpportunity(opportunity, options),
  );
}
