import { PageHeader } from "@/components/PageHeader";
import { BrainMetricsDashboard } from "@/components/brain/BrainMetricsDashboard";
import { Brain } from "lucide-react";

const BrainDashboard = () => {
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <PageHeader
        icon={Brain}
        title="Cérebro IA"
        subtitle="Métricas de aprendizado e economia de tokens do assistente inteligente"
      />
      <BrainMetricsDashboard />
    </div>
  );
};

export default BrainDashboard;
