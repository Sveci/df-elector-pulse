import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import UserMenu from "./UserMenu";
import { NotificationBell } from "./NotificationBell";
import { SessionLogoutWarning } from "./SessionLogoutWarning";
import { InactivityWarning } from "./InactivityWarning";
import { WhatsAppDisconnectedAlert } from "./WhatsAppDisconnectedAlert";
import { Menu } from "lucide-react";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({
  children
}: DashboardLayoutProps) {
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
