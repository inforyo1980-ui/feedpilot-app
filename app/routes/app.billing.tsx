import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { authenticate, STARTER_PLAN, GROWTH_PLAN } from "../shopify.server";

// Dev/test stores can set SHOPIFY_BILLING_TEST_MODE=true. Production defaults
// to real billing and rejects explicit test mode to avoid test charges.
function isBillingTestMode() {
  const explicit = process.env.SHOPIFY_BILLING_TEST_MODE;

  if (process.env.NODE_ENV === "production" && explicit === "true") {
    throw new Error(
      "SHOPIFY_BILLING_TEST_MODE=true is not allowed in production.",
    );
  }

  if (explicit === "true") return true;
  if (explicit === "false") return false;

  return process.env.NODE_ENV !== "production";
}

type BillingRequester = {
  request: (input: {
    plan: string;
    isTest: boolean;
    returnUrl: string;
  }) => Promise<{ confirmationUrl: string }>;
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return redirect("/app/upgrade");
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { billing, session } = await authenticate.admin(request);

  const formData = await request.formData();
  const selectedPlan = String(formData.get("plan") || "").trim();

  let plan: string;

  if (selectedPlan === "starter") {
    plan = STARTER_PLAN;
  } else if (selectedPlan === "growth") {
    plan = GROWTH_PLAN;
  } else {
    return Response.json({ error: "invalid_plan" }, { status: 400 });
  }

  const appUrl = process.env.SHOPIFY_APP_URL;

  if (!appUrl) {
    throw new Error("SHOPIFY_APP_URL is not set");
  }

  const currentUrl = new URL(request.url);
  const returnUrl = new URL("/app/upgrade", appUrl);
  returnUrl.searchParams.set("billing", "success");
  returnUrl.searchParams.set("shop", session.shop);

  const host = currentUrl.searchParams.get("host");
  if (host) {
    returnUrl.searchParams.set("host", host);
  }
  const response = await (billing as unknown as BillingRequester).request({
    plan,
    isTest: isBillingTestMode(),
    returnUrl: returnUrl.toString(),
  });

  return Response.json({ url: response.confirmationUrl });
};
