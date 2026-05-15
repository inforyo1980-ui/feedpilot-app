import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { authenticate, STARTER_PLAN, GROWTH_PLAN } from "../shopify.server";

const BILLING_TEST_MODE = true;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return redirect("/app/upgrade");
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { billing } = await authenticate.admin(request);

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

const returnUrl = `${appUrl}/app/upgrade?billing=success`;
  const response = await billing.request({
    plan,
    isTest: BILLING_TEST_MODE,
    returnUrl,
  });

  return redirect(response.confirmationUrl);
};