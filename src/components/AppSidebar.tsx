import { NavLink, useLocation } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useOrganization } from "@/hooks/useOrganization";
import { useDemoMask } from "@/contexts/DemoModeContext";
import { 
  LayoutDashboard, Users, UserCheck, Calendar, Target, FolderKanban, Bot, Settings, Shield,
  Building, LogOut, UserPlus, List, History as HistoryIcon, MessageSquare, Mail, HelpCircle,
  Ticket, Map, ClipboardList, Smartphone, GitBranch, Clock, CalendarDays, Globe,
  ChevronDown, Eye, Heart, GitCompare, UsersRound, MessageCircle, Sparkles, CalendarCheck, FileBarChart, Settings2,
  Package
} from "lucide-react";
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import logoIcon from "@/assets/logo-eleitor360-icon.png";
import logo from "@/assets/logo-eleitor360.png";


type AppRole = 'super_admin' | 'admin' | 'atendente' | 'checkin_operator';

interface MenuItem { title: string; url: string; icon: any; roles: AppRole[]; }
interface SubMenuItem { title: string; url: string; icon: any; }

const mainItems: MenuItem[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, roles: ['super_admin', 'admin', 'atendente'] },
  { title: "Contatos", url: "/contacts", icon: Users, roles: ['super_admin', 'admin', 'atendente'] },
  { title: "Lideranças", url: "/leaders", icon: UserCheck, roles: ['super_admin', 'admin', 'atendente'] },
  { title: "Árvore", url: "/leaders/tree", icon: GitBranch, roles: ['super_admin', 'admin', 'atendente'] },
  { title: "Mapa Estratégico", url: "/strategic-map", icon: Map, roles: ['super_admin', 'admin', 'atendente'] },
  { title: "Materiais", url: "/materials", icon: Package, roles: ['super_admin'] },
];

const campaignItems: MenuItem[] = [
  { title: "Campanhas", url: "/campaigns", icon: Target, roles: ['super_admin', 'admin', 'atendente'] },
  { title: "Pesquisas", url: "/surveys", icon: ClipboardList, roles: ['super_admin', 'admin', 'atendente'] },
  { title: "Eventos", url: "/events", icon: Calendar, roles: ['super_admin', 'admin', 'atendente', 'checkin_operator'] },
  { title: "Programas", url: "/projects", icon: FolderKanban, roles: ['super_admin', 'admin', 'atendente'] },
];

const publicOpinionSubItems: SubMenuItem[] = [
  { title: "Visão Geral", url: "/public-opinion", icon: Eye },
  { title: "Sentimento", url: "/public-opinion/sentiment", icon: Heart },
  { title: "Linha do Tempo", url: "/public-opinion/timeline", icon: Clock },
  { title: "Comparação", url: "/public-opinion/comparison", icon: GitCompare },
  { title: "Análise de Conteúdo", url: "/public-opinion/demographics", icon: UsersRound },
  { title: "Menções", url: "/public-opinion/comments", icon: MessageCircle },
  { title: "Insights IA", url: "/public-opinion/insights", icon: Sparkles },
  { title: "Eventos", url: "/public-opinion/events", icon: CalendarCheck },
  { title: "Relatórios", url: "/public-opinion/reports", icon: FileBarChart },
  { title: "Configurações", url: "/public-opinion/settings", icon: Settings2 },
];

const communicationItems: MenuItem[] = [
  { title: "Agente IA", url: "/ai-agent", icon: Bot, roles: ['super_admin', 'admin', 'atendente'] },
  { title: "WhatsApp", url: "/whatsapp", icon: MessageSquare, roles: ['super_admin', 'admin', 'atendente'] },
  { title: "Email", url: "/email", icon: Mail, roles: ['super_admin', 'admin', 'atendente'] },
  { title: "SMS", url: "/sms", icon: Smartphone, roles: ['super_admin', 'admin', 'atendente'] },
  { title: "Agendados", url: "/scheduled", icon: Clock, roles: ['super_admin', 'admin', 'atendente'] },
];

