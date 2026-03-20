import { useTenantContext } from "@/contexts/TenantContext";

/**
 * Hook que retorna o custom_domain do tenant ativo.
 * Usado para passar aos geradores de URL em páginas autenticadas.
 */
export function useTenantDomain(): string | null {
  // Hook must be called unconditionally — never inside try/catch
  const ctx = useTenantContext();
  return ctx?.activeTenant?.custom_domain ?? null;
}
