import type { LoaderFunctionArgs } from "react-router";
import { useEffect, useState } from "react";
import { useLoaderData, useNavigate } from "react-router";
import { authenticate } from "../shopify.server";
import { getPlanWithDevOverride } from "../utils/plan.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { billing } = await authenticate.admin(request);

  const plan = await getPlanWithDevOverride(request, billing);

  return Response.json({ plan });
};

type PlanType = "free" | "starter" | "growth";

const PLAN_THEME = {
  free: {
    accent: "#6b7280",
    softBg: "#f3f4f6",
    softBorder: "#e5e7eb",
    badgeBg: "#f3f4f6",
    badgeText: "#4b5563",
    badgeBorder: "#d1d5db",
  },
  starter: {
    accent: "#2563eb",
    softBg: "#eff6ff",
    softBorder: "#bfdbfe",
    badgeBg: "#eff6ff",
    badgeText: "#1d4ed8",
    badgeBorder: "#bfdbfe",
  },
  growth: {
    accent: "#059669",
    softBg: "#ecfdf5",
    softBorder: "#a7f3d0",
    badgeBg: "#ecfdf5",
    badgeText: "#047857",
    badgeBorder: "#a7f3d0",
  },
} as const;

type PlanCardProps = {
  title: string;
  price?: string;
  badge?: string;
  eyebrow?: string;
  descriptionLines: string[];
  buttonLabel: string;
  onClick: () => void;
  disabled?: boolean;
  highlight?: boolean;
  tone?: PlanType;
};

function StatusBadge({ label, tone }: { label: string; tone: PlanType }) {
  const theme = PLAN_THEME[tone];

  return (
    <div
      style={{
        position: "absolute",
        top: 14,
        right: 14,
        fontSize: 12,
        fontWeight: 700,
        padding: "6px 10px",
        borderRadius: 999,
        background: theme.badgeBg,
        color: theme.badgeText,
        border: `1px solid ${theme.badgeBorder}`,
      }}
    >
      {label}
    </div>
  );
}

function PlanCard({
  title,
  price,
  badge,
  eyebrow,
  descriptionLines,
  buttonLabel,
  onClick,
  disabled,
  highlight = false,
  tone = "free",
}: PlanCardProps) {
  const theme = PLAN_THEME[tone];

  return (
    <div
      style={{
        border: highlight
          ? `1.5px solid ${theme.softBorder}`
          : "1px solid #e5e7eb",
        borderRadius: 18,
        padding: 24,
        background: "#fff",
        boxShadow: highlight
          ? "0 6px 18px rgba(0,0,0,0.05)"
          : "0 1px 6px rgba(0,0,0,0.04)",
        position: "relative",
      }}
    >
      {badge ? <StatusBadge label={badge} tone={tone} /> : null}

      <div style={{ marginBottom: 14 }}>
        <div
          style={{
            fontSize: 14,
            color: highlight ? theme.accent : "#666",
            marginBottom: 8,
            fontWeight: highlight ? 700 : 500,
          }}
        >
          {title}
        </div>

        {price ? (
          <div style={{ fontSize: 34, fontWeight: 700, lineHeight: 1 }}>
            {price}
            <span style={{ fontSize: 16, color: "#666", marginLeft: 6 }}>
              / month
            </span>
          </div>
        ) : (
          <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.15 }}>
            {eyebrow || "Plan"}
          </div>
        )}
      </div>

      <div style={{ color: "#444", fontSize: 15, lineHeight: 1.75 }}>
        {descriptionLines.map((line) => (
          <div key={line}>• {line}</div>
        ))}
      </div>

      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        style={{
          marginTop: 22,
          width: "100%",
          height: 46,
          borderRadius: 12,
          border: "none",
          background: "#111",
          color: "#fff",
          fontSize: 15,
          fontWeight: 600,
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.6 : 1,
        }}
      >
        {buttonLabel}
      </button>
    </div>
  );
}

function SectionCard({
  title,
  tone,
  children,
}: {
  title: string;
  tone: PlanType;
  children: React.ReactNode;
}) {
  const theme = PLAN_THEME[tone];

  return (
    <div
      style={{
        background: "#fff",
        border: `1px solid ${theme.softBorder}`,
        borderRadius: 18,
        padding: 22,
      }}
    >
      <div
        style={{
          fontSize: 18,
          fontWeight: 800,
          marginBottom: 12,
          color: "#111",
        }}
      >
        {title}
      </div>
      <div style={{ color: "#4b5563", fontSize: 14, lineHeight: 1.75 }}>
        {children}
      </div>
    </div>
  );
}

