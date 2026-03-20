import { useState, useMemo } from "react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOfficeLeaders } from "@/hooks/office/useOfficeLeaders";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface LeaderAutocompleteProps {
  value?: string;
  onValueChange: (value: string) => void;
  cityId?: string;
  disabled?: boolean;
  placeholder?: string;
  allowAllLeaders?: boolean;
}

export function LeaderAutocomplete({
  value,
  onValueChange,
  cityId,
  disabled,
  placeholder = "Selecione o líder",
  allowAllLeaders = false
}: LeaderAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Remove city filter when searching to allow finding leaders from any city
  const { data: leadersResult, isLoading, isError, refetch } = useOfficeLeaders({
    cidade_id: search ? undefined : cityId,
    search: search || undefined
  });

  const leaders = leadersResult?.data || [];

  // Busca separada do líder selecionado quando não está na lista filtrada
  const { data: selectedLeaderData } = useQuery({
    queryKey: ["leader_by_id", value],
    queryFn: async () => {
      if (!value) return null;
      const { data, error } = await supabase
        .from("lideres")
        .select("id, nome_completo, cidade:office_cities(id, nome, codigo_ra)")
        .eq("id", value)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!value,
    staleTime: 5 * 60 * 1000, // Cache por 5 minutos
  });

  const selectedLeader = useMemo(() => {
    // Primeiro tenta encontrar na lista filtrada
    const fromList = leaders.find((leader) => leader.id === value);
    if (fromList) return fromList;

    // Se não encontrou, usa os dados da busca separada
    if (selectedLeaderData) {
      return {
        id: selectedLeaderData.id,
        nome_completo: selectedLeaderData.nome_completo,
        cidade: selectedLeaderData.cidade
      };
    }

    return undefined;
  }, [leaders, value, selectedLeaderData]);

  // Lista de líderes para exibir no dropdown - inclui o líder selecionado se não estiver na lista filtrada
  const displayedLeaders = useMemo(() => {
    if (selectedLeaderData && !leaders.find(l => l.id === selectedLeaderData.id)) {
      return [
        {
          id: selectedLeaderData.id,
          nome_completo: selectedLeaderData.nome_completo,
          cidade: selectedLeaderData.cidade
        },
        ...leaders
      ];
    }
    return leaders;
  }, [leaders, selectedLeaderData]);

  const hasLeaders = displayedLeaders.length > 0;
  const isDisabled = disabled || (!cityId && !allowAllLeaders);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={isDisabled || isLoading}
          onClick={isError ? () => refetch() : undefined}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Carregando...
            </>
          ) : isError ? (
            <span className="text-destructive">Erro ao carregar - Clique para tentar novamente</span>
          ) : selectedLeader ? (
            <>
              {selectedLeader.nome_completo}
              {selectedLeader.cidade && (
                <span className="ml-2 text-xs text-muted-foreground">
                  — {selectedLeader.cidade.nome}
                </span>
              )}
            </>
          ) : !cityId && !allowAllLeaders ? (
            "Selecione a cidade primeiro"
          ) : (
            placeholder
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Buscar líder..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>
              {!cityId && !allowAllLeaders
                ? "Selecione uma cidade primeiro"
                : !hasLeaders
                ? "Nenhum líder cadastrado nesta região. Cadastre um líder primeiro."
                : "Nenhum líder encontrado"}
            </CommandEmpty>
            <CommandGroup>
              {displayedLeaders?.map((leader) => (
                <CommandItem
                  key={leader.id}
                  value={leader.id}
                  onSelect={(currentValue) => {
                    onValueChange(currentValue === value ? "" : currentValue);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === leader.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col">
                    <span>{leader.nome_completo}</span>
                    {leader.cidade && (
                      <span className="text-xs text-muted-foreground">
                        {leader.cidade.nome} ({leader.cidade.codigo_ra})
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
