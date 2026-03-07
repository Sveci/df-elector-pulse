import { NavLink, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard, Building2, Ticket, LogOut, ArrowLeft, Settings2
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import logoIcon from "@/assets/logo-collapsed.png";
import logo from "@/assets/logo-eleitor360.png";

interface MenuItem {
  title: string;
  url: string;
  icon: any;
}

const adminItems: MenuItem[] = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
  { title: "Tenants", url: "/admin/tenants", icon: Building2 },
  { title: "Tickets", url: "/admin/tickets", icon: Ticket },
  { title: "APIs Externas", url: "/admin/apis", icon: Key },
];

export function AdminSidebar() {
  const { state, setOpenMobile } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;
  const isMobile = useIsMobile();
  const { logout } = useAuth();
  const isCollapsed = state === "collapsed";

  useEffect(() => {
    if (isMobile) setOpenMobile(false);
  }, [location.pathname, isMobile, setOpenMobile]);

  const renderMenuItem = (item: MenuItem) => {
    const active = currentPath === item.url || (item.url !== "/admin" && currentPath.startsWith(item.url));

    const content = (
      <SidebarMenuButton asChild isActive={active}>
        <NavLink
          to={item.url}
          end={item.url === "/admin"}
          className={`flex items-center ${isCollapsed ? 'justify-center px-2.5 py-3' : 'px-3 py-2'} rounded-lg text-sm font-medium transition-colors w-full`}
        >
          <item.icon className={`${isCollapsed ? 'h-6 w-6' : 'h-5 w-5'} shrink-0`} />
          {!isCollapsed && <span className="ml-3">{item.title}</span>}
        </NavLink>
      </SidebarMenuButton>
    );

    if (isCollapsed) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent side="right" className="font-medium">{item.title}</TooltipContent>
        </Tooltip>
      );
    }
    return content;
  };

  return (
    <Sidebar className={isCollapsed ? "w-20" : "w-64"} collapsible="icon">
      <SidebarContent className="bg-gray-900 border-r border-gray-800">
        {/* Logo/Header */}
        <div className={`${isCollapsed ? 'py-6 px-2.5' : 'p-4'} ${!isCollapsed ? 'border-b border-gray-800' : ''}`}>
          <div className="relative flex items-center justify-center w-full overflow-visible">
            <img
              src={logo}
              alt="Eleitor 360.ai"
              className={`h-8 object-contain transition-all duration-300 ease-in-out ${isCollapsed ? 'opacity-0 scale-75 w-0' : 'opacity-100 scale-100 w-full'}`}
            />
            <img
              src={logoIcon}
              alt="Eleitor 360.ai"
              className={`w-8 h-8 object-contain transition-all duration-300 ease-in-out absolute ${isCollapsed ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}`}
            />
          </div>
          {!isCollapsed && (
            <div className="mt-2 px-1">
              <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Painel Admin</span>
            </div>
          )}
        </div>

        {/* Admin Menu */}
        <SidebarGroup>
          {!isCollapsed && (
            <SidebarGroupLabel className="text-gray-500 text-xs font-medium uppercase tracking-wider">
              Administração
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {adminItems.map((item) => (
                <SidebarMenuItem key={item.title}>{renderMenuItem(item)}</SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Back to App */}
        <SidebarGroup>
          {!isCollapsed && (
            <SidebarGroupLabel className="text-gray-500 text-xs font-medium uppercase tracking-wider">
              Navegação
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                {isCollapsed ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <SidebarMenuButton asChild>
                        <NavLink
                          to="/dashboard"
                          className="flex items-center justify-center px-2.5 py-3 rounded-lg text-sm font-medium transition-colors w-full text-blue-400 hover:bg-blue-500/10"
                        >
                          <ArrowLeft className="h-6 w-6 shrink-0" />
                        </NavLink>
                      </SidebarMenuButton>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="font-medium">Voltar ao Sistema</TooltipContent>
                  </Tooltip>
                ) : (
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="/dashboard"
                      className="flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors w-full text-blue-400 hover:bg-blue-500/10"
                    >
                      <ArrowLeft className="h-5 w-5 shrink-0" />
                      <span className="ml-3">Voltar ao Sistema</span>
                    </NavLink>
                  </SidebarMenuButton>
                )}
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Logout */}
        <div className={`mt-auto ${isCollapsed ? 'py-6 px-2.5' : 'p-4'} ${!isCollapsed ? 'border-t border-gray-800' : ''}`}>
          {isCollapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => logout()}
                  className="text-red-400 hover:bg-red-500/10 w-full flex items-center justify-center py-3 rounded-lg text-sm font-medium transition-colors"
                >
                  <LogOut className="h-6 w-6" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="font-medium">Sair</TooltipContent>
            </Tooltip>
          ) : (
            <button
              onClick={() => logout()}
              className="text-red-400 hover:bg-red-500/10 w-full flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <LogOut className="h-5 w-5" />
              <span className="ml-3">Sair</span>
            </button>
          )}
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