function FeatureRow({
  label,
  free,
  starter,
  growth,
  plan,
}: {
  label: string;
  free: string;
  starter: string;
  growth: string;
  plan: PlanType;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1.5fr 1fr 1fr 1fr",
        gap: 12,
        padding: "12px 0",
        borderBottom: "1px solid #f0f0f0",
        alignItems: "center",
      }}
    >
      <div style={{ fontWeight: 600, color: "#111" }}>{label}</div>
      <div
        style={{
          color: plan === "free" ? PLAN_THEME.free.accent : "#374151",
          fontWeight: plan === "free" ? 700 : 500,
        }}
      >
        {free}
      </div>
      <div
        style={{
          color: plan === "starter" ? PLAN_THEME.starter.accent : "#374151",
          fontWeight: plan === "starter" ? 700 : 500,
        }}
      >
        {starter}
      </div>
      <div
        style={{
          color: plan === "growth" ? PLAN_THEME.growth.accent : "#374151",
          fontWeight: plan === "growth" ? 700 : 500,
        }}
      >
        {growth}
      </div>
    </div>
  );
}

function BottomCompareTable({ plan }: { plan: PlanType }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 18,
        padding: 22,
      }}
    >
      <div
        style={{
          fontSize: 18,
          fontWeight: 800,
          marginBottom: 14,
          color: "#111",
        }}
      >
        Plan comparison
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.5fr 1fr 1fr 1fr",
          gap: 12,
          paddingBottom: 12,
          borderBottom: "1px solid #e5e7eb",
          fontSize: 13,
          fontWeight: 800,
          color: "#6b7280",
          textTransform: "uppercase",
          letterSpacing: 0.3,
        }}
      >
        <div>Features</div>
        <div style={{ color: plan === "free" ? PLAN_THEME.free.accent : "#6b7280" }}>
          Free
        </div>
        <div style={{ color: plan === "starter" ? PLAN_THEME.starter.accent : "#6b7280" }}>
          Starter
        </div>
        <div style={{ color: plan === "growth" ? PLAN_THEME.growth.accent : "#6b7280" }}>
          Growth
        </div>
      </div>

      <FeatureRow label="Manual optimization" free="Limited" starter="Included" growth="Included" plan={plan} />
      <FeatureRow label="Weekly automation" free="—" starter="—" growth="Included" plan={plan} />
      <FeatureRow label="Background optimization" free="—" starter="—" growth="Included" plan={plan} />
      <FeatureRow label="Catalog growth loop" free="Preview only" starter="Manual only" growth="Active" plan={plan} />
      <FeatureRow label="Best fit" free="Evaluation" starter="Hands-on usage" growth="Ongoing automation" plan={plan} />
    </div>
  );
}

