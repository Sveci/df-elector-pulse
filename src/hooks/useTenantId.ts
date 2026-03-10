import { useTenantContext } from "@/contexts/TenantContext";

/**
 * Hook that returns the active tenant's ID.
 * Used to filter queries and pass tenant_id to mutations.
 */
export function useTenantId(): string | null {
  try {
    const { activeTenant } = useTenantContext();
    return activeTenant?.id || null;
  } catch {
    return null;
  }
}
