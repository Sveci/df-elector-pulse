import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface EmailTemplate {
  id: string;
  slug: string;
  nome: string;
  assunto: string;
  conteudo_html: string;
  categoria: string;
  variaveis: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useEmailTemplates() {
  return useQuery({
    queryKey: ["email_templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_templates")
        .select("*")
        .order("categoria", { ascending: true })
        .order("nome", { ascending: true });

      if (error) throw error;
      return data as EmailTemplate[];
    },
  });
}

export function useEmailTemplate(id: string) {
  return useQuery({
    queryKey: ["email_template", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_templates")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as EmailTemplate;
    },
    enabled: !!id,
  });
}

export function useUpdateEmailTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<EmailTemplate>;
    }) => {
      const { data, error } = await supabase
        .from("email_templates")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email_templates"] });
      toast.success("Template atualizado com sucesso!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao atualizar template: " + error.message);
    },
  });
}

export function useCreateEmailTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      data: Pick<EmailTemplate, "slug" | "nome" | "assunto" | "conteudo_html" | "categoria" | "variaveis">
    ) => {
      const { error } = await supabase.from("email_templates").insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email_templates"] });
      toast.success("Template criado com sucesso!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao criar template: " + error.message);
    },
  });
}

export function useDeleteEmailTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("email_templates")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email_templates"] });
      toast.success("Template excluído com sucesso!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao excluir template: " + error.message);
    },
  });
}

export function useTestResendConnection() {
  return useMutation({
    mutationFn: async (apiKey: string) => {
      const { data, error } = await supabase.functions.invoke("test-resend-connection", {
        body: { apiKey },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      
      return data;
    },
    onSuccess: (data) => {
      if (data.connected) {
        toast.success("Conexão com Resend estabelecida com sucesso!");
      } else {
        toast.error("Falha na conexão com Resend");
      }
    },
    onError: (error: Error) => {
      toast.error("Erro ao testar conexão: " + error.message);
    },
  });
}

export function useSendEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      templateSlug?: string;
      templateId?: string;
      to: string;
      toName?: string;
      subject?: string;
      html?: string;
      variables?: Record<string, string>;
      contactId?: string;
      leaderId?: string;
      eventId?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("send-email", {
        body: params,
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email_logs"] });
      toast.success("Email enviado com sucesso!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao enviar email: " + error.message);
    },
  });
}

export function useSendBulkEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      templateSlug: string;
      recipients: Array<{
        to: string;
        toName?: string;
        variables?: Record<string, string>;
        contactId?: string;
        leaderId?: string;
        eventId?: string;
      }>;
    }) => {
      const results = [];
      
      for (const recipient of params.recipients) {
        try {
          const { data, error } = await supabase.functions.invoke("send-email", {
            body: {
              templateSlug: params.templateSlug,
              ...recipient,
            },
          });
          
          results.push({
            email: recipient.to,
            success: !error && data?.success,
            error: error?.message || data?.error,
          });
        } catch (err: any) {
          results.push({
            email: recipient.to,
            success: false,
            error: err.message,
          });
        }
        
        // Small delay between emails
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ["email_logs"] });
      const successCount = results.filter(r => r.success).length;
      const failCount = results.length - successCount;
      
      if (failCount === 0) {
        toast.success(`${successCount} emails enviados com sucesso!`);
      } else {
        toast.warning(`${successCount} enviados, ${failCount} falharam`);
      }
    },
    onError: (error: Error) => {
      toast.error("Erro no envio em massa: " + error.message);
    },
  });
}
