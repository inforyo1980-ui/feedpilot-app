export type GrowthIssueSeverity = "critical" | "warning" | "info";

export type GrowthIssueCategory =
  | "seo"
  | "content"
  | "image"
  | "catalog_completeness"
  | "feed_readiness"
  | "pricing"
  | "inventory";

export type GrowthOpportunityLevel = "high" | "medium" | "low" | "healthy";

export interface GrowthIssue {
  code: string;
  severity: GrowthIssueSeverity;
  category: GrowthIssueCategory;
  message: string;
  field?: string;
  safeAutoFix?: boolean;
}

export interface ProductGrowthScanResult {
  issues: GrowthIssue[];
  seoHealthScore: number;
  completenessScore: number;
  feedReadinessScore: number;
  opportunityLevel: GrowthOpportunityLevel;
}

export interface ProductGrowthImageInput {
  alt?: unknown;
  altText?: unknown;
  imageAlt?: unknown;
  src?: unknown;
  url?: unknown;
}

export interface ProductGrowthVariantInput {
  price?: unknown;
  inventoryQuantity?: unknown;
  inventory_quantity?: unknown;
  available?: unknown;
}

export interface ProductGrowthProductInput {
  title?: unknown;
  description?: unknown;
  body_html?: unknown;
  bodyHtml?: unknown;
  descriptionHtml?: unknown;
  images?: unknown;
  image?: unknown;
  featuredImage?: unknown;
  productType?: unknown;
  product_type?: unknown;
  vendor?: unknown;
  tags?: unknown;
  price?: unknown;
  variants?: unknown;
  totalInventory?: unknown;
  inventoryQuantity?: unknown;
}

const GENERIC_TITLES = new Set([
  "product",
  "new product",
  "untitled",
  "test",
  "sample",
  "item",
  "default title",
]);

const clampScore = (score: number) =>
  Math.max(0, Math.min(100, Math.round(score)));

const toText = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

const stripHtml = (value: string): string =>
  value
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const wordCount = (value: string): number =>
  value.split(/\s+/).filter(Boolean).length;

const normalizeList = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    return value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  }
  return [];
};

const hasValue = (value: unknown): boolean => {
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  return value !== null && value !== undefined;
};

const readFirstText = (...values: unknown[]): string => {
  for (const value of values) {
    const text = toText(value);
    if (text) return text;
  }

  return "";
};

const readImages = (
  product: ProductGrowthProductInput,
): ProductGrowthImageInput[] => {
  const images = normalizeList(product.images).filter(
    (image): image is ProductGrowthImageInput => {
      return typeof image === "object" && image !== null;
    },
  );

  const singleImages = [product.image, product.featuredImage].filter(
    (image): image is ProductGrowthImageInput =>
      typeof image === "object" && image !== null,
  );

  return [...images, ...singleImages];
};

const imageHasAltField = (image: ProductGrowthImageInput): boolean => {
  return "alt" in image || "altText" in image || "imageAlt" in image;
};

const imageHasAltValue = (image: ProductGrowthImageInput): boolean => {
  return (
    hasValue(image.alt) || hasValue(image.altText) || hasValue(image.imageAlt)
  );
};

const hasPriceField = (product: ProductGrowthProductInput): boolean => {
  return (
    "price" in product ||
    normalizeList(product.variants).some((variant) => {
      return (
        typeof variant === "object" && variant !== null && "price" in variant
      );
    })
  );
};

const hasPriceSignal = (product: ProductGrowthProductInput): boolean => {
  if (hasValue(product.price)) return true;

  return normalizeList(product.variants).some((variant) => {
    if (typeof variant !== "object" || variant === null) return false;
    return hasValue((variant as ProductGrowthVariantInput).price);
  });
};

const hasInventorySignal = (product: ProductGrowthProductInput): boolean => {
  if (hasValue(product.totalInventory) || hasValue(product.inventoryQuantity))
    return true;

  return normalizeList(product.variants).some((variant) => {
    if (typeof variant !== "object" || variant === null) return false;
    const currentVariant = variant as ProductGrowthVariantInput;
    return (
      hasValue(currentVariant.inventoryQuantity) ||
      hasValue(currentVariant.inventory_quantity) ||
      hasValue(currentVariant.available)
    );
  });
};

