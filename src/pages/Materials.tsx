import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Package, Plus, ArrowDownToLine, BarChart3, CheckCircle2, AlertTriangle, PackagePlus, Clock, BookmarkCheck, RotateCcw, QrCode, MessageSquare, Info } from "lucide-react";
import { useCampaignMaterials } from "@/hooks/materials/useCampaignMaterials";
import { useMaterialWithdrawals, useConfirmWithdrawal } from "@/hooks/materials/useMaterialWithdrawals";
import { useMaterialReservations, useWithdrawReservation } from "@/hooks/materials/useMaterialReservations";
import { AddMaterialDialog } from "@/components/materials/AddMaterialDialog";
import { AddStockDialog } from "@/components/materials/AddStockDialog";
import { RegisterWithdrawalDialog } from "@/components/materials/RegisterWithdrawalDialog";
import type { CampaignMaterial } from "@/hooks/materials/useCampaignMaterials";
import { WithdrawalQRCode } from "@/components/materials/WithdrawalQRCode";
import { ReturnQRCode } from "@/components/materials/ReturnQRCode";
import { ConfirmationDetailsDialog } from "@/components/materials/ConfirmationDetailsDialog";
import { RequestReturnDialog } from "@/components/materials/RequestReturnDialog";
import { format, differenceInSeconds } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

