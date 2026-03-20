/**
 * PageLoader – full-screen loading indicator shown during lazy-loaded
 * route transitions (Suspense fallback).
 */
export const PageLoader = () => (
  <div
    className="min-h-screen flex items-center justify-center bg-background"
    aria-label="Carregando página"
    role="status"
  >
    <div className="flex flex-col items-center gap-4">
      {/* Animated logo mark */}
      <div className="relative w-12 h-12">
        <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
        <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
      <p className="text-sm text-muted-foreground animate-pulse">
        Carregando…
      </p>
    </div>
  </div>
);
