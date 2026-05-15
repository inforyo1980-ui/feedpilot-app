import type {
  LoaderFunctionArgs,
  ActionFunctionArgs,
  HeadersFunction,
} from "react-router";
import { useLoaderData, useNavigate, useFetcher } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";

type ProductDetail = {
  id: string;
  title: string;
  status: string;
  handle: string;
  price: string;
  descriptionHtml: string;
  seoScore: number;
  issues: string[];
  fixes: string[];
};

function calculateSeoScore(title: string, description: string) {
  let score = 20;

  const cleanTitle = (title || "").trim();
  const cleanDescription = (description || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  const titleWords = cleanTitle.toLowerCase().split(/\s+/).filter(Boolean);
  const uniqueTitleWords = new Set(titleWords);
  const keywordCount = titleWords.length;
  const uniqueKeywordCount = uniqueTitleWords.size;

  if (cleanTitle.length >= 25) score += 8;
  if (cleanTitle.length >= 40) score += 8;
  if (cleanTitle.length >= 60) score += 6;

  if (cleanDescription.length >= 80) score += 8;
  if (cleanDescription.length >= 160) score += 8;
  if (cleanDescription.length >= 300) score += 6;

  if (keywordCount >= 4) score += 6;
  if (keywordCount >= 7) score += 4;
  if (uniqueKeywordCount >= 4) score += 6;
  if (uniqueKeywordCount >= 7) score += 4;

  if (cleanTitle.length < 20) score -= 12;
  if (cleanDescription.length < 50) score -= 12;

  const repetitionPenalty = keywordCount - uniqueKeywordCount;
  if (repetitionPenalty >= 2) score -= repetitionPenalty * 2;

  if (cleanDescription.length > 0 && cleanDescription.length < 120) score -= 4;

  return Math.max(10, Math.min(score, 95));
}

function auditProduct(
  product: Omit<ProductDetail, "issues" | "fixes">,
): ProductDetail {
  const issues: string[] = [];
  const fixes: string[] = [];

  const title = product.title || "";
  const desc = (product.descriptionHtml || "")
    .replace(/<[^>]*>/g, " ")
    .trim();

  if (title.length < 50) {
    issues.push("Title is too short");
    fixes.push("Expand title with stronger keywords");
  }

  if (title.split(/\s+/).filter(Boolean).length < 5) {
    issues.push("Title lacks strong buyer-intent keywords");
    fixes.push("Add more relevant buyer-intent keywords");
  }

  if (desc.length < 120) {
    issues.push("Description is too weak");
    fixes.push("Improve description with features and benefits");
  }

  if (!/benefit|ideal|perfect|durable|lightweight|comfortable|performance/i.test(desc)) {
    issues.push("Description lacks persuasive conversion language");
    fixes.push("Add benefit-driven copy to improve conversion");
  }

  if (issues.length === 0) {
    issues.push("Keyword targeting can still be improved");
    fixes.push("Fine-tune title and description for stronger search intent");
  }

  return {
    ...product,
    issues,
    fixes,
  };
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const productId = decodeURIComponent(params.id || "");

  const response = await admin.graphql(
    `#graphql
    query GetProduct($id: ID!) {
      product(id: $id) {
        id
        title
        status
        handle
        descriptionHtml
        variants(first: 1) {
          edges {
            node {
              price
            }
          }
        }
      }
    }`,
    {
      variables: { id: productId },
    },
  );

  const data = await response.json();
  const node = data?.data?.product;

  if (!node) {
    throw new Response("Product not found", { status: 404 });
  }

  const title = node.title ?? "";
  const descriptionHtml = node.descriptionHtml ?? "";

  const product = auditProduct({
    id: node.id,
    title,
    status: node.status,
    handle: node.handle,
    descriptionHtml,
    price: node.variants?.edges?.[0]?.node?.price ?? "0.00",
    seoScore: calculateSeoScore(title, descriptionHtml),
  });

  return { product };
};
export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();

  const intent = String(formData.get("intent") ?? "");
  const title = String(formData.get("title") ?? "");
  const productId = String(formData.get("productId") ?? "");
  const description = String(formData.get("description") ?? "");

  if (intent === "generate") {
    if (!productId) {
      return Response.json({ error: "Missing productId" });
    }

    const scoreBefore = calculateSeoScore(title, description);

    const optimizedTitle =
      title.length < 50
        ? `${title} | High-Performance Option`
        : `${title} | Optimized for Search`;

    const optimizedDescription =
      description && description.replace(/<[^>]*>/g, " ").trim().length > 0
        ? `${description.replace(/<[^>]*>/g, " ").trim()}

Key benefits:
- Improved search visibility
- Stronger buyer intent
- More persuasive product positioning`
        : `This product is designed to deliver reliable performance and stronger buyer appeal.

Key benefits:
- Improved search visibility
- Stronger buyer intent
- More persuasive product positioning`;

    const scoreAfter = calculateSeoScore(optimizedTitle, optimizedDescription);

    return Response.json({
      parsed: {
        title: optimizedTitle,
        description: optimizedDescription,
        tags: "optimized, seo, conversion",
        score_before: scoreBefore,
        score_after: scoreAfter,
      },
    });
  }

  if (intent === "apply") {
    if (!productId) {
      return Response.json({ error: "Missing productId" });
    }

    const response = await admin.graphql(
      `#graphql
      mutation UpdateProduct($input: ProductUpdateInput!) {
        productUpdate(product: $input) {
          product {
            id
            title
            descriptionHtml
          }
          userErrors {
            field
            message
          }
        }
      }`,
      {
        variables: {
          input: {
            id: productId,
            title,
            descriptionHtml: description,
          },
        },
      },
    );

    const result = await response.json();
    const userErrors = result?.data?.productUpdate?.userErrors || [];

    if (userErrors.length > 0) {
      return Response.json({
        error: userErrors.map((e: any) => e.message).join(", "),
      });
    }

    return Response.json({
      success: true,
      applied: true,
      parsed: {
        title,
        description,
      },
    });
  }

  return Response.json({ error: "Unknown intent" });
};
export default function ProductDetailPage() {
  const { product } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const fetcher = useFetcher();
  return (
    <div style={{ padding: 20 }}>
      <button
        type="button"
        onClick={() => navigate("/app")}
        style={{ marginBottom: 16, padding: "6px 12px", cursor: "pointer" }}
      >
        ← Back
      </button>

      <h1 style={{ marginBottom: 8 }}>Product Detail Audit</h1>
      <p style={{ color: "#666", marginBottom: 20 }}>
        Review current content and prepare AI-powered improvements.
      </p>

      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: 8,
          padding: 16,
          marginBottom: 20,
        }}
      >
        <h2 style={{ marginTop: 0 }}>{product.title}</h2>
        <div>Handle: {product.handle}</div>
        <div>Status: {product.status}</div>
        <div>Price: ${product.price}</div>
        <div>SEO Score: {product.seoScore}</div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 20,
          alignItems: "start",
        }}
      >
        <div
          style={{
            border: "1px solid #ddd",
            borderRadius: 8,
            padding: 16,
            background: "#fafafa",
          }}
        >
          <h3 style={{ marginTop: 0 }}>Original Title</h3>
          <div>{product.title}</div>
        </div>

        <div
          style={{
            border: "1px solid #ddd",
            borderRadius: 8,
            padding: 16,
            background: "#fafafa",
          }}
        >
          <h3 style={{ marginTop: 0 }}>Original Description</h3>
          <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
            {product.descriptionHtml.replace(/<[^>]*>/g, " ").trim() || "No description"}
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 20,
          border: "1px solid #ddd",
          borderRadius: 8,
          padding: 16,
        }}
      >
        <h3 style={{ marginTop: 0 }}>Issues Found</h3>
        <ul>
          {product.issues.map((issue, i) => (
            <li key={i}>{issue}</li>
          ))}
        </ul>

        <h3>Recommended Fixes</h3>
        <ul>
          {product.fixes.map((fix, i) => (
            <li key={i}>{fix}</li>
          ))}
        </ul>
      </div>

           <div style={{ marginTop: 20 }}>
        <fetcher.Form method="post">
          <input type="hidden" name="intent" value="generate" />
          <input type="hidden" name="productId" value={product.id} />
          <input type="hidden" name="title" value={product.title} />
          <input
            type="hidden"
            name="description"
            value={product.descriptionHtml}
          />

          <button
            type="submit"
            style={{
              padding: "8px 14px",
              cursor: "pointer",
            }}
          >
            {fetcher.state === "submitting"
              ? "Generating..."
              : "Generate AI Optimization"}
          </button>
        </fetcher.Form>
      </div>

      {fetcher.data?.parsed && (
        <div
          style={{
            marginTop: 20,
            border: "1px solid #ddd",
            borderRadius: 8,
            padding: 16,
            background: "#f8fff9",
          }}
        >
          <h3 style={{ marginTop: 0 }}>AI Optimized Content</h3>

          <div style={{ marginBottom: 12 }}>
            <b>Optimized Title</b>
            <div>{fetcher.data.parsed.title}</div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <b>Optimized Description</b>
            <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
              {fetcher.data.parsed.description}
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <b>Tags</b>
            <div>{fetcher.data.parsed.tags}</div>
          </div>

          <div style={{ color: "#0a7" }}>
            <b>Score:</b> {fetcher.data.parsed.score_before} →{" "}
            {fetcher.data.parsed.score_after}
          </div>
<div style={{ marginTop: 12 }}>
  <fetcher.Form method="post">
    <input type="hidden" name="intent" value="apply" />
    <input type="hidden" name="productId" value={product.id} />
    <input
      type="hidden"
      name="title"
      value={fetcher.data.parsed.title}
    />
    <input
      type="hidden"
      name="description"
      value={fetcher.data.parsed.description}
    />

    <button
      type="submit"
      style={{
        padding: "8px 14px",
        background: "#000",
        color: "#fff",
        cursor: "pointer",
      }}
    >
      Apply to Shopify
    </button>
  </fetcher.Form>
</div>
        </div>
      )}
{fetcher.data?.success && (
  <div style={{ marginTop: 16, color: "green", fontWeight: 600 }}>
    ✅ Product updated successfully!
  </div>
)}
    </div>
  );
}

export const headers: HeadersFunction = (args) => {
  return boundary.headers(args);
};