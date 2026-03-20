import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Survey {
  id: string;
  titulo: string;
  descricao: string | null;
  slug: string;
  status: "draft" | "active" | "closed";
  data_inicio: string | null;
  data_fim: string | null;
  total_respostas: number;
  cover_url: string | null;
  logo_url: string | null;
  config: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface SurveyQuestion {
  id: string;
  survey_id: string;
  ordem: number;
  tipo: "multipla_escolha" | "escala" | "nps" | "texto_curto" | "texto_longo" | "sim_nao";
  pergunta: string;
  opcoes: string[] | null;
  obrigatoria: boolean;
  config: Record<string, any>;
  created_at: string;
}

export interface SurveyResponse {
  id: string;
  survey_id: string;
  contact_id: string | null;
  leader_id: string | null;
  referred_by_leader_id: string | null;
  respostas: Record<string, any>;
  is_leader: boolean;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  created_at: string;
}

export function useSurveys() {
  return useQuery({
    queryKey: ["surveys"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("surveys")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Survey[];
    },
  });
}

export function useSurvey(idOrSlug: string | undefined) {
  return useQuery({
    queryKey: ["survey", idOrSlug],
    queryFn: async () => {
      if (!idOrSlug) return null;

      // Try by slug first (for public pages), then by id
      let query = supabase.from("surveys").select("*");

      // Check if it's a UUID format
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);

      if (isUUID) {
        query = query.eq("id", idOrSlug);
      } else {
        query = query.eq("slug", idOrSlug);
      }

      const { data, error } = await query.single();

      if (error) throw error;
      return data as Survey;
    },
    enabled: !!idOrSlug,
  });
}

export function useSurveyQuestions(surveyId: string | undefined) {
  return useQuery({
    queryKey: ["survey_questions", surveyId],
    queryFn: async () => {
      if (!surveyId) return [];

      const { data, error } = await supabase
        .from("survey_questions")
        .select("*")
        .eq("survey_id", surveyId)
        .order("ordem", { ascending: true });

      if (error) throw error;
      return data as SurveyQuestion[];
    },
    enabled: !!surveyId,
  });
}

export function useSurveyResponses(surveyId: string | undefined) {
  return useQuery({
    queryKey: ["survey_responses", surveyId],
    queryFn: async () => {
      if (!surveyId) return [];

      const { data, error } = await supabase
        .from("survey_responses")
        .select(`
          *,
          contact:office_contacts(id, nome, telefone_norm, email),
          leader:lideres!survey_responses_leader_id_fkey(id, nome_completo),
          referred_by:lideres!survey_responses_referred_by_leader_id_fkey(id, nome_completo)
        `)
        .eq("survey_id", surveyId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!surveyId,
  });
}

export function useCreateSurvey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      titulo: string;
      descricao?: string;
      data_inicio?: string;
      data_fim?: string;
    }) => {
      // Generate slug from title
      const { data: slugData, error: slugError } = await supabase
        .rpc("generate_survey_slug", { base_name: data.titulo });

      if (slugError) throw slugError;

      const { data: survey, error } = await supabase
        .from("surveys")
        .insert({
          titulo: data.titulo,
          descricao: data.descricao,
          slug: slugData,
          data_inicio: data.data_inicio,
          data_fim: data.data_fim,
        })
        .select()
        .single();

      if (error) throw error;
      return survey as Survey;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["surveys"] });
      toast.success("Pesquisa criada com sucesso");
    },
    onError: (error) => {
      console.error("Erro ao criar pesquisa:", error);
      toast.error("Erro ao criar pesquisa");
    },
  });
}

export function useUpdateSurvey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Survey> }) => {
      const { error } = await supabase
        .from("surveys")
        .update(data)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["surveys"] });
      queryClient.invalidateQueries({ queryKey: ["survey", variables.id] });
      toast.success("Pesquisa atualizada com sucesso");
    },
    onError: (error) => {
      console.error("Erro ao atualizar pesquisa:", error);
      toast.error("Erro ao atualizar pesquisa");
    },
  });
}

export function useDeleteSurvey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("surveys")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["surveys"] });
      toast.success("Pesquisa excluída com sucesso");
    },
    onError: (error) => {
      console.error("Erro ao excluir pesquisa:", error);
      toast.error("Erro ao excluir pesquisa");
    },
  });
}

export function useSaveQuestions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ surveyId, questions }: {
      surveyId: string;
      questions: Omit<SurveyQuestion, "id" | "survey_id" | "created_at">[]
    }) => {
      // Delete existing questions
      await supabase
        .from("survey_questions")
        .delete()
        .eq("survey_id", surveyId);

      // Insert new questions
      if (questions.length > 0) {
        const { error } = await supabase
          .from("survey_questions")
          .insert(questions.map(q => ({ ...q, survey_id: surveyId })));

        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["survey_questions", variables.surveyId] });
      toast.success("Perguntas salvas com sucesso");
    },
    onError: (error) => {
      console.error("Erro ao salvar perguntas:", error);
      toast.error("Erro ao salvar perguntas");
    },
  });
}

export function useSubmitSurveyResponse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      survey_id: string;
      contact_id?: string;
      leader_id?: string;
      referred_by_leader_id?: string;
      respostas: Record<string, any>;
      is_leader: boolean;
      utm_source?: string;
      utm_medium?: string;
      utm_campaign?: string;
      utm_content?: string;
    }) => {
      const { data: response, error } = await supabase
        .from("survey_responses")
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return response;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["survey_responses", variables.survey_id] });
      queryClient.invalidateQueries({ queryKey: ["surveys"] });
    },
    onError: (error) => {
      console.error("Erro ao enviar resposta:", error);
      toast.error("Erro ao enviar resposta");
    },
  });
}
