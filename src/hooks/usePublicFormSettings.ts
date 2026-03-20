import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PublicFormSettings {
  affiliate_form_cover_url: string | null;
  affiliate_form_logo_url: string | null;
  leader_form_cover_url: string | null;
  leader_form_logo_url: string | null;
  leader_form_title: string | null;
  leader_form_subtitle: string | null;
}

/**
 * Hook for fetching public form settings via secure RPC function.
 * Only returns safe columns (URLs, titles) - no API credentials.
 * Safe for use on public/unauthenticated pages.
 */
export function usePublicFormSettings() {
  return useQuery({
    queryKey: ["public_form_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc("get_public_form_settings");

      if (error) throw error;

      // RPC returns array, get first result
      if (!data || data.length === 0) return null;
      return data[0] as PublicFormSettings;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes cache
  });
}
