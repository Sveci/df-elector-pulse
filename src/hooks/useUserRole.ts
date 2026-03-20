import { useAuth } from "@/contexts/AuthContext";

export type AppRole = 'super_admin' | 'admin' | 'atendente' | 'checkin_operator';

// Definição de acessos por role
const ROLE_ACCESS: Record<string, { pages: string[], settings: string[] }> = {
  admin: {
    // Admin tem acesso a tudo
    pages: ['dashboard', 'contacts', 'leaders', 'campaigns', 'events', 'projects', 'ai-agent', 'whatsapp', 'email', 'office', 'settings'],
    settings: ['organization', 'team', 'integrations', 'tracking', 'ai-providers', 'affiliate-form', 'leader-form', 'privacy', 'support', 'profile']
  },
  atendente: {
    // Atendente: tudo menos Organização, Equipe, Integrações, Rastreamento, Provedores de IA
    pages: ['dashboard', 'contacts', 'leaders', 'campaigns', 'events', 'projects', 'ai-agent', 'whatsapp', 'email', 'office', 'settings'],
    settings: ['affiliate-form', 'leader-form', 'privacy', 'support', 'profile']
  },
  checkin_operator: {
    // Operador de check-in: somente Eventos
    pages: ['events'],
    settings: ['privacy', 'profile']
  }
};

export function useUserRole() {
  const { user } = useAuth();

  const role = user?.role as AppRole | undefined;

  const isAdmin = role === 'admin' || role === 'super_admin';
  const isSuperAdmin = role === 'super_admin';
  const isAtendente = role === 'atendente';
  const isCheckinOperator = role === 'checkin_operator';

  const canAccessPage = (page: string): boolean => {
    if (!role) return false;
    if (role === 'super_admin') return true; // Super admin tem acesso total

    const access = ROLE_ACCESS[role];
    if (!access) return false;

    return access.pages.includes(page);
  };

  const canAccessSetting = (setting: string): boolean => {
    if (!role) return false;
    if (role === 'super_admin') return true; // Super admin tem acesso total

    const access = ROLE_ACCESS[role];
    if (!access) return false;

    return access.settings.includes(setting);
  };

  const canAccess = (allowedRoles: AppRole[]): boolean => {
    if (!role) return false;
    if (role === 'super_admin') return true;
    return allowedRoles.includes(role);
  };

  return {
    role,
    isAdmin,
    isSuperAdmin,
    isAtendente,
    isCheckinOperator,
    canAccess,
    canAccessPage,
    canAccessSetting
  };
}
