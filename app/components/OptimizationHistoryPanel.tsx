type HistoryItem = {
  id: string;
  source: string;
  status: string;
  impactDelta: number | null;
  seoScoreBefore: number | null;
  seoScoreAfter: number | null;
  productTitleBefore: string;
  productTitleAfter: string;
  createdAt: string;
};

type WeeklyInsight = {
  windowDays: number;
  totalOptimizations: number;
  appliedCount: number;
  failedCount: number;
  automatedCount: number;
  manualCount: number;
  lastWeeklyScanAt?: string | null;
  productsChecked?: number;
  issuesFound?: number;
  fixesApplied?: number;
  suggestionsWaiting?: number;
  skippedForSafety?: number;
  noCriticalIssuesFound?: boolean;
  improvedProducts: number;
  totalImpactDelta: number;
  avgImpactDelta: number;
  avgSeoBefore: number;
  avgSeoAfter: number;
  summaryText: string;
  topProducts: Array<{
    id: string;
    productId: string;
    titleBefore: string;
    titleAfter: string;
    impactDelta: number | null;
    seoScoreBefore: number | null;
    seoScoreAfter: number | null;
    createdAt: string;
  }>;
};

type ScoreLiftItem = {
  impactDelta: number | null;
  seoScoreBefore: number | null;
  seoScoreAfter: number | null;
};

export function OptimizationHistoryPanel(props: {
  plan: "free" | "starter" | "growth";
  weeklyInsight: WeeklyInsight;
  optimizationHistory: HistoryItem[];
}) {
  const { plan, weeklyInsight, optimizationHistory } = props;

  return (
    <div style={{ marginTop: 24 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.2fr 1fr",
          gap: 16,
          alignItems: "start",
        }}
      >
        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 16,
            padding: 20,
          }}
        >
          {plan === "growth" ? (
            <>
              <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
                Growth weekly monitoring report
              </div>
              <div style={{ color: "#6b7280", fontSize: 14, marginBottom: 16 }}>
                Weekly monitoring checks the Shopify catalog for SEO,
                visibility, and product data issues. Safe fixes are applied
                only when confidence is high; riskier changes stay as
                suggestions waiting for review.
              </div>

              <div
                style={{
                  background: "#f9fafb",
                  borderRadius: 12,
                  padding: 14,
                  fontSize: 14,
                  lineHeight: 1.7,
                  marginBottom: 16,
                }}
              >
                Last weekly scan: {formatDate(weeklyInsight.lastWeeklyScanAt)}.
                FeedPilot monitored {weeklyInsight.productsChecked ?? 0}{" "}
                products and found {weeklyInsight.issuesFound ?? 0} issue
                signals in the last 7 days.
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                  gap: 12,
                }}
              >
                <MetricCard
                  label="Products checked"
                  value={weeklyInsight.productsChecked ?? 0}
                />
                <MetricCard
                  label="Issues found"
                  value={weeklyInsight.issuesFound ?? 0}
                />
                <MetricCard
                  label="Safe fixes applied"
                  value={
                    weeklyInsight.fixesApplied ?? weeklyInsight.appliedCount
                  }
                />
                <MetricCard
                  label="Suggestions waiting"
                  value={weeklyInsight.suggestionsWaiting ?? 0}
                />
                <MetricCard
                  label="Skipped for safety"
                  value={weeklyInsight.skippedForSafety ?? 0}
                />
                <MetricCard
                  label="No critical issues"
                  value={weeklyInsight.noCriticalIssuesFound ? "Yes" : "No"}
                />
              </div>

              <div style={{ marginTop: 18 }}>
                <div
                  style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}
                >
                  Top improved products
                </div>

                {weeklyInsight.topProducts.length === 0 ? (
                  <div style={{ color: "#6b7280", fontSize: 14 }}>
                    No applied optimizations in the last 7 days.
                  </div>
                ) : (
                  weeklyInsight.topProducts.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: 12,
                        padding: 12,
                        marginBottom: 10,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          alignItems: "center",
                        }}
                      >
                        <div style={{ fontWeight: 700 }}>
                          {item.titleAfter}
                        </div>
                        <div
                          style={{
                            background: "#ecfdf3",
                            color: "#027a48",
                            border: "1px solid #abefc6",
                            borderRadius: 999,
                            padding: "4px 10px",
                            fontSize: 12,
                            fontWeight: 700,
                          }}
                        >
                          {formatExactLift(item)}
                        </div>
                      </div>

                      <div
                        style={{
                          marginTop: 6,
                          color: "#6b7280",
                          fontSize: 13,
                        }}
                      >
                        FeedPilot Visibility Score:{" "}
                        {display(item.seoScoreBefore)} to{" "}
                        {display(item.seoScoreAfter)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
                Weekly Monitoring
              </div>
              <div
                style={{
                  color: "#6b7280",
                  fontSize: 13,
                  fontWeight: 700,
                  marginBottom: 10,
                }}
              >
                Locked on {plan === "starter" ? "Starter" : "Free"}
              </div>
              <div style={{ color: "#4b5563", fontSize: 14, lineHeight: 1.6 }}>
                Growth monitors your catalog every week, applies supported safe
                fixes when confidence is high, and records review-only
                suggestions when automation is risky.
              </div>
            </>
          )}
        </div>

        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 16,
            padding: 20,
          }}
        >
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
            Growth Fix History
          </div>
          <div style={{ color: "#6b7280", fontSize: 14, marginBottom: 16 }}>
            FeedPilot keeps evidence of applied safe fixes, suggestions, and
            visibility score movement over time.
          </div>

          {optimizationHistory.length === 0 ? (
            <div style={{ color: "#6b7280", fontSize: 14 }}>
              No history yet. The next applied fix or reviewed suggestion will
              start building your growth evidence record.
            </div>
          ) : (
            optimizationHistory.map((item) => (
              <div
                key={item.id}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  padding: 12,
                  marginBottom: 10,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    marginBottom: 6,
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 14 }}>
                    {item.productTitleAfter}
                  </div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>
                    {formatDate(item.createdAt)}
                  </div>
                </div>

                <div
                  style={{ fontSize: 13, color: "#6b7280", marginBottom: 10 }}
                >
                  {item.source} - {item.status}
                </div>

                <HistoryScoreGrid item={item} />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function HistoryScoreGrid({ item }: { item: HistoryItem }) {
  const before = isFiniteNumber(item.seoScoreBefore)
    ? item.seoScoreBefore
    : null;
  const after = isFiniteNumber(item.seoScoreAfter) ? item.seoScoreAfter : null;
  const delta = getExactLift(item);
  const isLegacyRecord = before === null;

  return (
    <div>
      <div
        style={{
          color: "#374151",
          fontSize: 12,
          fontWeight: 700,
          marginBottom: 6,
        }}
      >
        FeedPilot Visibility Score
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 8,
        }}
      >
        <HistoryMetric
          label="Before"
          value={before}
          unavailableLabel="Not tracked"
        />
        <HistoryMetric
          label="After"
          value={after}
          unavailableLabel="Not tracked"
        />
        <HistoryMetric
          label="Lift"
          value={delta}
          unavailableLabel="Not tracked"
          signed
        />
      </div>

      {isLegacyRecord ? (
        <div style={{ marginTop: 8, color: "#9ca3af", fontSize: 11 }}>
          Legacy data. The original before score was not stored.
        </div>
      ) : null}
    </div>
  );
}

