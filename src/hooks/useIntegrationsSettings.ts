import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { toast } from "sonner";

interface IntegrationsSettings {
  id: string;
  zapi_instance_id: string | null;
  zapi_token: string | null;
  zapi_client_token: string | null;
  zapi_enabled: boolean;
  resend_api_key: string | null;
  resend_from_email: string | null;
  resend_from_name: string | null;
  resend_enabled: boolean;
  smsdev_api_key: string | null;
  smsdev_enabled: boolean;
  // SMSBarato
  smsbarato_api_key: string | null;
  smsbarato_enabled: boolean;
  // Disparopro
  disparopro_token: string | null;
  disparopro_enabled: boolean;
  sms_active_provider: 'smsdev' | 'smsbarato' | 'disparopro';
  // PassKit
  passkit_api_token: string | null;
  passkit_api_base_url: string | null;
  passkit_program_id: string | null;
  passkit_tier_id: string | null;
  passkit_enabled: boolean;
  // WhatsApp Cloud API (Meta)
  whatsapp_provider_active: 'zapi' | 'meta_cloud';
  meta_cloud_enabled: boolean;
  meta_cloud_test_mode: boolean;
  meta_cloud_whitelist: string[];
  meta_cloud_phone_number_id: string | null;
  meta_cloud_waba_id: string | null;
  meta_cloud_api_version: string;
  meta_cloud_fallback_enabled: boolean;
  meta_cloud_phone: string | null;
  
  // Controles de mensagens automáticas de WhatsApp
  wa_auto_verificacao_enabled: boolean;
  wa_auto_captacao_enabled: boolean;
  wa_auto_pesquisa_enabled: boolean;
  wa_auto_evento_enabled: boolean;
  wa_auto_lideranca_enabled: boolean;
  wa_auto_membro_enabled: boolean;
  wa_auto_visita_enabled: boolean;
  wa_auto_optout_enabled: boolean;
  wa_auto_sms_fallback_enabled: boolean;
  // Materiais por Região
  region_material_default_delay_minutes: number;
  // Verificação via WhatsApp
  verification_method: 'link' | 'whatsapp_consent' | 'whatsapp_meta_cloud';
  verification_wa_enabled: boolean;
  verification_wa_test_mode: boolean;
  verification_wa_whitelist: string[];
  verification_wa_keyword: string;
  verification_wa_zapi_phone: string | null;
  // Fallback automático
  verification_fallback_active: boolean;
  zapi_last_connected_at: string | null;
  zapi_disconnected_at: string | null;
  // Horário de Silêncio
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  created_at: string;
  updated_at: string;
}

interface UpdateIntegrationsDTO {
  zapi_instance_id?: string | null;
  zapi_token?: string | null;
  zapi_client_token?: string | null;
  zapi_enabled?: boolean;
  resend_api_key?: string | null;
  resend_from_email?: string | null;
  resend_from_name?: string | null;
  resend_enabled?: boolean;
  smsdev_api_key?: string | null;
  smsdev_enabled?: boolean;
  // SMSBarato
  smsbarato_api_key?: string | null;
  smsbarato_enabled?: boolean;
  // Disparopro
  disparopro_token?: string | null;
  disparopro_enabled?: boolean;
  sms_active_provider?: 'smsdev' | 'smsbarato' | 'disparopro';
  // PassKit
  passkit_api_token?: string | null;
  passkit_api_base_url?: string | null;
  passkit_program_id?: string | null;
  passkit_tier_id?: string | null;
  passkit_enabled?: boolean;
  // WhatsApp Cloud API (Meta)
  whatsapp_provider_active?: 'zapi' | 'meta_cloud' | 'dialog360';
  meta_cloud_enabled?: boolean;
  meta_cloud_test_mode?: boolean;
  meta_cloud_whitelist?: string[];
  meta_cloud_phone_number_id?: string | null;
  meta_cloud_waba_id?: string | null;
  meta_cloud_api_version?: string;
  meta_cloud_fallback_enabled?: boolean;
  meta_cloud_phone?: string | null;
  dialog360_phone?: string | null;
  // Controles de mensagens automáticas de WhatsApp
  wa_auto_verificacao_enabled?: boolean;
  wa_auto_captacao_enabled?: boolean;
  wa_auto_pesquisa_enabled?: boolean;
  wa_auto_evento_enabled?: boolean;
  wa_auto_lideranca_enabled?: boolean;
  // Materiais por Região
  region_material_default_delay_minutes?: number;
  wa_auto_membro_enabled?: boolean;
  wa_auto_visita_enabled?: boolean;
  wa_auto_optout_enabled?: boolean;
  wa_auto_sms_fallback_enabled?: boolean;
  // Verificação via WhatsApp
  verification_method?: 'link' | 'whatsapp_consent' | 'whatsapp_meta_cloud';
  verification_wa_enabled?: boolean;
  verification_wa_test_mode?: boolean;
  verification_wa_whitelist?: string[];
  verification_wa_keyword?: string;
  verification_wa_zapi_phone?: string | null;
  // 360dialog
  dialog360_enabled?: boolean;
  dialog360_phone_number_id?: string | null;
  dialog360_test_mode?: boolean;
  dialog360_whitelist?: string[];
  dialog360_fallback_enabled?: boolean;
  // Horário de Silêncio
  quiet_hours_enabled?: boolean;
  quiet_hours_start?: string;
  quiet_hours_end?: string;
}

