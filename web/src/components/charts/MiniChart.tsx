interface MiniChartProps {
  data: number[];
  color?: string;
  height?: number;
  max?: number;
}

export function MiniChart({ data, color = "#06b6d4", height = 40, max }: MiniChartProps) {
  if (data.length < 2) return <div style={{ height }} className="flex items-center justify-center text-xs text-muted-foreground">-</div>;

  const w = 120;
  const h = height;
  const pad = 2;
  const effectiveMax = max ?? Math.max(...data, 1);
  const points = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2);
    const y = h - pad - (Math.min(v, effectiveMax) / effectiveMax) * (h - pad * 2);
    return `${x},${y}`;
  });

  const linePath = `M ${points.join(" L ")}`;
  const fillPath = `${linePath} L ${pad + ((data.length - 1) / (data.length - 1)) * (w - pad * 2)},${h - pad} L ${pad},${h - pad} Z`;

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0">
      <defs>
        <linearGradient id={`grad-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0.02} />
        </linearGradient>
      </defs>
      <path d={fillPath} fill={`url(#grad-${color.replace("#", "")})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
