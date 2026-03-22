import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Types
export interface ChatbotConfig {
  id: string;
  is_enabled: boolean;
  use_ai_for_unknown: boolean;
  welcome_message: string | null;
  fallback_message: string | null;
  ai_system_prompt: string | null;
  max_messages_per_hour: number;
  created_at: string;
  updated_at: string;
}

export interface ChatbotKeyword {
  id: string;
  keyword: string;
  aliases: string[];
  description: string | null;
  response_type: "static" | "dynamic" | "ai";
  static_response: string | null;
  dynamic_function: string | null;
  is_active: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
}

export interface ChatbotLog {
  id: string;
  leader_id: string | null;
  phone: string;
  message_in: string;
  message_out: string | null;
  keyword_matched: string | null;
  response_type: string | null;
  processing_time_ms: number | null;
  error_message: string | null;
  created_at: string;
  leader?: {
    nome_completo: string;
  };
}

export interface ChatbotSession {
  id: string;
  phone: string;
  tenant_id: string;
  first_message_at: string;
  registration_state: string | null;
  registration_completed_at: string | null;
  registration_asked_at: string | null;
  collected_name: string | null;
  collected_email: string | null;
  collected_city: string | null;
  last_keyword_at: string | null;
  event_reg_state: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatbotStats {
  total_interactions: number;
  interactions_24h: number;
  interactions_7d: number;
  unique_users: number;
  unique_users_24h: number;
  ai_responses: number;
  dynamic_responses: number;
  static_responses: number;
  fallback_responses: number;
  avg_processing_ms: number | null;
  last_interaction_at: string | null;
}

// Hook for chatbot config
export function useChatbotConfig() {
  return useQuery({
    queryKey: ["chatbot-config"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("whatsapp_chatbot_config")
        .select("*")
        .limit(1)
        .single();

      if (error) throw error;
      return data as ChatbotConfig;
    }
  });
}

// Hook for updating chatbot config
export function useUpdateChatbotConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: Partial<ChatbotConfig>) => {
      const { data: existing } = await (supabase as any)
        .from("whatsapp_chatbot_config")
        .select("id")
        .limit(1)
        .single();

      if (!existing) {
        const { data, error } = await (supabase as any)
          .from("whatsapp_chatbot_config")
          .insert(updates)
          .select()
          .single();
        if (error) throw error;
        return data;
      }

      const { data, error } = await (supabase as any)
        .from("whatsapp_chatbot_config")
        .update(updates)
        .eq("id", existing.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chatbot-config"] });
      toast.success("Configurações atualizadas!");
    },
    onError: (error) => {
      console.error("Error updating config:", error);
      toast.error("Erro ao atualizar configurações");
    }
  });
}

// Hook for keywords
export function useChatbotKeywords() {
  return useQuery({
    queryKey: ["chatbot-keywords"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("whatsapp_chatbot_keywords")
        .select("*")
        .order("priority", { ascending: false });

      if (error) throw error;
      return data as ChatbotKeyword[];
    }
  });
}

// Hook for creating keyword
export function useCreateChatbotKeyword() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (keyword: Omit<ChatbotKeyword, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await (supabase as any)
        .from("whatsapp_chatbot_keywords")
        .insert(keyword)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chatbot-keywords"] });
      toast.success("Palavra-chave criada!");
    },
    onError: (error) => {
      console.error("Error creating keyword:", error);
      toast.error("Erro ao criar palavra-chave");
    }
  });
}

// Hook for updating keyword
export function useUpdateChatbotKeyword() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ChatbotKeyword> & { id: string }) => {
      const { data, error } = await (supabase as any)
        .from("whatsapp_chatbot_keywords")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chatbot-keywords"] });
      toast.success("Palavra-chave atualizada!");
    },
    onError: (error) => {
      console.error("Error updating keyword:", error);
      toast.error("Erro ao atualizar palavra-chave");
    }
  });
}

