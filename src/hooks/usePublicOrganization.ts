import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Fetches organization data by tenant_id for public pages
 * where TenantContext is not available.
 */
export function usePublicOrganization(tenantId: string | null | undefined) {
  return useQuery({
    queryKey: ["public_organization", tenantId],
    queryFn: async () => {
      if (!tenantId) return null;

      // Get org data
      const { data: org, error: orgError } = await supabase
        .from("organization")
        .select("*")
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (orgError) throw orgError;

      // Get tenant political config
      const { data: tenant, error: tenantError } = await supabase
        .from("tenants")
        .select("cargo_politico, estado, cidade")
        .eq("id", tenantId)
        .maybeSingle();

      if (tenantError) throw tenantError;

      // Merge tenant political config into org (same as useOrganization)
      return {
        ...org,
        cargo: tenant?.cargo_politico || org?.cargo || null,
        estado: tenant?.estado || org?.estado || null,
        cidade: tenant?.cidade || org?.cidade || null,
      };
    },
    enabled: !!tenantId,
  });
}
