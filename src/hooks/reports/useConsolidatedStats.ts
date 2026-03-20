import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ConsolidatedStats {
  // Comunicação
  totalMessages: number;
  totalSMS: number;
  totalEmail: number;
  totalWhatsApp: number;
  avgDeliveryRate: number;

  // Eventos
  totalEvents: number;
  totalRegistrations: number;
  totalCheckins: number;
  avgConversionRate: number;

  // Líderes
  totalLeaders: number;
  activeLeaders: number;
  totalIndications: number;
  topLeaders: Array<{ id: string; name: string; points: number; indications: number }>;

  // Geral
  lastUpdate: string;
}

export function useConsolidatedStats() {
  return useQuery({
    queryKey: ['consolidated_stats'],
    queryFn: async (): Promise<ConsolidatedStats> => {
      // Buscar estatísticas de SMS
      const { count: smsTotal } = await supabase
        .from('sms_messages')
        .select('*', { count: 'exact', head: true })
        .eq('direction', 'outgoing');

      const { count: smsDelivered } = await supabase
        .from('sms_messages')
        .select('*', { count: 'exact', head: true })
        .eq('direction', 'outgoing')
        .eq('status', 'delivered');

      // Buscar estatísticas de Email
      const { count: emailTotal } = await supabase
        .from('email_logs')
        .select('*', { count: 'exact', head: true });

      const { count: emailSent } = await supabase
        .from('email_logs')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'sent');

      // Buscar estatísticas de WhatsApp
      const { count: waTotal } = await supabase
        .from('whatsapp_messages')
        .select('*', { count: 'exact', head: true })
        .eq('direction', 'outgoing');

      const { count: waDelivered } = await supabase
        .from('whatsapp_messages')
        .select('*', { count: 'exact', head: true })
        .eq('direction', 'outgoing')
        .in('status', ['delivered', 'read']);

      // Buscar estatísticas de Eventos
      const { count: eventsTotal } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true });

      const { count: registrationsTotal } = await supabase
        .from('event_registrations')
        .select('*', { count: 'exact', head: true });

      const { count: checkinsTotal } = await supabase
        .from('event_registrations')
        .select('*', { count: 'exact', head: true })
        .eq('checked_in', true);

      // Buscar estatísticas de Líderes
      const { count: leadersTotal } = await supabase
        .from('lideres')
        .select('*', { count: 'exact', head: true });

      const { count: leadersActive } = await supabase
        .from('lideres')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      // Buscar top líderes
      const { data: topLeadersData } = await supabase
        .from('lideres')
        .select('id, nome_completo, pontuacao_total, cadastros')
        .eq('is_active', true)
        .order('pontuacao_total', { ascending: false })
        .limit(5);

      // Calcular total de indicações
      const { data: indicationsData } = await supabase
        .from('lideres')
        .select('cadastros');

      const totalIndications = indicationsData?.reduce((sum, l) => sum + (l.cadastros || 0), 0) || 0;

      // Calcular taxas
      const totalSMS = smsTotal || 0;
      const totalEmail = emailTotal || 0;
      const totalWhatsApp = waTotal || 0;
      const totalMessages = totalSMS + totalEmail + totalWhatsApp;

      const deliveredCount = (smsDelivered || 0) + (emailSent || 0) + (waDelivered || 0);
      const avgDeliveryRate = totalMessages > 0 ? (deliveredCount / totalMessages) * 100 : 0;

      const avgConversionRate = (registrationsTotal || 0) > 0
        ? ((checkinsTotal || 0) / (registrationsTotal || 1)) * 100
        : 0;

      return {
        totalMessages,
        totalSMS,
        totalEmail,
        totalWhatsApp,
        avgDeliveryRate,
        totalEvents: eventsTotal || 0,
        totalRegistrations: registrationsTotal || 0,
        totalCheckins: checkinsTotal || 0,
        avgConversionRate,
        totalLeaders: leadersTotal || 0,
        activeLeaders: leadersActive || 0,
        totalIndications,
        topLeaders: (topLeadersData || []).map(l => ({
          id: l.id,
          name: l.nome_completo,
          points: l.pontuacao_total,
          indications: l.cadastros
        })),
        lastUpdate: new Date().toISOString()
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
    refetchOnWindowFocus: false
  });
}
