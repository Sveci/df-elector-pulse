import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

// ─── Primitive skeletons ─────────────────────────────────────────────────────

export const SkeletonText = ({ className = "" }: { className?: string }) => (
  <Skeleton className={`h-4 rounded ${className}`} />
);

export const SkeletonTitle = ({ className = "" }: { className?: string }) => (
  <Skeleton className={`h-7 rounded ${className}`} />
);

export const SkeletonAvatar = ({ size = 10 }: { size?: number }) => (
  <Skeleton className={`h-${size} w-${size} rounded-full flex-shrink-0`} />
);

export const SkeletonButton = ({ className = "" }: { className?: string }) => (
  <Skeleton className={`h-9 w-24 rounded-md ${className}`} />
);

export const SkeletonBadge = () => (
  <Skeleton className="h-5 w-16 rounded-full" />
);

// ─── Card skeleton ────────────────────────────────────────────────────────────
export const SkeletonCard = () => (
  <Card>
    <CardHeader className="space-y-2 pb-3">
      <div className="flex items-center justify-between">
        <SkeletonTitle className="w-1/2" />
        <SkeletonBadge />
      </div>
      <SkeletonText className="w-3/4" />
    </CardHeader>
    <CardContent className="space-y-3">
      <SkeletonText className="w-full" />
      <SkeletonText className="w-5/6" />
      <SkeletonText className="w-4/5" />
      <div className="flex gap-2 pt-2">
        <SkeletonButton />
        <SkeletonButton />
      </div>
    </CardContent>
  </Card>
);

// ─── Stats row (4 metric cards) ───────────────────────────────────────────────
export const SkeletonStats = ({ count = 4 }: { count?: number }) => (
  <div className={`grid gap-4 grid-cols-2 lg:grid-cols-${count}`}>
    {Array.from({ length: count }).map((_, i) => (
      <Card key={i}>
        <CardContent className="p-6 space-y-3">
          <div className="flex items-center justify-between">
            <SkeletonText className="w-24" />
            <Skeleton className="h-8 w-8 rounded-lg" />
          </div>
          <SkeletonTitle className="w-20" />
          <SkeletonText className="w-28" />
        </CardContent>
      </Card>
    ))}
  </div>
);

// ─── Table skeleton ───────────────────────────────────────────────────────────
export const SkeletonTable = ({
  rows = 6,
  cols = 5,
}: {
  rows?: number;
  cols?: number;
}) => (
  <div className="rounded-lg border border-border overflow-hidden">
    {/* Header */}
    <div className="bg-muted/30 flex gap-4 px-4 py-3 border-b border-border">
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} className="h-4 flex-1 rounded" />
      ))}
    </div>
    {/* Rows */}
    {Array.from({ length: rows }).map((_, rowIdx) => (
      <div
        key={rowIdx}
        className="flex gap-4 px-4 py-3 border-b border-border last:border-0 hover:bg-muted/20"
      >
        {Array.from({ length: cols }).map((_, colIdx) => (
          <Skeleton
            key={colIdx}
            className={`h-4 flex-1 rounded ${colIdx === 0 ? "max-w-[160px]" : ""}`}
          />
        ))}
      </div>
    ))}
  </div>
);

// ─── List skeleton ────────────────────────────────────────────────────────────
export const SkeletonList = ({ items = 5 }: { items?: number }) => (
  <div className="space-y-3">
    {Array.from({ length: items }).map((_, i) => (
      <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-border">
        <SkeletonAvatar size={10} />
        <div className="flex-1 space-y-2">
          <SkeletonText className="w-1/3" />
          <SkeletonText className="w-2/3" />
        </div>
        <SkeletonBadge />
      </div>
    ))}
  </div>
);

// ─── Dashboard page skeleton ──────────────────────────────────────────────────
export const SkeletonDashboard = () => (
  <div className="p-6 space-y-6">
    {/* Page header */}
    <div className="flex items-center justify-between">
      <div className="space-y-2">
        <SkeletonTitle className="w-48" />
        <SkeletonText className="w-64" />
      </div>
      <div className="flex gap-2">
        <SkeletonButton />
        <SkeletonButton className="w-32" />
      </div>
    </div>
    {/* Stat cards */}
    <SkeletonStats count={4} />
    {/* Content area */}
    <div className="grid gap-6 md:grid-cols-2">
      <SkeletonCard />
      <SkeletonCard />
    </div>
    {/* Table */}
    <SkeletonTable rows={5} cols={5} />
  </div>
);

// ─── Generic page skeleton ────────────────────────────────────────────────────
export const SkeletonPage = () => (
  <div className="p-6 space-y-6">
    <div className="flex items-center justify-between">
      <div className="space-y-2">
        <SkeletonTitle className="w-40" />
        <SkeletonText className="w-60" />
      </div>
      <div className="flex gap-2">
        <SkeletonButton />
        <SkeletonButton className="w-28" />
      </div>
    </div>
    <SkeletonStats count={3} />
    <SkeletonTable rows={6} cols={4} />
  </div>
);
