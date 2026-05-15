import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { runRuleBasedAutoOptimize } from "../utils/auto-optimize.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  const body = await request.json();
  const productId = String(body.productId ?? "");
  const title = String(body.title ?? "");
  const descriptionHtml = String(body.description ?? "");
  const seoScore =
    typeof body.seoScore === "number" ? body.seoScore : 0;

  if (!productId) {
    return Response.json({ error: "Missing productId" }, { status: 400 });
  }

  try {
    const result = await runRuleBasedAutoOptimize({
      admin,
      product: {
        id: productId,
        title,
        descriptionHtml,
        seoScore,
      },
      focusMode: "balanced",
    });

    return Response.json(result);
  } catch (error: any) {
    return Response.json(
      { error: error?.message || "Auto optimization failed" },
      { status: 400 },
    );
  }
};