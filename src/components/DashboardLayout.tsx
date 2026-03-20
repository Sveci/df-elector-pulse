import { memo, ReactNode, useEffect } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import UserMenu from "./UserMenu";
import { NotificationBell } from "./NotificationBell";
import { SessionLogoutWarning } from "./SessionLogoutWarning";
import { InactivityWarning } from "./InactivityWarning";
import { WhatsAppDisconnectedAlert } from "./WhatsAppDisconnectedAlert";
import { useTenantContext } from "@/contexts/TenantContext";
import { Building2, Menu } from "lucide-react";

interface DashboardLayoutProps {
  children: ReactNode;
}

// Plan badge styling map
const PLAN_STYLES: Record<string, string> = {
  premium: "bg-amber-500/10 text-amber-600 border border-amber-500/20",
  pro: "bg-blue-500/10 text-blue-600 border border-blue-500/20",
  basic: "bg-muted text-muted-foreground border border-border",
};

/**
 * DashboardLayout – root layout for authenticated pages.
 * Memoized to prevent re-renders when parent contexts update unrelated state.
 */
export const DashboardLayout = memo(function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  const { activeTenant, isSuperAdmin, setShowTenantSelector, isLoading } =
    useTenantContext();

  // Auto-open tenant selector for super admins without an active tenant
  useEffect(() => {
    if (isSuperAdmin && !activeTenant && !isLoading) {
      setShowTenantSelector(true);
    }
  }, [isSuperAdmin, activeTenant, isLoading, setShowTenantSelector]);

  return (
    <SidebarProvider>
      {/* Session / inactivity warnings */}
      <SessionLogoutWarning />
      <InactivityWarning />

      <div className="min-h-screen flex w-full max-w-full overflow-x-hidden bg-background">
        <AppSidebar />

        <div className="flex-1 flex flex-col min-w-0">
          {/* ── Top header ─────────────────────────────────────────────── */}
          <header className="bg-card/95 backdrop-blur-sm border-b border-border h-16 flex items-center px-4 sm:px-6 sticky top-0 z-20 shadow-sm">
            {/* Sidebar toggle */}
            <SidebarTrigger
              className="mr-4 h-8 w-8 rounded-md hover:bg-accent transition-colors flex items-center justify-center"
              aria-label="Alternar menu lateral"
            >
              <Menu className="h-4 w-4" />
            </SidebarTrigger>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Tenant selector (super_admin only) */}
            {isSuperAdmin && activeTenant && (
              <button
                onClick={() => setShowTenantSelector(true)}
                className="group flex items-center gap-2 mr-3 px-3 py-1.5 rounded-lg border border-border bg-accent/50 hover:bg-accent transition-all duration-150 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                title="Trocar tenant ativo"
              >
                <Building2 className="h-4 w-4 text-primary flex-shrink-0" />
                <span className="font-medium text-foreground truncate max-w-[160px]">
                  {activeTenant.nome}
                </span>
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                    PLAN_STYLES[activeTenant.plano] ?? PLAN_STYLES.basic
                  }`}
                >
                  {activeTenant.plano}
                </span>
              </button>
            )}

            {/* WhatsApp disconnect alert */}
            <WhatsAppDisconnectedAlert />

            {/* Notification bell */}
            <NotificationBell />

            {/* User menu */}
            <UserMenu />
          </header>

          {/* ── Page content ───────────────────────────────────────────── */}
          <main className="flex-1 overflow-auto focus:outline-none" tabIndex={-1} id="main-content">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
});
