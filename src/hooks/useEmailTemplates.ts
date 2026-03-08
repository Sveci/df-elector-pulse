import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTenantContext } from "@/contexts/TenantContext";

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
  let tenantId: string | null = null;
  try {
    const ctx = useTenantContext();
    tenantId = ctx.activeTenant?.id || null;
  } catch {
    // Outside TenantProvider
  }

  return useQuery({
    queryKey: ["email_templates", tenantId],
    queryFn: async () => {
      // Fetch global defaults
      const { data: globals, error: globalError } = await supabase
        .from("email_templates")
        .select("*")
        .order("categoria", { ascending: true })
        .order("nome", { ascending: true });

      if (globalError) throw globalError;

      // Fetch tenant overrides if tenant is active
      let tenantOverrides: Record<string, any> = {};
      if (tenantId) {
        const { data: overrides } = await supabase
          .from("tenant_email_templates")
          .select("*")
          .eq("tenant_id", tenantId);

        if (overrides) {
          for (const o of overrides) {
            tenantOverrides[o.slug] = o;
          }
        }
      }

      // Merge: tenant override takes precedence over global
      const merged = (globals || []).map((g) => {
        const override = tenantOverrides[g.slug];
        if (override) {
          return {
            ...g,
            nome: override.nome,
            assunto: override.assunto,
            conteudo_html: override.conteudo_html,
            categoria: override.categoria,
            variaveis: override.variaveis,
            is_active: override.is_active,
            _is_tenant_override: true,
            _tenant_template_id: override.id,
          } as EmailTemplate & { _is_tenant_override?: boolean; _tenant_template_id?: string };
        }
        return { ...g, _is_tenant_override: false } as EmailTemplate & { _is_tenant_override?: boolean };
      });

      return merged as EmailTemplate[];
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
  let tenantId: string | null = null;
  try {
    const ctx = useTenantContext();
    tenantId = ctx.activeTenant?.id || null;
  } catch {}

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<EmailTemplate>;
    }) => {
      if (tenantId) {
        // Get the global template to know the slug
        const { data: globalTemplate } = await supabase
          .from("email_templates")
          .select("slug, nome, assunto, conteudo_html, categoria, variaveis")
          .eq("id", id)
          .single();

        if (!globalTemplate) throw new Error("Template global não encontrado");

        // Upsert into tenant_email_templates
        const tenantData = {
          tenant_id: tenantId,
          slug: globalTemplate.slug,
          nome: updates.nome ?? globalTemplate.nome,
          assunto: updates.assunto ?? globalTemplate.assunto,
          conteudo_html: updates.conteudo_html ?? globalTemplate.conteudo_html,
          categoria: updates.categoria ?? globalTemplate.categoria,
          variaveis: updates.variaveis ?? globalTemplate.variaveis,
          is_active: updates.is_active ?? true,
          updated_at: new Date().toISOString(),
        };

        // Check if override already exists
        const { data: existing } = await supabase
          .from("tenant_email_templates")
          .select("id")
          .eq("tenant_id", tenantId)
          .eq("slug", globalTemplate.slug)
          .single();

        if (existing) {
          const { data, error } = await supabase
            .from("tenant_email_templates")
            .update(tenantData)
            .eq("id", existing.id)
            .select()
            .single();
          if (error) throw error;
          return data;
        } else {
          const { data, error } = await supabase
            .from("tenant_email_templates")
            .insert(tenantData)
            .select()
            .single();
          if (error) throw error;
          return data;
        }
      } else {
        // No tenant = edit global (super_admin)
        const { data, error } = await supabase
          .from("email_templates")
          .update(updates)
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
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
  let tenantId: string | null = null;
  try {
    const ctx = useTenantContext();
    tenantId = ctx.activeTenant?.id || null;
  } catch {}

  return useMutation({
    mutationFn: async (params: {
      templateSlug?: string;
      templateId?: string;
      tenantId?: string;
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
        body: { ...params, tenantId: params.tenantId || tenantId },
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
  let tenantId: string | null = null;
  try {
    const ctx = useTenantContext();
    tenantId = ctx.activeTenant?.id || null;
  } catch {}

  return useMutation({
    mutationFn: async (params: {
      templateSlug: string;
      tenantId?: string;
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
      const effectiveTenantId = params.tenantId || tenantId;
      
      for (const recipient of params.recipients) {
        try {
          const { data, error } = await supabase.functions.invoke("send-email", {
            body: {
              templateSlug: params.templateSlug,
              tenantId: effectiveTenantId,
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
