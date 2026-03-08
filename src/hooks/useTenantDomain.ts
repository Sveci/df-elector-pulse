import { useTenantContext } from "@/contexts/TenantContext";

/**
 * Hook que retorna o custom_domain do tenant ativo.
 * Usado para passar aos geradores de URL em páginas autenticadas.
 */
export function useTenantDomain(): string | null {
  try {
    const { activeTenant } = useTenantContext();
    return activeTenant?.custom_domain || null;
  } catch {
    return null;
  }
}
