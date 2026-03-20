import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface EventStats {
  totalEvents: number;
  activeEvents: number;
  totalRegistrations: number;
  totalCheckins: number;
  overallConversionRate: number;
  averageCapacityUtilization: number;
  mostPopularEvent: {
    name: string;
    registrations: number;
  } | null;
  bestConversionEvent: {
    name: string;
    rate: number;
  } | null;
}

export function useEventStats() {
  return useQuery({
    queryKey: ["event-stats"],
    queryFn: async (): Promise<EventStats> => {
      const { data: events, error } = await supabase
        .from("events")
        .select("*")
        .order("date", { ascending: false });

      if (error) throw error;

      const totalEvents = events?.length || 0;
      const activeEvents = events?.filter(e => e.status === 'active').length || 0;

      const totalRegistrations = events?.reduce((sum, e) => sum + (e.registrations_count || 0), 0) || 0;
      const totalCheckins = events?.reduce((sum, e) => sum + (e.checkedin_count || 0), 0) || 0;
      const overallConversionRate = totalRegistrations > 0
        ? (totalCheckins / totalRegistrations) * 100
        : 0;

      const totalCapacity = events?.reduce((sum, e) => sum + (e.capacity || 0), 0) || 0;
      const averageCapacityUtilization = totalCapacity > 0
        ? (totalRegistrations / totalCapacity) * 100
        : 0;

      const mostPopularEvent = events?.reduce((max, event) => {
        const registrations = event.registrations_count || 0;
        return registrations > (max?.registrations || 0)
          ? { name: event.name, registrations }
          : max;
      }, null as { name: string; registrations: number } | null);

      const bestConversionEvent = events?.reduce((best, event) => {
        const registrations = event.registrations_count || 0;
        const checkins = event.checkedin_count || 0;
        const rate = registrations > 0 ? (checkins / registrations) * 100 : 0;
        return rate > (best?.rate || 0)
          ? { name: event.name, rate }
          : best;
      }, null as { name: string; rate: number } | null);

      return {
        totalEvents,
        activeEvents,
        totalRegistrations,
        totalCheckins,
        overallConversionRate,
        averageCapacityUtilization,
        mostPopularEvent,
        bestConversionEvent,
      };
    },
  });
}
