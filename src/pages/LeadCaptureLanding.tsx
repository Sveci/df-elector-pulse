import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Download, CheckCircle, Shield, ExternalLink, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { LocationSelect } from "@/components/office/LocationSelect";
import { useTenantLocationConfig } from "@/hooks/useTenantLocationConfig";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useLeadFunnelBySlug, useIncrementFunnelMetric } from "@/hooks/campaigns/useLeadFunnels";

import { supabase } from "@/integrations/supabase/client";
import { trackLead, pushToDataLayer, trackEvent } from "@/lib/trackingUtils";
import { normalizePhoneToE164 } from "@/utils/phoneNormalizer";
import { toast } from "@/hooks/use-toast";

export default function LeadCaptureLanding() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [hasTrackedView, setHasTrackedView] = useState(false);
  const [localidade, setLocalidade] = useState("");
  const locationConfig = useTenantLocationConfig();
  
  const { data: funnel, isLoading, error } = useLeadFunnelBySlug(slug);
  
  const incrementMetric = useIncrementFunnelMetric();

  // Get UTM params
  const utmParams = {
    utm_source: searchParams.get('utm_source'),
    utm_medium: searchParams.get('utm_medium'),
    utm_campaign: searchParams.get('utm_campaign'),
    utm_content: searchParams.get('utm_content'),
  };

  // Track page view
  useEffect(() => {
    if (funnel && !hasTrackedView) {
      const trackPageView = async () => {
        try {
          // Increment view count
          await incrementMetric.mutateAsync({ funnelId: funnel.id, metric: 'views' });
          
          // Ensure session_id exists
          let sessionId = sessionStorage.getItem('session_id');
          if (!sessionId) {
            sessionId = crypto.randomUUID();
            sessionStorage.setItem('session_id', sessionId);
          }
          
          // Track in page_views with proper error handling
          const { error: pageViewError } = await supabase.from('page_views').insert({
            page_type: 'captacao',
            page_identifier: funnel.slug,
            session_id: sessionId,
            utm_source: utmParams.utm_source,
            utm_medium: utmParams.utm_medium,
            utm_campaign: utmParams.utm_campaign,
            utm_content: utmParams.utm_content,
          });

          if (pageViewError) {
            console.error('Error tracking page view:', pageViewError);
          } else {
            console.log(`Page view tracked for funnel ${funnel.slug} with utm_campaign: ${utmParams.utm_campaign}`);
          }
        } catch (err) {
          console.error('Error in page view tracking:', err);
        }
      };

      trackPageView();
      setHasTrackedView(true);

      // Facebook Pixel ViewContent
      trackEvent('ViewContent', {
        content_name: funnel.nome,
        content_type: 'lead_funnel',
      });

      // GTM
      pushToDataLayer('view_content', {
        funnel_name: funnel.nome,
        funnel_slug: funnel.slug,
      });
    }
  }, [funnel, hasTrackedView]);

  // Build dynamic schema based on funnel fields
  const buildSchema = () => {
    const fields: Record<string, z.ZodTypeAny> = {
      nome: z.string().min(3, "Nome é obrigatório"),
      email: z.string().email("E-mail inválido"),
      lgpd: z.boolean().refine(val => val === true, "Você precisa aceitar os termos"),
    };

    if (funnel?.campos_form.includes('whatsapp')) {
      fields.whatsapp = z.string().min(10, "WhatsApp inválido");
    }
    if (funnel?.campos_form.includes('cidade')) {
      fields.cidade_id = z.string().optional();
    }

    return z.object(fields);
  };

  const form = useForm({
    resolver: funnel ? zodResolver(buildSchema()) : undefined,
    defaultValues: {
      nome: '',
      email: '',
      whatsapp: '',
      cidade_id: '',
      lgpd: false,
    },
  });

  const onSubmit = async (data: any) => {
    if (!funnel) return;
    
    setIsSubmitting(true);

    try {
      // Normalize phone if provided
      let telefone_norm: string | null = null;
      if (data.whatsapp) {
        try {
          telefone_norm = normalizePhoneToE164(data.whatsapp);
        } catch {
          telefone_norm = '+5500000000000'; // Fallback
        }
      }

      // Check if phone/email belongs to a leader - don't create contact for leaders
      let contactData: { id: string } | null = null;
      
      const { data: existingLeader } = await supabase
        .from('lideres')
        .select('id')
        .or(`telefone.eq.${telefone_norm},email.eq.${data.email}`)
        .maybeSingle();

      if (!existingLeader) {
        // Save to office_contacts using upsert to handle duplicate phones
        const { data: upsertedContact, error: contactError } = await supabase
          .from('office_contacts')
          .upsert({
            nome: data.nome,
            email: data.email,
            telefone_norm: telefone_norm || '+5500000000000', // Fallback if no phone
            cidade_id: data.cidade_id || null,
            source_type: 'captacao',
            source_id: funnel.id,
            ...utmParams,
          }, {
            onConflict: 'telefone_norm',
            ignoreDuplicates: false, // Update existing record
          })
          .select('id')
          .single();

        if (contactError) throw contactError;
        contactData = upsertedContact;
      } else {
        console.log('Lead is a registered leader, skipping contact creation');
      }

      // Record page view for this contact
      if (contactData?.id) {
        // Store contact_id in sessionStorage for download tracking
        sessionStorage.setItem(`captacao_contact_${funnel.id}`, contactData.id);
        
        const { error: pageViewError } = await supabase.from('contact_page_views').insert({
          contact_id: contactData.id,
          page_type: 'captacao',
          page_identifier: funnel.slug,
          page_name: funnel.nome,
          utm_source: utmParams.utm_source,
          utm_medium: utmParams.utm_medium,
          utm_campaign: utmParams.utm_campaign,
          utm_content: utmParams.utm_content,
        });
        
        if (pageViewError) {
          console.error('Error recording contact page view:', pageViewError);
        }
      }

      // Increment lead count
      await incrementMetric.mutateAsync({ funnelId: funnel.id, metric: 'leads' });

      // Increment campaign total_cadastros if utm_campaign matches
      if (utmParams.utm_campaign) {
        try {
          // Use maybeSingle to avoid error when campaign doesn't exist
          const { data: campaignData, error: findError } = await supabase
            .from('campaigns')
            .select('id, total_cadastros')
            .eq('utm_campaign', utmParams.utm_campaign)
            .maybeSingle();
          
          if (findError) {
            console.error('Error finding campaign:', findError);
          } else if (campaignData) {
            const { error: updateError } = await supabase
              .from('campaigns')
              .update({ total_cadastros: (campaignData.total_cadastros || 0) + 1 })
              .eq('id', campaignData.id);
            
            if (updateError) {
              console.error('Error incrementing campaign cadastros:', updateError);
            } else {
              console.log(`Campaign ${campaignData.id} cadastros incremented to ${(campaignData.total_cadastros || 0) + 1}`);
            }
          } else {
            console.log(`No campaign found for utm_campaign: ${utmParams.utm_campaign}`);
          }
        } catch (err) {
          console.error('Error updating campaign metrics:', err);
        }
      }

      // Track Lead event
      trackLead({
        content_name: funnel.nome,
        value: 1,
      });

      pushToDataLayer('generate_lead', {
        funnel_name: funnel.nome,
        funnel_slug: funnel.slug,
        lead_source: utmParams.utm_source || 'direct',
      });

      // Send WhatsApp welcome message (captacao-boas-vindas)
      if (telefone_norm && telefone_norm !== '+5500000000000') {
        try {
          // Build download URL for WhatsApp message
          const waSupabaseUrl = import.meta.env.VITE_SUPABASE_URL;
          let waDownloadUrl = `${waSupabaseUrl}/functions/v1/download-material?funnel_id=${funnel.id}`;
          if (contactData?.id) {
            waDownloadUrl += `&contact_id=${contactData.id}`;
          }

          await supabase.functions.invoke('send-whatsapp', {
            body: {
              phone: telefone_norm,
              templateSlug: 'captacao-boas-vindas',
              variables: {
                nome: data.nome,
                material_nome: funnel.lead_magnet_nome,
                download_url: waDownloadUrl,
              },
              contactId: contactData?.id,
            },
          });
        } catch (whatsappError) {
          console.error('Error sending WhatsApp welcome:', whatsappError);
          // Don't fail the submission if WhatsApp fails
        }
      }

      // Send Email welcome message (captacao-boas-vindas)
      if (data.email) {
        try {
          // Build download URL for the email
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
          let downloadUrl = `${supabaseUrl}/functions/v1/download-material?funnel_id=${funnel.id}`;
          if (contactData?.id) {
            downloadUrl += `&contact_id=${contactData.id}`;
          }

          await supabase.functions.invoke('send-email', {
            body: {
              templateSlug: 'captacao-boas-vindas',
              to: data.email,
              toName: data.nome,
              variables: {
                nome: data.nome,
                material_nome: funnel.lead_magnet_nome,
                download_url: downloadUrl,
              },
              contactId: contactData?.id,
            },
          });
        } catch (emailError) {
          console.error('Error sending email welcome:', emailError);
          // Don't fail the submission if email fails
        }
      }

      setIsSuccess(true);
    } catch (error: any) {
      console.error('Error submitting lead:', error);
      toast({
        title: "Erro ao enviar",
        description: "Tente novamente em alguns instantes.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownload = async () => {
    if (!funnel) return;

    // Track download event
    trackEvent('Download', {
      content_name: funnel.lead_magnet_nome,
    });

    pushToDataLayer('download', {
      funnel_name: funnel.nome,
      lead_magnet: funnel.lead_magnet_nome,
    });

    // Get contact_id from session if available
    const contactId = sessionStorage.getItem(`captacao_contact_${funnel.id}`);

    try {
      // Download via edge function - returns file directly (no Supabase URL exposed)
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      let downloadUrl = `${supabaseUrl}/functions/v1/download-material?funnel_id=${funnel.id}`;
      if (contactId) {
        downloadUrl += `&contact_id=${contactId}`;
      }

      // Fetch file from edge function
      const response = await fetch(downloadUrl);
      if (!response.ok) throw new Error('Failed to fetch file');
      
      const blob = await response.blob();
      
      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      let fileName = `${funnel.lead_magnet_nome}.pdf`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match) fileName = match[1];
      }
      
      // Create download link
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: "Erro no download",
        description: "Não foi possível baixar o arquivo. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleShare = async () => {
    if (navigator.share && funnel) {
      try {
        await navigator.share({
          title: funnel.titulo,
          text: funnel.subtitulo || '',
          url: window.location.href,
        });
      } catch (err) {
        // User cancelled or share not supported
      }
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !funnel) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <div className="text-6xl mb-4">📄</div>
        <h1 className="text-2xl font-bold mb-2">Página não encontrada</h1>
        <p className="text-muted-foreground">Este link não está mais disponível.</p>
      </div>
    );
  }

  // Success state - Thank you page
  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
        {/* Cover with logo */}
        <div className="h-56 md:h-64 relative overflow-hidden">
          {/* Background - image or default gradient */}
          <div 
            className="absolute inset-0 bg-gradient-to-br from-primary/30 to-primary/10"
            style={funnel.cover_url ? {
              backgroundImage: `url(${funnel.cover_url})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            } : undefined}
          />
          
        {/* Fade overlay - same as events page */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
        
        {funnel.logo_url && (
            <div className="absolute top-6 left-1/2 -translate-x-1/2 z-10">
              <img 
                src={funnel.logo_url} 
                alt="Logo" 
                className="h-16 md:h-20 w-auto bg-white/90 rounded-xl p-2 shadow-lg"
              />
            </div>
          )}
        </div>

        <div className="max-w-lg mx-auto px-4 pt-8 pb-12">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold mb-3">
              {funnel.obrigado_titulo}
            </h1>
            {funnel.obrigado_subtitulo && (
              <p className="text-muted-foreground">
                {funnel.obrigado_subtitulo}
              </p>
            )}
          </div>

          <div className="space-y-4">
            {/* Download Button */}
            <Button 
              size="lg" 
              className="w-full text-lg py-6"
              style={{ backgroundColor: funnel.cor_botao }}
              onClick={handleDownload}
            >
              <Download className="h-5 w-5 mr-2" />
              {funnel.obrigado_texto_botao}
            </Button>

            {/* Additional CTA */}
            {funnel.cta_adicional_texto && funnel.cta_adicional_url && (
              <Button 
                variant="outline" 
                size="lg" 
                className="w-full"
                onClick={() => window.open(funnel.cta_adicional_url!, '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                {funnel.cta_adicional_texto}
              </Button>
            )}

            {/* Share buttons */}
            <div className="flex justify-center gap-3 pt-4">
              <Button variant="ghost" size="sm" onClick={handleShare}>
                <Share2 className="h-4 w-4 mr-2" />
                Compartilhar
              </Button>
            </div>
          </div>

          {/* Lead magnet name */}
          <div className="mt-8 pt-6 border-t text-center">
            <p className="text-sm text-muted-foreground">
              🎁 <strong>{funnel.lead_magnet_nome}</strong>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Registration form
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Cover with title, subtitle, and logo inside */}
      <div className="h-72 md:h-96 lg:h-[28rem] relative overflow-hidden">
        {/* Background - image or default gradient */}
        <div 
          className="absolute inset-0 bg-gradient-to-br from-primary/30 to-primary/10"
          style={funnel.cover_url ? {
            backgroundImage: `url(${funnel.cover_url})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          } : undefined}
        />
        
        {/* Fade overlay - same as events page */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
        
        {/* Logo at top */}
        {funnel.logo_url && (
          <div className="absolute top-4 md:top-6 left-1/2 -translate-x-1/2 z-10">
            <img 
              src={funnel.logo_url} 
              alt="Logo" 
              className="h-14 md:h-16 w-auto bg-white/90 rounded-xl p-2 shadow-lg"
            />
          </div>
        )}
        
        {/* Title and subtitle at bottom of cover - same as events page */}
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8 z-10">
          <div className="max-w-lg mx-auto text-center">
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-3 text-foreground">
              {funnel.titulo}
            </h1>
            {funnel.subtitulo && (
              <p className="text-base md:text-lg text-muted-foreground">
                {funnel.subtitulo}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-8 pb-12">
        {/* Lead magnet preview */}
        <div className="bg-muted/50 rounded-lg p-4 mb-6 text-center">
          <span className="text-2xl">🎁</span>
          <p className="font-medium mt-1">{funnel.lead_magnet_nome}</p>
        </div>

        {/* Form */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome Completo *</FormLabel>
                  <FormControl>
                    <Input placeholder="Seu nome" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-mail *</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="seu@email.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {funnel.campos_form.includes('whatsapp') && (
              <FormField
                control={form.control}
                name="whatsapp"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>WhatsApp</FormLabel>
                    <FormControl>
                      <Input placeholder="(61) 99999-9999" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {funnel.campos_form.includes('cidade') && (
              <FormField
                control={form.control}
                name="cidade_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{locationConfig.label}</FormLabel>
                    <LocationSelect
                      value={field.value}
                      localidadeValue={localidade}
                      onLocationChange={({ cidadeId: cid, localidade: loc }) => {
                        field.onChange(cid || "");
                        setLocalidade(loc || "");
                      }}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="lgpd"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel className="text-sm font-normal">
                      Concordo em receber comunicações e aceito a política de privacidade *
                    </FormLabel>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button 
              type="submit" 
              size="lg" 
              className="w-full text-lg py-6"
              style={{ backgroundColor: funnel.cor_botao }}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                funnel.texto_botao
              )}
            </Button>
          </form>
        </Form>

        {/* Security indicator */}
        <div className="flex items-center justify-center gap-2 mt-6 text-xs text-muted-foreground">
          <Shield className="h-4 w-4" />
          <span>Seus dados estão seguros e protegidos</span>
        </div>
      </div>
    </div>
  );
}