function HistoryMetric(props: {
  label: string;
  value: number | null;
  unavailableLabel: string;
  displayValue?: string;
  signed?: boolean;
}) {
  const {
    label,
    value,
    unavailableLabel,
    displayValue,
    signed = false,
  } = props;
  const formattedValue =
    displayValue ??
    (value === null
      ? unavailableLabel
      : `${signed && value > 0 ? "+" : ""}${value}`);

  return (
    <div
      style={{
        background: "#f9fafb",
        border: "1px solid #e5e7eb",
        borderRadius: 10,
        padding: "9px 10px",
      }}
    >
      <div style={{ color: "#6b7280", fontSize: 11, marginBottom: 3 }}>
        {label}
      </div>
      <div
        style={{
          color: value === null ? "#9ca3af" : "#111827",
          fontSize: 14,
          fontWeight: 700,
        }}
      >
        {formattedValue}
      </div>
    </div>
  );
}

function MetricCard(props: { label: string; value: number | string }) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 12,
        background: "#fff",
      }}
    >
      <div style={{ color: "#6b7280", fontSize: 12, marginBottom: 6 }}>
        {props.label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 800 }}>{props.value}</div>
    </div>
  );
}

function formatExactLift(item: ScoreLiftItem) {
  const delta = getExactLift(item);
  if (delta === null) return "Not tracked";

  return `${delta > 0 ? "+" : ""}${delta}`;
}

function getExactLift(item: ScoreLiftItem) {
  const before = isFiniteNumber(item.seoScoreBefore)
    ? item.seoScoreBefore
    : null;
  const after = isFiniteNumber(item.seoScoreAfter) ? item.seoScoreAfter : null;

  if (before === null || after === null) return null;

  return isFiniteNumber(item.impactDelta) ? item.impactDelta : after - before;
}

function display(value: number | null | undefined) {
  return isFiniteNumber(value) ? value : "-";
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function formatDate(value?: string | null) {
  if (!value) return "Not run yet";
  const date = new Date(value);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
