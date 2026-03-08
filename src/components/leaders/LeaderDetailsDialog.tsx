import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import * as XLSX from "xlsx";

import { 
  User, Users, Calendar, MessageSquare, Trophy, History, 
  MapPin, Phone, Mail, CheckCircle, Clock, AlertCircle,
  MessageCircle, Send, Eye, XCircle, Globe, ExternalLink, ClipboardList,
  Download, Crown, Star, ChevronDown, GitBranch, FileText, ShieldCheck, ShieldAlert,
  Link, UserCheck, RefreshCw, ChevronRight, Wallet, Loader2, Shield
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { OfficeLeader } from "@/types/office";
import { useLeaderIndicatedContacts } from "@/hooks/leaders/useLeaderIndicatedContacts";
import { useLeaderSubordinates } from "@/hooks/leaders/useLeaderSubordinates";
import { useLeaderEventParticipation } from "@/hooks/leaders/useLeaderEventParticipation";
import { useLeaderCommunications } from "@/hooks/leaders/useLeaderCommunications";
import { useLeaderVisits } from "@/hooks/leaders/useLeaderVisits";
import { useLeaderPageViews } from "@/hooks/leaders/useLeaderPageViews";
import { useLeaderSurveyReferrals } from "@/hooks/leaders/useLeaderSurveyReferrals";
import { LeaderLevelBadge, LeaderLevelProgress } from "@/components/leaders/LeaderLevelBadge";
import { 
  useLeaderLevels, 
  useGamificationSettings,
  getLeaderLevel,
  getNextLevel,
  getPointsToNextLevel,
  DEFAULT_LEVELS
} from "@/hooks/leaders/useLeaderLevels";
import { useLeaderHierarchyPath } from "@/hooks/leaders/useLeaderHierarchyPath";
import { useResendLeaderVerificationSMS, useMarkLeaderVerifiedManually } from "@/hooks/leaders/useLeaderVerification";

interface LeaderDetailsDialogProps {
  leader: OfficeLeader;
  children: React.ReactNode;
}

const formatPhone = (phone: string) => {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 13) {
    return `(${cleaned.slice(2, 4)}) ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
  }
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  }
  return phone;
};

const formatDate = (date: string | null | undefined) => {
  if (!date) return "-";
  // Parse date-only strings (YYYY-MM-DD) without timezone shift
  const dateOnly = date.match(/^\d{4}-\d{2}-\d{2}$/);
  if (dateOnly) {
    const [y, m, d] = date.split("-").map(Number);
    return format(new Date(y, m - 1, d), "dd/MM/yyyy", { locale: ptBR });
  }
  const parsed = new Date(date);
  if (isNaN(parsed.getTime())) return "-";
  return format(parsed, "dd/MM/yyyy", { locale: ptBR });
};

const formatDateTime = (date: string | null | undefined) => {
  if (!date) return "-";
  const parsed = new Date(date);
  if (isNaN(parsed.getTime())) return "-";
  return format(parsed, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
};

const whatsappStatusConfig: Record<string, { icon: React.ReactNode; label: string; className: string }> = {
  pending: { icon: <Clock className="h-3 w-3" />, label: "Pendente", className: "text-muted-foreground" },
  sent: { icon: <CheckCircle className="h-3 w-3" />, label: "Enviado", className: "text-gray-500" },
  delivered: { icon: <CheckCircle className="h-3 w-3" />, label: "Entregue", className: "text-green-600" },
  read: { icon: <Eye className="h-3 w-3" />, label: "Lido", className: "text-blue-600" },
  failed: { icon: <XCircle className="h-3 w-3" />, label: "Falhou", className: "text-red-600" },
};

const visitStatusLabels: Record<string, string> = {
  REGISTERED: "Registrado",
  LINK_SENT: "Link Enviado",
  FORM_OPENED: "Form Aberto",
  FORM_SUBMITTED: "Form Enviado",
  CHECKED_IN: "Check-in Feito",
  CANCELLED: "Cancelado",
  MEETING_COMPLETED: "Reunião Concluída",
  RESCHEDULED: "Reagendado",
};

export function LeaderDetailsDialog({ leader, children }: LeaderDetailsDialogProps) {
  const [open, setOpen] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);
  const [loadingDetailedReport, setLoadingDetailedReport] = useState(false);
  const [includeAllLevels, setIncludeAllLevels] = useState(true);
  const [generatingPass, setGeneratingPass] = useState(false);
  const [portalPassword, setPortalPassword] = useState("");
  const [settingPassword, setSettingPassword] = useState(false);
  
  const { data: indicatedContacts, isLoading: loadingContacts } = useLeaderIndicatedContacts(open ? leader.id : undefined);
  const { data: subordinates, isLoading: loadingSubordinates } = useLeaderSubordinates(open ? leader.id : undefined);
  const { indicatedEvents, ownEvents, isLoading: loadingEvents } = useLeaderEventParticipation(
    open ? leader.id : undefined, 
    open ? leader.telefone : undefined,
    open ? leader.email : undefined
  );
  const { whatsappMessages, emailLogs, smsMessages, isLoading: loadingComms } = useLeaderCommunications(
    open ? leader.id : undefined,
    open ? leader.telefone : undefined,
    open ? leader.email : undefined
  );
  const { data: visits, isLoading: loadingVisits } = useLeaderVisits(open ? leader.id : undefined);
  const { data: pageViews, isLoading: loadingPageViews } = useLeaderPageViews(open ? leader.id : undefined);
  const { data: surveyData, isLoading: loadingSurveys } = useLeaderSurveyReferrals(open ? leader.id : undefined);
  const { data: hierarchyPath, isLoading: loadingHierarchy } = useLeaderHierarchyPath(open ? leader.id : undefined);
  
  // Hooks de verificação
  const resendVerificationMutation = useResendLeaderVerificationSMS();
  const markVerifiedMutation = useMarkLeaderVerifiedManually();
  
  // Buscar níveis e configurações dinâmicas do banco
  const { data: dynamicLevels } = useLeaderLevels();
  const { data: gamificationSettings } = useGamificationSettings();
  
  // Usar níveis dinâmicos ou fallback para padrão
  const activeLevels = dynamicLevels || DEFAULT_LEVELS;
  
  const levelInfo = getLeaderLevel(leader.pontuacao_total, activeLevels);
  const nextLevel = getNextLevel(leader.pontuacao_total, activeLevels);
  const pointsToNext = getPointsToNextLevel(leader.pontuacao_total, activeLevels);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col min-h-0 overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <User className="h-5 w-5" />
            {leader.nome_completo}
            <LeaderLevelBadge points={leader.pontuacao_total} levels={activeLevels} size="sm" />
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="info" className="flex flex-col flex-1 min-h-0">
          <TabsList className="w-full flex flex-wrap items-center justify-start gap-1 h-auto p-1">
            <TabsTrigger value="info" className="text-xs">Info</TabsTrigger>
            <TabsTrigger value="verificacao" className="text-xs">Verificação</TabsTrigger>
            <TabsTrigger value="indicacoes" className="text-xs">Indicações</TabsTrigger>
            <TabsTrigger value="eventos" className="text-xs">Eventos</TabsTrigger>
            <TabsTrigger value="pesquisas" className="text-xs">Pesquisas</TabsTrigger>
            <TabsTrigger value="comunicacoes" className="text-xs">Comunicações</TabsTrigger>
            <TabsTrigger value="pontuacao" className="text-xs">Pontuação</TabsTrigger>
            <TabsTrigger value="arvore" className="text-xs">Árvore</TabsTrigger>
            <TabsTrigger value="historico" className="text-xs">Histórico</TabsTrigger>
          </TabsList>

          <div className="flex-1 min-h-0 mt-4 overflow-y-auto overflow-x-hidden">
            {/* ABA INFO */}
            <TabsContent value="info" className="mt-0 space-y-4 pr-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    {leader.email || "Não informado"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Telefone</p>
                  <p className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    {leader.telefone ? formatPhone(leader.telefone) : "Não informado"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Região</p>
                  <p className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    {leader.cidade?.nome || leader.localidade || "Não informada"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Data de Nascimento</p>
                  <p>{leader.data_nascimento ? formatDate(leader.data_nascimento) : "Não informada"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Cadastro</p>
                  <p>{formatDate(leader.created_at)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Última Atividade</p>
                  <p>{leader.last_activity ? formatDateTime(leader.last_activity) : "Sem atividade"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge variant={leader.is_active ? "default" : "secondary"}>
                    {leader.is_active ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Token de Afiliado</p>
                  <p className="font-mono text-sm">{leader.affiliate_token || "Não gerado"}</p>
                </div>
              </div>
              {leader.observacao && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Observações</p>
                  <p className="text-sm bg-muted p-3 rounded-md">{leader.observacao}</p>
                </div>
              )}

              {/* Seção Carteira Digital */}
              <div className="pt-4 border-t">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="font-medium flex items-center gap-2">
                      <Wallet className="h-4 w-4" />
                      Carteira Digital
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Gere um cartão digital para Apple Wallet ou Google Pay
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={generatingPass || !leader.affiliate_token}
                    onClick={async () => {
                      setGeneratingPass(true);
                      try {
                        const { data, error } = await supabase.functions.invoke('create-leader-pass', {
                          body: { leaderId: leader.id }
                        });
                        
                        if (error || !data?.success) {
                          toast.error(data?.error || "Erro ao gerar cartão digital");
                          return;
                        }
                        
                        if (data.data?.passUrl) {
                          window.open(data.data.passUrl, '_blank');
                          toast.success("Cartão digital gerado! Abrindo página de download...");
                        } else {
                          toast.success("Cartão digital criado com sucesso!");
                        }
                      } catch (err) {
                        console.error("Erro ao gerar passe:", err);
                        toast.error("Erro ao gerar cartão digital");
                      } finally {
                        setGeneratingPass(false);
                      }
                    }}
                  >
                    {generatingPass ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Wallet className="h-4 w-4 mr-2" />
                    )}
                    {generatingPass ? "Gerando..." : "Gerar Cartão"}
                  </Button>
                </div>
                {!leader.affiliate_token && (
                  <p className="text-xs text-amber-600 mt-2">
                    O líder precisa ter um token de afiliado para gerar o cartão digital.
                  </p>
                )}
              </div>

              {/* Seção Portal do Coordenador */}
              {leader.is_coordinator && (
                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        Portal do Coordenador
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        Defina a senha de acesso ao portal do coordenador
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <input
                      type="password"
                      placeholder="Nova senha"
                      value={portalPassword}
                      onChange={(e) => setPortalPassword(e.target.value)}
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                    />
                    <Button
                      size="sm"
                      disabled={settingPassword || !portalPassword || portalPassword.length < 4}
                      onClick={async () => {
                        setSettingPassword(true);
                        try {
                          const { error } = await (supabase.rpc as any)("coordinator_set_password", {
                            p_leader_id: leader.id,
                            p_password: portalPassword,
                          });
                          if (error) throw error;
                          toast.success("Senha do portal definida com sucesso!");
                          setPortalPassword("");
                        } catch (err: any) {
                          toast.error("Erro: " + (err?.message || "Falha ao definir senha"));
                        } finally {
                          setSettingPassword(false);
                        }
                      }}
                    >
                      {settingPassword ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Salvar"
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    O coordenador acessará via <strong>/coordenador/login</strong> com o telefone e esta senha.
                  </p>
                </div>
              )}
            </TabsContent>

            {/* ABA VERIFICAÇÃO */}
            <TabsContent value="verificacao" className="mt-0 space-y-4 pr-4">
              {leader.is_verified ? (
                <div className="p-4 rounded-lg bg-green-50 border border-green-200 dark:bg-green-950/30 dark:border-green-800">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-medium">
                    <ShieldCheck className="h-5 w-5" />
                    Líder Verificado
                  </div>
                  <p className="text-sm text-green-600 dark:text-green-500 mt-2">
                    Este líder confirmou seu cadastro e já possui acesso ao link de indicação.
                  </p>
                  
                  {/* Método de verificação */}
                  <div className="mt-3 flex items-center gap-2 text-sm text-green-600 dark:text-green-500">
                    {leader.verification_method === 'manual' ? (
                      <>
                        <UserCheck className="h-4 w-4" />
                        <span>Verificado manualmente por um administrador</span>
                      </>
                    ) : leader.verification_method === 'whatsapp' || leader.verification_method === 'whatsapp_consent' ? (
                      <>
                        <MessageSquare className="h-4 w-4" />
                        <span>Verificado automaticamente via WhatsApp</span>
                      </>
                    ) : leader.verification_method === 'link' || leader.verification_method === 'sms' ? (
                      <>
                        <Link className="h-4 w-4" />
                        <span>Verificado automaticamente via link (SMS)</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4" />
                        <span>Verificado automaticamente</span>
                      </>
                    )}
                  </div>
                  
                  {leader.verified_at && (
                    <p className="text-xs text-green-500 dark:text-green-600 mt-2">
                      Verificado em: {formatDateTime(leader.verified_at)}
                    </p>
                  )}
                </div>
              ) : (
                <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-800 space-y-4">
                  <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-medium">
                    <ShieldAlert className="h-5 w-5" />
                    Verificação Pendente
                  </div>
                  <p className="text-sm text-amber-600 dark:text-amber-500">
                    Este líder precisa confirmar seu cadastro antes de receber o link de indicação.
                  </p>
                  
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="text-xs text-amber-600 dark:text-amber-500">
                      {leader.verification_sent_at ? (
                        <span>SMS enviado em: {formatDateTime(leader.verification_sent_at)}</span>
                      ) : (
                        <span>Nenhum SMS de verificação enviado</span>
                      )}
                    </div>
                    {leader.verification_code && (
                      <div className="font-mono bg-amber-100 dark:bg-amber-900/50 px-2 py-1 rounded text-xs">
                        Código: {leader.verification_code}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      disabled={resendVerificationMutation.isPending || !leader.telefone}
                      onClick={() => resendVerificationMutation.mutate(leader.id)}
                    >
                      {resendVerificationMutation.isPending ? (
                        <Clock className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <MessageSquare className="h-4 w-4 mr-2" />
                      )}
                      Reenviar SMS de Verificação
                    </Button>
                    <Button 
                      size="sm" 
                      variant="default"
                      disabled={markVerifiedMutation.isPending}
                      onClick={() => markVerifiedMutation.mutate(leader.id)}
                    >
                      {markVerifiedMutation.isPending ? (
                        <Clock className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <ShieldCheck className="h-4 w-4 mr-2" />
                      )}
                      Verificar Manualmente
                    </Button>
                  </div>
                </div>
              )}
              
              {/* Info sobre o fluxo */}
              <Card>
                <CardContent className="p-4">
                  <h4 className="font-medium mb-2">Fluxo de Verificação</h4>
                  <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                    <li>Líder se cadastra e recebe SMS com link de verificação</li>
                    <li>Líder clica no link e confirma seu telefone</li>
                    <li>Sistema envia automaticamente SMS/WhatsApp com link de indicação</li>
                    <li>Líder pode então começar a cadastrar apoiadores</li>
                  </ol>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ABA INDICAÇÕES */}
            <TabsContent value="indicacoes" className="mt-0 space-y-4 pr-4">
              {/* Header com total combinado */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h4 className="font-medium">Total de Indicações</h4>
                <Badge variant="default" className="text-sm">
                  {(indicatedContacts?.length || 0) + (subordinates?.length || 0)} indicações
                </Badge>
              </div>

              {/* Botões de Exportação */}
              <div className="flex flex-wrap gap-2">
                {/* Botão Todos */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const allContacts = indicatedContacts || [];
                    const allLeaders = subordinates || [];
                    const totalRecords = allContacts.length + allLeaders.length;
                    
                    if (totalRecords === 0) {
                      toast.info("Nenhum registro para exportar.");
                      return;
                    }
                    
                    const headers = ['Nome', 'Telefone', 'Email', 'Região', 'Tipo', 'Status', 'Data Cadastro'];
                    
                    const contactRows = allContacts.map(c => [
                      c.nome,
                      formatPhone(c.telefone_norm),
                      c.email || '',
                      c.cidade?.nome || '',
                      'Contato',
                      c.is_verified ? 'Verificado' : 'Pendente',
                      formatDate(c.created_at)
                    ]);
                    
                    const leaderRows = allLeaders.map(l => [
                      l.nome_completo,
                      l.telefone ? formatPhone(l.telefone) : '',
                      l.email || '',
                      l.cidade?.nome || '',
                      'Líder',
                      l.is_verified ? 'Verificado' : 'Não Verificado',
                      formatDate(l.created_at)
                    ]);
                    
                    const allRows = [...contactRows, ...leaderRows];
                    const csv = [headers, ...allRows].map(row => row.join(';')).join('\n');
                    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `${leader.nome_completo}_todos.csv`;
                    link.click();
                    URL.revokeObjectURL(url);
                    toast.success(`${totalRecords} registros exportados (${allContacts.length} contatos + ${allLeaders.length} líderes).`);
                  }}
                  disabled={!((indicatedContacts && indicatedContacts.length > 0) || (subordinates && subordinates.length > 0))}
                >
                  <Download className="h-4 w-4 mr-1" />
                  Todos ({(indicatedContacts?.length || 0) + (subordinates?.length || 0)})
                </Button>

                {/* Botão Verificados */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const verifiedContacts = indicatedContacts?.filter(c => c.is_verified) || [];
                    const verifiedLeaders = subordinates?.filter(l => l.is_verified) || [];
                    const totalVerified = verifiedContacts.length + verifiedLeaders.length;
                    
                    if (totalVerified === 0) {
                      toast.info("Nenhum registro verificado para exportar.");
                      return;
                    }
                    
                    const headers = ['Nome', 'Telefone', 'Email', 'Região', 'Tipo', 'Data Cadastro', 'Data Verificação'];
                    
                    const contactRows = verifiedContacts.map(c => [
                      c.nome,
                      formatPhone(c.telefone_norm),
                      c.email || '',
                      c.cidade?.nome || '',
                      'Contato',
                      formatDate(c.created_at),
                      c.verified_at ? formatDate(c.verified_at) : ''
                    ]);
                    
                    const leaderRows = verifiedLeaders.map(l => [
                      l.nome_completo,
                      l.telefone ? formatPhone(l.telefone) : '',
                      l.email || '',
                      l.cidade?.nome || '',
                      'Líder',
                      formatDate(l.created_at),
                      l.verified_at ? formatDate(l.verified_at) : ''
                    ]);
                    
                    const allRows = [...contactRows, ...leaderRows];
                    const csv = [headers, ...allRows].map(row => row.join(';')).join('\n');
                    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `${leader.nome_completo}_verificados.csv`;
                    link.click();
                    URL.revokeObjectURL(url);
                    toast.success(`${totalVerified} registros exportados (${verifiedContacts.length} contatos + ${verifiedLeaders.length} líderes).`);
                  }}
                  disabled={!(indicatedContacts?.some(c => c.is_verified) || subordinates?.some(l => l.is_verified))}
                >
                  <Download className="h-4 w-4 mr-1" />
                  Verificados ({(indicatedContacts?.filter(c => c.is_verified).length || 0) + (subordinates?.filter(l => l.is_verified).length || 0)})
                </Button>

                {/* Botão Pendentes */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const pendingContacts = indicatedContacts?.filter(c => !c.is_verified) || [];
                    const pendingLeaders = subordinates?.filter(l => !l.is_verified) || [];
                    const totalPending = pendingContacts.length + pendingLeaders.length;
                    
                    if (totalPending === 0) {
                      toast.info("Nenhum registro pendente para exportar.");
                      return;
                    }
                    
                    const headers = ['Nome', 'Telefone', 'Email', 'Região', 'Tipo', 'Data Cadastro'];
                    
                    const contactRows = pendingContacts.map(c => [
                      c.nome,
                      formatPhone(c.telefone_norm),
                      c.email || '',
                      c.cidade?.nome || '',
                      'Contato',
                      formatDate(c.created_at)
                    ]);
                    
                    const leaderRows = pendingLeaders.map(l => [
                      l.nome_completo,
                      l.telefone ? formatPhone(l.telefone) : '',
                      l.email || '',
                      l.cidade?.nome || '',
                      'Líder',
                      formatDate(l.created_at)
                    ]);
                    
                    const allRows = [...contactRows, ...leaderRows];
                    const csv = [headers, ...allRows].map(row => row.join(';')).join('\n');
                    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `${leader.nome_completo}_pendentes.csv`;
                    link.click();
                    URL.revokeObjectURL(url);
                    toast.success(`${totalPending} registros pendentes exportados (${pendingContacts.length} contatos + ${pendingLeaders.length} líderes).`);
                  }}
                  disabled={!(indicatedContacts?.some(c => !c.is_verified) || subordinates?.some(l => !l.is_verified))}
                >
                  <Download className="h-4 w-4 mr-1" />
                  Pendentes ({(indicatedContacts?.filter(c => !c.is_verified).length || 0) + (subordinates?.filter(l => !l.is_verified).length || 0)})
                </Button>
              </div>

              {/* Seção: Líderes Indicados (Subordinados) */}
              {(loadingSubordinates || (subordinates && subordinates.length > 0)) && (
                <>
                  <div className="flex items-center justify-between mt-4">
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4 text-amber-500" />
                      <h5 className="font-medium text-sm">Líderes Indicados</h5>
                    </div>
                    <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-0">
                      {subordinates?.length || 0} líderes
                    </Badge>
                  </div>
                  
                  {loadingSubordinates ? (
                    <p className="text-sm text-muted-foreground">Carregando...</p>
                  ) : (
                    <div className="space-y-2">
                      {subordinates?.map((sub) => (
                        <Card key={sub.id}>
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-medium">{sub.nome_completo}</p>
                                  <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300 text-xs">
                                    <Star className="h-3 w-3 mr-1" />
                                    Líder
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {sub.cidade?.nome || "Sem região"} • {formatDate(sub.created_at)}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge variant="secondary" className="text-xs">
                                    {sub.cadastros} cadastros
                                  </Badge>
                                  <Badge variant="secondary" className="text-xs">
                                    {sub.pontuacao_total} pontos
                                  </Badge>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {sub.is_verified ? (
                                  <Badge variant="default" className="bg-green-500/10 text-green-600 border-0">
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Verificado
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-0">
                                    <Clock className="h-3 w-3 mr-1" />
                                    Não Verificado
                                  </Badge>
                                )}
                                {sub.is_active ? (
                                  <Badge variant="default" className="bg-green-500/10 text-green-600 border-0">
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Ativo
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary">Inativo</Badge>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Seção: Contatos Indicados */}
              <div className="flex items-center justify-between mt-6">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-500" />
                  <h5 className="font-medium text-sm">Contatos Indicados</h5>
                </div>
                <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 border-0">
                  {indicatedContacts?.length || 0} contatos
                </Badge>
              </div>
              
              {loadingContacts ? (
                <p className="text-sm text-muted-foreground">Carregando...</p>
              ) : !indicatedContacts?.length ? (
                <p className="text-sm text-muted-foreground">Nenhum contato indicado ainda.</p>
              ) : (
                <div className="space-y-2">
                  {indicatedContacts.map((contact) => (
                    <Card key={contact.id}>
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{contact.nome}</p>
                              <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300 text-xs">
                                <User className="h-3 w-3 mr-1" />
                                Contato
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {contact.cidade?.nome || "Sem região"} • {formatDate(contact.created_at)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {contact.is_verified ? (
                              <Badge variant="default" className="bg-green-500/10 text-green-600 border-0">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Verificado
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-0">
                                <Clock className="h-3 w-3 mr-1" />
                                Pendente
                              </Badge>
                            )}
                            {!contact.is_active && (
                              <Badge variant="secondary">Inativo</Badge>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Visitas criadas pelo líder */}
              {visits && visits.length > 0 && (
                <>
                  <div className="flex items-center justify-between mt-6">
                    <h4 className="font-medium">Visitas Agendadas</h4>
                    <Badge variant="secondary">{visits.length} visitas</Badge>
                  </div>
                  <div className="space-y-2">
                    {visits.map((visit) => (
                      <Card key={visit.id}>
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{visit.contact?.nome || "Contato"}</p>
                              <p className="text-sm text-muted-foreground">
                                {visit.protocolo} • {visit.city?.nome}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">
                                {visitStatusLabels[visit.status] || visit.status}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {formatDate(visit.created_at)}
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </>
              )}
            </TabsContent>

            {/* ABA EVENTOS */}
            <TabsContent value="eventos" className="mt-0 space-y-4 pr-4">
              {/* Eventos próprios */}
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Eventos Participados</h4>
                <Badge variant="secondary">{ownEvents.length} eventos</Badge>
              </div>
              
              {loadingEvents ? (
                <p className="text-sm text-muted-foreground">Carregando...</p>
              ) : !ownEvents.length ? (
                <p className="text-sm text-muted-foreground">Nenhuma participação em eventos.</p>
              ) : (
                <div className="space-y-2">
                  {ownEvents.map((reg) => (
                    <Card key={reg.id}>
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{reg.event?.name || "Evento"}</p>
                            <p className="text-sm text-muted-foreground">
                              {reg.event?.date ? formatDate(reg.event.date) : ""} às {reg.event?.time?.slice(0, 5)} • {reg.event?.location}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {reg.checked_in ? (
                              <Badge className="bg-green-500/10 text-green-600 border-0">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Check-in
                              </Badge>
                            ) : (
                              <Badge variant="outline">Inscrito</Badge>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Indicações em eventos */}
              {indicatedEvents.length > 0 && (
                <>
                  <div className="flex items-center justify-between mt-6">
                    <h4 className="font-medium">Indicações em Eventos</h4>
                    <Badge variant="secondary">{indicatedEvents.length} indicações</Badge>
                  </div>
                  <div className="space-y-2">
                    {indicatedEvents.map((reg) => (
                      <Card key={reg.id}>
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{reg.nome}</p>
                              <p className="text-sm text-muted-foreground">
                                {reg.event?.name} • {reg.event?.date ? formatDate(reg.event.date) : ""}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {reg.checked_in ? (
                                <Badge className="bg-green-500/10 text-green-600 border-0">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Check-in
                                </Badge>
                              ) : (
                                <Badge variant="outline">Inscrito</Badge>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </>
              )}
            </TabsContent>

            {/* ABA PESQUISAS */}
            <TabsContent value="pesquisas" className="mt-0 space-y-4 pr-4">
              {/* Pesquisas respondidas pelo líder */}
              <div className="flex items-center justify-between">
                <h4 className="font-medium flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-primary" />
                  Pesquisas Respondidas
                </h4>
                <Badge variant="secondary">{surveyData?.ownResponses?.length || 0} respostas</Badge>
              </div>
              
              {loadingSurveys ? (
                <p className="text-sm text-muted-foreground">Carregando...</p>
              ) : !surveyData?.ownResponses?.length ? (
                <p className="text-sm text-muted-foreground">Nenhuma pesquisa respondida ainda.</p>
              ) : (
                <div className="space-y-2">
                  {surveyData.ownResponses.map((response) => (
                    <Card key={response.id}>
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{response.survey?.titulo || "Pesquisa"}</p>
                            <p className="text-sm text-muted-foreground">
                              Respondida em {formatDateTime(response.created_at)}
                            </p>
                          </div>
                          <Badge className="bg-green-500/10 text-green-600 border-0">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Respondida
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Indicações de pesquisa */}
              {surveyData?.referredResponses && surveyData.referredResponses.length > 0 && (
                <>
                  <div className="flex items-center justify-between mt-6">
                    <h4 className="font-medium">Indicações em Pesquisas</h4>
                    <Badge variant="secondary">{surveyData.referredResponses.length} indicações</Badge>
                  </div>
                  <div className="space-y-2">
                    {surveyData.referredResponses.map((response) => (
                      <Card key={response.id}>
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{response.contact?.nome || "Contato"}</p>
                              <p className="text-sm text-muted-foreground">
                                {response.survey?.titulo} • {formatDateTime(response.created_at)}
                              </p>
                            </div>
                            <Badge variant="outline">
                              +2 pts
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </>
              )}
            </TabsContent>

            {/* ABA COMUNICAÇÕES */}
            <TabsContent value="comunicacoes" className="mt-0 space-y-4 pr-4 overflow-x-hidden max-w-full">
              {/* WhatsApp */}
              <div className="flex items-center justify-between">
                <h4 className="font-medium flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-green-600" />
                  WhatsApp
                </h4>
                <Badge variant="secondary">{whatsappMessages.length} mensagens</Badge>
              </div>
              
              {loadingComms ? (
                <p className="text-sm text-muted-foreground">Carregando...</p>
              ) : !whatsappMessages.length ? (
                <p className="text-sm text-muted-foreground">Nenhuma mensagem WhatsApp.</p>
              ) : (
                <div className="space-y-2">
                  {whatsappMessages.slice(0, 10).map((msg) => {
                    const statusInfo = whatsappStatusConfig[msg.status] || whatsappStatusConfig.pending;
                    return (
                      <Card key={msg.id} className="overflow-hidden w-full">
                        <CardContent className="p-3 max-w-full">
                          <div className="flex items-start justify-between gap-2 w-full">
                            <div className="flex-1 min-w-0 overflow-hidden">
                              <div className="flex items-center gap-2 mb-1">
                                {msg.direction === 'outgoing' ? (
                                  <Send className="h-3 w-3 text-blue-600" />
                                ) : (
                                  <MessageSquare className="h-3 w-3 text-green-600" />
                                )}
                                <span className={`flex items-center gap-1 text-xs ${statusInfo.className}`}>
                                  {statusInfo.icon}
                                  {statusInfo.label}
                                </span>
                              </div>
                              <p className="text-sm text-muted-foreground line-clamp-2">{msg.message}</p>
                            </div>
                            <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                              {formatDateTime(msg.created_at)}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}

              {/* SMS */}
              <div className="flex items-center justify-between mt-6">
                <h4 className="font-medium flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-purple-600" />
                  SMS
                </h4>
                <Badge variant="secondary">{smsMessages.length} mensagens</Badge>
              </div>
              
              {!smsMessages.length ? (
                <p className="text-sm text-muted-foreground">Nenhum SMS enviado.</p>
              ) : (
                <div className="space-y-2">
                  {smsMessages.slice(0, 10).map((sms) => {
                    const statusInfo = whatsappStatusConfig[sms.status] || whatsappStatusConfig.pending;
                    return (
                      <Card key={sms.id} className="overflow-hidden w-full">
                        <CardContent className="p-3 max-w-full">
                          <div className="flex items-start justify-between gap-2 w-full">
                            <div className="flex-1 min-w-0 overflow-hidden">
                              <div className="flex items-center gap-2 mb-1">
                                <Send className="h-3 w-3 text-purple-600" />
                                <span className={`flex items-center gap-1 text-xs ${statusInfo.className}`}>
                                  {statusInfo.icon}
                                  {statusInfo.label}
                                </span>
                              </div>
                              <p className="text-sm text-muted-foreground line-clamp-2">{sms.message}</p>
                            </div>
                            <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                              {formatDateTime(sms.created_at)}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}

              {/* Email */}
              <div className="flex items-center justify-between mt-6">
                <h4 className="font-medium flex items-center gap-2">
                  <Mail className="h-4 w-4 text-blue-600" />
                  Email
                </h4>
                <Badge variant="secondary">{emailLogs.length} emails</Badge>
              </div>
              
              {!emailLogs.length ? (
                <p className="text-sm text-muted-foreground">Nenhum email enviado.</p>
              ) : (
                <div className="space-y-2">
                  {emailLogs.slice(0, 10).map((email) => (
                    <Card key={email.id} className="overflow-hidden w-full">
                      <CardContent className="p-3 max-w-full">
                        <div className="flex items-start justify-between gap-2 w-full">
                          <div className="flex-1 min-w-0 overflow-hidden">
                            <p className="font-medium text-sm line-clamp-1">{email.subject}</p>
                            <p className="text-xs text-muted-foreground line-clamp-1">{email.to_email}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge 
                              variant="outline" 
                              className={email.status === 'sent' ? 'text-green-600' : email.status === 'failed' ? 'text-red-600' : ''}
                            >
                              {email.status === 'sent' ? 'Enviado' : email.status === 'failed' ? 'Falhou' : 'Pendente'}
                            </Badge>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {formatDateTime(email.created_at)}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* ABA PONTUAÇÃO */}
            <TabsContent value="pontuacao" className="mt-0 space-y-4 pr-4">
              <div className="text-center p-6 bg-muted rounded-lg">
                <div className="text-5xl mb-2">{levelInfo.icon}</div>
                <h3 className="text-2xl font-bold">{levelInfo.name}</h3>
                <p className="text-3xl font-bold text-primary mt-2">{leader.pontuacao_total} pontos</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Progresso para próximo nível</span>
                  <span className="font-medium">{nextLevel ? `${pointsToNext} pts restantes` : 'Nível máximo!'}</span>
                </div>
                <LeaderLevelProgress points={leader.pontuacao_total} levels={activeLevels} />
              </div>

              <div className="grid grid-cols-3 gap-4 mt-6">
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-3xl font-bold text-primary">{(leader.cadastros || 0) + (subordinates?.length || 0)}</p>
                    <p className="text-sm text-muted-foreground">Total Indicações</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-3xl font-bold text-primary">{(indicatedContacts?.filter(c => c.is_verified).length || 0) + (subordinates?.length || 0)}</p>
                    <p className="text-sm text-muted-foreground">Verificados</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-3xl font-bold text-primary">{subordinates?.length || 0}</p>
                    <p className="text-sm text-muted-foreground">Líderes Indicados</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-3xl font-bold text-primary">{indicatedEvents.length}</p>
                    <p className="text-sm text-muted-foreground">Indicações em Eventos</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-3xl font-bold text-primary">{visits?.filter(v => v.checked_in).length || 0}</p>
                    <p className="text-sm text-muted-foreground">Check-ins de Visitas</p>
                  </CardContent>
                </Card>
              </div>

              <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-2">Como ganhar pontos:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• +{gamificationSettings?.pontos_form_submitted || 1} ponto por contato indicado verificado</li>
                  <li>• +{gamificationSettings?.pontos_form_submitted || 1} ponto por inscrição em evento</li>
                  <li>• +2 pontos por check-in em evento</li>
                  <li>• +2 pontos por check-in de visita indicada</li>
                  <li>• +2 pontos por download de material indicado</li>
                  <li>• +1 ponto por responder uma pesquisa</li>
                  <li>• +2 pontos por indicação que responde pesquisa</li>
                </ul>
              </div>
            </TabsContent>

            {/* ABA ÁRVORE */}
            <TabsContent value="arvore" className="mt-0 space-y-4 pr-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <GitBranch className="h-5 w-5 text-muted-foreground" />
                  <h4 className="font-medium">Hierarquia de Liderança</h4>
                </div>
                
                <div className="flex items-center gap-3">
                  {/* Checkbox para filtrar níveis no relatório */}
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      id="include-all-levels"
                      checked={includeAllLevels}
                      onCheckedChange={(checked) => setIncludeAllLevels(checked === true)}
                    />
                    <Label htmlFor="include-all-levels" className="text-sm text-muted-foreground cursor-pointer">
                      Incluir todos os níveis
                    </Label>
                  </div>
                  
                  {/* Botão de Relatório Detalhado (PDF) */}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={loadingDetailedReport}
                    onClick={async () => {
                      setLoadingDetailedReport(true);
                      try {
                        // 1. Buscar toda a árvore de líderes subordinados COM PAGINAÇÃO
                        const allTreeData: any[] = [];
                        const rpcPageSize = 1000;
                        let rpcPage = 0;
                        let hasMoreTreeData = true;

                        while (hasMoreTreeData) {
                          const from = rpcPage * rpcPageSize;
                          const to = from + rpcPageSize - 1;

                          const { data: pageData, error: pageError } = await supabase
                            .rpc("get_leader_tree", { _leader_id: leader.id })
                            .range(from, to);

                          if (pageError) throw pageError;

                          if (pageData && pageData.length > 0) {
                            allTreeData.push(...pageData);
                            hasMoreTreeData = pageData.length === rpcPageSize;
                            rpcPage++;
                          } else {
                            hasMoreTreeData = false;
                          }
                        }

                        // Filtrar apenas líderes ativos
                        const leaders = allTreeData.filter((l: any) => l.is_active === true);
                        const leaderIds = leaders.map((l: any) => l.id);

                        if (leaderIds.length === 0) {
                          toast.info("Nenhum líder encontrado na árvore.");
                          setLoadingDetailedReport(false);
                          return;
                        }

                        // 2. Calcular estatísticas por líder (verificação de LÍDERES, não contatos)
                        const baseLevel = leader.hierarchy_level || 1;
                        const directSubordinateLevel = baseLevel + 1;

                        // Filtrar líderes para o relatório baseado na opção selecionada
                        const sortLeadersHierarchically = (allLeaders: any[], parentId: string): any[] => {
                          const result: any[] = [];
                          const children = allLeaders.filter((l: any) => l.parent_leader_id === parentId && l.id !== parentId);
                          
                          for (const child of children) {
                            result.push(child);
                            result.push(...sortLeadersHierarchically(allLeaders, child.id));
                          }
                          
                          return result;
                        };

                        const sortedLeaders = sortLeadersHierarchically(leaders, leader.id);

                        const leadersForReport = includeAllLevels
                          ? sortedLeaders
                          : sortedLeaders.filter((l: any) => l.hierarchy_level === directSubordinateLevel);

                        // Criar mapa de subordinados diretos por líder
                        const subordinatesCount = new Map<string, number>();
                        leaders.forEach((l: any) => {
                          if (l.parent_leader_id) {
                            const count = subordinatesCount.get(l.parent_leader_id) || 0;
                            subordinatesCount.set(l.parent_leader_id, count + 1);
                          }
                        });

                        // Calcular líderes verificados/não verificados apenas entre subordinados diretos
                        const calculateDirectChildrenStats = (leaderId: string): { verified: number; notVerified: number } => {
                          const directChildren = leaders.filter((l: any) => l.parent_leader_id === leaderId && l.id !== leaderId);
                          
                          let totalVerified = 0;
                          let totalNotVerified = 0;
                          
                          for (const child of directChildren) {
                            if (child.is_verified === true) {
                              totalVerified++;
                            } else {
                              totalNotVerified++;
                            }
                          }
                          
                          return { verified: totalVerified, notVerified: totalNotVerified };
                        };

                        // Calcular stats agregados para cada líder no relatório
                        const statsPerLeader = new Map<string, { verified: number; notVerified: number }>();
                        leadersForReport.forEach((l: any) => {
                          const subtreeStats = calculateDirectChildrenStats(l.id);
                          statsPerLeader.set(l.id, subtreeStats);
                        });

                        // 4. Gerar Excel
                        const filterLabel = includeAllLevels ? "Todos os níveis" : "Apenas liderados diretos";
                        
                        // Criar dados para a planilha
                        const excelData: any[][] = [
                          [`RELATÓRIO DE ÁRVORE - ${leader.nome_completo}`],
                          [`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`],
                          [`Filtro: ${filterLabel}`],
                          [], // Linha vazia
                          ["N°", "Nome", "Telefone", "Árvore", "Verificados", "Não Verificados"] // Cabeçalho
                        ];
                        
                        // Adicionar dados dos líderes
                        leadersForReport.forEach((l: any, index: number) => {
                          const stats = statsPerLeader.get(l.id) || { verified: 0, notVerified: 0 };
                          const arvoreCount = stats.verified + stats.notVerified;
                          const phone = l.telefone ? formatPhone(l.telefone) : "";
                          
                          excelData.push([
                            index + 1,
                            l.nome_completo,
                            phone,
                            arvoreCount,
                            stats.verified,
                            stats.notVerified
                          ]);
                        });
                        
                        // Criar workbook e worksheet
                        const worksheet = XLSX.utils.aoa_to_sheet(excelData);
                        
                        // Configurar larguras das colunas
                        worksheet["!cols"] = [
                          { wch: 6 },  // N°
                          { wch: 40 }, // Nome
                          { wch: 18 }, // Telefone
                          { wch: 10 }, // Árvore
                          { wch: 12 }, // Verificados
                          { wch: 16 }  // Não Verificados
                        ];
                        
                        // Mesclar células do cabeçalho
                        worksheet["!merges"] = [
                          { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }, // Título
                          { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } }, // Data
                          { s: { r: 2, c: 0 }, e: { r: 2, c: 5 } }  // Filtro
                        ];
                        
                        const workbook = XLSX.utils.book_new();
                        XLSX.utils.book_append_sheet(workbook, worksheet, "Relatório");
                        
                        // Salvar arquivo
                        const fileName = `Relatorio_Arvore_${leader.nome_completo.replace(/\s+/g, "_")}.xlsx`;
                        XLSX.writeFile(workbook, fileName);

                        toast.success(`Relatório detalhado exportado com ${leadersForReport.length} líderes`);
                      } catch (error) {
                        console.error("Erro ao gerar relatório detalhado:", error);
                        toast.error("Erro ao gerar relatório detalhado.");
                      } finally {
                        setLoadingDetailedReport(false);
                      }
                    }}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    {loadingDetailedReport ? "Gerando Excel..." : "Relatório Detalhado"}
                  </Button>

                  {/* Botão de Relatório de Pendentes */}
                <Button
                  size="sm"
                  variant="outline"
                  disabled={loadingReport}
                  onClick={async () => {
                    setLoadingReport(true);
                    try {
                      // 1. Buscar toda a árvore de líderes subordinados COM PAGINAÇÃO
                      // O Supabase tem limite de 1000 registros por requisição RPC
                      const allTreeData: any[] = [];
                      const rpcPageSize = 1000;
                      let rpcPage = 0;
                      let hasMoreTreeData = true;

                      while (hasMoreTreeData) {
                        const from = rpcPage * rpcPageSize;
                        const to = from + rpcPageSize - 1;

                        const { data: pageData, error: pageError } = await supabase
                          .rpc("get_leader_tree", { _leader_id: leader.id })
                          .range(from, to);

                        if (pageError) throw pageError;

                        if (pageData && pageData.length > 0) {
                          allTreeData.push(...pageData);
                          hasMoreTreeData = pageData.length === rpcPageSize;
                          rpcPage++;
                        } else {
                          hasMoreTreeData = false;
                        }
                      }

                      console.log(`Total de líderes carregados da árvore: ${allTreeData.length}`);
                      
                      // Filtrar apenas líderes ativos (excluir desativados do relatório)
                      const leaders = allTreeData.filter((l: any) => l.is_active === true);
                      const leaderIds = leaders.map((l: any) => l.id);
                      
                      if (leaderIds.length === 0) {
                        toast.info("Nenhum líder encontrado na árvore.");
                        setLoadingReport(false);
                        return;
                      }

                      // 2. Dividir leaderIds em chunks para evitar Bad Request (URL muito longa)
                      const chunkSize = 200;
                      const leaderIdChunks: string[][] = [];
                      for (let i = 0; i < leaderIds.length; i += chunkSize) {
                        leaderIdChunks.push(leaderIds.slice(i, i + chunkSize));
                      }

                      // 3. Buscar contatos pendentes (não verificados) de todos os chunks
                      const allPendingContacts: any[] = [];
                      const pageSize = 1000;

                      for (const chunk of leaderIdChunks) {
                        let page = 0;
                        let hasMore = true;

                        while (hasMore) {
                          const from = page * pageSize;
                          const to = from + pageSize - 1;

                          const { data: contactsData, error: contactsError } = await supabase
                            .from("office_contacts")
                            .select(`
                              id, nome, telefone_norm, email, source_id, created_at,
                              cidade:office_cities(nome)
                            `)
                            .eq("source_type", "lider")
                            .in("source_id", chunk)
                            .eq("is_active", true)
                            .eq("is_verified", false)
                            .range(from, to);

                          if (contactsError) throw contactsError;

                          if (contactsData && contactsData.length > 0) {
                            allPendingContacts.push(...contactsData);
                            hasMore = contactsData.length === pageSize;
                            page++;
                          } else {
                            hasMore = false;
                          }
                        }
                      }

                      // 4. Criar mapa de líderes por ID para lookup
                      const leaderMap = new Map(leaders.map((l: any) => [l.id, l]));

                      // 5. Criar mapa de subordinados diretos por líder (para contagem de cadastros)
                      const subordinatesCount = new Map<string, number>();
                      leaders.forEach((l: any) => {
                        if (l.parent_leader_id) {
                          const count = subordinatesCount.get(l.parent_leader_id) || 0;
                          subordinatesCount.set(l.parent_leader_id, count + 1);
                        }
                      });

                      // 6. Gerar CSV
                      const headers = ['Tipo', 'Nome', 'Telefone', 'Email', 'Região', 'Nível', 'Líder Indicador', 'Data Cadastro', 'Cadastros', 'Status Verificação'];
                      
                      // Função recursiva para ordenar hierarquicamente
                      const sortLeadersHierarchically = (allLeaders: any[], parentId: string): any[] => {
                        const result: any[] = [];
                        const children = allLeaders.filter((l: any) => l.parent_leader_id === parentId && l.id !== parentId);
                        
                        for (const child of children) {
                          result.push(child);
                          // Recursivamente adiciona os subordinados diretos
                          result.push(...sortLeadersHierarchically(allLeaders, child.id));
                        }
                        
                        return result;
                      };

                      // Ordenar líderes hierarquicamente começando pelo líder selecionado
                      const sortedLeaders = sortLeadersHierarchically(leaders, leader.id);

                      // Calcular totais para o cabeçalho do relatório (sempre da árvore completa)
                      const totalLeadersInTree = sortedLeaders.length;
                      const totalContactsPending = allPendingContacts.length;
                      const leaderDirectSubordinates = subordinatesCount.get(leader.id) || 0;
                      const leaderTotalCadastros = (leader.cadastros || 0) + leaderDirectSubordinates;

                      // Calcular o nível base para filtrar liderados diretos (usar hierarchy_level real)
                      const baseLevel = leader.hierarchy_level || 1;
                      const directSubordinateLevel = baseLevel + 1;

                      // Filtrar líderes para o relatório baseado na opção selecionada
                      const leadersForReport = includeAllLevels 
                        ? sortedLeaders 
                        : sortedLeaders.filter((l: any) => {
                            // Incluir apenas liderados diretos (um nível abaixo)
                            return l.hierarchy_level === directSubordinateLevel;
                          });

                      // IDs dos líderes que vão no relatório
                      const leaderIdsForReport = leadersForReport.map((l: any) => l.id);

                      // Filtrar contatos pendentes apenas dos líderes filtrados
                      const contactsForReport = includeAllLevels 
                        ? allPendingContacts 
                        : allPendingContacts.filter((c: any) => leaderIdsForReport.includes(c.source_id));

                      // Linhas de líderes (filtradas) com cadastros = contatos + subordinados
                      const leaderRows = leadersForReport.map((l: any) => {
                        const parentLeader = l.parent_leader_id ? leaderMap.get(l.parent_leader_id) : null;
                        const directSubordinates = subordinatesCount.get(l.id) || 0;
                        const totalCadastros = (l.cadastros || 0) + directSubordinates;
                        return [
                          l.is_coordinator ? 'Coordenador' : 'Líder',
                          l.nome_completo,
                          l.telefone || '',
                          l.email || '',
                          l.cidade_nome || '',
                          l.is_coordinator ? 'Coordenador' : `Nível ${(l.hierarchy_level || 1) - 1}`,
                          parentLeader ? (parentLeader as any).nome_completo : '',
                          l.created_at ? formatDate(l.created_at) : '',
                          String(totalCadastros),
                          l.is_verified ? 'Verificado' : 'NÃO VERIFICADO'
                        ];
                      });

                      // Linhas de contatos pendentes (filtradas)
                      const contactRows = contactsForReport.map((c: any) => {
                        const indicatorLeader = leaderMap.get(c.source_id);
                        return [
                          'Contato Pendente',
                          c.nome,
                          c.telefone_norm || '',
                          c.email || '',
                          (c.cidade as any)?.nome || '',
                          '-',
                          indicatorLeader ? (indicatorLeader as any).nome_completo : '',
                          formatDate(c.created_at),
                          '0',
                          'NÃO VERIFICADO'
                        ];
                      });

                      const allRows = [...leaderRows, ...contactRows];

                      // Calcular líderes não verificados para o resumo
                      const totalLeadersNotVerified = sortedLeaders.filter((l: any) => !l.is_verified).length;

                      // Linha informativa se não houver dados na listagem
                      const dataRows = allRows.length > 0 
                        ? allRows 
                        : [['', 'Nenhum líder subordinado ou contato pendente encontrado', '', '', '', '', '', '', '', '']];

                      // 7. Criar cabeçalho do relatório com totais e filtro aplicado
                      const filterLabel = includeAllLevels ? 'Todos os níveis' : 'Apenas liderados diretos';
                      const listingLabel = includeAllLevels ? 'COMPLETA' : 'LIDERADOS DIRETOS';
                      const reportHeader = [
                        [`RELATÓRIO DE ÁRVORE - ${leader.nome_completo}`],
                        [`Gerado em: ${formatDateTime(new Date().toISOString())}`],
                        [`Filtro: ${filterLabel}`],
                        [''],
                        ['RESUMO (ÁRVORE COMPLETA):'],
                        [`Total de Líderes na Árvore: ${totalLeadersInTree}`],
                        [`Líderes NÃO Verificados: ${totalLeadersNotVerified}`],
                        [`Total de Contatos Pendentes: ${totalContactsPending}`],
                        [`Cadastros do ${leader.is_coordinator ? 'Coordenador' : 'Líder'}: ${leaderTotalCadastros}`],
                        [''],
                        [`LISTAGEM (${listingLabel}): ${leaderRows.length} líderes + ${contactRows.length} contatos pendentes`],
                        ['']
                      ];

                      // 8. Exportar CSV com cabeçalho
                      const csv = [...reportHeader.map(row => row.join(';')), headers.join(';'), ...dataRows.map(row => row.join(';'))].join('\n');
                      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = `${leader.nome_completo}_arvore_pendentes.csv`;
                      link.click();
                      URL.revokeObjectURL(url);
                      
                      toast.success(`Relatório exportado: ${leaderRows.length} líderes + ${contactRows.length} contatos pendentes`);
                    } catch (error) {
                      console.error('Erro ao gerar relatório:', error);
                      toast.error("Erro ao gerar relatório.");
                    } finally {
                      setLoadingReport(false);
                    }
                  }}
                  >
                    <FileText className="h-4 w-4 mr-1" />
                    {loadingReport ? "Gerando..." : "Relatório Pendentes"}
                  </Button>
                </div>
              </div>

              {loadingHierarchy ? (
                <p className="text-sm text-muted-foreground">Carregando hierarquia...</p>
              ) : leader.is_coordinator ? (
                <Card className="border-amber-200 bg-amber-50/50">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-amber-100 text-amber-600">
                        <Crown className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium">Este líder é um Coordenador</p>
                        <p className="text-sm text-muted-foreground">
                          Coordenadores são a raiz da árvore hierárquica
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : !hierarchyPath || hierarchyPath.length === 0 || !hierarchyPath[0]?.hierarchy_level ? (
                <Card className="border-muted">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-muted text-muted-foreground">
                        <AlertCircle className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium">Sem vínculo hierárquico</p>
                        <p className="text-sm text-muted-foreground">
                          Este líder não está vinculado a nenhuma árvore hierárquica
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {hierarchyPath.map((node, index) => {
                    const isCurrentLeader = node.id === leader.id;
                    const isCoordinator = node.is_coordinator;
                    
                    return (
                      <div key={node.id}>
                        {/* Conector */}
                        {index > 0 && (
                          <div className="flex justify-center py-1">
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        
                        {/* Card do nó */}
                        <Card className={`${isCurrentLeader ? 'border-primary ring-2 ring-primary/20' : ''} ${isCoordinator ? 'border-amber-300 bg-amber-50/30' : ''}`}>
                          <CardContent className="p-3">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-full ${
                                isCoordinator 
                                  ? 'bg-amber-100 text-amber-600' 
                                  : 'bg-blue-100 text-blue-600'
                              }`}>
                                {isCoordinator ? (
                                  <Crown className="h-4 w-4" />
                                ) : (
                                  <Star className="h-4 w-4" />
                                )}
                              </div>
                              
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-medium">{node.nome_completo}</p>
                                  {isCurrentLeader && (
                                    <Badge variant="outline" className="text-xs border-primary text-primary">
                                      Você está aqui
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                                  <Badge 
                                    variant="secondary" 
                                    className={`text-xs ${isCoordinator ? 'bg-amber-100 text-amber-700' : ''}`}
                                  >
                                    {isCoordinator ? 'Coordenador' : `Nível ${(node.hierarchy_level || 1) - 1}`}
                                  </Badge>
                                  {node.cidade_nome && (
                                    <span className="flex items-center gap-1">
                                      <MapPin className="h-3 w-3" />
                                      {node.cidade_nome}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* ABA HISTÓRICO */}
            <TabsContent value="historico" className="mt-0 space-y-4 pr-4">
              <div className="space-y-3">
                <Card>
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-green-100 text-green-600">
                        <User className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium">Líder cadastrado</p>
                        <p className="text-sm text-muted-foreground">{formatDateTime(leader.created_at)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {leader.last_activity && leader.last_activity !== leader.created_at && (
                  <Card>
                    <CardContent className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-blue-100 text-blue-600">
                          <History className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-medium">Última atividade</p>
                          <p className="text-sm text-muted-foreground">{formatDateTime(leader.last_activity)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {!leader.is_active && (
                  <Card>
                    <CardContent className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-red-100 text-red-600">
                          <AlertCircle className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-medium">Líder desativado</p>
                          <p className="text-sm text-muted-foreground">Status alterado para inativo</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Timeline de atividades recentes */}
                {indicatedContacts && indicatedContacts.slice(0, 5).map((contact) => (
                  <Card key={contact.id}>
                    <CardContent className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-primary/10 text-primary">
                          <Users className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-medium">Indicou {contact.nome}</p>
                          <p className="text-sm text-muted-foreground">{formatDateTime(contact.created_at)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Páginas Acessadas por Indicações */}
              {pageViews && pageViews.length > 0 && (
                <div className="mt-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium flex items-center gap-2">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      Páginas Acessadas (Indicações)
                    </h4>
                    <Badge variant="secondary">{pageViews.length} acessos</Badge>
                  </div>
                  
                  {loadingPageViews ? (
                    <p className="text-sm text-muted-foreground">Carregando...</p>
                  ) : (
                    <div className="space-y-2">
                      {pageViews.slice(0, 10).map((view) => (
                        <Card key={view.id}>
                          <CardContent className="p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <ExternalLink className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-xs text-muted-foreground">{view.contact_name}</span>
                                </div>
                                <p className="font-medium text-sm">{view.page_name || "Formulário"}</p>
                                <p className="text-xs text-muted-foreground truncate max-w-[350px]">
                                  {view.page_identifier}
                                </p>
                                {view.utm_source && (
                                  <div className="flex gap-1 mt-1">
                                    <Badge variant="outline" className="text-[10px] px-1 py-0">
                                      {view.utm_source}
                                    </Badge>
                                    {view.utm_campaign && (
                                      <Badge variant="outline" className="text-[10px] px-1 py-0">
                                        {view.utm_campaign}
                                      </Badge>
                                    )}
                                  </div>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground whitespace-nowrap">
                                {formatDateTime(view.created_at)}
                              </span>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Retentativas de SMS */}
              {(() => {
                const smsWithRetries = smsMessages.filter(sms => sms.retry_count && sms.retry_count > 0);
                if (smsWithRetries.length === 0) return null;
                
                return (
                  <div className="mt-6 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium flex items-center gap-2">
                        <RefreshCw className="h-4 w-4 text-muted-foreground" />
                        Retentativas de SMS
                      </h4>
                      <Badge variant="secondary">{smsWithRetries.length} SMS</Badge>
                    </div>
                    
                    <div className="space-y-2">
                      {smsWithRetries.map((sms) => {
                        const statusConfig = {
                          pending: { label: "Pendente", className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
                          sent: { label: "Enviado", className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
                          delivered: { label: "Entregue", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
                          failed: { label: "Falhou", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
                        };
                        const config = statusConfig[sms.status as keyof typeof statusConfig] || statusConfig.pending;
                        
                        // Calcular tempo até próxima tentativa
                        let nextRetryText = null;
                        if (sms.next_retry_at && sms.status === 'failed') {
                          const nextRetry = new Date(sms.next_retry_at);
                          const now = new Date();
                          const diffMs = nextRetry.getTime() - now.getTime();
                          if (diffMs > 0) {
                            const diffMin = Math.ceil(diffMs / 60000);
                            nextRetryText = `Próxima tentativa em ${diffMin} min`;
                          }
                        }
                        
                        return (
                          <Card key={sms.id}>
                            <CardContent className="p-3">
                              <Collapsible>
                                <div className="space-y-2">
                                  {/* Header com mensagem truncada */}
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium truncate">{sms.message.substring(0, 60)}...</p>
                                      <p className="text-xs text-muted-foreground">{formatDateTime(sms.created_at)}</p>
                                    </div>
                                  </div>
                                  
                                  {/* Status e badge de tentativas */}
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Badge className={config.className} variant="secondary">
                                      {sms.status === 'failed' ? <XCircle className="h-3 w-3 mr-1" /> : <CheckCircle className="h-3 w-3 mr-1" />}
                                      {config.label}
                                    </Badge>
                                    <Badge variant="outline" className="text-xs">
                                      <RefreshCw className="h-3 w-3 mr-1" />
                                      {sms.retry_count}/{sms.max_retries || 6} tentativas
                                    </Badge>
                                    {nextRetryText && (
                                      <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        {nextRetryText}
                                      </span>
                                    )}
                                  </div>
                                  
                                  {/* Erro atual */}
                                  {sms.error_message && (
                                    <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                                      <AlertCircle className="h-3 w-3" />
                                      {sms.error_message}
                                    </p>
                                  )}
                                  
                                  {/* Botão para expandir histórico */}
                                  {sms.retry_history && Array.isArray(sms.retry_history) && sms.retry_history.length > 0 && (
                                    <CollapsibleTrigger asChild>
                                      <Button variant="ghost" size="sm" className="w-full justify-start p-0 h-auto text-xs text-muted-foreground hover:text-foreground">
                                        <ChevronRight className="h-3 w-3 mr-1 transition-transform duration-200 group-data-[state=open]:rotate-90" />
                                        Ver histórico de tentativas ({(sms.retry_history as unknown[]).length})
                                      </Button>
                                    </CollapsibleTrigger>
                                  )}
                                </div>
                                
                                {/* Histórico expansível */}
                                <CollapsibleContent className="mt-2">
                                  <div className="border-l-2 border-muted pl-3 space-y-2">
                                    {(Array.isArray(sms.retry_history) ? sms.retry_history : []).map((entry: { attempt?: number; timestamp?: string; status?: string; error?: string }, idx: number) => (
                                      <div key={idx} className="text-xs">
                                        <div className="flex items-center gap-2">
                                          {entry.status === 'success' || entry.status === 'delivered' ? (
                                            <CheckCircle className="h-3 w-3 text-green-600" />
                                          ) : (
                                            <XCircle className="h-3 w-3 text-red-600" />
                                          )}
                                          <span className="font-medium">{entry.attempt}ª tentativa</span>
                                          <span className="text-muted-foreground">
                                            {format(new Date(entry.timestamp), "dd/MM 'às' HH:mm", { locale: ptBR })}
                                          </span>
                                        </div>
                                        {entry.error && (
                                          <p className="text-red-600 dark:text-red-400 ml-5 mt-0.5">{entry.error}</p>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </CollapsibleContent>
                              </Collapsible>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
