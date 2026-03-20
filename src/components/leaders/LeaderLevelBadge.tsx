import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  useLeaderLevels,
  getLeaderLevel as getDynamicLevel,
  getNextLevel as getDynamicNextLevel,
  getProgressToNextLevel as getDynamicProgress,
  getPointsToNextLevel as getDynamicPointsToNext,
  DEFAULT_LEVELS,
  type LeaderLevel
} from "@/hooks/leaders/useLeaderLevels";

// Re-export for backward compatibility
export type { LeaderLevel };

// Static versions that use DEFAULT_LEVELS (for components that don't need dynamic levels)
export function getLeaderLevel(points: number): LeaderLevel {
  return getDynamicLevel(points, DEFAULT_LEVELS);
}

export function getNextLevel(points: number): LeaderLevel | null {
  return getDynamicNextLevel(points, DEFAULT_LEVELS);
}

export function getProgressToNextLevel(points: number): number {
  return getDynamicProgress(points, DEFAULT_LEVELS);
}

export function getPointsToNextLevel(points: number): number {
  return getDynamicPointsToNext(points, DEFAULT_LEVELS);
}

interface LeaderLevelBadgeProps {
  points: number;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  levels?: LeaderLevel[];
}

export function LeaderLevelBadge({
  points,
  showIcon = true,
  size = 'md',
  className,
  levels
}: LeaderLevelBadgeProps) {
  const { data: dynamicLevels } = useLeaderLevels();
  const activeLevels = levels || dynamicLevels || DEFAULT_LEVELS;
  const level = getDynamicLevel(points, activeLevels);

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5'
  };

  return (
    <Badge
      className={cn(
        level.bgClass,
        level.colorClass,
        'border',
        level.borderClass,
        sizeClasses[size],
        'font-semibold',
        className
      )}
      variant="outline"
    >
      {showIcon && <span className="mr-1">{level.icon}</span>}
      {level.name}
    </Badge>
  );
}

interface LeaderLevelProgressProps {
  points: number;
  showLabel?: boolean;
  className?: string;
  levels?: LeaderLevel[];
}

export function LeaderLevelProgress({
  points,
  showLabel = true,
  className,
  levels
}: LeaderLevelProgressProps) {
  const { data: dynamicLevels } = useLeaderLevels();
  const activeLevels = levels || dynamicLevels || DEFAULT_LEVELS;
  const level = getDynamicLevel(points, activeLevels);
  const nextLevel = getDynamicNextLevel(points, activeLevels);
  const progress = getDynamicProgress(points, activeLevels);
  const pointsNeeded = getDynamicPointsToNext(points, activeLevels);

  return (
    <div className={cn("space-y-1", className)}>
      {showLabel && (
        <div className="flex items-center justify-between text-xs">
          <span className={level.colorClass}>{level.icon} {level.name}</span>
          {nextLevel && (
            <span className="text-muted-foreground">
              {pointsNeeded} pts para {nextLevel.icon} {nextLevel.name}
            </span>
          )}
        </div>
      )}
      <Progress
        value={progress}
        className="h-2"
      />
    </div>
  );
}

interface LeaderLevelCardColorProps {
  points: number;
  levels?: LeaderLevel[];
}

export function getLeaderCardColorClass(points: number, levels?: LeaderLevel[]): string {
  const activeLevels = levels || DEFAULT_LEVELS;
  const level = getDynamicLevel(points, activeLevels);
  return `border-l-4 ${level.borderClass} ${level.bgClass.replace('100', '50')}/50`;
}

export { DEFAULT_LEVELS as LEADER_LEVELS };