function ReservationCountdown({ expiresAt }: { expiresAt: string }) {
  const [timeLeft, setTimeLeft] = useState("");
  useEffect(() => {
    const update = () => {
      const diff = differenceInSeconds(new Date(expiresAt), new Date());
      if (diff <= 0) { setTimeLeft("Expirado"); return; }
      const d = Math.floor(diff / 86400);
      const h = Math.floor((diff % 86400) / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      setTimeLeft(`${d}d ${h.toString().padStart(2,"0")}h ${m.toString().padStart(2,"0")}m ${s.toString().padStart(2,"0")}s`);
    };
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, [expiresAt]);
  const isExpiring = differenceInSeconds(new Date(expiresAt), new Date()) < 86400;
  return <span className={`font-mono text-xs ${isExpiring ? "text-destructive font-semibold" : "text-muted-foreground"}`}>{timeLeft}</span>;
}

export default function Materials() {
  const [tab, setTab] = useState("materiais");
  const [addMaterialOpen, setAddMaterialOpen] = useState(false);
  const [addStockOpen, setAddStockOpen] = useState(false);
  const [withdrawalOpen, setWithdrawalOpen] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<CampaignMaterial | null>(null);

  const { data: materials, isLoading: loadingMaterials } = useCampaignMaterials();
  const { data: withdrawals, isLoading: loadingWithdrawals } = useMaterialWithdrawals();
  const { data: reservations, isLoading: loadingReservations } = useMaterialReservations();
  const confirmWithdrawal = useConfirmWithdrawal();
  const withdrawReservation = useWithdrawReservation();
  const [qrReservation, setQrReservation] = useState<any>(null);
  const [returnQrReservation, setReturnQrReservation] = useState<any>(null);
  const [detailsReservation, setDetailsReservation] = useState<any>(null);
  const [returnRequestReservation, setReturnRequestReservation] = useState<any>(null);

  const activeReservations = useMemo(() => (reservations || []).filter(r => r.status === "reserved"), [reservations]);

  // Combine withdrawn reservations + legacy withdrawals into a unified list
  const withdrawnItems = useMemo(() => {
    const items: Array<{
      id: string; date: string; materialName: string; leaderName: string;
      cargo: string; region: string; quantidade: number; returned: number;
      source: "reservation" | "direct"; image_url: string | null;
    }> = [];
    // From reservations (withdrawn)
    (reservations || []).filter(r => r.status === "withdrawn").forEach(r => {
      items.push({
        id: `res-${r.id}`, date: r.withdrawn_at || r.reserved_at,
        materialName: r.material?.nome || "—", leaderName: r.leader?.nome_completo || "—",
        cargo: r.leader?.is_coordinator ? "Coordenador" : "Líder",
        region: r.leader_city?.nome || "—", quantidade: r.quantidade,
        returned: r.returned_quantity || 0,
        source: (r as any).origin === "direct" ? "direct" : "reservation",
        image_url: r.material?.image_url || null,
      });
    });
    // From legacy withdrawals
    (withdrawals || []).forEach(w => {
      items.push({
        id: `wd-${w.id}`, date: w.data_retirada,
        materialName: w.material?.nome || "—", leaderName: w.leader?.nome_completo || "—",
        cargo: w.leader?.is_coordinator ? "Coordenador" : "Líder",
        region: w.leader_city?.nome || "—", quantidade: w.quantidade,
        returned: 0, source: "direct", image_url: null,
      });
    });
    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [reservations, withdrawals]);


  // Stats
  const totalProduzido = useMemo(() => (materials || []).reduce((s, m) => s + m.quantidade_produzida, 0), [materials]);
  const totalEstoque = useMemo(() => (materials || []).reduce((s, m) => s + m.estoque_atual, 0), [materials]);
  const totalDistribuido = totalProduzido - totalEstoque;
  const totalRetiradas = withdrawnItems.length;

  // Report data — uses unified withdrawnItems
  const withdrawalsByLeader = useMemo(() => {
    const map: Record<string, { nome: string; cargo: string; regiao: string; total: number }> = {};
    withdrawnItems.forEach(item => {
      const key = `${item.leaderName}-${item.region}`;
      if (!map[key]) {
        map[key] = { nome: item.leaderName, cargo: item.cargo, regiao: item.region, total: 0 };
      }
      map[key].total += item.quantidade;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [withdrawnItems]);

  const withdrawalsByRegion = useMemo(() => {
    const map: Record<string, number> = {};
    withdrawnItems.forEach(item => {
      const reg = item.region || "Sem região";
      map[reg] = (map[reg] || 0) + item.quantidade;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([regiao, total]) => ({ regiao, total }));
  }, [withdrawnItems]);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <PageHeader icon={Package} title="Controle de Materiais" subtitle="Gerencie produção, estoque e distribuição de materiais de campanha" />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setAddMaterialOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Novo Material
          </Button>
          <Button onClick={() => setWithdrawalOpen(true)}>
            <ArrowDownToLine className="h-4 w-4 mr-1" /> Registrar Retirada
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10"><Package className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Total Produzido</p>
                <p className="text-xl font-bold">{totalProduzido.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100"><PackagePlus className="h-5 w-5 text-green-600" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Em Estoque</p>
                <p className="text-xl font-bold">{totalEstoque.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100"><ArrowDownToLine className="h-5 w-5 text-blue-600" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Distribuído</p>
                <p className="text-xl font-bold">{totalDistribuido.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-100"><BarChart3 className="h-5 w-5 text-orange-600" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Retiradas</p>
                <p className="text-xl font-bold">{totalRetiradas}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="materiais">Materiais</TabsTrigger>
          <TabsTrigger value="reservas">
            Reservas {activeReservations.length > 0 && <Badge variant="secondary" className="ml-1 h-5 px-1.5">{activeReservations.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="retiradas">Retiradas</TabsTrigger>
          <TabsTrigger value="relatorios">Relatórios</TabsTrigger>
        </TabsList>

        {/* === MATERIAIS TAB === */}
        <TabsContent value="materiais">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Foto</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Produzido</TableHead>
                    <TableHead className="text-right">Estoque</TableHead>
                    <TableHead className="text-right">Distribuído</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingMaterials ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                  ) : (materials || []).length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum material cadastrado</TableCell></TableRow>
                  ) : (materials || []).map(m => {
                    const dist = m.quantidade_produzida - m.estoque_atual;
                    const lowStock = m.estoque_atual <= m.quantidade_produzida * 0.1;
                    return (
                      <TableRow key={m.id}>
                        <TableCell>
                          {m.image_url ? (
                            <img src={m.image_url} alt={m.nome} className="h-10 w-10 rounded object-cover border" />
                          ) : (
                            <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                              <Package className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{m.nome}</TableCell>
                        <TableCell><Badge variant="outline">{m.tipo}</Badge></TableCell>
                        <TableCell className="text-right">{m.quantidade_produzida.toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          <span className={lowStock ? "text-red-600 font-semibold" : ""}>{m.estoque_atual.toLocaleString()}</span>
                        </TableCell>
                        <TableCell className="text-right">{dist.toLocaleString()}</TableCell>
                        <TableCell>
                          {lowStock ? (
                            <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />Estoque Baixo</Badge>
                          ) : (
                            <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Normal</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => { setSelectedMaterial(m); setAddStockOpen(true); }}>
                            <PackagePlus className="h-4 w-4 mr-1" /> Estoque
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* === RESERVAS TAB === */}
        <TabsContent value="reservas">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Material</TableHead>
                    <TableHead>Quem Reservou</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead>Região</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead>Devolvido</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tempo Restante</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingReservations ? (
                    <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                  ) : (reservations || []).length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nenhuma reserva registrada</TableCell></TableRow>
                  ) : (reservations || []).map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.material?.nome}</TableCell>
                      <TableCell>{r.leader?.nome_completo}</TableCell>
                      <TableCell><Badge variant="outline">{r.leader?.is_coordinator ? "Coordenador" : "Líder"}</Badge></TableCell>
                      <TableCell>{r.leader_city?.nome || "—"}</TableCell>
                      <TableCell className="text-right font-semibold">{r.quantidade.toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        {r.returned_quantity > 0 ? (
                          <span className="text-xs font-medium text-blue-600">{r.returned_quantity.toLocaleString()}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {r.status === "reserved" ? (
                          <Badge variant="outline" className="gap-1 text-amber-600 border-amber-300 bg-amber-50">
                            <Clock className="h-3 w-3" /> Reservado
                          </Badge>
                        ) : r.status === "withdrawn" ? (
                          <Badge className="bg-green-100 text-green-700 hover:bg-green-100 gap-1">
                            <BookmarkCheck className="h-3 w-3" /> Retirado
                          </Badge>
                        ) : r.status === "expired" ? (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="h-3 w-3" /> Expirado
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Cancelado</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {r.status === "reserved" ? (
                          <ReservationCountdown expiresAt={r.expires_at} />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {r.status === "reserved" && (
                            <>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="sm" variant="outline"
                                      className="text-xs h-7"
                                      onClick={() => setQrReservation(r)}
                                    >
                                      <QrCode className="h-3 w-3" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>QR Code de Retirada</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              <Button
                                size="sm" variant="outline"
                                className="text-xs h-7"
                                onClick={() => withdrawReservation.mutate(r.id)}
                                disabled={withdrawReservation.isPending}
                              >
                                <BookmarkCheck className="h-3 w-3 mr-1" /> Retirada
                              </Button>
                            </>
                          )}
                          {r.status === "withdrawn" && (
                            <>
                              {r.confirmed_via && (
                                <Badge
                                  variant="outline"
                                  className="text-xs gap-1 text-green-600 border-green-300 bg-green-50 cursor-pointer hover:bg-green-100 transition-colors"
                                  onClick={() => setDetailsReservation(r)}
                                >
                                  <MessageSquare className="h-3 w-3" />
                                  {r.confirmed_via === "whatsapp" ? "WhatsApp" : r.confirmed_via === "manual" ? "Manual" : r.confirmed_via}
                                </Badge>
                              )}
                              {r.return_confirmed_via && (
                                <Badge
                                  variant="outline"
                                  className="text-xs gap-1 text-blue-600 border-blue-300 bg-blue-50 cursor-pointer hover:bg-blue-100 transition-colors"
                                  onClick={() => setDetailsReservation(r)}
                                >
                                  <RotateCcw className="h-3 w-3" />
                                  Dev. {r.return_confirmed_via === "whatsapp" ? "WhatsApp" : "Manual"}
                                </Badge>
                              )}
                              {r.returned_quantity < r.quantidade && (
                                <>
                                  {r.return_requested_quantity > 0 && r.returned_quantity < r.return_requested_quantity && (
                                    <>
                                      <Badge variant="outline" className="text-xs gap-1 text-orange-600 border-orange-300 bg-orange-50">
                                        <RotateCcw className="h-3 w-3" /> Solicitado: {r.return_requested_quantity}
                                      </Badge>
                                      {r.return_confirmation_code && (
                                        <TooltipProvider>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <Button
                                                size="sm" variant="outline"
                                                className="text-xs h-7"
                                                onClick={() => setReturnQrReservation(r)}
                                              >
                                                <QrCode className="h-3 w-3" />
                                              </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>QR Code de Devolução</TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                      )}
                                    </>
                                  )}
                                  {(!r.return_requested_quantity || r.return_requested_quantity <= 0 || r.returned_quantity >= r.return_requested_quantity) && (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            size="sm" variant="outline"
                                            className="text-xs h-7"
                                            onClick={() => setReturnRequestReservation(r)}
                                          >
                                            <RotateCcw className="h-3 w-3" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Solicitar devolução</TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  )}
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* === RETIRADAS TAB === */}
        <TabsContent value="retiradas">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Foto</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Material</TableHead>
                    <TableHead>Quem Retirou</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead>Região</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-right">Devolvido</TableHead>
                    <TableHead>Origem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(loadingWithdrawals && loadingReservations) ? (
                    <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                  ) : withdrawnItems.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nenhuma retirada registrada</TableCell></TableRow>
                  ) : withdrawnItems.map(item => (
                    <TableRow key={item.id}>
                      <TableCell>
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.materialName} className="h-8 w-8 rounded object-cover border" />
                        ) : (
                          <div className="h-8 w-8 rounded bg-muted flex items-center justify-center">
                            <Package className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{format(new Date(item.date), "dd/MM/yy HH:mm", { locale: ptBR })}</TableCell>
                      <TableCell className="font-medium">{item.materialName}</TableCell>
                      <TableCell>{item.leaderName}</TableCell>
                      <TableCell><Badge variant="outline">{item.cargo}</Badge></TableCell>
                      <TableCell>{item.region}</TableCell>
                      <TableCell className="text-right font-semibold">{item.quantidade.toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        {item.returned > 0 ? (
                          <span className="text-xs font-medium text-blue-600">{item.returned.toLocaleString()}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {item.source === "reservation" ? (
                          <Badge variant="outline" className="text-xs">Reserva</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">Direta</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* === RELATÓRIOS TAB === */}
        <TabsContent value="relatorios">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Top retiradas por pessoa */}
            <Card>
              <CardHeader><CardTitle className="text-base">Retiradas por Pessoa</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Cargo</TableHead>
                      <TableHead>Região</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {withdrawalsByLeader.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-4 text-muted-foreground">Sem dados</TableCell></TableRow>
                    ) : withdrawalsByLeader.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{r.nome}</TableCell>
                        <TableCell><Badge variant="outline">{r.cargo}</Badge></TableCell>
                        <TableCell>{r.regiao}</TableCell>
                        <TableCell className="text-right font-semibold">{r.total.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Distribuição por região */}
            <Card>
              <CardHeader><CardTitle className="text-base">Distribuição por Região</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Região</TableHead>
                      <TableHead className="text-right">Total Distribuído</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {withdrawalsByRegion.length === 0 ? (
                      <TableRow><TableCell colSpan={2} className="text-center py-4 text-muted-foreground">Sem dados</TableCell></TableRow>
                    ) : withdrawalsByRegion.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{r.regiao}</TableCell>
                        <TableCell className="text-right font-semibold">{r.total.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Estoque disponível */}
            <Card className="md:col-span-2">
              <CardHeader><CardTitle className="text-base">Estoque Disponível por Material</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Material</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Produzido</TableHead>
                      <TableHead className="text-right">Distribuído</TableHead>
                      <TableHead className="text-right">Disponível</TableHead>
                      <TableHead className="text-right">% Distribuído</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(materials || []).map(m => {
                      const dist = m.quantidade_produzida - m.estoque_atual;
                      const pct = m.quantidade_produzida > 0 ? Math.round((dist / m.quantidade_produzida) * 100) : 0;
                      return (
                        <TableRow key={m.id}>
                          <TableCell className="font-medium">{m.nome}</TableCell>
                          <TableCell><Badge variant="outline">{m.tipo}</Badge></TableCell>
                          <TableCell className="text-right">{m.quantidade_produzida.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{dist.toLocaleString()}</TableCell>
                          <TableCell className="text-right font-semibold">{m.estoque_atual.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{pct}%</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <AddMaterialDialog open={addMaterialOpen} onOpenChange={setAddMaterialOpen} />
      <AddStockDialog open={addStockOpen} onOpenChange={setAddStockOpen} material={selectedMaterial} />
      <RegisterWithdrawalDialog open={withdrawalOpen} onOpenChange={setWithdrawalOpen} />

      {/* QR Code Dialogs */}
      {qrReservation && (
        <WithdrawalQRCode
          confirmationCode={qrReservation.confirmation_code || ""}
          materialName={qrReservation.material?.nome || ""}
          open={!!qrReservation}
          onOpenChange={(open) => { if (!open) setQrReservation(null); }}
        />
      )}
      {returnQrReservation && (
        <ReturnQRCode
          confirmationCode={returnQrReservation.return_confirmation_code || ""}
          materialName={returnQrReservation.material?.nome || ""}
          open={!!returnQrReservation}
          onOpenChange={(open) => { if (!open) setReturnQrReservation(null); }}
        />
      )}
      <ConfirmationDetailsDialog
        reservation={detailsReservation}
        open={!!detailsReservation}
        onOpenChange={(open) => { if (!open) setDetailsReservation(null); }}
      />
      <RequestReturnDialog
        reservation={returnRequestReservation}
        open={!!returnRequestReservation}
        onOpenChange={(open) => { if (!open) setReturnRequestReservation(null); }}
      />
    </div>
  );
}
