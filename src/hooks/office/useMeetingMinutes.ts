import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useMeetingMinutes(visitId: string | undefined) {
  return useQuery({
    queryKey: ["meeting_minutes", visitId],
    queryFn: async () => {
      if (!visitId) return null;

      const { data, error } = await supabase
        .from("office_meeting_minutes")
        .select("*")
        .eq("visit_id", visitId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!visitId,
  });
}
