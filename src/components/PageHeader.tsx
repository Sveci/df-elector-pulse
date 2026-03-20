import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  /** Extra classes for the outer wrapper */
  className?: string;
  /** data-tutorial attribute */
  dataTutorial?: string;
}

/**
 * Normalised page header with branded icon block.
 * Renders a primary-coloured icon badge followed by title + optional subtitle.
 */
export function PageHeader({
  icon: Icon,
  title,
  subtitle,
  children,
  className,
  dataTutorial,
}: PageHeaderProps) {
  return (
    <div className={cn("flex items-start gap-3", className)} data-tutorial={dataTutorial}>
      {/* Icon block */}
      <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mt-0.5">
        <Icon className="h-5 w-5 text-primary" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{title}</h1>
          {children}
        </div>
        {subtitle && (
          <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
