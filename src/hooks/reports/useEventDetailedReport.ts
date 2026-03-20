import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface EventDetailedReport {
  // Métricas gerais
  totalRegistrations: number;
  totalCheckins: number;
  totalAbsent: number;
  conversionRate: number;

  // Origem geográfica
  citiesBreakdown: {
    cityId: string | null;
    cityName: string;
    registrations: number;
    checkins: number;
    absents: number;
    conversionRate: number;
  }[];

  // Perfil dos participantes
  profileBreakdown: {
    contacts: number;
    leaders: number;
    coordinators: number;
  };

  // Recorrência
  recurrenceStats: {
    firstTimers: number;
    recurring: number;
    averageEventsPerParticipant: number;
    topRecurring: {
      nome: string;
      email: string;
      eventsCount: number;
      eventNames: string[];
    }[];
  };

  // Lista detalhada
  registrations: {
    id: string;
    nome: string;
    email: string;
    whatsapp: string;
    cityName: string | null;
    checkedIn: boolean;
    checkedInAt: string | null;
    createdAt: string;
    profileType: 'contact' | 'leader' | 'coordinator';
    leaderId: string | null;
    parentLeaderId: string | null;
    parentLeaderName: string | null;
    otherEventsCount: number;
    otherEventNames: string[];
  }[];
}

function normalizePhone(phone: string | null): string {
  if (!phone) return '';
  return phone.replace(/\D/g, '').slice(-8);
}

