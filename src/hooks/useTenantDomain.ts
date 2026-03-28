import { useTenantContext } from "@/contexts/TenantContext";

/**
 * Hook que retorna o custom_domain do tenant ativo.
 * Usado para passar aos geradores de URL em páginas autenticadas.
 */
export function useTenantDomain(): string | null {
  // Hook must be called unconditionally — never inside try/catch
  const ctx = useTenantContext();
  const tenantDomain = ctx?.activeTenant?.custom_domain;
  if (tenantDomain) return tenantDomain;

  if (typeof window !== "undefined") {
    const cachedTenantDomain = localStorage.getItem("active_tenant_domain");
    if (cachedTenantDomain) return cachedTenantDomain;
  }

  return null;
}
