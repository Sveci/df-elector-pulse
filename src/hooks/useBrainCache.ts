import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/contexts/TenantContext";
import { toast } from "sonner";

export interface BrainCacheEntry {
  id: string;
  tenant_id: string;
  pergunta_original: string;
  pergunta_normalizada: string;
  resposta: string;
  resposta_tipo: string;
  categoria: string | null;
  intencao: string | null;
  origem: string;
  score_confianca: number;
  vezes_utilizada: number;
  ultima_utilizacao: string | null;
  feedback_positivo: number;
  feedback_negativo: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export function useBrainCache() {
  const { activeTenant } = useTenantContext();
  return useQuery({
    queryKey: ["brain-cache", activeTenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brain_cache")
        .select("*")
        .eq("tenant_id", activeTenant!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as BrainCacheEntry[];
    },
    enabled: !!activeTenant?.id,
    staleTime: 1000 * 60 * 2,
  });
}

export function useAddBrainCacheEntry() {
  const { activeTenant } = useTenantContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (entry: { pergunta: string; resposta: string; categoria: string }) => {
      // 1. Generate embedding via brain-embed
      const { data: embedData, error: embedError } = await supabase.functions.invoke("brain-embed", {
        body: { text: entry.pergunta },
      });
      if (embedError || !embedData?.success) {
        throw new Error(embedData?.error || embedError?.message || "Erro ao gerar embedding");
      }

      // 2. Normalize question
      const perguntaNorm = entry.pergunta
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\w\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      // 3. Insert into brain_cache
      const { error } = await supabase.from("brain_cache").insert({
        tenant_id: activeTenant!.id,
        pergunta_original: entry.pergunta,
        pergunta_normalizada: perguntaNorm,
        embedding: JSON.stringify(embedData.embeddings),
        resposta: entry.resposta,
        categoria: entry.categoria || "geral",
        origem: "manual",
        score_confianca: 0.95,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brain-cache"] });
      queryClient.invalidateQueries({ queryKey: ["brain-cache-stats"] });
      toast.success("Pergunta/resposta adicionada ao cache!");
    },
    onError: (err: any) => {
      toast.error("Erro ao salvar: " + err.message);
    },
  });
}

export function useToggleBrainCacheEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from("brain_cache")
        .update({ ativo })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brain-cache"] });
      toast.success("Status atualizado!");
    },
  });
}

export function useDeleteBrainCacheEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("brain_cache").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brain-cache"] });
      queryClient.invalidateQueries({ queryKey: ["brain-cache-stats"] });
      toast.success("Entrada removida do cache!");
    },
  });
}
