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
  weeklyInsight: WeeklyInsight;
  optimizationHistory: HistoryItem[];
}) {
  const { weeklyInsight, optimizationHistory } = props;

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
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
            Weekly Insight
          </div>
          <div style={{ color: "#6b7280", fontSize: 14, marginBottom: 16 }}>
            Last 7 days of optimization activity.
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
            FeedPilot applied {weeklyInsight.appliedCount} optimizations in the last
            7 days. Your catalog is improving based on FeedPilot Visibility Score.
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: 12,
            }}
          >
            <MetricCard label="Applied" value={weeklyInsight.appliedCount} />
            <MetricCard label="Improved" value={weeklyInsight.improvedProducts} />
            <MetricCard label="Impact" value={weeklyInsight.totalImpactDelta} />
            <MetricCard label="Automation" value={weeklyInsight.automatedCount} />
          </div>

          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>
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
                    <div style={{ fontWeight: 700 }}>{item.titleAfter}</div>
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

                  <div style={{ marginTop: 6, color: "#6b7280", fontSize: 13 }}>
                    FeedPilot Visibility Score: {display(item.seoScoreBefore)} to{" "}
                    {display(item.seoScoreAfter)}
                  </div>
                </div>
              ))
            )}
          </div>
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
            Optimization History
          </div>
          <div style={{ color: "#6b7280", fontSize: 14, marginBottom: 16 }}>
            FeedPilot Visibility Score is based on title quality, description completeness, and content signals.
          </div>

          {optimizationHistory.length === 0 ? (
            <div style={{ color: "#6b7280", fontSize: 14 }}>
              No history yet. The next applied optimization will start building your value record.
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

                <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 10 }}>
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
  const before = isFiniteNumber(item.seoScoreBefore) ? item.seoScoreBefore : null;
  const after = isFiniteNumber(item.seoScoreAfter) ? item.seoScoreAfter : null;
  const delta = getExactLift(item);
  const isLegacyRecord = before === null;

  return (
    <div>
      <div style={{ color: "#374151", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
        FeedPilot Visibility Score
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 8,
        }}
      >
        <HistoryMetric label="Before" value={before} unavailableLabel="Not tracked" />
        <HistoryMetric label="After" value={after} unavailableLabel="Not tracked" />
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
  const { label, value, unavailableLabel, displayValue, signed = false } = props;
  const formattedValue =
    displayValue ??
    (value === null ? unavailableLabel : `${signed && value > 0 ? "+" : ""}${value}`);

  return (
    <div
      style={{
        background: "#f9fafb",
        border: "1px solid #e5e7eb",
        borderRadius: 10,
        padding: "9px 10px",
      }}
    >
      <div style={{ color: "#6b7280", fontSize: 11, marginBottom: 3 }}>{label}</div>
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

function MetricCard(props: { label: string; value: number }) {
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
  const before = isFiniteNumber(item.seoScoreBefore) ? item.seoScoreBefore : null;
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

function formatDate(value: string) {
  const date = new Date(value);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
