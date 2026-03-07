import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { 
  Building2, 
  Users, 
  Bot, 
  CreditCard, 
  Palette, 
  Shield,
  Plug,
  ChevronRight,
  BarChart3,
  FileText,
  HelpCircle,
  Trophy,
  MessageSquareText,
  FileBarChart,
  FolderOpen,
  Copy
} from "lucide-react";
import { useTutorial } from "@/hooks/useTutorial";
import { TutorialOverlay } from "@/components/TutorialOverlay";
import { TutorialButton } from "@/components/TutorialButton";
import type { Step } from "react-joyride";

const settingsTutorialSteps: Step[] = [
  {
    target: '[data-tutorial="settings-header"]',
    title: "Configurações",
    content: "Gerencie todas as configurações da plataforma: organização, equipe, integrações e mais.",
    placement: "bottom",
    disableBeacon: true,
  },
  {
    target: '[data-tutorial="settings-grid"]',
    title: "Seções de Configuração",
    content: "Clique em cada card para acessar as configurações específicas. Algumas funcionalidades podem estar em desenvolvimento.",
    placement: "top",
  },
];

type AppRole = 'super_admin' | 'admin' | 'atendente' | 'checkin_operator';

interface SettingSection {
  title: string;
  description: string;
  icon: any;
  href: string;
  available: boolean;
  roles: AppRole[];
}

const Settings = () => {
  const { role, isAdmin } = useUserRole();

  const settingsSections: SettingSection[] = [
    {
      title: "Organização",
      description: "Configure os dados do político e informações da campanha",
      icon: Building2,
      href: "/settings/organization",
      available: true,
      roles: ['super_admin', 'admin'],
    },
    {
      title: "Equipe",
      description: "Gerencie usuários, permissões e convites",
      icon: Users,
      href: "/settings/team",
      available: true,
      roles: ['super_admin', 'admin'],
    },
    {
      title: "Provedores de IA",
      description: "Configure as credenciais para integração com serviços de IA",
      icon: Bot,
      href: "/settings/ai-providers",
      available: true,
      roles: ['super_admin', 'admin'],
    },
    {
      title: "Rastreamento",
      description: "Configure Facebook Pixel, Google Tag Manager e rastreamento de conversões",
      icon: BarChart3,
      href: "/settings/tracking",
      available: true,
      roles: ['super_admin', 'admin'],
    },
    {
      title: "Formulário de Indicação",
      description: "Configure a imagem de capa do formulário de cadastro via link de líder",
      icon: FileText,
      href: "/settings/affiliate-form",
      available: true,
      roles: ['super_admin', 'admin', 'atendente'],
    },
    {
      title: "Formulário de Líder",
      description: "Configure a aparência da página pública de cadastro de líderes",
      icon: Users,
      href: "/settings/leader-form",
      available: true,
      roles: ['super_admin', 'admin', 'atendente'],
    },
    {
      title: "Gamificação",
      description: "Configure regras de pontuação e níveis de líderes",
      icon: Trophy,
      href: "/settings/gamification",
      available: true,
      roles: ['super_admin', 'admin'],
    },
    {
      title: "Assistente Virtual WhatsApp",
      description: "Configure o chatbot para atender líderes automaticamente",
      icon: MessageSquareText,
      href: "/settings/whatsapp-chatbot",
      available: true,
      roles: ['super_admin', 'admin'],
    },
    {
      title: "Materiais por Região",
      description: "Configure materiais exclusivos para cada RA enviados após verificação",
      icon: FolderOpen,
      href: "/settings/region-materials",
      available: true,
      roles: ['super_admin', 'admin'],
    },
    {
      title: "Faturamento",
      description: "Gerencie seu plano, pagamentos e uso da plataforma",
      icon: CreditCard,
      href: "/settings/billing",
      available: false,
      roles: ['super_admin', 'admin'],
    },
    {
      title: "Integrações",
      description: "Conecte com WhatsApp, email marketing e redes sociais",
      icon: Plug,
      href: "/settings/integrations",
      available: true,
      roles: ['super_admin', 'admin'],
    },
    {
      title: "Branding",
      description: "Personalize cores, logos e identidade visual",
      icon: Palette,
      href: "/settings/branding",
      available: false,
      roles: ['super_admin', 'admin'],
    },
    {
      title: "Privacidade",
      description: "Configurações de segurança e proteção de dados",
      icon: Shield,
      href: "/settings/privacy",
      available: true,
      roles: ['super_admin', 'admin', 'atendente', 'checkin_operator'],
    },
    {
      title: "Suporte",
      description: "Abra tickets para reportar problemas ou tirar dúvidas",
      icon: HelpCircle,
      href: "/settings/support",
      available: true,
      roles: ['super_admin', 'admin', 'atendente', 'checkin_operator'],
    },
    {
      title: "Relatórios",
      description: "Visualize relatórios consolidados de comunicações, eventos e líderes",
      icon: FileBarChart,
      href: "/settings/reports",
      available: true,
      roles: ['super_admin', 'admin', 'atendente'],
    },
    {
      title: "Duplicidades",
      description: "Gerencie contatos que possuem cadastro duplicado como líder",
      icon: Copy,
      href: "/settings/duplicates",
      available: true,
      roles: ['super_admin', 'admin'],
    },
  ];

  // Filtrar seções baseado no role do usuário
  const visibleSections = settingsSections.filter(section => {
    if (!role) return false;
    return section.roles.includes(role as AppRole);
  });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Configurações</h1>
        <p className="text-gray-600 mt-2">
          Gerencie as configurações da sua organização e personalize a plataforma
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {visibleSections.map((section) => {
          const Icon = section.icon;
          const content = (
            <Card 
              className={`transition-all ${
                section.available 
                  ? "hover:shadow-md hover:border-primary-300 cursor-pointer" 
                  : "opacity-60 cursor-not-allowed"
              }`}
            >
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      section.available 
                        ? "bg-primary-100 text-primary-600" 
                        : "bg-gray-100 text-gray-400"
                    }`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="text-lg">{section.title}</span>
                  </div>
                  {section.available && <ChevronRight className="h-5 w-5 text-gray-400" />}
                </CardTitle>
                <CardDescription className="mt-2">
                  {section.description}
                  {!section.available && (
                    <span className="block mt-1 text-xs text-amber-600 font-medium">
                      Em breve
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
            </Card>
          );

          return section.available ? (
            <Link key={section.href} to={section.href}>
              {content}
            </Link>
          ) : (
            <div key={section.href}>
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Settings;
