import React from "react";
import { Users, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useZapiGroups } from "@/hooks/proposicoes/useAlertasConfig";
import { cn } from "@/lib/utils";

interface GrupoZapiSelectorProps {
  value: string;
  onChange: (groupId: string, groupName: string) => void;
  disabled?: boolean;
  className?: string;
}

export function GrupoZapiSelector({
  value,
  onChange,
  disabled,
  className,
}: GrupoZapiSelectorProps) {
  const { data: groups, isLoading, isError, refetch, isFetching } = useZapiGroups();

  if (isLoading || isFetching) {
    return (
      <div className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}>
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Carregando grupos Z-API...</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className={cn("flex items-center gap-2 text-sm text-destructive", className)}>
        <AlertCircle className="h-4 w-4" />
        <span>Falha ao carregar grupos</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => refetch()}
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  if (!groups || groups.length === 0) {
    return (
      <div className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}>
        <Users className="h-4 w-4" />
        <span>Nenhum grupo encontrado no Z-API</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => refetch()}
          title="Atualizar lista"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Select
        value={value}
        onValueChange={(v) => {
          const group = groups.find((g) => g.id === v);
          onChange(v, group?.name || v);
        }}
        disabled={disabled}
      >
        <SelectTrigger className="flex-1">
          <SelectValue placeholder="Selecione um grupo WhatsApp" />
        </SelectTrigger>
        <SelectContent>
          {groups.map((group) => (
            <SelectItem key={group.id} value={group.id}>
              <div className="flex items-center gap-2">
                <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="truncate">{group.name}</span>
                {group.participants !== null && (
                  <span className="text-xs text-muted-foreground ml-auto shrink-0">
                    {group.participants} membros
                  </span>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 shrink-0"
        onClick={() => refetch()}
        title="Atualizar lista de grupos"
        disabled={isFetching}
      >
        <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
      </Button>
    </div>
  );
}