const officeItems: MenuItem[] = [
  { title: "Nova Visita", url: "/office/new", icon: UserPlus, roles: ['super_admin', 'admin', 'atendente'] },
  { title: "Agenda", url: "/office/schedule", icon: CalendarDays, roles: ['super_admin'] },
  { title: "Fila do Dia", url: "/office/queue", icon: List, roles: ['super_admin', 'admin', 'atendente'] },
  { title: "Histórico", url: "/office/history", icon: HistoryIcon, roles: ['super_admin', 'admin', 'atendente'] },
  { title: "Configurações", url: "/office/settings", icon: Settings, roles: ['super_admin', 'admin'] },
];

const settingsItems: MenuItem[] = [
  { title: "Privacidade", url: "/settings/privacy", icon: Shield, roles: ['super_admin', 'admin', 'atendente', 'checkin_operator'] },
  { title: "Organização", url: "/settings/organization", icon: Building, roles: ['super_admin', 'admin'] },
  { title: "Suporte", url: "/settings/support", icon: HelpCircle, roles: ['super_admin', 'admin', 'atendente', 'checkin_operator'] },
];

const adminSettingsItems: MenuItem[] = [
  { title: "Administrar Tickets", url: "/settings/admin-tickets", icon: Ticket, roles: ['super_admin'] },
];

