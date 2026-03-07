import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "./AdminSidebar";
import UserMenu from "./UserMenu";
import { Menu } from "lucide-react";

interface AdminLayoutProps {
  children: ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full max-w-full overflow-x-hidden bg-background">
        <AdminSidebar />

        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <header className="bg-card border-b border-border h-16 flex items-center px-4 sm:px-6 sticky top-0 z-10">
            <SidebarTrigger className="mr-4 h-8 w-8 rounded-md hover:bg-accent flex items-center justify-center">
              <Menu className="h-4 w-4" />
            </SidebarTrigger>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold bg-amber-500/10 text-amber-500 px-2 py-1 rounded-md uppercase tracking-wider">
                Admin
              </span>
            </div>

            <div className="flex-1" />

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
