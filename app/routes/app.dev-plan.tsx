import type { ActionFunctionArgs } from "react-router";

import {
  buildDevPlanCookie,
  isPlanType,
  type PlanType,
} from "../utils/plan.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  if (process.env.NODE_ENV === "production") {
    return Response.json({ ok: false, disabled: true }, { status: 404 });
  }

  const formData = await request.formData();
  const selectedPlan = String(formData.get("plan") ?? "").trim();
  const plan: PlanType | null = isPlanType(selectedPlan) ? selectedPlan : null;

  return Response.json(
    { ok: true, plan },
    {
      headers: {
        "Set-Cookie": buildDevPlanCookie(plan),
      },
    },
  );
};