export function AppSidebar() {
  const { state, setOpenMobile } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;
  const isMobile = useIsMobile();
  const { data: isSuperAdmin } = useIsSuperAdmin();
  const { logout } = useAuth();
  const { role } = useUserRole();
  const { data: organization } = useOrganization();
  const { m } = useDemoMask();

  const platformName = m.platformName(organization?.nome_plataforma || "Eleitor 360.ai");
  const platformInitial = platformName.charAt(0).toUpperCase();
  const isCollapsed = state === "collapsed";

  const isPublicOpinionActive = currentPath.startsWith('/public-opinion');
  const [poOpen, setPoOpen] = useState(isPublicOpinionActive);
  const poButtonRef = useRef<HTMLButtonElement>(null);
  const poMenuRef = useRef<HTMLDivElement>(null);
  const [poMenuPos, setPoMenuPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    setPoOpen(false);
  }, [currentPath]);

  useEffect(() => {
    if (poOpen && poButtonRef.current) {
      const rect = poButtonRef.current.getBoundingClientRect();
      setPoMenuPos({ top: rect.top, left: rect.right + 8 });
    }
  }, [poOpen]);

  useEffect(() => {
    if (!poOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        poButtonRef.current && !poButtonRef.current.contains(e.target as Node) &&
        poMenuRef.current && !poMenuRef.current.contains(e.target as Node)
      ) {
        setPoOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [poOpen]);

  const filterByRole = (items: MenuItem[]) => {
    if (!role) return [];
    return items.filter(item => item.roles.includes(role as AppRole));
  };

  useEffect(() => {
    if (isMobile) setOpenMobile(false);
  }, [location.pathname, isMobile, setOpenMobile]);
  
  const renderMenuItem = (item: MenuItem | SubMenuItem) => {
    const active = currentPath === item.url;

    const content = (
      <SidebarMenuButton asChild isActive={active}>
        <NavLink 
          to={item.url} 
          end 
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

  const filteredMainItems = filterByRole(mainItems);
  const filteredCampaignItems = filterByRole(campaignItems);
  const filteredCommunicationItems = filterByRole(communicationItems);
  const filteredOfficeItems = filterByRole(officeItems);
  const filteredSettingsItems = filterByRole(settingsItems);
  const filteredAdminSettingsItems = filterByRole(adminSettingsItems);
  const showPublicOpinion = role === 'super_admin';

  const renderSection = (label: string, items: MenuItem[]) => {
    if (items.length === 0) return null;
    return (
      <SidebarGroup>
        {!isCollapsed && (
          <SidebarGroupLabel className="text-gray-500 text-xs font-medium uppercase tracking-wider">{label}</SidebarGroupLabel>
        )}
        <SidebarGroupContent>
          <SidebarMenu>
            {items.map((item) => (
              <SidebarMenuItem key={item.title}>{renderMenuItem(item)}</SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  };

  return (
    <Sidebar className={isCollapsed ? "w-20" : "w-64"} collapsible="icon">
      <SidebarContent className="bg-gray-900 border-r border-gray-800">
        {/* Logo/Header */}
        <div className={`${isCollapsed ? 'py-6 px-2.5' : 'p-4'} ${!isCollapsed ? 'border-b border-gray-800' : ''}`}>
          {!isCollapsed ? (
            <img src={logo} alt="Eleitor 360.ai" className="h-10 object-contain" />
          ) : (
            <div className="w-10 h-10 rounded-lg flex items-center justify-center mx-auto overflow-hidden">
              <img src={logoIcon} alt="Eleitor 360.ai" className="w-10 h-10 object-contain" />
            </div>
          )}
        </div>

        {renderSection("Principal", filteredMainItems)}
        {renderSection("Campanhas", filteredCampaignItems)}

        {/* Comunicação with Public Opinion collapsible */}
        {(filteredCommunicationItems.length > 0 || showPublicOpinion) && (
          <SidebarGroup>
            {!isCollapsed && (
              <SidebarGroupLabel className="text-gray-500 text-xs font-medium uppercase tracking-wider">Comunicação</SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {/* Public Opinion Collapsible */}
                {showPublicOpinion && (
                  <SidebarMenuItem>
                    <div className="relative group/po">
                      {isCollapsed ? (
                         <Tooltip>
                          <TooltipTrigger asChild>
                            <SidebarMenuButton asChild isActive={isPublicOpinionActive}>
                              <NavLink
                                to="/public-opinion"
                                className="flex items-center justify-center px-2.5 py-3 rounded-lg text-sm font-medium transition-colors w-full"
                              >
                                <Globe className="h-6 w-6 shrink-0" />
                              </NavLink>
                            </SidebarMenuButton>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="font-medium">Opinião Pública</TooltipContent>
                        </Tooltip>
                      ) : (
                        <SidebarMenuButton asChild isActive={isPublicOpinionActive}>
                          <button
                            ref={poButtonRef}
                            onClick={() => setPoOpen(!poOpen)}
                            className="flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors w-full"
                          >
                            <Globe className="h-5 w-5 shrink-0" />
                            <span className="ml-3 flex-1 text-left">Opinião Pública</span>
                            <ChevronDown className={`h-4 w-4 transition-transform ${poOpen ? 'rotate-180' : ''}`} />
                          </button>
                        </SidebarMenuButton>
                      )}
                      {/* Floating submenu via portal */}
                      {poOpen && !isCollapsed && createPortal(
                        <div
                          ref={poMenuRef}
                          className="fixed z-[9999] w-52 bg-gray-800 border border-gray-700 rounded-lg shadow-lg py-2"
                          style={{ top: poMenuPos.top, left: poMenuPos.left }}
                        >
                          {publicOpinionSubItems.map((sub) => (
                            <NavLink
                              key={sub.url}
                              to={sub.url}
                              end
                              onClick={() => setPoOpen(false)}
                              className={({ isActive }) => `
                                ${isActive ? "bg-primary/10 text-primary font-medium" : "text-gray-300 hover:bg-primary/10 hover:text-primary"}
                                flex items-center gap-2 px-3 py-2 text-sm transition-colors rounded-md
                              `}
                            >
                              <sub.icon className="h-4 w-4 shrink-0" />
                              {sub.title}
                            </NavLink>
                          ))}
                        </div>,
                        document.body
                      )}
                    </div>
                  </SidebarMenuItem>
                )}
                {filteredCommunicationItems.map((item) => (
                  <SidebarMenuItem key={item.title}>{renderMenuItem(item)}</SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {renderSection("Gabinete", filteredOfficeItems)}

        {/* Configurações */}
        {(filteredSettingsItems.length > 0 || filteredAdminSettingsItems.length > 0) && (
          <SidebarGroup>
            {!isCollapsed && (
              <SidebarGroupLabel className="text-gray-500 text-xs font-medium uppercase tracking-wider">Configurações</SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {filteredSettingsItems.map((item) => (
                  <SidebarMenuItem key={item.title}>{renderMenuItem(item)}</SidebarMenuItem>
                ))}
                {isSuperAdmin && filteredAdminSettingsItems.map((item) => (
                  <SidebarMenuItem key={item.title}>{renderMenuItem(item)}</SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

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
