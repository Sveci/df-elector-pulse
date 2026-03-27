import { PageHeader } from "@/components/PageHeader";
import { BrainMetricsDashboard } from "@/components/brain/BrainMetricsDashboard";
import { BrainCacheManager } from "@/components/brain/BrainCacheManager";
import { Brain } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Database } from "lucide-react";

const BrainDashboard = () => {
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <PageHeader
        icon={Brain}
        title="Cérebro IA"
        subtitle="Métricas de aprendizado e economia de tokens do assistente inteligente"
      />
      <Tabs defaultValue="metricas">
        <TabsList>
          <TabsTrigger value="metricas" className="gap-1.5">
            <BarChart3 className="h-4 w-4" /> Métricas
          </TabsTrigger>
          <TabsTrigger value="cache" className="gap-1.5">
            <Database className="h-4 w-4" /> Gerenciar Cache
          </TabsTrigger>
        </TabsList>
        <TabsContent value="metricas" className="mt-4">
          <BrainMetricsDashboard />
        </TabsContent>
        <TabsContent value="cache" className="mt-4">
          <BrainCacheManager />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BrainDashboard;