const getOpportunityLevel = (issues: GrowthIssue[]): GrowthOpportunityLevel => {
  if (issues.some((issue) => issue.severity === "critical")) return "high";
  if (issues.filter((issue) => issue.severity === "warning").length >= 3)
    return "high";
  if (issues.some((issue) => issue.severity === "warning")) return "medium";
  if (issues.length > 0) return "low";
  return "healthy";
};

export function classifyProductGrowthIssues(
  product: ProductGrowthProductInput | null | undefined,
): ProductGrowthScanResult {
  const currentProduct = product ?? {};
  const issues: GrowthIssue[] = [];

  const title = readFirstText(currentProduct.title);
  const rawDescription = readFirstText(
    currentProduct.description,
    currentProduct.bodyHtml,
    currentProduct.body_html,
    currentProduct.descriptionHtml,
  );
  const description = stripHtml(rawDescription);
  const productType = readFirstText(
    currentProduct.productType,
    currentProduct.product_type,
  );
  const vendor = readFirstText(currentProduct.vendor);
  const tags = normalizeList(currentProduct.tags).filter(
    (tag) => toText(tag).length > 0,
  );
  const images = readImages(currentProduct);

  if (!title) {
    issues.push({
      code: "TITLE_MISSING",
      severity: "critical",
      category: "seo",
      field: "title",
      message:
        "Product title is missing, which limits SEO and catalog discovery readiness.",
      safeAutoFix: false,
    });
  } else if (title.length < 20) {
    issues.push({
      code: "TITLE_TOO_SHORT",
      severity: "warning",
      category: "seo",
      field: "title",
      message:
        "Product title is short and may not describe the item clearly enough for discovery.",
      safeAutoFix: true,
    });
  } else if (title.length > 80) {
    issues.push({
      code: "TITLE_TOO_LONG",
      severity: "warning",
      category: "seo",
      field: "title",
      message:
        "Product title is long and may be truncated in storefront or feed contexts.",
      safeAutoFix: true,
    });
  }

  if (title && GENERIC_TITLES.has(title.toLowerCase())) {
    issues.push({
      code: "TITLE_GENERIC",
      severity: "warning",
      category: "seo",
      field: "title",
      message:
        "Product title appears generic and may not communicate product-specific value.",
      safeAutoFix: true,
    });
  }

  if (!description) {
    issues.push({
      code: "DESCRIPTION_MISSING",
      severity: "critical",
      category: "content",
      field: "description",
      message:
        "Product description is missing, reducing SEO context and merchant catalog completeness.",
      safeAutoFix: true,
    });
  } else if (description.length < 80) {
    issues.push({
      code: "DESCRIPTION_TOO_SHORT",
      severity: "warning",
      category: "content",
      field: "description",
      message:
        "Product description is short and may not give shoppers or feeds enough context.",
      safeAutoFix: true,
    });
  } else if (wordCount(description) < 25) {
    issues.push({
      code: "DESCRIPTION_THIN",
      severity: "info",
      category: "content",
      field: "description",
      message:
        "Product description looks thin and may benefit from more useful product details.",
      safeAutoFix: true,
    });
  }

  if (images.length === 0) {
    issues.push({
      code: "IMAGE_MISSING",
      severity: "critical",
      category: "image",
      field: "images",
      message:
        "Product image is missing, creating a major catalog completeness and feed readiness gap.",
      safeAutoFix: false,
    });
  } else if (
    images.some(imageHasAltField) &&
    images.some((image) => imageHasAltField(image) && !imageHasAltValue(image))
  ) {
    issues.push({
      code: "IMAGE_ALT_MISSING",
      severity: "info",
      category: "image",
      field: "images.alt",
      message:
        "Image alt text is missing where alt data is available, which may reduce accessibility and SEO context.",
      safeAutoFix: true,
    });
  }

  if (!productType) {
    issues.push({
      code: "PRODUCT_TYPE_MISSING",
      severity: "warning",
      category: "catalog_completeness",
      field: "productType",
      message:
        "Product type is missing, making catalog grouping and feed readiness harder to assess.",
      safeAutoFix: false,
    });
    issues.push({
      code: "FEED_PRODUCT_TYPE_GAP",
      severity: "warning",
      category: "feed_readiness",
      field: "productType",
      message: "Feed readiness signal: product type gap detected.",
      safeAutoFix: false,
    });
  }

  if (!vendor) {
    issues.push({
      code: "VENDOR_MISSING",
      severity: "warning",
      category: "catalog_completeness",
      field: "vendor",
      message:
        "Vendor is missing, reducing catalog completeness and filtering quality.",
      safeAutoFix: false,
    });
    issues.push({
      code: "FEED_VENDOR_GAP",
      severity: "warning",
      category: "feed_readiness",
      field: "vendor",
      message: "Feed readiness signal: vendor gap detected.",
      safeAutoFix: false,
    });
  }

  if (tags.length === 0) {
    issues.push({
      code: "TAGS_MISSING",
      severity: "warning",
      category: "catalog_completeness",
      field: "tags",
      message:
        "Product tags are missing, limiting segmentation and growth opportunity discovery.",
      safeAutoFix: false,
    });
  } else if (tags.length < 3) {
    issues.push({
      code: "TAGS_THIN",
      severity: "info",
      category: "catalog_completeness",
      field: "tags",
      message:
        "Product tags are thin and may not fully support merchandising or growth analysis.",
      safeAutoFix: false,
    });
  }

  if (images.length === 0) {
    issues.push({
      code: "FEED_IMAGE_GAP",
      severity: "critical",
      category: "feed_readiness",
      field: "images",
      message: "Feed readiness signal: image gap detected.",
      safeAutoFix: false,
    });
  }

  if (hasPriceField(currentProduct) && !hasPriceSignal(currentProduct)) {
    issues.push({
      code: "FEED_PRICE_GAP",
      severity: "warning",
      category: "feed_readiness",
      field: "price",
      message:
        "Feed readiness signal: price data was not present in the current product data.",
      safeAutoFix: false,
    });
  }

  if (
    "totalInventory" in currentProduct ||
    "inventoryQuantity" in currentProduct ||
    normalizeList(currentProduct.variants).length > 0
  ) {
    if (!hasInventorySignal(currentProduct)) {
      issues.push({
        code: "INVENTORY_SIGNAL_MISSING",
        severity: "info",
        category: "inventory",
        field: "inventory",
        message:
          "Inventory signal was expected from the current product data shape but was not available.",
        safeAutoFix: false,
      });
    }
  }

  const seoHealthScore = clampScore(
    100 -
      issues
        .filter(
          (issue) =>
            issue.category === "seo" ||
            issue.category === "content" ||
            issue.category === "image",
        )
        .reduce(
          (score, issue) =>
            score +
            (issue.severity === "critical"
              ? 25
              : issue.severity === "warning"
                ? 12
                : 6),
          0,
        ),
  );
  const completenessScore = clampScore(
    100 -
      issues
        .filter(
          (issue) =>
            issue.category === "catalog_completeness" ||
            issue.category === "content" ||
            issue.category === "image",
        )
        .reduce(
          (score, issue) =>
            score +
            (issue.severity === "critical"
              ? 25
              : issue.severity === "warning"
                ? 12
                : 6),
          0,
        ),
  );
  const feedReadinessScore = clampScore(
    100 -
      issues
        .filter((issue) => issue.category === "feed_readiness")
        .reduce(
          (score, issue) =>
            score +
            (issue.severity === "critical"
              ? 30
              : issue.severity === "warning"
                ? 15
                : 8),
          0,
        ),
  );

  return {
    issues,
    seoHealthScore,
    completenessScore,
    feedReadinessScore,
    opportunityLevel: getOpportunityLevel(issues),
  };
}
