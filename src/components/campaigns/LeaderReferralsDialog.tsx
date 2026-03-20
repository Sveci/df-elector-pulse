import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  User,
  Calendar,
  Mail,
  Phone,
  CheckCircle2,
  XCircle,
  Ticket,
  Building2,
  ClipboardList
} from "lucide-react";

interface LeaderReferralsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leader: {
    id: string;
    leaderName: string;
    cityName: string | null;
  } | null;
}

type ReferralType = "cadastro" | "evento" | "visita";

interface Referral {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  created_at: string;
  source: ReferralType;
  eventName?: string;
  eventDate?: string;
  checkedIn?: boolean;
  protocolo?: string;
  visitStatus?: string;
}

export default function LeaderReferralsDialog({
  open,
  onOpenChange,
  leader,
}: LeaderReferralsDialogProps) {
  const [activeTab, setActiveTab] = useState<"todos" | ReferralType>("todos");

  const { data: referrals = [], isLoading } = useQuery({
    queryKey: ["leader-referrals", leader?.id],
    queryFn: async () => {
      if (!leader?.id) return [];

      // Buscar cadastros via link de indicação (office_contacts)
      const { data: contacts, error: contactsError } = await supabase
        .from("office_contacts")
        .select("id, nome, email, telefone_norm, created_at")
        .eq("source_type", "lider")
        .eq("source_id", leader.id)
        .order("created_at", { ascending: false });

      if (contactsError) console.error("Erro ao buscar contacts:", contactsError);

      // Buscar inscrições em eventos
      const { data: eventRegs, error: eventRegsError } = await supabase
        .from("event_registrations")
        .select(`
          id, 
          nome, 
          email, 
          whatsapp, 
          checked_in, 
          created_at,
          events (name, date)
        `)
        .eq("leader_id", leader.id)
        .order("created_at", { ascending: false });

      if (eventRegsError) console.error("Erro ao buscar event_registrations:", eventRegsError);

      // Buscar visitas ao gabinete
      const { data: visits, error: visitsError } = await supabase
        .from("office_visits")
        .select(`
          id, 
          protocolo, 
          status, 
          created_at,
          contact:office_contacts (nome, email, telefone_norm)
        `)
        .eq("leader_id", leader.id)
        .order("created_at", { ascending: false });

      if (visitsError) console.error("Erro ao buscar office_visits:", visitsError);

      // Unificar dados
      const allReferrals: Referral[] = [];

      // Adicionar cadastros
      (contacts || []).forEach((c) => {
        allReferrals.push({
          id: c.id,
          nome: c.nome,
          email: c.email,
          telefone: c.telefone_norm,
          created_at: c.created_at,
          source: "cadastro",
        });
      });

      // Adicionar inscrições em eventos
      (eventRegs || []).forEach((e: any) => {
        allReferrals.push({
          id: e.id,
          nome: e.nome,
          email: e.email,
          telefone: e.whatsapp,
          created_at: e.created_at,
          source: "evento",
          eventName: e.events?.name || "Evento",
          eventDate: e.events?.date,
          checkedIn: e.checked_in,
        });
      });

      // Adicionar visitas
      (visits || []).forEach((v: any) => {
        const contact = v.contact;
        allReferrals.push({
          id: v.id,
          nome: contact?.nome || "Visitante",
          email: contact?.email,
          telefone: contact?.telefone_norm,
          created_at: v.created_at,
          source: "visita",
          protocolo: v.protocolo,
          visitStatus: v.status,
        });
      });

      // Ordenar por data (mais recente primeiro)
      allReferrals.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      return allReferrals;
    },
    enabled: open && !!leader?.id,
  });

  const filteredReferrals =
    activeTab === "todos"
      ? referrals
      : referrals.filter((r) => r.source === activeTab);

  const counts = {
    todos: referrals.length,
    cadastro: referrals.filter((r) => r.source === "cadastro").length,
    evento: referrals.filter((r) => r.source === "evento").length,
    visita: referrals.filter((r) => r.source === "visita").length,
  };

  const getSourceBadge = (source: ReferralType) => {
    switch (source) {
      case "cadastro":
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            <ClipboardList className="h-3 w-3 mr-1" />
            Cadastro
          </Badge>
        );
      case "evento":
        return (
          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
            <Ticket className="h-3 w-3 mr-1" />
            Evento
          </Badge>
        );
      case "visita":
        return (
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
            <Building2 className="h-3 w-3 mr-1" />
            Visita
          </Badge>
        );
    }
  };

  const getVisitStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      REGISTERED: { label: "Registrado", className: "bg-gray-100 text-gray-700" },
      LINK_SENT: { label: "Link Enviado", className: "bg-blue-100 text-blue-700" },
      FORM_OPENED: { label: "Form Aberto", className: "bg-yellow-100 text-yellow-700" },
      FORM_SUBMITTED: { label: "Form Enviado", className: "bg-green-100 text-green-700" },
      CHECKED_IN: { label: "Check-in", className: "bg-emerald-100 text-emerald-700" },
      MEETING_COMPLETED: { label: "Concluída", className: "bg-primary-100 text-primary-700" },
      CANCELLED: { label: "Cancelada", className: "bg-red-100 text-red-700" },
      RESCHEDULED: { label: "Reagendada", className: "bg-orange-100 text-orange-700" },
    };
    const { label, className } = statusMap[status] || { label: status, className: "bg-gray-100" };
    return <Badge variant="outline" className={className}>{label}</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Indicações de {leader?.leaderName}
          </DialogTitle>
          {leader?.cityName && (
            <p className="text-sm text-muted-foreground">{leader.cityName}</p>
          )}
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="todos">
              Todos ({counts.todos})
            </TabsTrigger>
            <TabsTrigger value="cadastro">
              Cadastros ({counts.cadastro})
            </TabsTrigger>
            <TabsTrigger value="evento">
              Eventos ({counts.evento})
            </TabsTrigger>
            <TabsTrigger value="visita">
              Visitas ({counts.visita})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Carregando indicações...
              </div>
            ) : filteredReferrals.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma indicação encontrada.
              </div>
            ) : (
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-3">
                  {filteredReferrals.map((referral) => (
                    <div
                      key={`${referral.source}-${referral.id}`}
                      className="p-4 border rounded-lg bg-card hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-foreground truncate">
                              {referral.nome}
                            </h4>
                            {getSourceBadge(referral.source)}
                          </div>

                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                            {referral.email && (
                              <span className="flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {referral.email}
                              </span>
                            )}
                            {referral.telefone && (
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {referral.telefone}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(referral.created_at), "dd/MM/yyyy", {
                                locale: ptBR,
                              })}
                            </span>
                          </div>

                          {/* Informações específicas por tipo */}
                          {referral.source === "evento" && (
                            <div className="mt-2 flex items-center gap-2 text-sm">
                              <span className="text-muted-foreground">
                                🎪 {referral.eventName}
                                {referral.eventDate && ` (${format(new Date(referral.eventDate), "dd/MM/yyyy")})`}
                              </span>
                              {referral.checkedIn ? (
                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Check-in
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200">
                                  <XCircle className="h-3 w-3 mr-1" />
                                  Sem check-in
                                </Badge>
                              )}
                            </div>
                          )}

                          {referral.source === "visita" && (
                            <div className="mt-2 flex items-center gap-2 text-sm">
                              <span className="text-muted-foreground font-mono">
                                {referral.protocolo}
                              </span>
                              {referral.visitStatus && getVisitStatusBadge(referral.visitStatus)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
