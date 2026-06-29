export type GrowthIssueSeverity = "critical" | "warning" | "opportunity";

export type GrowthIssueCategory =
  | "seo"
  | "content"
  | "image"
  | "catalog_data"
  | "feed_readiness"
  | "pricing"
  | "inventory";

export type GrowthOpportunityLevel = "high" | "medium" | "low" | "healthy";

export interface GrowthIssue {
  code: string;
  severity: GrowthIssueSeverity;
  category: GrowthIssueCategory;
  title: string;
  explanation: string;
  recommendedAction: string;
  message: string;
  field?: string;
  safeAutoFix?: boolean;
}

export interface ProductGrowthScanResult {
  productId?: string;
  productTitle?: string;
  checkedAreas: GrowthIssueCategory[];
  issues: GrowthIssue[];
  issueCount: number;
  criticalCount: number;
  warningCount: number;
  opportunityCount: number;
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
  id?: unknown;
  productId?: unknown;
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
  const addIssue = (issue: GrowthIssue) => {
    issues.push({
      ...issue,
      message: issue.message || issue.explanation,
    });
  };

  const productId = readFirstText(currentProduct.productId, currentProduct.id);
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
    addIssue({
      code: "TITLE_MISSING",
      title: "Missing product title",
      explanation:
        "The product title is empty, which limits SEO context and catalog discovery readiness.",
      recommendedAction:
        "Add a clear, product-specific title before publishing or promoting this item.",
      severity: "critical",
      category: "seo",
      field: "title",
      message:
        "Product title is missing, which limits SEO and catalog discovery readiness.",
      safeAutoFix: false,
    });
  } else if (title.length < 20) {
    addIssue({
      code: "TITLE_TOO_SHORT",
      title: "Short product title",
      explanation:
        "The product title may be too brief to describe the item clearly in search, storefront, or feed contexts.",
      recommendedAction:
        "Review the title and include the product type, key attribute, or differentiator where appropriate.",
      severity: "warning",
      category: "seo",
      field: "title",
      message:
        "Product title is short and may not describe the item clearly enough for discovery.",
      safeAutoFix: true,
    });
  } else if (title.length > 80) {
    addIssue({
      code: "TITLE_TOO_LONG",
      title: "Long product title",
      explanation:
        "The product title may be truncated in storefront or feed contexts.",
      recommendedAction:
        "Review the title and keep the most useful product details near the beginning.",
      severity: "warning",
      category: "seo",
      field: "title",
      message:
        "Product title is long and may be truncated in storefront or feed contexts.",
      safeAutoFix: true,
    });
  }

  if (title && GENERIC_TITLES.has(title.toLowerCase())) {
    addIssue({
      code: "TITLE_GENERIC",
      title: "Generic product title",
      explanation:
        "The product title appears generic and may not communicate product-specific value.",
      recommendedAction:
        "Replace generic wording with a specific product name and meaningful attributes.",
      severity: "warning",
      category: "seo",
      field: "title",
      message:
        "Product title appears generic and may not communicate product-specific value.",
      safeAutoFix: true,
    });
  }

  if (!description) {
    addIssue({
      code: "DESCRIPTION_MISSING",
      title: "Missing product description",
      explanation:
        "The product description is empty, reducing SEO context and catalog completeness.",
      recommendedAction:
        "Add useful product details such as materials, fit, use cases, benefits, or care details.",
      severity: "critical",
      category: "content",
      field: "description",
      message:
        "Product description is missing, reducing SEO context and merchant catalog completeness.",
      safeAutoFix: true,
    });
  } else if (description.length < 80) {
    addIssue({
      code: "DESCRIPTION_TOO_SHORT",
      title: "Short product description",
      explanation:
        "The product description may not give shoppers or feeds enough context.",
      recommendedAction:
        "Expand the description with accurate product details that help customers evaluate the item.",
      severity: "warning",
      category: "content",
      field: "description",
      message:
        "Product description is short and may not give shoppers or feeds enough context.",
      safeAutoFix: true,
    });
  } else if (wordCount(description) < 25) {
    addIssue({
      code: "DESCRIPTION_THIN",
      title: "Thin product description",
      explanation:
        "The product description has limited detail and may miss useful growth signals.",
      recommendedAction:
        "Review the description and add helpful specifics where they are accurate.",
      severity: "opportunity",
      category: "content",
      field: "description",
      message:
        "Product description looks thin and may benefit from more useful product details.",
      safeAutoFix: true,
    });
  }

  if (images.length === 0) {
    addIssue({
      code: "PRODUCT_IMAGE_MISSING",
      title: "Missing product image",
      explanation:
        "The product has no image in the provided data, creating a major catalog completeness and feed readiness gap.",
      recommendedAction:
        "Add at least one accurate product image before relying on this item for merchandising or feeds.",
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
    addIssue({
      code: "IMAGE_ALT_MISSING",
      title: "Missing image alt text",
      explanation:
        "Image alt text is missing where alt data is available, reducing accessibility and SEO context.",
      recommendedAction:
        "Add concise, accurate alt text that describes the product image.",
      severity: "opportunity",
      category: "image",
      field: "images.alt",
      message:
        "Image alt text is missing where alt data is available, which may reduce accessibility and SEO context.",
      safeAutoFix: true,
    });
  }

  if (!productType) {
    addIssue({
      code: "PRODUCT_TYPE_MISSING",
      title: "Missing product type",
      explanation:
        "Product type is missing, making catalog grouping and growth analysis harder.",
      recommendedAction:
        "Review and assign the appropriate product type manually.",
      severity: "warning",
      category: "catalog_data",
      field: "productType",
      message:
        "Product type is missing, making catalog grouping and feed readiness harder to assess.",
      safeAutoFix: false,
    });
    addIssue({
      code: "FEED_PRODUCT_TYPE_GAP",
      title: "Feed product type gap",
      explanation:
        "A missing product type creates a feed readiness signal to review.",
      recommendedAction:
        "Add the product type manually if it is known and appropriate.",
      severity: "warning",
      category: "feed_readiness",
      field: "productType",
      message: "Feed readiness signal: product type gap detected.",
      safeAutoFix: false,
    });
  }

  if (!vendor) {
    addIssue({
      code: "VENDOR_MISSING",
      title: "Missing vendor",
      explanation:
        "Vendor is missing, reducing catalog completeness and filtering quality.",
      recommendedAction: "Review and assign the correct vendor manually.",
      severity: "warning",
      category: "catalog_data",
      field: "vendor",
      message:
        "Vendor is missing, reducing catalog completeness and filtering quality.",
      safeAutoFix: false,
    });
    addIssue({
      code: "FEED_VENDOR_GAP",
      title: "Feed vendor gap",
      explanation:
        "A missing vendor creates a feed readiness signal to review.",
      recommendedAction:
        "Add the vendor manually if it is known and appropriate.",
      severity: "warning",
      category: "feed_readiness",
      field: "vendor",
      message: "Feed readiness signal: vendor gap detected.",
      safeAutoFix: false,
    });
  }

  if (tags.length === 0) {
    addIssue({
      code: "TAGS_MISSING",
      title: "Missing product tags",
      explanation:
        "Product tags are missing, limiting segmentation and growth opportunity discovery.",
      recommendedAction: "Add accurate merchandising or catalog tags manually.",
      severity: "warning",
      category: "catalog_data",
      field: "tags",
      message:
        "Product tags are missing, limiting segmentation and growth opportunity discovery.",
      safeAutoFix: false,
    });
  } else if (tags.length < 3) {
    addIssue({
      code: "TAGS_THIN",
      title: "Thin product tags",
      explanation:
        "The product has very few tags, which may limit merchandising and growth analysis.",
      recommendedAction:
        "Review whether additional accurate tags would improve catalog organization.",
      severity: "opportunity",
      category: "catalog_data",
      field: "tags",
      message:
        "Product tags are thin and may not fully support merchandising or growth analysis.",
      safeAutoFix: false,
    });
  }

  if (images.length === 0) {
    addIssue({
      code: "FEED_IMAGE_GAP",
      title: "Feed image gap",
      explanation: "A missing image creates a feed readiness signal to review.",
      recommendedAction:
        "Add an accurate product image before using this item in feed workflows.",
      severity: "critical",
      category: "feed_readiness",
      field: "images",
      message: "Feed readiness signal: image gap detected.",
      safeAutoFix: false,
    });
  }

  if (hasPriceField(currentProduct) && !hasPriceSignal(currentProduct)) {
    addIssue({
      code: "FEED_PRICE_GAP",
      title: "Feed price gap",
      explanation:
        "Price data was expected from the current product data shape but no usable price was present.",
      recommendedAction:
        "Review price data in Shopify; do not auto-fill price from this classifier.",
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
      addIssue({
        code: "INVENTORY_SIGNAL_MISSING",
        title: "Inventory signal missing",
        explanation:
          "Inventory data was expected from the current product data shape but was not available.",
        recommendedAction:
          "Review inventory data in Shopify if inventory readiness is required for this workflow.",
        severity: "opportunity",
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
            issue.category === "catalog_data" ||
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

  const criticalCount = issues.filter(
    (issue) => issue.severity === "critical",
  ).length;
  const warningCount = issues.filter(
    (issue) => issue.severity === "warning",
  ).length;
  const opportunityCount = issues.filter(
    (issue) => issue.severity === "opportunity",
  ).length;

  return {
    productId: productId || undefined,
    productTitle: title || undefined,
    checkedAreas: [
      "seo",
      "content",
      "image",
      "catalog_data",
      "feed_readiness",
      "pricing",
      "inventory",
    ],
    issues,
    issueCount: issues.length,
    criticalCount,
    warningCount,
    opportunityCount,
    seoHealthScore,
    completenessScore,
    feedReadinessScore,
    opportunityLevel: getOpportunityLevel(issues),
  };
}
