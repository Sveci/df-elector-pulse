import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

export type FlowNodeType =
  | "trigger"
  | "keyword"
  | "ai_response"
  | "automation"
  | "message"
  | "condition"
  | "delay"
  | "end";

export interface FlowNodeData {
  label: string;
  // trigger
  triggerType?: "any_message" | "first_contact" | "keyword" | "schedule";
  // keyword
  keyword?: string;
  aliases?: string[];
  caseSensitive?: boolean;
  partialMatch?: boolean;
  // message
  messageText?: string;
  mediaUrl?: string;
  mediaType?: "image" | "video" | "document" | "audio";
  // ai_response
  aiPrompt?: string;
  aiModel?: string;
  useKnowledgeBase?: boolean;
  temperature?: number;
  // automation
  automationFunction?: string;
  automationParams?: Record<string, string>;
  // condition
  conditionField?: string;
  conditionOperator?: "equals" | "contains" | "starts_with" | "regex" | "is_empty" | "is_not_empty";
  conditionValue?: string;
  // delay
  delaySeconds?: number;
  // end
  endAction?: "close" | "transfer_human" | "restart" | "nothing";
  endMessage?: string;
  // shared
  description?: string;
  isActive?: boolean;
  [key: string]: unknown;
}

export interface FlowNode {
  id: string;
  type: FlowNodeType;
  position: { x: number; y: number };
  data: FlowNodeData;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  label?: string;
  type?: string;
  animated?: boolean;
  style?: Record<string, unknown>;
}

export interface ChatbotFlow {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  is_published: boolean;
  nodes: FlowNode[];
  edges: FlowEdge[];
  version: number;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  tags: string[];
  color: string | null;
  icon: string | null;
  trigger_count: number;
  execution_count: number;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

const TABLE = "whatsapp_chatbot_flows";

export function useChatbotFlows() {
  return useQuery({
    queryKey: ["chatbot-flows"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from(TABLE)
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ChatbotFlow[];
    },
  });
}

export function useChatbotFlow(id?: string) {
  return useQuery({
    queryKey: ["chatbot-flow", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from(TABLE)
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as ChatbotFlow;
    },
  });
}

export function useCreateChatbotFlow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      flow: Omit<ChatbotFlow, "id" | "tenant_id" | "created_at" | "updated_at" | "published_at" | "trigger_count" | "execution_count">
    ) => {
      const { data, error } = await (supabase as any)
        .from(TABLE)
        .insert({ ...flow, version: 1 })
        .select()
        .single();
      if (error) throw error;
      return data as ChatbotFlow;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chatbot-flows"] });
      toast.success("Fluxo criado com sucesso!");
    },
    onError: () => toast.error("Erro ao criar fluxo"),
  });
}

export function useUpdateChatbotFlow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ChatbotFlow> & { id: string }) => {
      const { data, error } = await (supabase as any)
        .from(TABLE)
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as ChatbotFlow;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["chatbot-flows"] });
      qc.invalidateQueries({ queryKey: ["chatbot-flow", vars.id] });
    },
    onError: () => toast.error("Erro ao salvar fluxo"),
  });
}

export function usePublishChatbotFlow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await (supabase as any)
        .from(TABLE)
        .update({ is_published: true, published_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as ChatbotFlow;
    },
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["chatbot-flows"] });
      qc.invalidateQueries({ queryKey: ["chatbot-flow", id] });
      toast.success("Fluxo publicado!");
    },
    onError: () => toast.error("Erro ao publicar fluxo"),
  });
}

export function useDuplicateChatbotFlow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (flow: ChatbotFlow) => {
      const { id: _id, tenant_id: _t, created_at: _c, updated_at: _u, published_at: _p, ...rest } = flow;
      const { data, error } = await (supabase as any)
        .from(TABLE)
        .insert({ ...rest, name: `${flow.name} (cópia)`, is_published: false, version: 1 })
        .select()
        .single();
      if (error) throw error;
      return data as ChatbotFlow;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chatbot-flows"] });
      toast.success("Fluxo duplicado!");
    },
    onError: () => toast.error("Erro ao duplicar fluxo"),
  });
}

export function useDeleteChatbotFlow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from(TABLE).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chatbot-flows"] });
      toast.success("Fluxo removido!");
    },
    onError: () => toast.error("Erro ao remover fluxo"),
  });
}

// ─── Default Flow Templates ────────────────────────────────────────────────────

export const DEFAULT_FLOW_TEMPLATES: Array<Partial<ChatbotFlow> & { templateName: string }> = [
  {
    templateName: "Fluxo de Boas-Vindas",
    name: "Boas-Vindas",
    description: "Recebe o primeiro contato e apresenta o menu principal",
    color: "#22c55e",
    icon: "👋",
    tags: ["boas-vindas", "onboarding"],
    is_active: true,
    is_published: false,
    nodes: [
      { id: "n1", type: "trigger", position: { x: 60, y: 200 }, data: { label: "Primeiro Contato", triggerType: "first_contact" } },
      { id: "n2", type: "message", position: { x: 320, y: 200 }, data: { label: "Mensagem de Boas-Vindas", messageText: "👋 Olá! Bem-vindo(a)! Sou o assistente virtual. Como posso te ajudar?\n\n1️⃣ Minha Árvore\n2️⃣ Meus Cadastros\n3️⃣ Pontuação\n4️⃣ Falar com humano" } },
      { id: "n3", type: "end", position: { x: 580, y: 200 }, data: { label: "Aguardar Resposta", endAction: "nothing" } },
    ],
    edges: [
      { id: "e1", source: "n1", target: "n2", animated: true },
      { id: "e2", source: "n2", target: "n3" },
    ],
  },
  {
    templateName: "Resposta por IA",
    name: "Perguntas Abertas (IA)",
    description: "Rota padrão para perguntas não reconhecidas usando IA",
    color: "#8b5cf6",
    icon: "🤖",
    tags: ["ia", "fallback"],
    is_active: true,
    is_published: false,
    nodes: [
      { id: "n1", type: "trigger", position: { x: 60, y: 200 }, data: { label: "Qualquer Mensagem", triggerType: "any_message" } },
      { id: "n2", type: "ai_response", position: { x: 320, y: 200 }, data: { label: "Resposta IA", aiPrompt: "Você é um assistente virtual. Responda com base no contexto do usuário.", useKnowledgeBase: true, temperature: 0.7 } },
      { id: "n3", type: "end", position: { x: 580, y: 200 }, data: { label: "Finalizar", endAction: "nothing" } },
    ],
    edges: [
      { id: "e1", source: "n1", target: "n2", animated: true },
      { id: "e2", source: "n2", target: "n3" },
    ],
  },
];

// ─── Automation functions available ────────────────────────────────────────────

export { AVAILABLE_DYNAMIC_FUNCTIONS } from "@/hooks/useWhatsAppChatbot";
