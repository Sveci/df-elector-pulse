import { useState } from "react";
import { useDemoMask } from "@/contexts/DemoModeContext";
import {
  Eye,
  Edit,
  Copy,
  Trash2,
  ExternalLink,
  MoreVertical,
  Play,
  Pause,
  FileText,
  Users,
  Download,
  Link as LinkIcon
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  LeadFunnel,
  useUpdateFunnel,
  useDuplicateFunnel,
  useDeleteFunnel
} from "@/hooks/campaigns/useLeadFunnels";
import { CreateFunnelDialog } from "./CreateFunnelDialog";
import { FunnelReportDialog } from "./FunnelReportDialog";
import { toast } from "@/hooks/use-toast";
import { getTenantBaseUrl } from "@/lib/urlHelper";
import { useTenantDomain } from "@/hooks/useTenantDomain";

interface FunnelCardProps {
  funnel: LeadFunnel;
}

export function FunnelCard({ funnel }: FunnelCardProps) {
  const { isDemoMode, m } = useDemoMask();
  const tenantDomain = useTenantDomain();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const updateFunnel = useUpdateFunnel();
  const duplicateFunnel = useDuplicateFunnel();
  const deleteFunnel = useDeleteFunnel();

  const funnelUrl = `${getTenantBaseUrl(tenantDomain)}/captacao/${funnel.slug}`;

  const conversionRate = funnel.views_count > 0
    ? ((funnel.leads_count / funnel.views_count) * 100).toFixed(1)
    : '0';

  const downloadRate = funnel.leads_count > 0
    ? ((funnel.downloads_count / funnel.leads_count) * 100).toFixed(1)
    : '0';

  const handleCopyLink = () => {
    navigator.clipboard.writeText(funnelUrl);
    toast({ title: "Link copiado!" });
  };

  const handleToggleStatus = () => {
    const newStatus = funnel.status === 'active' ? 'paused' : 'active';
    updateFunnel.mutate({ id: funnel.id, status: newStatus });
  };

  const handleDuplicate = () => {
    duplicateFunnel.mutate(funnel);
  };

  const handleDelete = () => {
    deleteFunnel.mutate(funnel.id);
    setDeleteDialogOpen(false);
  };

  const getStatusBadge = () => {
    switch (funnel.status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Ativo</Badge>;
      case 'paused':
        return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Pausado</Badge>;
      case 'draft':
        return <Badge variant="secondary">Rascunho</Badge>;
      default:
        return null;
    }
  };

  return (
    <>
      <Card className="overflow-hidden">
        {/* Cover preview */}
        <div
          className="h-24 bg-gradient-to-br from-primary/20 to-primary/5 relative"
          style={!isDemoMode && funnel.cover_url ? {
            backgroundImage: `url(${funnel.cover_url})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          } : undefined}
        >
          {!isDemoMode && funnel.logo_url && (
            <img
              src={funnel.logo_url}
              alt="Logo"
              className="absolute bottom-2 left-1/2 -translate-x-1/2 h-12 w-auto bg-white rounded-lg p-1 shadow"
            />
          )}
          {isDemoMode && (
            <div className="absolute inset-0 flex items-center justify-center text-3xl opacity-40">🎯</div>
          )}
        </div>

        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <h4 className="font-semibold leading-none">{m.brand(funnel.nome)}</h4>
              <p className="text-xs text-muted-foreground">
                🎁 {m.brand(funnel.lead_magnet_nome)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {getStatusBadge()}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => window.open(funnelUrl, '_blank')}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Visualizar Página
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleCopyLink}>
                    <LinkIcon className="h-4 w-4 mr-2" />
                    Copiar Link
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setEditDialogOpen(true)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Editar Funil
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setReportDialogOpen(true)}>
                    <FileText className="h-4 w-4 mr-2" />
                    Ver Relatório
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleDuplicate}>
                    <Copy className="h-4 w-4 mr-2" />
                    Duplicar
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleToggleStatus}>
                    {funnel.status === 'active' ? (
                      <>
                        <Pause className="h-4 w-4 mr-2" />
                        Pausar
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 mr-2" />
                        Ativar
                      </>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setDeleteDialogOpen(true)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {/* Metrics */}
          <div className="grid grid-cols-3 gap-2 text-center mt-3">
            <div className="p-2 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                <Eye className="h-3 w-3" />
              </div>
              <p className="text-lg font-bold">{m.number(funnel.views_count, funnel.id + "_v")}</p>
              <p className="text-[10px] text-muted-foreground">Visitas</p>
            </div>
            <div className="p-2 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                <Users className="h-3 w-3" />
              </div>
              <p className="text-lg font-bold">{m.number(funnel.leads_count, funnel.id + "_l")}</p>
              <p className="text-[10px] text-muted-foreground">Leads</p>
            </div>
            <div className="p-2 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                <Download className="h-3 w-3" />
              </div>
              <p className="text-lg font-bold">{m.number(funnel.downloads_count, funnel.id + "_d")}</p>
              <p className="text-[10px] text-muted-foreground">Downloads</p>
            </div>
          </div>

          {/* Conversion rates */}
          <div className="flex justify-between text-xs text-muted-foreground mt-3 pt-3 border-t">
            <span>Conversão: <strong className="text-foreground">{isDemoMode ? m.percentage(parseFloat(conversionRate), funnel.id + "_cr") : conversionRate}%</strong></span>
            <span>Taxa Download: <strong className="text-foreground">{isDemoMode ? m.percentage(parseFloat(downloadRate), funnel.id + "_dr") : downloadRate}%</strong></span>
          </div>
        </CardContent>
      </Card>

      <CreateFunnelDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        editFunnel={funnel}
      />

      <FunnelReportDialog
        open={reportDialogOpen}
        onOpenChange={setReportDialogOpen}
        funnel={funnel}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir funil?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O funil "{m.brand(funnel.nome)}" será
              permanentemente excluído, mas os leads já capturados serão mantidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
