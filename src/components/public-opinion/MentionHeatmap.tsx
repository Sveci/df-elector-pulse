import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock } from "lucide-react";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

interface HeatmapCell {
  day: number; // 0=Sun..6=Sat
  hour: number;
  count: number;
}

function useMentionHeatmap(entityId?: string) {
  return useQuery({
    queryKey: ["po_mention_heatmap", entityId],
    enabled: !!entityId,
    staleTime: 1000 * 60 * 10,
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 30);

      // Paginate through all mentions in the last 30 days (only need published_at)
      let all: { published_at: string | null; collected_at: string }[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("po_mentions")
          .select("published_at, collected_at")
          .eq("entity_id", entityId!)
          .gte("collected_at", since.toISOString())
          .range(from, from + pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all = all.concat(data);
        if (data.length < pageSize) break;
        from += pageSize;
      }

      // Build 7×24 grid
      const grid: Record<string, number> = {};
      all.forEach((m) => {
        const rawDate = m.published_at || m.collected_at;
        if (!rawDate) return;
        const d = new Date(rawDate);
        if (isNaN(d.getTime())) return;
        const key = `${d.getDay()}-${d.getHours()}`;
        grid[key] = (grid[key] || 0) + 1;
      });

      const cells: HeatmapCell[] = [];
      for (let day = 0; day < 7; day++) {
        for (let hour = 0; hour < 24; hour++) {
          cells.push({ day, hour, count: grid[`${day}-${hour}`] || 0 });
        }
      }

      return { cells, total: all.length };
    },
  });
}

interface MentionHeatmapProps {
  entityId?: string;
}

export function MentionHeatmap({ entityId }: MentionHeatmapProps) {
  const { data, isLoading } = useMentionHeatmap(entityId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" /> Horário de Pico das Menções</CardTitle></CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
            Carregando dados...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.total === 0) return null;

  const maxCount = Math.max(...data.cells.map(c => c.count), 1);

  const getColor = (count: number) => {
    if (count === 0) return "bg-muted/30";
    const intensity = count / maxCount;
    if (intensity < 0.2) return "bg-primary/20";
    if (intensity < 0.4) return "bg-primary/40";
    if (intensity < 0.6) return "bg-primary/60";
    if (intensity < 0.8) return "bg-primary/80";
    return "bg-primary";
  };

  // Group by day for rendering
  const byDay: HeatmapCell[][] = DAYS.map((_, dayIdx) =>
    HOURS.map(hour => data.cells.find(c => c.day === dayIdx && c.hour === hour)!)
  );

  // Find peak hour across all days
  const peakCell = data.cells.reduce((best, c) => c.count > best.count ? c : best, data.cells[0]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Horário de Pico das Menções
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Distribuição de menções por hora e dia da semana (últimos 30 dias)
          {peakCell.count > 0 && (
            <> · Pico: <strong>{DAYS[peakCell.day]} às {peakCell.hour}h</strong> ({peakCell.count} menções)</>
          )}
        </p>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <div className="min-w-[640px]">
          {/* Hour header */}
          <div className="flex gap-0.5 mb-1 ml-8">
            {HOURS.map(h => (
              <div key={h} className="w-5 flex-shrink-0 text-center text-[10px] text-muted-foreground">
                {h % 3 === 0 ? `${h}h` : ""}
              </div>
            ))}
          </div>

          {/* Grid */}
          {byDay.map((row, dayIdx) => (
            <div key={dayIdx} className="flex items-center gap-0.5 mb-0.5">
              <div className="w-7 text-xs text-muted-foreground text-right pr-1 shrink-0">{DAYS[dayIdx]}</div>
              {row.map((cell, hourIdx) => (
                <div
                  key={hourIdx}
                  className={`w-5 h-5 flex-shrink-0 rounded-sm transition-colors cursor-default ${getColor(cell.count)}`}
                  title={`${DAYS[dayIdx]} ${hourIdx}h: ${cell.count} menção${cell.count !== 1 ? 'ões' : ''}`}
                />
              ))}
            </div>
          ))}

          {/* Legend */}
          <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
            <span>Menos</span>
            {[0, 0.2, 0.4, 0.6, 0.8, 1].map((t) => (
              <div
                key={t}
                className={`w-4 h-4 rounded-sm ${
                  t === 0 ? "bg-muted/30" :
                  t <= 0.2 ? "bg-primary/20" :
                  t <= 0.4 ? "bg-primary/40" :
                  t <= 0.6 ? "bg-primary/60" :
                  t <= 0.8 ? "bg-primary/80" :
                  "bg-primary"
                }`}
              />
            ))}
            <span>Mais</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
