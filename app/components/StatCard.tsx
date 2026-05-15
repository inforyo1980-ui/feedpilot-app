export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  const styles: Record<
    string,
    {
      background: string;
      border: string;
      accent: string;
      badgeBg: string;
      badgeText: string;
    }
  > = {
    "Products Monitored": {
      background: "#ffffff",
      border: "#e5e7eb",
      accent: "#111827",
      badgeBg: "#f3f4f6",
      badgeText: "#374151",
    },
    "Avg Optimization Lift": {
      background: "#eff6ff",
      border: "#bfdbfe",
      accent: "#1d4ed8",
      badgeBg: "#dbeafe",
      badgeText: "#1e40af",
    },
    "Critical Issues": {
      background: "#fff1f0",
      border: "#ffa39e",
      accent: "#cf1322",
      badgeBg: "#fff2f0",
      badgeText: "#a8071a",
    },
    "Optimization Opportunities": {
      background: "#fff7ed",
      border: "#fed7aa",
      accent: "#c2410c",
      badgeBg: "#ffedd5",
      badgeText: "#9a3412",
    },
  };

  const style =
    styles[label] ?? {
      background: "#ffffff",
      border: "#e5e7eb",
      accent: "#111827",
      badgeBg: "#f3f4f6",
      badgeText: "#374151",
    };

  return (
    <div
      style={{
        flex: 1,
        minWidth: 240,
        padding: 20,
        border: `1px solid ${style.border}`,
        borderRadius: 18,
        background: style.background,
        boxShadow: "0 1px 2px rgba(16,24,40,0.04)",
      }}
    >
      <div
        style={{
          display: "inline-block",
          padding: "4px 10px",
          borderRadius: 999,
          background: style.badgeBg,
          color: style.badgeText,
          fontSize: 12,
          fontWeight: 700,
          marginBottom: 12,
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontSize: 40,
          fontWeight: 800,
          lineHeight: 1,
          color: style.accent,
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </div>

      {hint ? (
        <div
          style={{
            fontSize: 12,
            color: "#667085",
            marginTop: 10,
            lineHeight: 1.5,
          }}
        >
          {hint}
        </div>
      ) : null}
    </div>
  );
}