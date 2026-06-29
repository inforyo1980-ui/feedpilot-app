type ProductGrowthReportProps = {
  productsMonitored: number;
  criticalCount: number;
  opportunityCount: number;
  avgSeoScore: number;
  avgOptimizationLift: number;
};

export function ProductGrowthReport({
  productsMonitored,
  criticalCount,
  opportunityCount,
  avgSeoScore,
  avgOptimizationLift,
}: ProductGrowthReportProps) {
  const actionCount = criticalCount + opportunityCount;
  const liftLabel = avgOptimizationLift > 0 ? `+${avgOptimizationLift}` : "0";

  return (
    <section
      style={{
        marginBottom: 22,
        padding: 18,
        border: "1px solid #dbeafe",
        borderRadius: 14,
        background: "#eff6ff",
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 800, color: "#1d4ed8", marginBottom: 6 }}>
        Product Growth Report
      </div>
      <div style={{ fontSize: 18, fontWeight: 800, color: "#111827", marginBottom: 8 }}>
        {actionCount > 0
          ? `${actionCount} products can still improve visibility`
          : "Your monitored products look stable"}
      </div>
      <div style={{ fontSize: 14, color: "#374151", lineHeight: 1.7 }}>
        FeedPilot scanned {productsMonitored} products, found {criticalCount} critical issues and {opportunityCount} growth opportunities, with an average visibility score of {avgSeoScore}. Historical optimizations show {liftLabel} average visibility lift.
      </div>
    </section>
  );
}
