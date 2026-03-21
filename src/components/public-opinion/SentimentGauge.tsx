import { useMemo } from "react";

interface SentimentGaugeProps {
  score: number; // 0..10
  size?: number;
  showLabel?: boolean;
}

/**
 * Semi-circle gauge for sentiment score (0-10).
 * Renders as an SVG arc from red (0) → yellow (5) → green (10).
 */
export function SentimentGauge({ score, size = 160, showLabel = true }: SentimentGaugeProps) {
  const clampedScore = Math.max(0, Math.min(10, score));
  const pct = clampedScore / 10; // 0..1

  // SVG dimensions
  const cx = size / 2;
  const cy = size * 0.6;
  const r = size * 0.38;
  const strokeWidth = size * 0.1;

  // The arc spans 180° (from 180° to 0° in SVG coords, i.e. left to right)
  const startAngle = Math.PI; // leftmost point
  const endAngle = 0; // rightmost point

  function polarToCartesian(angle: number) {
    return {
      x: cx + r * Math.cos(angle),
      y: cy - r * Math.sin(angle),
    };
  }

  // Background arc (full 180°)
  const bgStart = polarToCartesian(startAngle);
  const bgEnd = polarToCartesian(endAngle);
  const bgPath = `M ${bgStart.x} ${bgStart.y} A ${r} ${r} 0 0 1 ${bgEnd.x} ${bgEnd.y}`;

  // Value arc (0..pct of 180°)
  const valAngle = Math.PI - pct * Math.PI;
  const valEnd = polarToCartesian(valAngle);
  const largeArc = pct > 0.5 ? 1 : 0;
  const valPath = pct === 0
    ? ""
    : pct >= 1
    ? bgPath
    : `M ${bgStart.x} ${bgStart.y} A ${r} ${r} 0 ${largeArc} 1 ${valEnd.x} ${valEnd.y}`;

  // Color interpolation: 0=red, 5=yellow, 10=green
  const color = useMemo(() => {
    if (clampedScore <= 5) {
      const t = clampedScore / 5;
      const r2 = Math.round(239 + (234 - 239) * t);
      const g = Math.round(68 + (179 - 68) * t);
      const b2 = Math.round(68 + (8 - 68) * t);
      return `rgb(${r2},${g},${b2})`;
    } else {
      const t = (clampedScore - 5) / 5;
      const r2 = Math.round(234 + (34 - 234) * t);
      const g = Math.round(179 + (197 - 179) * t);
      const b2 = Math.round(8 + (94 - 8) * t);
      return `rgb(${r2},${g},${b2})`;
    }
  }, [clampedScore]);

  // Needle
  const needleAngle = Math.PI - pct * Math.PI;
  const needleLength = r * 0.75;
  const needleEnd = {
    x: cx + needleLength * Math.cos(needleAngle),
    y: cy - needleLength * Math.sin(needleAngle),
  };

  const label =
    clampedScore >= 8 ? "Excelente" :
    clampedScore >= 6 ? "Bom" :
    clampedScore >= 4 ? "Regular" :
    clampedScore >= 2 ? "Ruim" : "Crítico";

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size * 0.65} viewBox={`0 0 ${size} ${size * 0.65}`} role="img" aria-label={`Score de sentimento: ${clampedScore}/10`}>
        {/* Gradient definition */}
        <defs>
          <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="50%" stopColor="#eab308" />
            <stop offset="100%" stopColor="#22c55e" />
          </linearGradient>
        </defs>

        {/* Background track */}
        <path
          d={bgPath}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* Value arc */}
        {valPath && (
          <path
            d={valPath}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            style={{ transition: "all 0.6s ease" }}
          />
        )}

        {/* Tick marks */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const angle = Math.PI - t * Math.PI;
          const inner = r - strokeWidth / 2 - 2;
          const outer = r + strokeWidth / 2 + 2;
          const x1 = cx + inner * Math.cos(angle);
          const y1 = cy - inner * Math.sin(angle);
          const x2 = cx + outer * Math.cos(angle);
          const y2 = cy - outer * Math.sin(angle);
          return (
            <line
              key={t}
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="hsl(var(--background))"
              strokeWidth={1.5}
            />
          );
        })}

        {/* Needle */}
        <line
          x1={cx} y1={cy}
          x2={needleEnd.x} y2={needleEnd.y}
          stroke={color}
          strokeWidth={size * 0.025}
          strokeLinecap="round"
          style={{ transition: "all 0.6s ease" }}
        />
        <circle cx={cx} cy={cy} r={size * 0.035} fill={color} style={{ transition: "all 0.6s ease" }} />

        {/* Center score text */}
        <text
          x={cx} y={cy + size * 0.05}
          textAnchor="middle"
          fontSize={size * 0.16}
          fontWeight="bold"
          fill={color}
          style={{ transition: "all 0.6s ease" }}
        >
          {clampedScore.toFixed(1)}
        </text>
        <text
          x={cx} y={cy + size * 0.16}
          textAnchor="middle"
          fontSize={size * 0.07}
          fill="hsl(var(--muted-foreground))"
        >
          /10
        </text>
      </svg>
      {showLabel && (
        <span
          className="text-sm font-semibold mt-1"
          style={{ color }}
        >
          {label}
        </span>
      )}
    </div>
  );
}
