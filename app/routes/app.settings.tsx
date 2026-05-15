import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import {
  Form,
  Link,
  useActionData,
  useLoaderData,
  useNavigate,
  useNavigation,
} from "react-router";
import { authenticate } from "../shopify.server";
import {
  getGrowthAutomationRule,
  upsertGrowthAutomationRule,
} from "../utils/growth-automation.server";
import { getPlan } from "../utils/plan.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { billing, session } = await authenticate.admin(request);
  const growthRule = await getGrowthAutomationRule(session.shop);
  const plan = await getPlan(billing);

  return Response.json({
    shop: session.shop,
    growthRule,
    plan,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { billing, session } = await authenticate.admin(request);
  const plan = await getPlan(billing);

  if (plan !== "growth") {
    return Response.json(
      { ok: false, error: "Growth plan required" },
      { status: 403 },
    );
  }

  const formData = await request.formData();

  const optimizeBelowScore = Number(formData.get("optimizeBelowScore") ?? 70);
  const optimizeShortTitle = formData.get("optimizeShortTitle") === "on";
  const optimizeWeakDescription =
    formData.get("optimizeWeakDescription") === "on";

  const prioritizeLowScore = formData.get("prioritizeLowScore") === "on";
  const prioritizeWeakDescription =
    formData.get("prioritizeWeakDescription") === "on";

  const maxProductsPerRun = Number(formData.get("maxProductsPerRun") ?? 5);
  const runMode = String(formData.get("runMode") ?? "suggest");
  const runFrequencyDays = Number(formData.get("runFrequencyDays") ?? 7);
  const focusMode = String(formData.get("focusMode") ?? "balanced");

  await upsertGrowthAutomationRule(session.shop, {
    optimizeBelowScore,
    optimizeShortTitle,
    optimizeWeakDescription,
    prioritizeLowScore,
    prioritizeWeakDescription,
    maxProductsPerRun,
    runMode,
    runFrequencyDays,
    focusMode,
  });

  return Response.json({
    ok: true,
    message: `Automation settings saved. Mode: ${runMode}`,
  });
};

function BackButton() {
  return (
    <div style={{ marginBottom: 16 }}>
      <Link
        to="/app"
        style={{
          display: "inline-block",
          padding: "8px 14px",
          border: "1px solid #ccc",
          borderRadius: 8,
          background: "#fff",
          textDecoration: "none",
          color: "#111",
          fontWeight: 700,
        }}
      >
        ← Back to Dashboard
      </Link>
    </div>
  );
}

function LockedPlanCard({
  plan,
  shop,
  growthRule,
  navigate,
}: {
  plan: "free" | "starter" | "growth";
  shop: string;
  growthRule: any;
  navigate: (path: string) => void;
}) {
  return (
    <div style={{ padding: 24, maxWidth: 980 }}>
      <BackButton />

      <div
        style={{
          borderRadius: 18,
          padding: 24,
          background: "#f8fafc",
          border: "1px solid #e5e7eb",
          marginBottom: 20,
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 800,
            color: plan === "starter" ? "#2563eb" : "#6b7280",
            letterSpacing: "0.05em",
            marginBottom: 8,
          }}
        >
          AUTOMATION CONTROL
        </div>

        <h1 style={{ marginTop: 0, marginBottom: 10 }}>
          {plan === "starter"
            ? "Growth unlocks automatic optimization"
            : "Automation is locked on Free"}
        </h1>

        <p style={{ color: "#4b5563", marginTop: 0, lineHeight: 1.7 }}>
          {plan === "starter"
            ? "Starter gives you manual optimization. Growth keeps FeedPilot scanning and improving your catalog automatically every week."
            : "Free lets you review opportunities, but saved automation rules and weekly AI optimization are available on paid plans."}
        </p>
     </div>





<div style={{ display: "grid", gap: 20 }}>
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 14,
            padding: 20,
            background: "#fff",
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 12 }}>
            Current Rule Preview
          </div>

          <div style={{ marginBottom: 8 }}>
            Connected shop: <b>{shop}</b>
          </div>
          <div style={{ marginBottom: 8 }}>
            Optimize below score: <b>{growthRule.optimizeBelowScore}</b>
          </div>
          <div style={{ marginBottom: 8 }}>
            Short title optimization:{" "}
            <b>{growthRule.optimizeShortTitle ? "On" : "Off"}</b>
          </div>
          <div style={{ marginBottom: 8 }}>
            Weak description optimization:{" "}
            <b>{growthRule.optimizeWeakDescription ? "On" : "Off"}</b>
          </div>
          <div style={{ marginBottom: 8 }}>
            Max products per run: <b>{growthRule.maxProductsPerRun}</b>
          </div>
          <div style={{ marginBottom: 8 }}>
            Frequency: <b>Every {growthRule.runFrequencyDays} day(s)</b>
          </div>
          <div style={{ marginBottom: 8 }}>
            Focus: <b>{growthRule.focusMode}</b>
          </div>
        </div>

        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 14,
            padding: 20,
            background: "#fff",
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 10 }}>
            {plan === "starter"
              ? "Upgrade to Growth to activate this system"
              : "Choose a paid plan to unlock automation"}
          </div>

          <div style={{ color: "#666", lineHeight: 1.7, marginBottom: 16 }}>
            Growth turns FeedPilot into an automatic optimization system that
            monitors weak listings, applies AI improvements, and records every
            change as proof of ongoing value.
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => navigate("/app/upgrade?reason=automation_unlock")}
              style={{
                padding: "12px 18px",
                borderRadius: 10,
                border: "none",
                background: "#111827",
                color: "#fff",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {plan === "starter"
                ? "Enable Auto Optimization"
                : "View Paid Plans"}
            </button>

            <button
              type="button"
              onClick={() => navigate("/app")}
              style={{
                padding: "12px 18px",
                borderRadius: 10,
                border: "1px solid #d1d5db",
                background: "#fff",
                color: "#111827",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { shop, growthRule, plan } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const navigate = useNavigate();

  if (plan === "free" || plan === "starter") {
    return (
      <LockedPlanCard
        plan={plan}
        shop={shop}
        growthRule={growthRule}
        navigate={navigate}
      />
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>
      {navigation.state === "submitting" && (
        <div
          style={{
            marginBottom: 16,
            padding: "12px 16px",
            borderRadius: 10,
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            color: "#1d4ed8",
            fontWeight: 700,
          }}
        >
          Saving automation settings...
        </div>
      )}

      {actionData?.ok && (
        <div
          style={{
            marginBottom: 16,
            padding: "12px 16px",
            borderRadius: 10,
            background: "#ecfdf3",
            border: "1px solid #abefc6",
            color: "#027a48",
            fontWeight: 700,
          }}
        >
          {actionData.message}
        </div>
      )}

      <BackButton />

      <div
        style={{
          marginBottom: 24,
          borderRadius: 18,
          padding: 24,
          background: "#f0fdf4",
          border: "1px solid #bbf7d0",
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 800,
            color: "#15803d",
            letterSpacing: "0.05em",
            marginBottom: 8,
          }}
        >
          GROWTH AUTOMATION CENTER
        </div>

        <h1
          style={{
            margin: 0,
            marginBottom: 10,
            fontSize: 28,
            lineHeight: 1.2,
            color: "#111827",
          }}
        >
          FeedPilot is optimizing your catalog automatically
        </h1>

        <p
          style={{
            color: "#4b5563",
            fontSize: 15,
            lineHeight: 1.7,
            maxWidth: 780,
            marginTop: 0,
            marginBottom: 20,
          }}
        >
          FeedPilot continuously monitors weak listings, applies AI-powered
          improvements, and helps prevent ranking decay before product
          visibility drops.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
            gap: 14,
          }}
        >
          <div style={statusCardStyle}>
            <div style={metricLabelStyle}>Status</div>
            <div style={{ ...metricValueStyle, color: "#16a34a" }}>
              ● Active
            </div>
          </div>

          <div style={statusCardStyle}>
            <div style={metricLabelStyle}>Frequency</div>
            <div style={metricValueStyle}>
              Every {growthRule.runFrequencyDays} days
            </div>
          </div>

          <div style={statusCardStyle}>
            <div style={metricLabelStyle}>Optimization mode</div>
            <div style={{ ...metricValueStyle, textTransform: "capitalize" }}>
              {growthRule.focusMode}
            </div>
          </div>

          <div style={statusCardStyle}>
            <div style={metricLabelStyle}>Max products per run</div>
            <div style={metricValueStyle}>{growthRule.maxProductsPerRun}</div>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gap: 20 }}>
        <div style={sectionCardStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <div style={sectionEyebrowStyle}>OPTIMIZATION STRATEGY</div>
              <h2 style={sectionTitleStyle}>Control what FeedPilot improves</h2>
            </div>
          </div>

          <Form method="post">
            <div style={formGridStyle}>
              <div>
                <div style={labelStyle}>Optimize when SEO score is below</div>
                <input
                  type="number"
                  name="optimizeBelowScore"
                  min={10}
                  max={100}
                  defaultValue={growthRule.optimizeBelowScore}
                  style={inputStyle}
                />
              </div>

              <div>
                <div style={labelStyle}>Max products per run</div>
                <input
                  type="number"
                  name="maxProductsPerRun"
                  min={1}
                  max={50}
                  defaultValue={growthRule.maxProductsPerRun}
                  style={inputStyle}
                />
              </div>

              <div>
                <div style={labelStyle}>Review frequency (days)</div>
                <input
                  type="number"
                  name="runFrequencyDays"
                  min={1}
                  max={30}
                  defaultValue={growthRule.runFrequencyDays}
                  style={inputStyle}
                />
              </div>

              <div>
                <div style={labelStyle}>Optimization mode</div>
                <select
                  name="runMode"
                  defaultValue={growthRule.runMode}
                  style={selectStyle}
                >
                  <option value="suggest">Recommend changes only</option>
                  <option value="auto">Apply changes automatically</option>
                </select>
              </div>

              <div>
                <div style={labelStyle}>Focus mode</div>
                <select
                  name="focusMode"
                  defaultValue={growthRule.focusMode}
                  style={selectStyle}
                >
                  <option value="balanced">Safe SEO optimization</option>
                  <option value="seo">Aggressive ranking optimization</option>
                  <option value="conversion">
                    Conversion-focused optimization
                  </option>
                </select>
              </div>
            </div>

            <div style={{ marginTop: 24 }}>
              <div style={labelStyle}>Optimization conditions</div>

              <label style={checkboxStyle}>
                <input
                  type="checkbox"
                  name="optimizeShortTitle"
                  defaultChecked={growthRule.optimizeShortTitle}
                />{" "}
                Optimize short titles
              </label>

              <label style={checkboxStyle}>
                <input
                  type="checkbox"
                  name="optimizeWeakDescription"
                  defaultChecked={growthRule.optimizeWeakDescription}
                />{" "}
                Optimize weak descriptions
              </label>
            </div>

            <div style={{ marginTop: 24 }}>
              <div style={labelStyle}>Priority rules</div>

              <label style={checkboxStyle}>
                <input
                  type="checkbox"
                  name="prioritizeLowScore"
                  defaultChecked={growthRule.prioritizeLowScore}
                />{" "}
                Prioritize lower-score products first
              </label>

              <label style={checkboxStyle}>
                <input
                  type="checkbox"
                  name="prioritizeWeakDescription"
                  defaultChecked={growthRule.prioritizeWeakDescription}
                />{" "}
                Prioritize weak descriptions first
              </label>
            </div>

            <button
              type="submit"
              style={{
                marginTop: 26,
                padding: "12px 18px",
                borderRadius: 10,
                border: "none",
                background: "#16a34a",
                color: "#fff",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              Save Automation Settings
            </button>
          </Form>
        </div>

        <div style={sectionCardStyle}>
          <div style={sectionEyebrowStyle}>CURRENT RULE</div>
          <h2 style={sectionTitleStyle}>Active automation configuration</h2>

          <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
            <div>
              Connected shop: <b>{shop}</b>
            </div>
            <div>
              Optimize below score: <b>{growthRule.optimizeBelowScore}</b>
            </div>
            <div>
              Short title optimization:{" "}
              <b>{growthRule.optimizeShortTitle ? "On" : "Off"}</b>
            </div>
            <div>
              Weak description optimization:{" "}
              <b>{growthRule.optimizeWeakDescription ? "On" : "Off"}</b>
            </div>
            <div>
              Prioritize low score:{" "}
              <b>{growthRule.prioritizeLowScore ? "On" : "Off"}</b>
            </div>
            <div>
              Prioritize weak description:{" "}
              <b>{growthRule.prioritizeWeakDescription ? "On" : "Off"}</b>
            </div>
            <div>
              Max products per run: <b>{growthRule.maxProductsPerRun}</b>
            </div>
            <div>
              Mode: <b>{growthRule.runMode}</b>
            </div>
            <div>
              Frequency: <b>Every {growthRule.runFrequencyDays} day(s)</b>
            </div>
            <div>
              Focus: <b>{growthRule.focusMode}</b>
            </div>
          </div>
        </div>

        <div
          style={{
            border: "1px solid #bbf7d0",
            borderRadius: 14,
            padding: 20,
            background: "#f0fdf4",
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 8 }}>
            FeedPilot keeps working after you close the app
          </div>
          <div style={{ color: "#4b5563", lineHeight: 1.7 }}>
            Automatic optimization history is recorded so you can track how
            FeedPilot improves product visibility over time. Your Growth plan
            keeps the catalog moving forward without requiring manual re-entry.
          </div>
        </div>
      </div>
    </div>
  );
}

const statusCardStyle = {
  background: "#fff",
  border: "1px solid #bbf7d0",
  borderRadius: 14,
  padding: 16,
};

const metricLabelStyle = {
  fontSize: 12,
  color: "#6b7280",
  marginBottom: 6,
};

const metricValueStyle = {
  color: "#111827",
  fontWeight: 800,
  fontSize: 18,
};

const sectionCardStyle = {
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  padding: 22,
  background: "#fff",
};

const sectionHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  marginBottom: 20,
};

const sectionEyebrowStyle = {
  fontSize: 12,
  fontWeight: 800,
  color: "#16a34a",
  letterSpacing: "0.05em",
  marginBottom: 6,
};

const sectionTitleStyle = {
  margin: 0,
  fontSize: 20,
  color: "#111827",
};

const formGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
  gap: 18,
};

const labelStyle = {
  fontWeight: 700,
  marginBottom: 8,
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box" as const,
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #ccc",
};

const selectStyle = {
  width: "100%",
  boxSizing: "border-box" as const,
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #ccc",
  background: "#fff",
};

const checkboxStyle = {
  display: "block",
  marginBottom: 10,
};