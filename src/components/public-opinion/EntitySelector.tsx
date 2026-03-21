import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useMonitoredEntities, type MonitoredEntity } from "@/hooks/public-opinion/usePublicOpinion";

interface EntitySelectorProps {
  value?: string; // entity id
  onChange: (entityId: string) => void;
  className?: string;
}

export function EntitySelector({ value, onChange, className }: EntitySelectorProps) {
  const { data: entities } = useMonitoredEntities();

  if (!entities || entities.length <= 1) return null;

  return (
    <Select value={value || ""} onValueChange={onChange}>
      <SelectTrigger className={className || "w-[220px]"}>
        <SelectValue placeholder="Selecionar entidade" />
      </SelectTrigger>
      <SelectContent>
        {entities.map((e: MonitoredEntity) => (
          <SelectItem key={e.id} value={e.id}>
            <div className="flex items-center gap-2">
              <span>{e.nome}</span>
              {e.is_principal && (
                <Badge variant="default" className="text-xs py-0 px-1">Principal</Badge>
              )}
              {e.partido && (
                <span className="text-xs text-muted-foreground">{e.partido}</span>
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
