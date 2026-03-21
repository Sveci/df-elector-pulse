import { AlertTriangle, TrendingDown, TrendingUp, Zap, Activity, Info, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePoAlerts, type PoAlert, type AlertLevel } from "@/hooks/public-opinion/usePoAlerts";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const levelConfig: Record<AlertLevel, {
  bg: string; border: string; icon: React.ElementType; iconColor: string; badge: string;
}> = {
  critical: {
    bg: "bg-red-50 dark:bg-red-950/30",
    border: "border-red-300 dark:border-red-700",
    icon: AlertTriangle,
    iconColor: "text-red-600",
    badge: "bg-red-100 text-red-700 border-red-200",
  },
  warning: {
    bg: "bg-amber-50 dark:bg-amber-950/30",
    border: "border-amber-300 dark:border-amber-700",
    icon: Zap,
    iconColor: "text-amber-600",
    badge: "bg-amber-100 text-amber-700 border-amber-200",
  },
  info: {
    bg: "bg-blue-50 dark:bg-blue-950/30",
    border: "border-blue-200 dark:border-blue-800",
    icon: Info,
    iconColor: "text-blue-600",
    badge: "bg-blue-100 text-blue-700 border-blue-200",
  },
};

const typeIcons: Record<PoAlert["type"], React.ElementType> = {
  sentiment_drop: TrendingDown,
  negative_spike: TrendingDown,
  mention_spike: Activity,
  positive_surge: TrendingUp,
  low_activity: Activity,
  viral_content: Zap,
};

const levelLabels: Record<AlertLevel, string> = {
  critical: "Crítico",
  warning: "Atenção",
  info: "Informação",
};

interface AlertsPanelProps {
  entityId?: string;
  maxVisible?: number;
}

export function AlertsPanel({ entityId, maxVisible = 5 }: AlertsPanelProps) {
  const { data: alerts, isLoading } = usePoAlerts(entityId);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  if (!entityId || isLoading || !alerts?.length) return null;

  const visible = alerts.filter(a => !dismissed.has(a.id)).slice(0, maxVisible);
  if (visible.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        <span className="text-sm font-semibold text-foreground">Alertas em Tempo Real</span>
        <Badge variant="secondary" className="text-xs">{visible.length}</Badge>
      </div>
      <AnimatePresence>
        {visible.map((alert) => {
          const cfg = levelConfig[alert.level];
          const LevelIcon = cfg.icon;
          const TypeIcon = typeIcons[alert.type];
          return (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, y: -8, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -8, height: 0 }}
              transition={{ duration: 0.25 }}
            >
              <div className={`relative flex items-start gap-3 rounded-lg border p-3 ${cfg.bg} ${cfg.border}`}>
                <div className={`mt-0.5 shrink-0 ${cfg.iconColor}`}>
                  <LevelIcon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-foreground">{alert.title}</span>
                    <Badge className={`text-xs border ${cfg.badge}`}>
                      {levelLabels[alert.level]}
                    </Badge>
                    <TypeIcon className={`h-3.5 w-3.5 ${cfg.iconColor}`} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{alert.description}</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    Detectado: {format(new Date(alert.detectedAt), "dd/MM 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
                  onClick={() => setDismissed(d => new Set([...d, alert.id]))}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
