import { useState } from "react";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLeadFunnels } from "@/hooks/campaigns/useLeadFunnels";
import { FunnelCard } from "./FunnelCard";
import { CreateFunnelDialog } from "./CreateFunnelDialog";

export function CaptacaoTab() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const { data: funnels, isLoading } = useLeadFunnels();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Funis de Captação</h3>
          <p className="text-sm text-muted-foreground">
            Crie páginas de captura com iscas digitais para gerar leads
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Funil
        </Button>
      </div>

      {funnels && funnels.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {funnels.map((funnel) => (
            <FunnelCard key={funnel.id} funnel={funnel} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 border border-dashed rounded-lg">
          <div className="text-4xl mb-4">🎯</div>
          <h3 className="text-lg font-medium mb-2">Nenhum funil criado</h3>
          <p className="text-muted-foreground mb-4">
            Crie seu primeiro funil de captação para começar a gerar leads
          </p>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Criar Primeiro Funil
          </Button>
        </div>
      )}

      <CreateFunnelDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </div>
  );
}