export function useEventDetailedReport(eventId: string | null) {
  return useQuery({
    queryKey: ['event_detailed_report', eventId],
    queryFn: async (): Promise<EventDetailedReport> => {
      if (!eventId) {
        throw new Error('Event ID is required');
      }

      // Buscar inscrições do evento com cidade
      const { data: registrations, error: regError } = await supabase
        .from('event_registrations')
        .select(`
          id,
          nome,
          email,
          whatsapp,
          checked_in,
          checked_in_at,
          created_at,
          cidade_id,
          leader_id,
          office_cities (
            id,
            nome
          )
        `)
        .eq('event_id', eventId);

      if (regError) throw regError;
      if (!registrations || registrations.length === 0) {
        return {
          totalRegistrations: 0,
          totalCheckins: 0,
          totalAbsent: 0,
          conversionRate: 0,
          citiesBreakdown: [],
          profileBreakdown: { contacts: 0, leaders: 0, coordinators: 0 },
          recurrenceStats: { firstTimers: 0, recurring: 0, averageEventsPerParticipant: 0, topRecurring: [] },
          registrations: []
        };
      }

      // Buscar todos os líderes para classificação com paginação (limite de 1000 por query)
      const allLeaders: { id: string; email: string | null; telefone: string | null; is_coordinator: boolean | null; parent_leader_id: string | null; nome_completo: string }[] = [];
      let leaderOffset = 0;
      const leaderPageSize = 1000;
      while (true) {
        const { data: leadersBatch } = await supabase
          .from('lideres')
          .select('id, email, telefone, is_coordinator, parent_leader_id, nome_completo')
          .range(leaderOffset, leaderOffset + leaderPageSize - 1);
        if (!leadersBatch || leadersBatch.length === 0) break;
        allLeaders.push(...leadersBatch);
        if (leadersBatch.length < leaderPageSize) break;
        leaderOffset += leaderPageSize;
      }
      const leaders = allLeaders;

      // Criar maps para lookup rápido
      const leadersByEmail = new Map<string, { id: string; is_coordinator: boolean; parent_leader_id: string | null }>();
      const leadersByPhone = new Map<string, { id: string; is_coordinator: boolean; parent_leader_id: string | null }>();
      const leadersById = new Map<string, { nome_completo: string; is_coordinator: boolean }>();

      leaders?.forEach(l => {
        leadersById.set(l.id, {
          nome_completo: l.nome_completo,
          is_coordinator: l.is_coordinator || false
        });
        if (l.email) {
          leadersByEmail.set(l.email.toLowerCase(), { id: l.id, is_coordinator: l.is_coordinator || false, parent_leader_id: l.parent_leader_id });
        }
        if (l.telefone) {
          const normalized = normalizePhone(l.telefone);
          if (normalized.length >= 8) {
            leadersByPhone.set(normalized, { id: l.id, is_coordinator: l.is_coordinator || false, parent_leader_id: l.parent_leader_id });
          }
        }
      });

      // Buscar todas as inscrições de todos os eventos para calcular recorrência
      const emails = registrations.map(r => r.email.toLowerCase()).filter(Boolean);

      const { data: allRegistrations } = await supabase
        .from('event_registrations')
        .select('email, event_id, events!inner(id, name)')
        .in('email', emails)
        .neq('event_id', eventId);

      // Agrupar eventos por email
      const eventsByEmail = new Map<string, { id: string; name: string }[]>();
      allRegistrations?.forEach(reg => {
        const email = reg.email.toLowerCase();
        if (!eventsByEmail.has(email)) {
          eventsByEmail.set(email, []);
        }
        const events = eventsByEmail.get(email)!;
        const eventData = reg.events as unknown as { id: string; name: string };
        if (eventData && !events.find(e => e.id === eventData.id)) {
          events.push({ id: eventData.id, name: eventData.name });
        }
      });

      // Processar cada inscrição
      const processedRegistrations = registrations.map(reg => {
        const emailLower = reg.email?.toLowerCase() || '';
        const phoneNormalized = normalizePhone(reg.whatsapp);

        // Classificar perfil
        let profileType: 'contact' | 'leader' | 'coordinator' = 'contact';
        let matchedLeaderId: string | null = null;
        let parentLeaderId: string | null = null;
        let parentLeaderName: string | null = null;

        const emailMatch = leadersByEmail.get(emailLower);
        const phoneMatch = leadersByPhone.get(phoneNormalized);
        const match = emailMatch || phoneMatch;

        if (match) {
          matchedLeaderId = match.id;
          profileType = match.is_coordinator ? 'coordinator' : 'leader';

          // Buscar líder superior
          if (match.parent_leader_id) {
            parentLeaderId = match.parent_leader_id;
            const parentInfo = leadersById.get(match.parent_leader_id);
            parentLeaderName = parentInfo?.nome_completo || null;
          }
        }

        // Buscar outros eventos
        const otherEvents = eventsByEmail.get(emailLower) || [];

        const cityData = reg.office_cities as { id: string; nome: string } | null;

        return {
          id: reg.id,
          nome: reg.nome,
          email: reg.email,
          whatsapp: reg.whatsapp,
          cityName: cityData?.nome || null,
          cityId: reg.cidade_id,
          checkedIn: reg.checked_in || false,
          checkedInAt: reg.checked_in_at,
          createdAt: reg.created_at || '',
          profileType,
          leaderId: matchedLeaderId || reg.leader_id,
          parentLeaderId,
          parentLeaderName,
          otherEventsCount: otherEvents.length,
          otherEventNames: otherEvents.map(e => e.name)
        };
      });

      // Calcular métricas gerais
      const totalRegistrations = processedRegistrations.length;
      const totalCheckins = processedRegistrations.filter(r => r.checkedIn).length;
      const totalAbsent = totalRegistrations - totalCheckins;
      const conversionRate = totalRegistrations > 0 ? (totalCheckins / totalRegistrations) * 100 : 0;

      // Agrupar por cidade
      const citiesMap = new Map<string, { cityId: string | null; cityName: string; registrations: number; checkins: number }>();
      processedRegistrations.forEach(reg => {
        const cityKey = reg.cityId || 'unknown';
        const cityName = reg.cityName || 'Não informada';

        if (!citiesMap.has(cityKey)) {
          citiesMap.set(cityKey, { cityId: reg.cityId, cityName, registrations: 0, checkins: 0 });
        }

        const city = citiesMap.get(cityKey)!;
        city.registrations++;
        if (reg.checkedIn) city.checkins++;
      });

      const citiesBreakdown = Array.from(citiesMap.values())
        .map(city => ({
          ...city,
          absents: city.registrations - city.checkins,
          conversionRate: city.registrations > 0 ? (city.checkins / city.registrations) * 100 : 0
        }))
        .sort((a, b) => b.registrations - a.registrations);

      // Calcular perfil
      const profileBreakdown = {
        contacts: processedRegistrations.filter(r => r.profileType === 'contact').length,
        leaders: processedRegistrations.filter(r => r.profileType === 'leader').length,
        coordinators: processedRegistrations.filter(r => r.profileType === 'coordinator').length
      };

      // Calcular recorrência
      const firstTimers = processedRegistrations.filter(r => r.otherEventsCount === 0).length;
      const recurring = processedRegistrations.filter(r => r.otherEventsCount > 0).length;
      const totalEvents = processedRegistrations.reduce((sum, r) => sum + r.otherEventsCount + 1, 0);
      const averageEventsPerParticipant = totalRegistrations > 0 ? totalEvents / totalRegistrations : 0;

      // Top participantes recorrentes
      const topRecurring = processedRegistrations
        .filter(r => r.otherEventsCount > 0)
        .sort((a, b) => b.otherEventsCount - a.otherEventsCount)
        .slice(0, 5)
        .map(r => ({
          nome: r.nome,
          email: r.email,
          eventsCount: r.otherEventsCount + 1, // +1 para incluir o evento atual
          eventNames: r.otherEventNames
        }));

      return {
        totalRegistrations,
        totalCheckins,
        totalAbsent,
        conversionRate,
        citiesBreakdown,
        profileBreakdown,
        recurrenceStats: {
          firstTimers,
          recurring,
          averageEventsPerParticipant,
          topRecurring
        },
        registrations: processedRegistrations
      };
    },
    enabled: !!eventId
  });
}
