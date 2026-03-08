import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook para páginas públicas: resolve o tenant pelo hostname atual.
 * Usado quando não há contexto de autenticação (ex: formulários públicos, eventos).
 * Faz lookup via RPC get_tenant_by_domain usando window.location.hostname.
 */
export function usePublicTenantByDomain() {
  const hostname = typeof window !== "undefined" ? window.location.hostname : "";

  return useQuery({
    queryKey: ["public_tenant_by_domain", hostname],
    queryFn: async () => {
      if (!hostname) return null;

      // Skip lookup for known Lovable/preview domains
      if (
        hostname.includes("lovable.app") ||
        hostname.includes("lovableproject.com") ||
        hostname === "localhost"
      ) {
        return null;
      }

      const { data, error } = await supabase.rpc("get_tenant_by_domain", {
        _domain: hostname,
      });

      if (error) {
        console.warn("[usePublicTenantByDomain] Lookup failed:", error.message);
        return null;
      }

      if (!data || data.length === 0) return null;

      return {
        id: data[0].id as string,
        nome: data[0].nome as string,
        slug: data[0].slug as string,
        custom_domain: data[0].custom_domain as string,
        logo_url: data[0].logo_url as string | null,
      };
    },
    enabled: !!hostname,
    staleTime: 5 * 60 * 1000, // Cache 5 min
    retry: 1,
  });
}
