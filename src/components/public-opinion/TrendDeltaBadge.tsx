import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { usePoTrendDelta } from "@/hooks/public-opinion/usePoAlerts";
import { cn } from "@/lib/utils";

interface TrendDeltaBadgeProps {
  entityId?: string;
  metric: "positive" | "negative" | "mentions" | "score";
  className?: string;
}

const metricLabel: Record<TrendDeltaBadgeProps["metric"], string> = {
  positive: "sentimento positivo",
  negative: "sentimento negativo",
  mentions: "menções",
  score: "score",
};

export function TrendDeltaBadge({ entityId, metric, className }: TrendDeltaBadgeProps) {
  const { data: delta } = usePoTrendDelta(entityId);

  if (!delta) return null;

  let value: number | null = null;
  if (metric === "positive") value = delta.positiveDelta;
  else if (metric === "negative") value = delta.negativeDelta;
  else if (metric === "mentions") value = delta.mentionsDelta;
  else if (metric === "score") value = delta.scoreDelta ? delta.scoreDelta * 100 : null;

  if (value === null) return null;

  const isPositive = value > 0;
  const isNeutral = Math.abs(value) < 0.5;

  const Icon = isNeutral ? Minus : isPositive ? TrendingUp : TrendingDown;

  // For negative metric: going up is bad, going down is good
  const isGoodChange = metric === "negative" ? !isPositive : isPositive;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium rounded-full px-2 py-0.5",
        isNeutral
          ? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
          : isGoodChange
          ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
          : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
        className
      )}
      title={`Variação vs. 7 dias anteriores: ${value > 0 ? "+" : ""}${value.toFixed(1)}${metric === "mentions" ? "%" : "pp"}`}
    >
      <Icon className="h-3 w-3" />
      {isPositive ? "+" : ""}{value.toFixed(1)}{metric === "mentions" ? "%" : "pp"} 7d
    </span>
  );
}
