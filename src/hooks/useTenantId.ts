import { useTenantContext } from "@/contexts/TenantContext";

/**
 * Hook that returns the active tenant's ID.
 * Used to filter queries and pass tenant_id to mutations.
 */
export function useTenantId(): string | null {
  // Hook must be called unconditionally — never inside try/catch
  const ctx = useTenantContext();
  return ctx?.activeTenant?.id ?? null;
}