export function useIntegrationsSettings() {
  return useQuery({
    queryKey: ["integrations_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integrations_settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      if (!data) {
        // Auto-create default row if none exists
        const { data: newRow, error: insertError } = await supabase
          .from("integrations_settings")
          .insert({})
          .select()
          .single();
        if (insertError) throw insertError;
        return newRow as IntegrationsSettings;
      }
      return data as IntegrationsSettings;
    },
    retry: 2,
  });
}

export function useUpdateIntegrationsSettings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (updates: UpdateIntegrationsDTO) => {
      const { data: existing } = await supabase
        .from("integrations_settings")
        .select("id")
        .limit(1)
        .maybeSingle();

      if (!existing) {
        // Auto-create if missing
        const { data: newRow, error: insertErr } = await supabase
          .from("integrations_settings")
          .insert(updates)
          .select()
          .single();
        if (insertErr) throw insertErr;
        return newRow;
      }

      const { data, error } = await supabase
        .from("integrations_settings")
        .update(updates)
        .eq("id", existing.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations_settings"] });
      toast({
        title: "Configurações salvas",
        description: "As configurações de integração foram atualizadas.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    }
  });
}

export function useTestZapiConnection() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (credentials: { instanceId: string; token: string; clientToken?: string }) => {
      const { data, error } = await supabase.functions.invoke('test-zapi-connection', {
        body: credentials
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      
      return data.data;
    },
    onSuccess: (data) => {
      const connected = data.connected || data.status === "connected";
      if (connected) {
        toast({
          title: "Conexão bem-sucedida",
          description: "O Z-API está conectado e funcionando.",
        });
      } else {
        toast({
          title: "WhatsApp desconectado",
          description: "A instância Z-API está ativa, mas o WhatsApp não está conectado. Verifique no painel do Z-API.",
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Erro na conexão",
        description: error.message || "Verifique as credenciais e tente novamente.",
        variant: "destructive",
      });
    }
  });
}

export function useTestSmsdevConnection() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (apiKey: string) => {
      const { data, error } = await supabase.functions.invoke('test-smsdev-connection', {
        body: { apiKey }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      
      return data.data;
    },
    onSuccess: (data) => {
      toast({
        title: "Conexão bem-sucedida",
        description: data.description || `Saldo disponível: ${data.balance} SMS`,
      });
    },
    onError: (error) => {
      toast({
        title: "Erro na conexão",
        description: error.message || "Verifique a API Key e tente novamente.",
        variant: "destructive",
      });
    }
  });
}

export function useTestSmsbaratoConnection() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (apiKey: string) => {
      const { data, error } = await supabase.functions.invoke('test-smsbarato-connection', {
        body: { apiKey }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      
      return data.data;
    },
    onSuccess: (data) => {
      toast({
        title: "Conexão bem-sucedida",
        description: data.description || `Saldo disponível: ${data.balance} SMS`,
      });
    },
    onError: (error) => {
      toast({
        title: "Erro na conexão",
        description: error.message || "Verifique a API Key e tente novamente.",
        variant: "destructive",
      });
    }
  });
}

export function useTestSmsdevWebhook() {
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('test-smsdev-webhook');

      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      
      return data;
    },
    onSuccess: (data) => {
      toast.success("Webhook testado com sucesso!", {
        description: data.message,
      });
    },
    onError: (error: Error) => {
      toast.error("Erro ao testar webhook", {
        description: error.message,
      });
    }
  });
}

export function useTestDisparoproConnection() {
  const { toast: toastHook } = useToast();

  return useMutation({
    mutationFn: async (token: string) => {
      const { data, error } = await supabase.functions.invoke('test-disparopro-connection', {
        body: { token }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      
      return data.data;
    },
    onSuccess: (data) => {
      toastHook({
        title: "Conexão bem-sucedida",
        description: data.description || `Saldo disponível: ${data.balance} SMS`,
      });
    },
    onError: (error) => {
      toastHook({
        title: "Erro na conexão",
        description: error.message || "Verifique o token e tente novamente.",
        variant: "destructive",
      });
    }
  });
}

export function useTestMetaCloudConnection() {
  const { toast: toastHook } = useToast();

  return useMutation({
    mutationFn: async (params: { phoneNumberId: string; apiVersion?: string }) => {
      const { data, error } = await supabase.functions.invoke('test-meta-cloud-connection', {
        body: params
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      
      return data.data;
    },
    onSuccess: (data) => {
      toastHook({
        title: "Conexão bem-sucedida",
        description: `Número verificado: ${data.displayPhoneNumber || data.verifiedName || 'Conectado'}`,
      });
    },
    onError: (error: Error) => {
      toastHook({
        title: "Erro na conexão",
        description: error.message || "Verifique o Phone Number ID e o Access Token.",
        variant: "destructive",
      });
    }
  });
}

export function useTest360DialogConnection() {
  const { toast: toastHook } = useToast();

  return useMutation({
    mutationFn: async (phoneNumberId: string) => {
      const { data, error } = await supabase.functions.invoke('test-360dialog-connection', {
        body: { phoneNumberId }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      
      return data.data;
    },
    onSuccess: (data) => {
      toastHook({
        title: "Conexão bem-sucedida",
        description: `Número verificado: ${data.displayPhoneNumber || data.verifiedName || 'Conectado'}`,
      });
    },
    onError: (error: Error) => {
      toastHook({
        title: "Erro na conexão",
        description: error.message || "Verifique o Phone Number ID e a API Key.",
        variant: "destructive",
      });
    }
  });
}
