import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Search } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { DashboardLayout } from "@/components/DashboardLayout";
import { SMSTemplatesTab } from "@/components/sms/SMSTemplatesTab";
import { SMSBulkSendTab } from "@/components/sms/SMSBulkSendTab";
import { SMSHistoryTab } from "@/components/sms/SMSHistoryTab";
import { useTutorial } from "@/hooks/useTutorial";
import { TutorialOverlay } from "@/components/TutorialOverlay";
import { TutorialButton } from "@/components/TutorialButton";
import type { Step } from "react-joyride";

const smsTutorialSteps: Step[] = [
  {
    target: '[data-tutorial="sms-header"]',
    title: '📱 SMS Marketing',
    content: 'Gerencie envios de mensagens SMS em massa, crie templates personalizados e acompanhe o histórico de envios.',
    placement: 'bottom',
    disableBeacon: true,
  },
  {
    target: '[data-tutorial="sms-tabs"]',
    title: '📑 Abas de Navegação',
    content: 'Navegue entre Envio em Massa para campanhas, Templates para criar modelos de mensagem e Histórico para acompanhar envios.',
    placement: 'bottom',
  },
  {
    target: '[data-tutorial="sms-content"]',
    title: '📤 Área de Conteúdo',
    content: 'Cada aba apresenta funcionalidades específicas. O SMS é ideal para mensagens curtas e com alta taxa de abertura.',
    placement: 'top',
  },
];

export default function SMSMarketing() {
  const [activeTab, setActiveTab] = useState("bulk");
  const [searchTerm, setSearchTerm] = useState("");
  const { restartTutorial } = useTutorial("sms-marketing", smsTutorialSteps, { delay: 1200 });

  return (
    <DashboardLayout>
      <TutorialOverlay page="sms-marketing" />
      <div className="p-4 sm:p-6 max-w-full overflow-x-hidden">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-6" data-tutorial="sms-header">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <PageHeader icon={MessageSquare} title="SMS Marketing" subtitle="Gerencie templates e envie mensagens em massa via SMS">
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
            <TabsList className="w-full grid grid-cols-3 mb-6" data-tutorial="sms-tabs">
              <TabsTrigger value="bulk">Envio em Massa</TabsTrigger>
              <TabsTrigger value="templates">Templates</TabsTrigger>
              <TabsTrigger value="history">Histórico</TabsTrigger>
            </TabsList>

            <div data-tutorial="sms-content">
              <TabsContent value="bulk">
                <SMSBulkSendTab />
              </TabsContent>

              <TabsContent value="templates">
                <SMSTemplatesTab searchTerm={searchTerm} />
              </TabsContent>

              <TabsContent value="history">
                <SMSHistoryTab />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </DashboardLayout>
  );
}
