import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserTenants, Tenant } from "@/hooks/useTenants";

interface TenantContextType {
  activeTenant: Tenant | null;
  setActiveTenant: (tenant: Tenant | null) => void;
  tenants: Array<{ id: string; tenant: Tenant; role: string }>;
  isLoading: boolean;
  showTenantSelector: boolean;
  setShowTenantSelector: (show: boolean) => void;
  isSuperAdmin: boolean;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";
  const { data: userTenants, isLoading } = useUserTenants();

  const [activeTenant, setActiveTenantState] = useState<Tenant | null>(null);
  const [showTenantSelector, setShowTenantSelector] = useState(false);

  const setActiveTenant = (tenant: Tenant | null) => {
    setActiveTenantState(tenant);
    if (tenant) {
      localStorage.setItem("active_tenant_id", tenant.id);
    } else {
      localStorage.removeItem("active_tenant_id");
    }
  };

  // Ao carregar, verificar se super_admin precisa escolher tenant
  useEffect(() => {
    if (!user || isLoading) return;

    if (isSuperAdmin && userTenants && userTenants.length > 0) {
      const savedTenantId = localStorage.getItem("active_tenant_id");
      const savedTenant = userTenants.find((ut) => ut.tenant_id === savedTenantId);

      if (savedTenant) {
        setActiveTenantState(savedTenant.tenant);
      } else {
        // Se não tem tenant salvo, mostrar modal para escolher
        setShowTenantSelector(true);
      }
    } else if (!isSuperAdmin && userTenants && userTenants.length > 0) {
      // Usuário normal: pegar o default ou primeiro
      const defaultTenant = userTenants.find((ut) => ut.is_default) || userTenants[0];
      if (defaultTenant) {
        setActiveTenantState(defaultTenant.tenant);
      }
    }
  }, [user, userTenants, isLoading, isSuperAdmin]);

  return (
    <TenantContext.Provider
      value={{
        activeTenant,
        setActiveTenant,
        tenants: userTenants?.map((ut) => ({ id: ut.id, tenant: ut.tenant, role: ut.role })) || [],
        isLoading,
        showTenantSelector,
        setShowTenantSelector,
        isSuperAdmin,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenantContext() {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error("useTenantContext must be used within TenantProvider");
  }
  return context;
}
