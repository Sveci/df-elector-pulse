import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useIsSuperAdmin() {
  return useQuery({
    queryKey: ['is-super-admin'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { data } = await supabase
        .from('platform_admins')
        .select('role')
        .eq('id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      return data?.role === 'super_admin';
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
