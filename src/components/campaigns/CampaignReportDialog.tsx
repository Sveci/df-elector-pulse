import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TrendingUp, Users, Target, CheckCircle2, XCircle, Calendar, FileText } from "lucide-react";
import { useDemoMask } from "@/contexts/DemoModeContext";

interface CampaignReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignUtmCampaign: string;
  campaignName: string;
}

interface RegistrationData {
  id: string;
  nome: string;
  email: string;
  whatsapp: string;
  cidade: string | null;
  checked_in: boolean | null;
  checked_in_at: string | null;
  created_at: string;
  leader_nome: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  source: 'event' | 'funnel';
}

export default function CampaignReportDialog({
  open,
  onOpenChange,
  campaignUtmCampaign,
  campaignName,
}: CampaignReportDialogProps) {
  const { isDemoMode, m } = useDemoMask();

  // Buscar visitantes (page_views) - both eventos and captacao
  const { data: pageViews = 0 } = useQuery({
    queryKey: ["campaign_page_views", campaignUtmCampaign],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("page_views")
        .select("*", { count: "exact", head: true })
        .eq("utm_campaign", campaignUtmCampaign);

      if (error) throw error;
      return count || 0;
    },
    enabled: open && !!campaignUtmCampaign,
  });

  // Buscar cadastros de EVENTOS (event_registrations)
  const { data: eventRegistrations = [] } = useQuery({
    queryKey: ["campaign_event_registrations", campaignUtmCampaign],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_registrations")
        .select(`
          id,
          nome,
          email,
          whatsapp,
          checked_in,
          checked_in_at,
          created_at,
          utm_source,
          utm_medium,
          utm_campaign,
          utm_content,
          cidade:office_cities(nome),
          leader:lideres(nome_completo)
        `)
        .eq("utm_campaign", campaignUtmCampaign)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data || []).map((reg: any) => ({
        id: reg.id,
        nome: reg.nome,
        email: reg.email,
        whatsapp: reg.whatsapp,
        cidade: reg.cidade?.nome || null,
        checked_in: reg.checked_in || false,
        checked_in_at: reg.checked_in_at,
        created_at: reg.created_at,
        leader_nome: reg.leader?.nome_completo || null,
        utm_source: reg.utm_source,
        utm_medium: reg.utm_medium,
        utm_campaign: reg.utm_campaign,
        utm_content: reg.utm_content,
        source: 'event' as const,
      })) as RegistrationData[];
    },
    enabled: open && !!campaignUtmCampaign,
  });

  // Buscar cadastros de FUNIS (office_contacts with source_type='captacao')
  const { data: funnelLeads = [] } = useQuery({
    queryKey: ["campaign_funnel_leads", campaignUtmCampaign],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("office_contacts")
        .select(`
          id,
          nome,
          email,
          telefone_norm,
          created_at,
          cidade:office_cities!cidade_id(nome),
          utm_source,
          utm_medium,
          utm_campaign,
          utm_content
        `)
        .eq("utm_campaign", campaignUtmCampaign)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data || []).map((contact: any) => ({
        id: contact.id,
        nome: contact.nome,
        email: contact.email || "-",
        whatsapp: contact.telefone_norm,
        cidade: contact.cidade?.nome || null,
        checked_in: null, // N/A for funnel leads
        checked_in_at: null,
        created_at: contact.created_at,
        leader_nome: null,
        utm_source: contact.utm_source,
        utm_medium: contact.utm_medium,
        utm_campaign: contact.utm_campaign,
        utm_content: contact.utm_content,
        source: 'funnel' as const,
      })) as RegistrationData[];
    },
    enabled: open && !!campaignUtmCampaign,
  });

  // Combinar e ordenar resultados
  const allRegistrations = [
    ...eventRegistrations,
    ...funnelLeads,
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const isLoading = false;

  const totalRegistrations = allRegistrations.length;
  const totalCheckins = allRegistrations.filter(r => r.checked_in === true).length;
  const conversionRate = pageViews > 0
    ? ((totalRegistrations / pageViews) * 100).toFixed(1)
    : "0.0";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Relatório: {m.brand(campaignName)}</DialogTitle>
        </DialogHeader>

        {/* Métricas Principais */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Visitantes</p>
                  <p className="text-2xl font-bold text-purple-600">{m.number(pageViews, "camp_pv")}</p>
                </div>
                <Users className="h-8 w-8 text-purple-600 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Cadastros</p>
                  <p className="text-2xl font-bold text-blue-600">{m.number(totalRegistrations, "camp_reg")}</p>
                </div>
                <Target className="h-8 w-8 text-blue-600 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Check-ins</p>
                  <p className="text-2xl font-bold text-green-600">{m.number(totalCheckins, "camp_chk")}</p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-green-600 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Conversão</p>
                  <p className="text-2xl font-bold text-orange-600">{isDemoMode ? m.percentage(parseFloat(conversionRate), "camp_conv") : conversionRate}%</p>
                </div>
                <TrendingUp className="h-8 w-8 text-orange-600 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Breakdown por origem */}
        <div className="flex gap-4 mb-4">
          <Badge variant="outline" className="text-sm">
            <Calendar className="w-3 h-3 mr-1" />
            Eventos: {m.number(eventRegistrations.length, "camp_ev")}
          </Badge>
          <Badge variant="outline" className="text-sm">
            <FileText className="w-3 h-3 mr-1" />
            Captação: {m.number(funnelLeads.length, "camp_fn")}
          </Badge>
        </div>

        {/* Tabela de Cadastrados */}
        <div className="border rounded-lg">
          <div className="bg-muted px-4 py-3 rounded-t-lg">
            <h3 className="font-semibold">Cadastrados ({m.number(totalRegistrations, "camp_reg")})</h3>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">
              Carregando...
            </div>
          ) : allRegistrations.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              Nenhum cadastro encontrado para esta campanha.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Origem</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead>Cidade</TableHead>
                  <TableHead>Líder</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Check-in</TableHead>
                  <TableHead>UTM Source</TableHead>
                  <TableHead>UTM Medium</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allRegistrations.map((reg) => (
                  <TableRow key={`${reg.source}-${reg.id}`}>
                    <TableCell>
                      <Badge variant={reg.source === 'event' ? 'default' : 'secondary'}>
                        {reg.source === 'event' ? 'Evento' : 'Captação'}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{m.name(reg.nome)}</TableCell>
                    <TableCell className="text-sm">{m.email(reg.email)}</TableCell>
                    <TableCell className="text-sm">{m.phone(reg.whatsapp)}</TableCell>
                    <TableCell className="text-sm">{m.city(reg.cidade)}</TableCell>
                    <TableCell className="text-sm">{reg.leader_nome ? m.name(reg.leader_nome) : "-"}</TableCell>
                    <TableCell className="text-sm">
                      {format(new Date(reg.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      {reg.source === 'funnel' ? (
                        <Badge variant="outline" className="text-gray-400">
                          N/A
                        </Badge>
                      ) : reg.checked_in ? (
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Sim
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-gray-500">
                          <XCircle className="w-3 h-3 mr-1" />
                          Não
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {reg.utm_source || "-"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {reg.utm_medium || "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
