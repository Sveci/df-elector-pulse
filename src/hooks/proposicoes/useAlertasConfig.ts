import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/contexts/TenantContext";
import { toast } from "sonner";

export interface AlertaConfig {
  id: string;
  tenant_id: string;
  nome: string;
  provider: "zapi" | "meta_cloud";
  tipo_destino: "individual" | "grupo_zapi";
  destino: string;
  destino_nome: string | null;
  eventos_criticos_only: boolean;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export type AlertaConfigInput = Omit<AlertaConfig, "id" | "tenant_id" | "created_at" | "updated_at">;

// ─── Listar alertas do tenant ────────────────────────────────────────────────
export function useAlertasConfig() {
  const { activeTenant } = useTenantContext();

  return useQuery({
    queryKey: ["alertas-config", activeTenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proposicoes_alertas_config")
        .select("*")
        .eq("tenant_id", activeTenant!.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as AlertaConfig[];
    },
    enabled: !!activeTenant?.id,
  });
}

// ─── Criar alerta ────────────────────────────────────────────────────────────
export function useCreateAlerta() {
  const queryClient = useQueryClient();
  const { activeTenant } = useTenantContext();

  return useMutation({
    mutationFn: async (input: AlertaConfigInput) => {
      const { data, error } = await supabase
        .from("proposicoes_alertas_config")
        .insert({ ...input, tenant_id: activeTenant!.id })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alertas-config"] });
      toast.success("Alerta criado com sucesso");
    },
    onError: (err: any) => {
      toast.error("Erro ao criar alerta: " + err.message);
    },
  });
}

// ─── Atualizar alerta ────────────────────────────────────────────────────────
export function useUpdateAlerta() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<AlertaConfig> & { id: string }) => {
      const { data, error } = await supabase
        .from("proposicoes_alertas_config")
        .update(input)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alertas-config"] });
      toast.success("Alerta atualizado");
    },
    onError: (err: any) => {
      toast.error("Erro ao atualizar alerta: " + err.message);
    },
  });
}

// ─── Deletar alerta ──────────────────────────────────────────────────────────
export function useDeleteAlerta() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("proposicoes_alertas_config")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alertas-config"] });
      toast.success("Alerta removido");
    },
    onError: (err: any) => {
      toast.error("Erro ao remover alerta: " + err.message);
    },
  });
}

// ─── Toggle ativo/inativo ────────────────────────────────────────────────────
export function useToggleAlerta() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from("proposicoes_alertas_config")
        .update({ ativo })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alertas-config"] });
    },
    onError: (err: any) => {
      toast.error("Erro ao atualizar alerta: " + err.message);
    },
  });
}

// ─── Listar grupos Z-API disponíveis ─────────────────────────────────────────
export function useZapiGroups() {
  const { activeTenant } = useTenantContext();

  return useQuery({
    queryKey: ["zapi-groups", activeTenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("list-zapi-groups", {});
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Falha ao listar grupos");
      return data.groups as Array<{ id: string; name: string; participants: number | null }>;
    },
    enabled: !!activeTenant?.id,
    staleTime: 1000 * 60 * 5,
    retry: false,
  });
}

// ─── Disparar monitoramento manualmente ─────────────────────────────────────
export function useRunMonitor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("monitor-proposicoes", {});
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["proposicoes-monitoradas"] });
      queryClient.invalidateQueries({ queryKey: ["tramitacoes-cached"] });
      toast.success(
        `Monitoramento concluído: ${data.new_tramitacoes} novas tramitações, ${data.notifications} notificações`
      );
    },
    onError: (err: any) => {
      toast.error("Erro ao executar monitoramento: " + err.message);
    },
  });
}