// Hook for deleting keyword
export function useDeleteChatbotKeyword() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("whatsapp_chatbot_keywords")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chatbot-keywords"] });
      toast.success("Palavra-chave removida!");
    },
    onError: (error) => {
      console.error("Error deleting keyword:", error);
      toast.error("Erro ao remover palavra-chave");
    }
  });
}

// Hook for chatbot logs
export function useChatbotLogs(limit = 50) {
  return useQuery({
    queryKey: ["chatbot-logs", limit],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("whatsapp_chatbot_logs")
        .select(`
          *,
          leader:lideres(nome_completo)
        `)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data as ChatbotLog[];
    }
  });
}

// Hook for chatbot sessions (for admin monitoring)
export function useChatbotSessions(limit = 50) {
  return useQuery({
    queryKey: ["chatbot-sessions", limit],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("whatsapp_chatbot_sessions")
        .select("id, phone, first_message_at, last_activity_at, registration_state, registration_completed_at, collected_name, invite_sent_count, created_at")
        .order("last_activity_at", { ascending: false, nullsFirst: false })
        .limit(limit);

      if (error) throw error;
      return data as Partial<ChatbotSession>[];
    }
  });
}

// Hook for chatbot stats (aggregated)
export function useChatbotStats() {
  return useQuery({
    queryKey: ["chatbot-stats"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("whatsapp_chatbot_stats")
        .select("*")
        .limit(1)
        .single();

      // If view doesn't exist yet, compute manually from logs
      if (error || !data) {
        const now = new Date();
        const h24ago = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
        const d7ago = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

        const { data: logs } = await (supabase as any)
          .from("whatsapp_chatbot_logs")
          .select("phone, response_type, processing_time_ms, created_at")
          .order("created_at", { ascending: false })
          .limit(1000);

        if (!logs) return null;

        const stats: ChatbotStats = {
          total_interactions: logs.length,
          interactions_24h: logs.filter((l: any) => l.created_at >= h24ago).length,
          interactions_7d: logs.filter((l: any) => l.created_at >= d7ago).length,
          unique_users: new Set(logs.map((l: any) => l.phone)).size,
          unique_users_24h: new Set(logs.filter((l: any) => l.created_at >= h24ago).map((l: any) => l.phone)).size,
          ai_responses: logs.filter((l: any) => l.response_type === 'ai').length,
          dynamic_responses: logs.filter((l: any) => l.response_type === 'dynamic').length,
          static_responses: logs.filter((l: any) => l.response_type === 'static').length,
          fallback_responses: logs.filter((l: any) => l.response_type === 'fallback').length,
          avg_processing_ms: logs.length > 0
            ? Math.round(logs.reduce((sum: number, l: any) => sum + (l.processing_time_ms || 0), 0) / logs.length)
            : null,
          last_interaction_at: logs[0]?.created_at || null,
        };
        return stats;
      }

      return data as ChatbotStats;
    },
    refetchInterval: 60_000, // refresh every minute
  });
}

// Available dynamic functions for reference
export const AVAILABLE_DYNAMIC_FUNCTIONS = [
  { value: "minha_arvore", label: "Minha Árvore", description: "Mostra estatísticas da rede do líder" },
  { value: "meus_cadastros", label: "Meus Cadastros", description: "Lista os últimos cadastros indicados" },
  { value: "minha_pontuacao", label: "Minha Pontuação", description: "Mostra pontos e nível de gamificação" },
  { value: "minha_posicao", label: "Minha Posição", description: "Mostra posição no ranking geral" },
  { value: "meus_subordinados", label: "Meus Subordinados", description: "Lista líderes diretamente abaixo" },
  { value: "pendentes", label: "Pendentes", description: "Lista subordinados pendentes de verificação" },
  { value: "cadastro_evento", label: "Cadastro em Evento", description: "Inscrição em evento com envio de QR Code para check-in" },
  { value: "ajuda", label: "Ajuda", description: "Lista de comandos disponíveis" },
];