export default function UpgradePage() {
  const { plan } = useLoaderData<typeof loader>() as { plan: PlanType };
  const navigate = useNavigate();
  const [loadingPlan, setLoadingPlan] = useState<"starter" | "growth" | null>(null);

  const billingSuccess =
    typeof window !== "undefined" &&
    new URL(window.location.href).searchParams.get("billing") === "success";

  useEffect(() => {
    if (!billingSuccess) return;

    const timer = window.setTimeout(() => {
      navigate("/app");
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [billingSuccess, navigate]);

  const handleUpgrade = async (targetPlan: "starter" | "growth") => {
    try {
      setLoadingPlan(targetPlan);

      const res = await fetch("/app/billing", {
        method: "POST",
        body: new URLSearchParams({ plan: targetPlan }),
      });

      const data = await res.json();

      if (!res.ok || !data?.url) {
        console.error("Billing response error:", data);
        alert("Failed to start billing");
        setLoadingPlan(null);
        return;
      }

      open(data.url, "_top");
    } catch (error) {
      console.error("Billing error:", error);
      alert("Billing error");
      setLoadingPlan(null);
    }
  };

  return (
    <div style={{ maxWidth: 1120, margin: "0 auto", padding: "32px 20px 56px" }}>
      <button
        type="button"
        onClick={() => navigate("/app")}
        style={{
          marginBottom: 20,
          border: "1px solid #d1d5db",
          background: "#fff",
          borderRadius: 10,
          padding: "9px 14px",
          cursor: "pointer",
          fontWeight: 600,
        }}
      >
        ← Back to Dashboard
      </button>

      {billingSuccess && (
        <div
          style={{
            background: "#ecfdf5",
            border: "1px solid #a7f3d0",
            color: "#047857",
            borderRadius: 14,
            padding: "12px 16px",
            marginBottom: 20,
            fontWeight: 700,
          }}
        >
          ✅ Subscription activated successfully. Redirecting to dashboard...
        </div>
      )}

      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 32, margin: "0 0 10px" }}>Upgrade FeedPilot</h1>
        <p style={{ fontSize: 16, color: "#666", margin: 0 }}>
          {plan === "free" && "Choose the plan that fits how you want to optimize."}
          {plan === "starter" && "Starter is active. Upgrade to Growth when you want weekly automation."}
          {plan === "growth" && "Your Growth plan is active and automation is enabled."}
        </p>
      </div>

      {plan === "free" && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: 20,
              marginBottom: 24,
            }}
          >
            <PlanCard
              title="Starter"
              price="$9"
              tone="starter"
              highlight
              descriptionLines={[
                "Manual optimization access",
                "Basic workflow for paid usage",
                "Best first paid step before automation",
              ]}
              buttonLabel={loadingPlan === "starter" ? "Redirecting..." : "Start with $9"}
              onClick={() => handleUpgrade("starter")}
              disabled={loadingPlan !== null}
            />

            <PlanCard
              title="Growth"
              price="$19"
              badge="Popular"
              tone="growth"
              highlight
              descriptionLines={[
                "Weekly automatic optimization",
                "Background scan and improvement loop",
                "Continuous optimization without manual work",
              ]}
              buttonLabel={loadingPlan === "growth" ? "Redirecting..." : "Start with $19"}
              onClick={() => handleUpgrade("growth")}
              disabled={loadingPlan !== null}
            />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.1fr 1fr",
              gap: 20,
              marginBottom: 20,
            }}
          >
            <SectionCard title="How to choose" tone="free">
              <div>
                Start with <b style={{ color: PLAN_THEME.starter.accent }}>Starter</b> if you want to begin paid usage with manual optimization and confirm product value first.
              </div>
              <div style={{ marginTop: 10 }}>
                Choose <b style={{ color: PLAN_THEME.growth.accent }}>Growth</b> if you already want FeedPilot to keep working in the background every week.
              </div>
            </SectionCard>

            <SectionCard title="What changes after upgrade" tone="free">
              <div>
                <b style={{ color: PLAN_THEME.starter.accent }}>Starter</b> unlocks paid manual optimization workflow.
              </div>
              <div style={{ marginTop: 10 }}>
                <b style={{ color: PLAN_THEME.growth.accent }}>Growth</b> adds automation, weekly optimization runs, and an ongoing catalog improvement loop.
              </div>
            </SectionCard>
          </div>

          <BottomCompareTable plan={plan} />
        </>
      )}

      {plan === "starter" && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(320px, 560px)",
              gap: 20,
              marginBottom: 24,
            }}
          >
            <PlanCard
              title="Growth"
              price="$19"
              badge="Upgrade"
              tone="growth"
              highlight
              descriptionLines={[
                "Weekly automatic optimization",
                "Background scan and improvement loop",
                "Continuous optimization without manual work",
              ]}
              buttonLabel={loadingPlan === "growth" ? "Redirecting..." : "Upgrade to Growth $19"}
              onClick={() => handleUpgrade("growth")}
              disabled={loadingPlan !== null}
            />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.1fr 1fr",
              gap: 20,
              marginBottom: 20,
            }}
          >
            <SectionCard title="Included in Starter" tone="starter">
              <div>
                <span style={{ color: PLAN_THEME.starter.accent, fontWeight: 700, marginRight: 6 }}>
                  ● Active
                </span>
                Manual optimization is available.
              </div>
              <div style={{ marginTop: 10 }}>
                You are already on the paid Starter plan, so the $9 first-step purchase is complete.
              </div>
              <div style={{ marginTop: 10 }}>
                Starter is best for hands-on optimization before committing to automation.
              </div>
            </SectionCard>

            <SectionCard title="Why upgrade to Growth" tone="starter">
              <div>
                <b style={{ color: PLAN_THEME.growth.accent }}>Growth</b> keeps FeedPilot scanning and improving your catalog in the background.
              </div>
              <div style={{ marginTop: 10 }}>
                It removes the stop-and-start nature of manual optimization and turns FeedPilot into an ongoing weekly system.
              </div>
            </SectionCard>
          </div>

          <BottomCompareTable plan={plan} />
        </>
      )}

      {plan === "growth" && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(320px, 560px)",
              gap: 20,
              marginBottom: 24,
            }}
          >
            <PlanCard
              title="Growth"
              badge="Active"
              eyebrow="Current plan"
              tone="growth"
              descriptionLines={[
                "Current plan: Growth",
                "Weekly automation is enabled",
                "You can manage your plan from the app",
              ]}
              buttonLabel="Back to Dashboard"
              onClick={() => navigate("/app")}
            />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.1fr 1fr",
              gap: 20,
              marginBottom: 20,
            }}
          >
            <SectionCard title="What is active now" tone="growth">
              <div>
                <span style={{ color: PLAN_THEME.growth.accent, fontWeight: 700, marginRight: 6 }}>
                  ● Active
                </span>
                Weekly automation is enabled.
              </div>
              <div style={{ marginTop: 10 }}>
                FeedPilot can continue scanning and improving your catalog without requiring manual re-entry every time.
              </div>
              <div style={{ marginTop: 10 }}>
                This is the completed automation state of the product.
              </div>
            </SectionCard>

            <SectionCard title="Manage your Growth plan" tone="growth">
              <div>
                Use the app home to run optimization now and monitor active automation behavior.
              </div>
              <div style={{ marginTop: 10 }}>
                This page stays as a plan status page rather than another sales page.
              </div>
            </SectionCard>
          </div>
        </>
      )}
    </div>
  );
}
