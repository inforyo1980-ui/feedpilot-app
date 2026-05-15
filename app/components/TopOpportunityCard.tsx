function getPriorityMeta(product: any) {
  if (product?.severity === "critical") {
    return {
      label: "Critical",
      icon: "🔥",
      color: "#cf1322",
      bg: "#fff1f0",
      border: "#ffa39e",
    };
  }

  return {
    label: "Opportunity",
    icon: "⚠",
    color: "#d46b08",
    bg: "#fff7e6",
    border: "#ffd591",
  };
}

function getImpactLevelStyle(level?: string) {
  if (level === "High") {
    return {
      color: "#cf1322",
      bg: "#fff1f0",
      border: "#ffa39e",
    };
  }

  if (level === "Medium") {
    return {
      color: "#d46b08",
      bg: "#fff7e6",
      border: "#ffd591",
    };
  }

  return {
    color: "#237804",
    bg: "#f6ffed",
    border: "#b7eb8f",
  };
}

export function TopOpportunityCard({
  product,
  index,
  isPro,
  optimizingId,
  onOptimize,
}: {
  product: any;
  index: number;
  isPro: boolean;
  optimizingId: string;
  onOptimize: (product: any) => void | Promise<void>;
}) {
  const priority = getPriorityMeta(product);
  const isCritical = product?.severity === "critical";
  const impactStyle = getImpactLevelStyle(product?.impactLevel);

  const buttonLabel =
    optimizingId === product.id
      ? "Optimizing..."
      : product?.ctaLabel || "Optimize Listing";

  return (
    <div
      style={{
        padding: "16px 0",
        borderBottom: "1px solid #eee",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "flex-start",
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 1, minWidth: 260 }}>
          {/* 标签 */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 10px",
              borderRadius: 999,
              background: priority.bg,
              border: `1px solid ${priority.border}`,
              color: priority.color,
              fontSize: 12,
              fontWeight: 700,
              marginBottom: 8,
            }}
          >
            <span>{priority.icon}</span>
            <span>{priority.label}</span>
          </div>

          {/* 标题 */}
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>
            {index + 1}. {product.title}
          </div>

          {/* SEO */}
          <div style={{ fontSize: 13, color: "#666", marginBottom: 8 }}>
            SEO Score: <b style={{ color: "#111" }}>{product.seoScore}</b>
          </div>

          {/* Impact */}
          <div style={{ marginTop: 6, color: "#a00", marginBottom: 8 }}>
            <b>Impact:</b> {product.impact}
          </div>

          {/* Impact Level */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 10px",
              borderRadius: 999,
              background: impactStyle.bg,
              border: `1px solid ${impactStyle.border}`,
              color: impactStyle.color,
              fontSize: 12,
              fontWeight: 700,
              marginBottom: 10,
            }}
          >
            Impact Level: {product.impactLevel || "Medium"}
          </div>

          {/* WHY */}
          <div style={{ marginTop: 6, fontSize: 13, color: "#666" }}>
            <b>Why this matters:</b>
            <div style={{ marginTop: 6, lineHeight: 1.7 }}>
              {product?.whyItMatters?.map((item: string, i: number) => (
                <div key={i}>• {item}</div>
              ))}
            </div>
          </div>

          {/* Outcome */}
          <div style={{ marginTop: 10, fontSize: 13, color: "#666" }}>
            <b>Expected Outcome:</b> {product.outcomeText}
          </div>

          {/* Potential */}
          <div style={{ marginTop: 10, fontSize: 13, color: "#666" }}>
            <b>Optimization Potential:</b> {product.estimatedLift}
          </div>

          {/* Action */}
          <div style={{ marginTop: 10, color: "#0a7" }}>
            <b>Recommended Action:</b> {product.recommendedAction}
          </div>

          {/* Reasons */}
          <div style={{ marginTop: 8, fontSize: 12, color: "#666" }}>
            Reasons:{" "}
            {product?.optimizationReasons?.join(", ") || "generalOpportunity"}
          </div>
        </div>

        {/* 按钮 */}
        <button
          disabled={optimizingId === product.id}
          style={{
            marginTop: 4,
            padding: "8px 14px",
            borderRadius: 8,
            border: isCritical ? "1px solid #ffa39e" : "1px solid #ccc",
            background:
              optimizingId === product.id
                ? "#f3f3f3"
                : isCritical
                ? "#fff1f0"
                : "#fff",
            cursor: optimizingId === product.id ? "not-allowed" : "pointer",
            opacity: optimizingId === product.id ? 0.7 : 1,
            fontWeight: 700,
            color: isCritical ? "#a8071a" : "#111",
          }}
          onClick={() => onOptimize(product)}
        >
          {buttonLabel}
        </button>
      </div>
    </div>
  );
}