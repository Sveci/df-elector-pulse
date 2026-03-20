import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface LeadFunnel {
  id: string;
  nome: string;
  slug: string;
  descricao: string | null;
  status: 'draft' | 'active' | 'paused';
  lead_magnet_nome: string;
  lead_magnet_url: string;
  cover_url: string | null;
  logo_url: string | null;
  titulo: string;
  subtitulo: string | null;
  texto_botao: string;
  cor_botao: string;
  campos_form: string[];
  obrigado_titulo: string;
  obrigado_subtitulo: string | null;
  obrigado_texto_botao: string;
  cta_adicional_texto: string | null;
  cta_adicional_url: string | null;
  views_count: number;
  leads_count: number;
  downloads_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreateFunnelData {
  nome: string;
  slug?: string;
  descricao?: string;
  status?: string;
  lead_magnet_nome: string;
  lead_magnet_url: string;
  cover_url?: string;
  logo_url?: string;
  titulo: string;
  subtitulo?: string;
  texto_botao?: string;
  cor_botao?: string;
  campos_form?: string[];
  obrigado_titulo?: string;
  obrigado_subtitulo?: string;
  obrigado_texto_botao?: string;
  cta_adicional_texto?: string;
  cta_adicional_url?: string;
}

export function useLeadFunnels() {
  return useQuery({
    queryKey: ['lead_funnels'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_funnels')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as LeadFunnel[];
    },
  });
}

export function useLeadFunnelBySlug(slug: string | undefined) {
  return useQuery({
    queryKey: ['lead_funnel', slug],
    queryFn: async () => {
      if (!slug) return null;

      const { data, error } = await supabase
        .from('lead_funnels')
        .select('*')
        .eq('slug', slug)
        .eq('status', 'active')
        .single();

      if (error) throw error;
      return data as LeadFunnel;
    },
    enabled: !!slug,
  });
}

export function useCreateFunnel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateFunnelData) => {
      // Generate slug if not provided
      let slug = data.slug;
      if (!slug) {
        const { data: slugData, error: slugError } = await supabase
          .rpc('generate_funnel_slug', { base_name: data.nome });

        if (slugError) throw slugError;
        slug = slugData;
      }

      const { data: funnel, error } = await supabase
        .from('lead_funnels')
        .insert({
          ...data,
          slug,
          campos_form: data.campos_form || ['nome', 'email', 'whatsapp'],
        })
        .select()
        .single();

      if (error) throw error;
      return funnel;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead_funnels'] });
      toast({
        title: "Funil criado com sucesso!",
        description: "Seu funil de captação está pronto.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar funil",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useUpdateFunnel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<CreateFunnelData> & { id: string }) => {
      const { data: funnel, error } = await supabase
        .from('lead_funnels')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return funnel;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead_funnels'] });
      toast({
        title: "Funil atualizado!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar funil",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useDuplicateFunnel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (funnel: LeadFunnel) => {
      // Generate new slug
      const { data: slug, error: slugError } = await supabase
        .rpc('generate_funnel_slug', { base_name: funnel.nome + ' (Cópia)' });

      if (slugError) throw slugError;

      const { data: newFunnel, error } = await supabase
        .from('lead_funnels')
        .insert({
          nome: funnel.nome + ' (Cópia)',
          slug,
          descricao: funnel.descricao,
          status: 'draft',
          lead_magnet_nome: funnel.lead_magnet_nome,
          lead_magnet_url: funnel.lead_magnet_url,
          cover_url: funnel.cover_url,
          logo_url: funnel.logo_url,
          titulo: funnel.titulo,
          subtitulo: funnel.subtitulo,
          texto_botao: funnel.texto_botao,
          cor_botao: funnel.cor_botao,
          campos_form: funnel.campos_form,
          obrigado_titulo: funnel.obrigado_titulo,
          obrigado_subtitulo: funnel.obrigado_subtitulo,
          obrigado_texto_botao: funnel.obrigado_texto_botao,
          cta_adicional_texto: funnel.cta_adicional_texto,
          cta_adicional_url: funnel.cta_adicional_url,
        })
        .select()
        .single();

      if (error) throw error;
      return newFunnel;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead_funnels'] });
      toast({
        title: "Funil duplicado!",
        description: "Uma cópia do funil foi criada como rascunho.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao duplicar funil",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useDeleteFunnel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('lead_funnels')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead_funnels'] });
      toast({
        title: "Funil excluído!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao excluir funil",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useIncrementFunnelMetric() {
  return useMutation({
    mutationFn: async ({ funnelId, metric }: { funnelId: string; metric: 'views' | 'leads' | 'downloads' }) => {
      const { error } = await supabase
        .rpc('increment_funnel_metric', {
          _funnel_id: funnelId,
          _metric: metric
        });

      if (error) throw error;
    },
  });
}

export async function uploadFunnelAsset(file: File, path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('lead-funnel-assets')
    .upload(path, file, { upsert: true });

  if (error) throw error;

  const { data: { publicUrl } } = supabase.storage
    .from('lead-funnel-assets')
    .getPublicUrl(data.path);

  return publicUrl;
}
