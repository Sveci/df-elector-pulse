import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import UserMenu from "./UserMenu";
import { NotificationBell } from "./NotificationBell";
import { SessionLogoutWarning } from "./SessionLogoutWarning";
import { InactivityWarning } from "./InactivityWarning";
import { WhatsAppDisconnectedAlert } from "./WhatsAppDisconnectedAlert";
import { useTenantContext } from "@/contexts/TenantContext";
import { Building2 } from "lucide-react";
import { Menu } from "lucide-react";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({
  children
}: DashboardLayoutProps) {
  const { activeTenant, isSuperAdmin, setShowTenantSelector } = useTenantContext();

  return (
    <SidebarProvider>
      {/* Warning de logout forçado */}
      <SessionLogoutWarning />
      
      {/* Warning de inatividade */}
      <InactivityWarning />
      
      <div className="min-h-screen flex w-full max-w-full overflow-x-hidden bg-background">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <header className="bg-card border-b border-border h-16 flex items-center px-4 sm:px-6 sticky top-0 z-10">
            <SidebarTrigger className="mr-4 h-8 w-8 rounded-md hover:bg-accent flex items-center justify-center">
              <Menu className="h-4 w-4" />
            </SidebarTrigger>
            
            <div className="flex-1" />

            {/* Tenant ativo (só para super_admin) */}
            {isSuperAdmin && activeTenant && (
              <button
                onClick={() => setShowTenantSelector(true)}
                className="flex items-center gap-2 mr-3 px-3 py-1.5 rounded-lg border border-border bg-accent/50 hover:bg-accent transition-colors text-sm"
              >
                <Building2 className="h-4 w-4 text-primary" />
                <span className="font-medium text-foreground truncate max-w-[160px]">
                  {activeTenant.nome}
                </span>
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                  activeTenant.plano === 'premium'
                    ? 'bg-amber-500/10 text-amber-600'
                    : activeTenant.plano === 'pro'
                    ? 'bg-blue-500/10 text-blue-600'
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {activeTenant.plano}
                </span>
              </button>
            )}

            {/* Alerta de WhatsApp desconectado */}
            <WhatsAppDisconnectedAlert />

            {/* Notification Bell */}
            <NotificationBell />

            {/* User Menu */}
            <UserMenu />
          </header>

          {/* Main content */}
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
