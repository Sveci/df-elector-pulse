import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useCoordinatorAuth } from "@/contexts/CoordinatorAuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Package, Clock, AlertTriangle, ArrowLeft, BookmarkCheck, X, RotateCcw, MessageSquare } from "lucide-react";
import { useCampaignMaterials } from "@/hooks/materials/useCampaignMaterials";
import { useMaterialReservations, useCreateReservation, useCancelReservation, useRequestReturn } from "@/hooks/materials/useMaterialReservations";
import { ConfirmationDetailsDialog } from "@/components/materials/ConfirmationDetailsDialog";
import { differenceInSeconds, format } from "date-fns";
import { ptBR } from "date-fns/locale";
const logo = "/lovable-uploads/7fcd39d2-d59f-4493-8232-a462c15b3f07.png";

function CountdownTimer({ expiresAt }: { expiresAt: string }) {
  const [timeLeft, setTimeLeft] = useState("");
  useEffect(() => {
    const update = () => {
      const diff = differenceInSeconds(new Date(expiresAt), new Date());
      if (diff <= 0) { setTimeLeft("Expirado"); return; }
      const d = Math.floor(diff / 86400);
      const h = Math.floor((diff % 86400) / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      setTimeLeft(`${d}d ${h.toString().padStart(2, "0")}h ${m.toString().padStart(2, "0")}m ${s.toString().padStart(2, "0")}s`);
    };
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, [expiresAt]);
  const isExpiring = differenceInSeconds(new Date(expiresAt), new Date()) < 86400;
  return <span className={`font-mono text-xs ${isExpiring ? "text-destructive font-semibold" : "text-muted-foreground"}`}>{timeLeft}</span>;
}

export default function CoordinatorMaterials() {
  const { session, isAuthenticated } = useCoordinatorAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) navigate("/coordenador/login", { replace: true });
  }, [isAuthenticated, navigate]);

  const { data: materials, isLoading: loadingMaterials } = useCampaignMaterials();
  const { data: reservations, isLoading: loadingReservations } = useMaterialReservations({ leader_id: session?.leader_id });
  const createReservation = useCreateReservation();
  const cancelReservation = useCancelReservation();
  const requestReturn = useRequestReturn();

  const [selectedMaterialId, setSelectedMaterialId] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [returnReservationData, setReturnReservationData] = useState<any>(null);
  const [returnQuantity, setReturnQuantity] = useState("");
  const [detailsReservation, setDetailsReservation] = useState<any>(null);

  if (!isAuthenticated || !session) return null;

  const activeMaterials = (materials || []).filter(m => m.is_active && m.estoque_atual > 0);
  const selectedMaterial = activeMaterials.find(m => m.id === selectedMaterialId);
  const activeReservations = (reservations || []).filter(r => r.status === "reserved");
  const pastReservations = (reservations || []).filter(r => r.status !== "reserved");

  const handleSubmit = () => {
    if (!selectedMaterialId || !quantidade) return;
    const qty = parseInt(quantidade);
    if (isNaN(qty) || qty <= 0) return;
    if (selectedMaterial && qty > selectedMaterial.estoque_atual) return;
    createReservation.mutate({ material_id: selectedMaterialId, leader_id: session.leader_id, quantidade: qty }, {
      onSuccess: () => { setSelectedMaterialId(""); setQuantidade(""); },
    });
  };

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    try { return format(new Date(d), "dd/MM/yyyy HH:mm", { locale: ptBR }); } catch { return "—"; }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      {/* Header */}
      <div className="bg-card border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Logo" className="h-4" />
            <div>
              <p className="font-semibold text-sm">{session.nome_completo}</p>
              <p className="text-xs text-muted-foreground">Solicitar Material</p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => navigate("/coordenador/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Request Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Package className="h-5 w-5" /> Solicitar Material
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select value={selectedMaterialId} onValueChange={setSelectedMaterialId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o material" />
              </SelectTrigger>
              <SelectContent>
              {loadingMaterials ? (
                  <SelectItem value="loading" disabled>Carregando...</SelectItem>
                ) : activeMaterials.length === 0 ? (
                  <SelectItem value="none" disabled>Nenhum material disponível</SelectItem>
                ) : (
                  activeMaterials.map(m => (
                    <SelectItem key={m.id} value={m.id}>
                      <div className="flex items-center gap-2">
                        {m.image_url && <img src={m.image_url} alt={m.nome} className="h-6 w-6 rounded object-cover" />}
                        <span>{m.nome} ({m.tipo})</span>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>

            {selectedMaterial && (
              <div className="bg-muted/50 rounded-md p-3">
                <div className="flex items-center gap-3">
                  {selectedMaterial.image_url && (
                    <img src={selectedMaterial.image_url} alt={selectedMaterial.nome} className="h-16 w-16 rounded-lg object-cover border" />
                  )}
                  <div className="flex-1">
                    <p className="font-medium text-sm">{selectedMaterial.nome}</p>
                    <div className="flex items-center justify-between text-sm mt-1">
                      <span className="text-muted-foreground">Estoque disponível:</span>
                      <span className="font-semibold">{selectedMaterial.estoque_atual.toLocaleString()} {selectedMaterial.unidade}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <Input
              type="number"
              placeholder="Quantidade desejada"
              value={quantidade}
              onChange={e => setQuantidade(e.target.value)}
              min={1}
              max={selectedMaterial?.estoque_atual || undefined}
            />

            {selectedMaterial && parseInt(quantidade) > selectedMaterial.estoque_atual && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Quantidade acima do estoque disponível
              </p>
            )}

            <Button
              className="w-full"
              onClick={handleSubmit}
              disabled={
                !selectedMaterialId || !quantidade || parseInt(quantidade) <= 0 ||
                (selectedMaterial ? parseInt(quantidade) > selectedMaterial.estoque_atual : false) ||
                createReservation.isPending
              }
            >
              {createReservation.isPending ? "Reservando..." : "Reservar Material"}
            </Button>
          </CardContent>
        </Card>

        {/* Active Reservations */}
        {activeReservations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock className="h-5 w-5" /> Reservas Ativas ({activeReservations.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {activeReservations.map(r => (
                <div key={r.id} className="border rounded-lg p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {(r.material as any)?.image_url && (
                        <img src={(r.material as any).image_url} alt={r.material?.nome} className="h-12 w-12 rounded-lg object-cover border" />
                      )}
                      <div>
                        <p className="font-medium text-sm">{r.material?.nome}</p>
                        <p className="text-xs text-muted-foreground">{r.quantidade.toLocaleString()} {r.material?.unidade}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="gap-1 text-amber-600 border-amber-300 bg-amber-50">
                      <Clock className="h-3 w-3" /> Reservado
                    </Badge>
                  </div>
                  
                  <div className="flex items-end justify-between gap-4">
                     <div className="flex flex-col gap-1.5">
                       <div className="flex items-center gap-1.5 text-xs">
                         <Clock className="h-3 w-3 text-muted-foreground" />
                         <span className="text-muted-foreground">Prazo:</span>
                         <span className="font-medium">{formatDate(r.expires_at)}</span>
                       </div>
                       <div className="flex items-center gap-1.5 text-xs">
                         <AlertTriangle className="h-3 w-3 text-amber-500" />
                         <span className="text-muted-foreground">Tempo restante:</span>
                         <CountdownTimer expiresAt={r.expires_at} />
                       </div>
                     </div>
                     <div className="flex items-center gap-1">
                       <Button
                         size="sm" variant="outline"
                         className="text-xs h-8 text-destructive border-destructive/20 hover:bg-destructive/5"
                         onClick={() => cancelReservation.mutate(r.id)}
                         disabled={cancelReservation.isPending}
                       >
                         <X className="h-3 w-3 mr-1" /> Cancelar
                       </Button>
                     </div>
                   </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Package className="h-5 w-5" /> Histórico de Solicitações
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingReservations ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : pastReservations.length === 0 && activeReservations.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma solicitação registrada.</p>
            ) : (
              <div className="space-y-2">
                {(reservations || []).map(r => (
                  <div key={r.id} className="flex items-center justify-between border rounded-lg p-3">
                    <div className="flex items-center gap-3">
                      {(r.material as any)?.image_url && (
                        <img src={(r.material as any).image_url} alt={r.material?.nome} className="h-10 w-10 rounded object-cover border" />
                      )}
                      <div>
                        <p className="font-medium text-sm">{r.material?.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {r.quantidade.toLocaleString()} {r.material?.unidade} · {formatDate(r.reserved_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {r.status === "reserved" ? (
                        <div className="text-right space-y-1">
                          <Badge variant="outline" className="gap-1 text-amber-600 border-amber-300 bg-amber-50 text-xs">
                            <Clock className="h-3 w-3" /> Reservado
                          </Badge>
                          <p className="text-[10px] text-muted-foreground">Até {formatDate(r.expires_at)}</p>
                          <div className="flex justify-end items-center gap-1">
                            <CountdownTimer expiresAt={r.expires_at} />
                          </div>
                        </div>
                        ) : r.status === "withdrawn" ? (
                        <div className="text-right space-y-1">
                          <Badge
                            className="bg-green-100 text-green-700 hover:bg-green-200 gap-1 text-xs cursor-pointer transition-colors"
                            onClick={() => setDetailsReservation(r)}
                          >
                            <BookmarkCheck className="h-3 w-3" /> Retirado
                          </Badge>
                          {r.confirmed_via && (
                            <p
                              className="text-[10px] text-green-600 font-medium flex items-center justify-end gap-1 cursor-pointer hover:underline"
                              onClick={() => setDetailsReservation(r)}
                            >
                              <MessageSquare className="h-3 w-3" />
                              {r.confirmed_via === "whatsapp" ? "Via WhatsApp" : "Manual"}
                              {r.confirmed_at && ` · ${formatDate(r.confirmed_at)}`}
                            </p>
                          )}
                          {r.returned_quantity > 0 && (
                            <p
                              className="text-[10px] text-blue-600 font-medium cursor-pointer hover:underline"
                              onClick={() => setDetailsReservation(r)}
                            >
                              Devolvido: {r.returned_quantity}
                              {r.return_confirmed_via && ` (${r.return_confirmed_via === "whatsapp" ? "WhatsApp" : r.return_confirmed_via})`}
                            </p>
                          )}
                          {r.return_requested_quantity > 0 && r.returned_quantity < r.return_requested_quantity && (
                            <Badge variant="outline" className="text-[10px] text-orange-600 border-orange-300 bg-orange-50">
                              <RotateCcw className="h-3 w-3 mr-1" /> Devolução solicitada: {r.return_requested_quantity}
                            </Badge>
                          )}
                          {r.returned_quantity < r.quantidade && !r.return_requested_at && (
                            <div className="flex justify-end gap-1">
                              <Button
                                size="sm" variant="outline"
                                className="text-[10px] h-6 px-2"
                                onClick={() => {
                                  setReturnReservationData(r);
                                  setReturnQuantity("");
                                  setReturnDialogOpen(true);
                                }}
                              >
                                <RotateCcw className="h-3 w-3 mr-1" /> Solicitar Devolução
                              </Button>
                            </div>
                          )}
                        </div>
                      ) : r.status === "expired" ? (
                        <Badge variant="destructive" className="gap-1 text-xs">
                          <AlertTriangle className="h-3 w-3" /> Expirado
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Cancelado</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Return Request Dialog */}
      <Dialog open={returnDialogOpen} onOpenChange={setReturnDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Solicitar Devolução</DialogTitle>
          </DialogHeader>
          {returnReservationData && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-md p-3 space-y-1 text-sm">
                <p><span className="text-muted-foreground">Material:</span> <span className="font-medium">{returnReservationData.material?.nome}</span></p>
                <p><span className="text-muted-foreground">Quantidade retirada:</span> <span className="font-semibold">{returnReservationData.quantidade.toLocaleString()}</span></p>
                <p><span className="text-muted-foreground">Já devolvido:</span> <span className="font-semibold">{(returnReservationData.returned_quantity || 0).toLocaleString()}</span></p>
                <p><span className="text-muted-foreground">Máximo devolvível:</span> <span className="font-semibold">{(returnReservationData.quantidade - (returnReservationData.returned_quantity || 0)).toLocaleString()}</span></p>
              </div>
              <Input
                type="number"
                placeholder="Quantidade a devolver"
                value={returnQuantity}
                onChange={e => setReturnQuantity(e.target.value)}
                min={1}
                max={returnReservationData.quantidade - (returnReservationData.returned_quantity || 0)}
              />
              <p className="text-xs text-muted-foreground">
                Após solicitar, apresente-se no gabinete para confirmar a devolução via QR Code.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => {
                if (!returnReservationData || !returnQuantity) return;
                const qty = parseInt(returnQuantity);
                const max = returnReservationData.quantidade - (returnReservationData.returned_quantity || 0);
                if (isNaN(qty) || qty <= 0 || qty > max) return;
                requestReturn.mutate({ id: returnReservationData.id, quantity: qty }, {
                  onSuccess: () => setReturnDialogOpen(false),
                });
              }}
              disabled={
                !returnQuantity || parseInt(returnQuantity) <= 0 ||
                (returnReservationData ? parseInt(returnQuantity) > (returnReservationData.quantidade - (returnReservationData.returned_quantity || 0)) : true) ||
                requestReturn.isPending
              }
            >
              {requestReturn.isPending ? "Solicitando..." : "Solicitar Devolução"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmationDetailsDialog
        reservation={detailsReservation}
        open={!!detailsReservation}
        onOpenChange={(open) => { if (!open) setDetailsReservation(null); }}
      />
    </div>
  );
}
