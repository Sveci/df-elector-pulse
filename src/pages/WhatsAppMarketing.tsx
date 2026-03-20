import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Search } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { DashboardLayout } from "@/components/DashboardLayout";
import { WhatsAppTemplatesTab } from "@/components/whatsapp/WhatsAppTemplatesTab";
import { WhatsAppBulkSendTab } from "@/components/whatsapp/WhatsAppBulkSendTab";
import { WhatsAppHistoryTab } from "@/components/whatsapp/WhatsAppHistoryTab";

import { useTutorial } from "@/hooks/useTutorial";
import { TutorialOverlay } from "@/components/TutorialOverlay";
import { TutorialButton } from "@/components/TutorialButton";
import type { Step } from "react-joyride";

const whatsappTutorialSteps: Step[] = [
  {
    target: '[data-tutorial="whatsapp-header"]',
    title: '💬 WhatsApp Marketing',
    content: 'Gerencie envios de mensagens em massa via WhatsApp, crie templates personalizados e acompanhe o histórico de envios.',
    placement: 'bottom',
    disableBeacon: true,
  },
  {
    target: '[data-tutorial="whatsapp-tabs"]',
    title: '📑 Abas de Navegação',
    content: 'Navegue entre Envio em Massa, API Oficial para templates Meta, Templates para criar modelos de mensagem e Histórico para acompanhar envios.',
    placement: 'bottom',
  },
  {
    target: '[data-tutorial="whatsapp-content"]',
    title: '📤 Área de Conteúdo',
    content: 'Cada aba apresenta funcionalidades específicas. No envio em massa, selecione contatos e templates. Em templates, crie modelos reutilizáveis.',
    placement: 'top',
  },
];

export default function WhatsAppMarketing() {
  const [activeTab, setActiveTab] = useState("bulk");
  const [searchTerm, setSearchTerm] = useState("");
  const { restartTutorial } = useTutorial("whatsapp-marketing", whatsappTutorialSteps, { delay: 1200 });

  return (
    <DashboardLayout>
      <TutorialOverlay page="whatsapp-marketing" />
      <div className="p-4 sm:p-6 max-w-full overflow-x-hidden">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-6" data-tutorial="whatsapp-header">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <PageHeader icon={MessageSquare} title="WhatsApp Marketing" subtitle="Gerencie templates e envie mensagens em massa via WhatsApp">
                  <TutorialButton onClick={restartTutorial} />
                </PageHeader>
              </div>

              {activeTab === "templates" && (
                <div className="relative w-full sm:w-auto">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar templates..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 w-full sm:w-[280px]"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full grid grid-cols-3 mb-6" data-tutorial="whatsapp-tabs">
              <TabsTrigger value="bulk">Envio em Massa</TabsTrigger>
              <TabsTrigger value="templates">Templates</TabsTrigger>
              <TabsTrigger value="history">Histórico</TabsTrigger>
            </TabsList>

            <div data-tutorial="whatsapp-content">
              <TabsContent value="bulk">
                <WhatsAppBulkSendTab />
              </TabsContent>

              <TabsContent value="templates">
                <WhatsAppTemplatesTab />
              </TabsContent>

              <TabsContent value="history">
                <WhatsAppHistoryTab />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </DashboardLayout>
  );
}