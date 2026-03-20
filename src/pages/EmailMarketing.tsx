import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Mail, Send, History, FileText, Search, FileBarChart } from "lucide-react";
import { EmailTemplatesTab } from "@/components/email/EmailTemplatesTab";
import { EmailHistoryTab } from "@/components/email/EmailHistoryTab";
import { EmailBulkSendTab } from "@/components/email/EmailBulkSendTab";
import { EmailReportTab } from "@/components/email/EmailReportTab";
import { useTutorial } from "@/hooks/useTutorial";
import { TutorialOverlay } from "@/components/TutorialOverlay";
import { TutorialButton } from "@/components/TutorialButton";
import type { Step } from "react-joyride";

const emailTutorialSteps: Step[] = [
  {
    target: '[data-tutorial="email-header"]',
    title: "Email Marketing",
    content: "Gerencie templates, envie emails em massa e acompanhe o histórico de envios.",
    placement: "bottom",
    disableBeacon: true,
  },
  {
    target: '[data-tutorial="email-tabs"]',
    title: "Navegação",
    content: "Alterne entre envio em massa, gerenciamento de templates e histórico de emails.",
    placement: "bottom",
  },
];

const EmailMarketing = () => {
  const [activeTab, setActiveTab] = useState("bulk");
  const [searchTerm, setSearchTerm] = useState("");
  const { restartTutorial } = useTutorial("email-marketing", emailTutorialSteps);

  return (
    <DashboardLayout>
      <TutorialOverlay page="email-marketing" />
      <div className="p-4 sm:p-6 max-w-full overflow-x-hidden">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-6 sm:mb-8" data-tutorial="email-header">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <PageHeader icon={Mail} title="Email Marketing" subtitle="Gerencie templates, envie emails em massa e acompanhe o histórico">
                  <TutorialButton onClick={restartTutorial} />
                </PageHeader>
              </div>
              {activeTab === "templates" && (
                <div className="relative w-full sm:w-auto sm:min-w-[280px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar templates..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="w-full grid grid-cols-4" data-tutorial="email-tabs">
              <TabsTrigger value="bulk" className="gap-2">
                <Send className="h-4 w-4" />
                <span className="hidden sm:inline">Envio em Massa</span>
              </TabsTrigger>
              <TabsTrigger value="templates" className="gap-2">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Templates</span>
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-2">
                <History className="h-4 w-4" />
                <span className="hidden sm:inline">Histórico</span>
              </TabsTrigger>
              <TabsTrigger value="reports" className="gap-2">
                <FileBarChart className="h-4 w-4" />
                <span className="hidden sm:inline">Relatórios</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="bulk">
              <EmailBulkSendTab />
            </TabsContent>

            <TabsContent value="templates">
              <EmailTemplatesTab searchTerm={searchTerm} />
            </TabsContent>

            <TabsContent value="history">
              <EmailHistoryTab />
            </TabsContent>

            <TabsContent value="reports">
              <EmailReportTab />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default EmailMarketing;
