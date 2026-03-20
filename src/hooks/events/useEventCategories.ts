import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface EventCategory {
  id: string;
  value: string;
  label: string;
  cadastros: number;
}

// Cores padrão para categorias (baseadas no nome do tema)
const DEFAULT_CATEGORY_COLORS: Record<string, string> = {
  educacao: "bg-blue-500",
  saude: "bg-green-500",
  seguranca: "bg-red-500",
  infraestrutura: "bg-yellow-500",
  cultura: "bg-purple-500",
  esporte: "bg-orange-500",
  meio_ambiente: "bg-teal-500",
  desenvolvimento: "bg-indigo-500",
  politica: "bg-slate-500",
  prestacao_de_contas: "bg-cyan-500",
};

export function getCategoryColor(category: string): string {
  // Normaliza o valor para buscar a cor
  const normalized = category
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_");

  return DEFAULT_CATEGORY_COLORS[normalized] || "bg-gray-500";
}

export function useEventCategories() {
  return useQuery({
    queryKey: ["event-categories"],
    queryFn: async (): Promise<EventCategory[]> => {
      const { data, error } = await supabase
        .from("temas")
        .select("id, tema, cadastros")
        .order("tema", { ascending: true });

      if (error) throw error;

      return (data || []).map((tema) => ({
        id: tema.id,
        value: tema.tema
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/\s+/g, "_"),
        label: tema.tema,
        cadastros: tema.cadastros,
      }));
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
