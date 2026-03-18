import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useCoordinatorAuth } from "@/contexts/CoordinatorAuthContext";
import { useCoordinatorDashboard } from "@/hooks/coordinator/useCoordinatorDashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Trophy, Users, Calendar, MessageSquare, LogOut, Star,
  CheckCircle, Clock, GitBranch, Plus, ShieldCheck, ShieldAlert,
  Mail, Phone, MessageCircle, Eye, Loader2, Search, Package,
} from "lucide-react";
import { CoordinatorMessageDetailsDialog } from "@/components/coordinator/CoordinatorMessageDetailsDialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { maskPhone } from "@/lib/maskPhone";
import {
  DEFAULT_LEVELS,
  getLeaderLevel,
  getNextLevel,
  getPointsToNextLevel,
  getProgressToNextLevel,
} from "@/hooks/leaders/useLeaderLevels";
const logo = "/lovable-uploads/7fcd39d2-d59f-4493-8232-a462c15b3f07.png";
import { useMaterialReservations } from "@/hooks/materials/useMaterialReservations";

export default function CoordinatorDashboard() {
  const { session, logout, isAuthenticated } = useCoordinatorAuth();
  const navigate = useNavigate();
  const { data: dashboard, isLoading } = useCoordinatorDashboard(session?.leader_id);
  const { data: reservations } = useMaterialReservations({ leader_id: session?.leader_id });
  const [selectedMessage, setSelectedMessage] = useState<any>(null);
  const [subSearch, setSubSearch] = useState("");
  const [subFilter, setSubFilter] = useState<"all" | "verified" | "pending">("all");

  const allSubordinates = (dashboard?.subordinates as any[]) || [];
  const subordinates = useMemo(() => {
    let filtered = allSubordinates;
    if (subFilter === "verified") filtered = filtered.filter((s: any) => s.is_verified);
    if (subFilter === "pending") filtered = filtered.filter((s: any) => !s.is_verified);
    if (subSearch.trim()) {
      const q = subSearch.trim().toLowerCase();
      filtered = filtered.filter((s: any) => s.nome_completo?.toLowerCase().includes(q));
    }
    return filtered;
  }, [allSubordinates, subSearch, subFilter]);

  useEffect(() => {
    if (!isAuthenticated) navigate("/coordenador/login", { replace: true });
  }, [isAuthenticated, navigate]);

  if (!isAuthenticated || !session) return null;

  const levels = DEFAULT_LEVELS;
  const points = session.pontuacao_total;
  const level = getLeaderLevel(points, levels);
  const nextLevel = getNextLevel(points, levels);
  const pointsToNext = getPointsToNextLevel(points, levels);
  const progress = getProgressToNextLevel(points, levels);
  const eventsParticipated = (dashboard?.events_participated as any[]) || [];
  const eventsCreated = (dashboard?.events_created as any[]) || [];
  const commsGrouped = dashboard?.communications || { whatsapp: [], email: [], sms: [] };
  const whatsappComms = (commsGrouped.whatsapp as any[]) || [];
  const emailComms = (commsGrouped.email as any[]) || [];
  const smsComms = (commsGrouped.sms as any[]) || [];
  const totalComms = whatsappComms.length + emailComms.length + smsComms.length;
  const treeTotals = dashboard?.tree_totals || { total_members: 0, total_points: 0, total_cadastros: 0 };

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    try { return format(new Date(d), "dd/MM/yyyy", { locale: ptBR }); } catch { return "—"; }
  };

  const translateStatus = (status: string) => {
    const map: Record<string, string> = {
      sent: "Enviado",
      delivered: "Entregue",
      read: "Lido",
      failed: "Falhou",
      pending: "Pendente",
      queued: "Na fila",
      error: "Erro",
      sending: "Enviando",
      opened: "Aberto",
      clicked: "Clicado",
      bounced: "Rejeitado",
    };
    return map[status?.toLowerCase()] || status;
  };

  const populateVariables = (text: string | null | undefined): string => {
    if (!text) return "";
    return text
      .replace(/\{\{nome\}\}/gi, session.nome_completo || "")
      .replace(/\{\{nome_completo\}\}/gi, session.nome_completo || "")
      .replace(/\{\{telefone\}\}/gi, session.telefone || "")
      .replace(/\{\{email\}\}/gi, session.email || "")
      .replace(/\{\{cidade\}\}/gi, session.cidade_nome || "")
      .replace(/\{\{pontuacao\}\}/gi, String(session.pontuacao_total || 0))
      .replace(/\{\{cadastros\}\}/gi, String(session.cadastros || 0))
      .replace(/\{\{primeiro_nome\}\}/gi, (session.nome_completo || "").split(" ")[0]);
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
              <p className="text-xs text-muted-foreground">{session.cidade_nome}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => navigate("/coordenador/verificar")}>
              <ShieldCheck className="h-4 w-4 mr-1" /> Verificar
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate("/coordenador/eventos")}>
              <Plus className="h-4 w-4 mr-1" /> Eventos
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate("/coordenador/materiais")}>
              <Package className="h-4 w-4 mr-1" /> Material
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { logout(); navigate("/coordenador/login"); }}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {isLoading ? (
          <>
            {/* Loading skeleton */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center gap-4">
                  <Skeleton className="w-14 h-14 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-6 w-40" />
                    <Skeleton className="h-4 w-56" />
                  </div>
                </div>
                <Skeleton className="h-2 w-full" />
              </CardContent>
            </Card>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[1,2,3,4].map(i => (
                <Card key={i}>
                  <CardContent className="pt-4 pb-3 flex flex-col items-center gap-2">
                    <Skeleton className="h-5 w-5 rounded" />
                    <Skeleton className="h-7 w-12" />
                    <Skeleton className="h-3 w-16" />
                  </CardContent>
                </Card>
              ))}
            </div>
            <Card>
              <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
              <CardContent className="space-y-3">
                {[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
              </CardContent>
            </Card>
            <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Carregando dados do painel...</span>
            </div>
          </>
        ) : (
          <>
        {/* Status & Progress */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4 mb-4">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl ${level.bgClass} ${level.borderClass} border-2`}>
                {level.icon}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold">{level.name}</h2>
                  <Badge variant="secondary">{points} pontos</Badge>
                </div>
                {nextLevel ? (
                  <p className="text-sm text-muted-foreground">
                    Faltam {pointsToNext} pontos para {nextLevel.name} {nextLevel.icon}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">Nível máximo atingido!</p>
                )}
              </div>
            </div>
            <Progress value={progress} className="h-2" />
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <Trophy className="h-5 w-5 mx-auto mb-1 text-primary" />
              <p className="text-2xl font-bold">{points}</p>
              <p className="text-xs text-muted-foreground">Pontos</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <Users className="h-5 w-5 mx-auto mb-1 text-primary" />
              <p className="text-2xl font-bold">{session.cadastros}</p>
              <p className="text-xs text-muted-foreground">Cadastros</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <GitBranch className="h-5 w-5 mx-auto mb-1 text-primary" />
              <p className="text-2xl font-bold">{treeTotals.total_members}</p>
              <p className="text-xs text-muted-foreground">Rede Total</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <Star className="h-5 w-5 mx-auto mb-1 text-primary" />
              <p className="text-2xl font-bold">{treeTotals.total_points}</p>
              <p className="text-xs text-muted-foreground">Pontos da Rede</p>
            </CardContent>
          </Card>
        </div>

        {/* Last Material Reservation */}
        {(() => {
          const lastReservation = (reservations || [])[0];
          if (!lastReservation) return null;
          return (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Package className="h-5 w-5" /> Último Pedido de Material
                  </CardTitle>
                  <Button size="sm" variant="outline" onClick={() => navigate("/coordenador/materiais")}>
                    Ver Todos
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between border rounded-lg p-3">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{lastReservation.material?.nome}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-muted-foreground">
                        {lastReservation.quantidade} {lastReservation.material?.unidade}
                      </p>
                      {lastReservation.status === "reserved" && (
                        <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">
                          Até {formatDate(lastReservation.expires_at)}
                        </span>
                      )}
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-xs ${
                      lastReservation.status === "reserved" ? "text-amber-600 border-amber-300 bg-amber-50" :
                      lastReservation.status === "withdrawn" ? "text-green-600 border-green-300 bg-green-50" :
                      lastReservation.status === "expired" ? "text-destructive" : ""
                    }`}
                  >
                    {lastReservation.status === "reserved" ? "Reservado" :
                     lastReservation.status === "withdrawn" ? "Retirado" :
                     lastReservation.status === "expired" ? "Expirado" : "Cancelado"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {/* Subordinates */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5" /> Indicações ({allSubordinates.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : allSubordinates.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma indicação ainda.</p>
            ) : (
              <>
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nome..."
                      value={subSearch}
                      onChange={(e) => setSubSearch(e.target.value)}
                      className="pl-9 h-9"
                    />
                  </div>
                  <div className="flex gap-1">
                    {([
                      { value: "all", label: "Todos" },
                      { value: "verified", label: "Verificados" },
                      { value: "pending", label: "Pendentes" },
                    ] as const).map((f) => (
                      <Button
                        key={f.value}
                        size="sm"
                        variant={subFilter === f.value ? "default" : "outline"}
                        onClick={() => setSubFilter(f.value)}
                        className="text-xs h-9"
                      >
                        {f.label}
                      </Button>
                    ))}
                  </div>
                </div>
                {subordinates.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">Nenhum resultado encontrado.</p>
                ) : (
                <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                  <p className="text-xs text-muted-foreground">{subordinates.length} resultado(s)</p>
                  {subordinates.map((sub: any) => (
                  <div key={sub.id} className="flex items-center justify-between border rounded-lg p-3">
                    <div className="flex items-center gap-3">
                      {sub.is_verified ? (
                        <ShieldCheck className="h-4 w-4 text-green-600 shrink-0" />
                      ) : (
                        <ShieldAlert className="h-4 w-4 text-amber-500 shrink-0" />
                      )}
                      <div>
                        <p className="font-medium text-sm">{sub.nome_completo}</p>
                        <p className="text-xs text-muted-foreground">
                          {maskPhone(sub.telefone)} · {formatDate(sub.created_at)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      <p className="font-semibold">{sub.pontuacao_total} pts</p>
                      <p className="text-xs text-muted-foreground">{sub.cadastros} cadastros</p>
                    </div>
                  </div>
                ))}
                </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Events Created */}
        {eventsCreated.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Calendar className="h-5 w-5" /> Eventos Criados ({eventsCreated.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {eventsCreated.map((ev: any) => (
                  <div key={ev.id} className="flex items-center justify-between border rounded-lg p-3">
                    <div>
                      <p className="font-medium text-sm">{ev.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(ev.date)} · {ev.location}
                      </p>
                    </div>
                    <div className="text-right text-sm">
                      <p>{ev.registrations_count || 0} inscritos</p>
                      <p className="text-xs text-muted-foreground">{ev.checkedin_count || 0} check-ins</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Events Participated */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="h-5 w-5" /> Eventos Participados ({eventsParticipated.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {eventsParticipated.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum evento registrado.</p>
            ) : (
              <div className="space-y-2">
                {eventsParticipated.map((ev: any, i: number) => (
                  <div key={i} className="flex items-center justify-between border rounded-lg p-3">
                    <div>
                      <p className="font-medium text-sm">{ev.name}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(ev.date)}</p>
                    </div>
                    {ev.checked_in ? (
                      <Badge variant="default" className="text-xs">
                        <CheckCircle className="h-3 w-3 mr-1" /> Check-in
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">
                        <Clock className="h-3 w-3 mr-1" /> Inscrito
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Communications - Grouped by Channel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <MessageSquare className="h-5 w-5" /> Comunicações ({totalComms})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {totalComms === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma comunicação registrada.</p>
            ) : (
              <Tabs defaultValue={whatsappComms.length > 0 ? "whatsapp" : emailComms.length > 0 ? "email" : "sms"}>
                <TabsList className="w-full">
                  <TabsTrigger value="whatsapp" className="flex-1 gap-1">
                    <MessageCircle className="h-3.5 w-3.5" /> WhatsApp ({whatsappComms.length})
                  </TabsTrigger>
                  <TabsTrigger value="email" className="flex-1 gap-1">
                    <Mail className="h-3.5 w-3.5" /> Email ({emailComms.length})
                  </TabsTrigger>
                  <TabsTrigger value="sms" className="flex-1 gap-1">
                    <Phone className="h-3.5 w-3.5" /> SMS ({smsComms.length})
                  </TabsTrigger>
                </TabsList>
                {[
                  { key: "whatsapp", items: whatsappComms },
                  { key: "email", items: emailComms },
                  { key: "sms", items: smsComms },
                ].map(({ key, items }) => (
                  <TabsContent key={key} value={key}>
                    {items.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-3">Nenhuma mensagem neste canal.</p>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {items.slice(0, 30).map((comm: any, i: number) => (
                          <div key={i} className="flex items-center justify-between border rounded-lg p-3">
                            <p className="text-sm truncate max-w-[200px]">{populateVariables(comm.subject) || "—"}</p>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">{translateStatus(comm.status)}</Badge>
                              <p className="text-xs text-muted-foreground">{formatDate(comm.sent_at)}</p>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => setSelectedMessage({
                                  ...comm,
                                  channel: key,
                                  subject: populateVariables(comm.subject),
                                  message: populateVariables(comm.message),
                                })}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                ))}
              </Tabs>
            )}
          </CardContent>
        </Card>

        <CoordinatorMessageDetailsDialog
          message={selectedMessage}
          open={!!selectedMessage}
          onOpenChange={(open) => { if (!open) setSelectedMessage(null); }}
        />
        </>
        )}
      </div>
    </div>
  );
}
