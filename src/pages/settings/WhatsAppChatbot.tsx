import { PageHeader } from "@/components/PageHeader";
import { WhatsAppInboxContent } from "@/pages/WhatsAppInbox";
import { Inbox } from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Bot,
  MessageSquare,
  Settings,
  Plus,
  Pencil,
  Trash2,
  History,
  Zap,
  Brain,
  FileText,
  ArrowLeft,
  BarChart2,
  Users,
  Clock,
  TrendingUp,
  RefreshCw,
  Activity,
  GitBranch,
  Workflow
} from "lucide-react";
import { Link } from "react-router-dom";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  useChatbotConfig,
  useUpdateChatbotConfig,
  useChatbotKeywords,
  useCreateChatbotKeyword,
  useUpdateChatbotKeyword,
  useDeleteChatbotKeyword,
  useChatbotLogs,
  useChatbotSessions,
  useChatbotStats,
  useDeleteChatbotSession,
  ChatbotKeyword,
  AVAILABLE_DYNAMIC_FUNCTIONS
} from "@/hooks/useWhatsAppChatbot";
import { useWhatsAppCommunities, useUpdateCommunity, useWhatsAppChatStates } from "@/hooks/useWhatsAppCommunities";
import { useChatbotFlows } from "@/hooks/useWhatsAppFlows";
import { useTutorial } from "@/hooks/useTutorial";
import { TutorialOverlay } from "@/components/TutorialOverlay";
import { TutorialButton } from "@/components/TutorialButton";
import type { Step } from "react-joyride";

const chatbotTutorialSteps: Step[] = [
  { target: '[data-tutorial="bot-header"]', title: 'Assistente Virtual', content: 'Configure o chatbot para atender líderes via WhatsApp.' },
  { target: '[data-tutorial="bot-toggle"]', title: 'Ativar/Desativar', content: 'Ligue ou desligue o assistente virtual.' },
  { target: '[data-tutorial="bot-config"]', title: 'Configurações', content: 'Defina comportamento, limite de mensagens e uso de IA.' },
  { target: '[data-tutorial="bot-messages"]', title: 'Mensagens Padrão', content: 'Configure boas-vindas e fallback.' },
  { target: '[data-tutorial="bot-keywords"]', title: 'Palavras-Chave', content: 'Crie comandos que o chatbot reconhece.' },
  { target: '[data-tutorial="bot-logs"]', title: 'Histórico', content: 'Veja as últimas conversas do chatbot.' },
  { target: '[data-tutorial="bot-prompt"]', title: 'Prompt IA', content: 'Instruções para a IA responder perguntas abertas.' },
];

const WhatsAppChatbot = () => {
  const [activeTab, setActiveTab] = useState("communities");
  const [keywordDialogOpen, setKeywordDialogOpen] = useState(false);
  const [editingKeyword, setEditingKeyword] = useState<ChatbotKeyword | null>(null);
  const { restartTutorial } = useTutorial("whatsapp-chatbot", chatbotTutorialSteps);

  // Form state for keyword
  const [keywordForm, setKeywordForm] = useState({
    keyword: "",
    aliases: "",
    description: "",
    response_type: "dynamic" as "static" | "dynamic" | "ai" | "flow",
    static_response: "",
    dynamic_function: "",
    flow_id: "",
    is_active: true,
    priority: 0
  });

  // Queries
  const { data: config, isLoading: loadingConfig } = useChatbotConfig();
  const { data: keywords, isLoading: loadingKeywords } = useChatbotKeywords();
  const { data: logs, isLoading: loadingLogs } = useChatbotLogs(100);
  const { data: communities, isLoading: loadingCommunities } = useWhatsAppCommunities();
  const { data: chatStates, isLoading: loadingChatStates } = useWhatsAppChatStates();
  const { data: sessions, isLoading: loadingSessions } = useChatbotSessions(50);
  const { data: stats, isLoading: loadingStats } = useChatbotStats();

  // Mutations
  const updateConfig = useUpdateChatbotConfig();
  const createKeyword = useCreateChatbotKeyword();
  const updateKeyword = useUpdateChatbotKeyword();
  const deleteKeyword = useDeleteChatbotKeyword();
  const updateCommunity = useUpdateCommunity();
  const deleteSession = useDeleteChatbotSession();

  const handleConfigChange = (field: string, value: any) => {
    updateConfig.mutate({ [field]: value });
  };

  const openNewKeywordDialog = () => {
    setEditingKeyword(null);
    setKeywordForm({
      keyword: "",
      aliases: "",
      description: "",
      response_type: "dynamic",
      static_response: "",
      dynamic_function: "",
      flow_id: "",
      is_active: true,
      priority: 0
    });
    setKeywordDialogOpen(true);
  };

  const openEditKeywordDialog = (kw: ChatbotKeyword) => {
    setEditingKeyword(kw);
    setKeywordForm({
      keyword: kw.keyword,
      aliases: (kw.aliases || []).join(", "),
      description: kw.description || "",
      response_type: kw.response_type,
      static_response: kw.static_response || "",
      dynamic_function: kw.dynamic_function || "",
      flow_id: kw.flow_id || "",
      is_active: kw.is_active,
      priority: kw.priority
    });
    setKeywordDialogOpen(true);
  };

  const handleSaveKeyword = () => {
    const aliases = keywordForm.aliases
      .split(",")
      .map(a => a.trim())
      .filter(a => a.length > 0);

    const data = {
      keyword: keywordForm.keyword.toUpperCase(),
      aliases,
      description: keywordForm.description || null,
      response_type: keywordForm.response_type,
      static_response: keywordForm.response_type === "static" ? keywordForm.static_response : null,
      dynamic_function: keywordForm.response_type === "dynamic" ? keywordForm.dynamic_function : null,
      flow_id: keywordForm.response_type === "flow" ? keywordForm.flow_id || null : null,
      is_active: keywordForm.is_active,
      priority: keywordForm.priority
    };

    if (editingKeyword) {
      updateKeyword.mutate({ id: editingKeyword.id, ...data });
    } else {
      createKeyword.mutate(data);
    }

    setKeywordDialogOpen(false);
  };

  const handleDeleteKeyword = (id: string) => {
    if (confirm("Tem certeza que deseja excluir esta palavra-chave?")) {
      deleteKeyword.mutate(id);
    }
  };

  const getResponseTypeBadge = (type: string) => {
    switch (type) {
      case "static":
        return <Badge variant="secondary"><FileText className="w-3 h-3 mr-1" /> Estática</Badge>;
      case "dynamic":
        return <Badge variant="default"><Zap className="w-3 h-3 mr-1" /> Dinâmica</Badge>;
      case "ai":
        return <Badge className="bg-purple-500"><Brain className="w-3 h-3 mr-1" /> IA</Badge>;
      case "flow":
        return <Badge className="bg-emerald-600 text-white"><Workflow className="w-3 h-3 mr-1" /> Fluxo</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <TutorialOverlay page="whatsapp-chatbot" />
      {/* Header */}
      <div className="flex items-center gap-4" data-tutorial="bot-header">
        <Link to="/settings">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <PageHeader icon={Bot} title="Assistente Virtual WhatsApp" subtitle="Configure o chatbot para atender automaticamente os líderes via WhatsApp" className="flex-1" />
        <Link to="/settings/whatsapp-flow-builder">
          <Button className="gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-sm">
            <GitBranch className="h-4 w-4" />
            Abrir Whiteboard de Fluxos
          </Button>
        </Link>
        <TutorialButton onClick={restartTutorial} />
      </div>

      {/* Main Toggle */}
      {loadingConfig ? (
        <Skeleton className="h-20 w-full" />
      ) : (
        <Card className={config?.is_enabled ? "border-green-500 bg-green-50/50" : ""} data-tutorial="bot-toggle">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg">Ativar Assistente Virtual</h3>
                <p className="text-muted-foreground text-sm">
                  Quando ativado, o chatbot responderá automaticamente às mensagens de líderes cadastrados
                </p>
              </div>
              <Switch
                checked={config?.is_enabled || false}
                onCheckedChange={(checked) => handleConfigChange("is_enabled", checked)}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="communities" className="gap-2">
            <MessageSquare className="h-4 w-4" /> Comunidades
          </TabsTrigger>
          <TabsTrigger value="config" className="gap-2" data-tutorial="bot-config">
            <Settings className="h-4 w-4" /> Configurações
          </TabsTrigger>
          <TabsTrigger value="keywords" className="gap-2" data-tutorial="bot-keywords">
            <MessageSquare className="h-4 w-4" /> Palavras-Chave
          </TabsTrigger>
          <TabsTrigger value="contacts" className="gap-2">
            <MessageSquare className="h-4 w-4" /> Contatos
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-2" data-tutorial="bot-logs">
            <History className="h-4 w-4" /> Histórico
          </TabsTrigger>
          <TabsTrigger value="sessions" className="gap-2">
            <Users className="h-4 w-4" /> Sessões
          </TabsTrigger>
          <TabsTrigger value="stats" className="gap-2">
            <BarChart2 className="h-4 w-4" /> Estatísticas
          </TabsTrigger>
          <TabsTrigger value="inbox" className="gap-2">
            <Inbox className="h-4 w-4" /> Inbox
          </TabsTrigger>
        </TabsList>
  const { data: availableFlows } = useChatbotFlows();

        {/* Config Tab */}
        <TabsContent value="config" className="space-y-4">
          {loadingConfig ? (
            <Skeleton className="h-96 w-full" />
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Comportamento</CardTitle>
                  <CardDescription>Configure como o chatbot responde às mensagens</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Usar IA para perguntas não reconhecidas</Label>
                      <p className="text-sm text-muted-foreground">
                        Quando a mensagem não corresponder a nenhuma palavra-chave, usar IA para responder
                      </p>
                    </div>
                    <Switch
                      checked={config?.use_ai_for_unknown || false}
                      onCheckedChange={(checked) => handleConfigChange("use_ai_for_unknown", checked)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Limite de mensagens por hora (por líder)</Label>
                    <Input
                      type="number"
                      value={config?.max_messages_per_hour || 20}
                      onChange={(e) => handleConfigChange("max_messages_per_hour", parseInt(e.target.value) || 20)}
                      min={1}
                      max={100}
                    />
                    <p className="text-sm text-muted-foreground">
                      Limita quantas mensagens cada líder pode enviar por hora para evitar spam
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card data-tutorial="bot-messages">
                <CardHeader>
                  <CardTitle>Mensagens Padrão</CardTitle>
                  <CardDescription>Mensagens automáticas do chatbot</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Mensagem de boas-vindas</Label>
                    <Textarea
                      value={config?.welcome_message || ""}
                      onChange={(e) => handleConfigChange("welcome_message", e.target.value)}
                      placeholder="Olá! Sou o assistente virtual..."
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Mensagem de fallback (quando não entender)</Label>
                    <Textarea
                      value={config?.fallback_message || ""}
                      onChange={(e) => handleConfigChange("fallback_message", e.target.value)}
                      placeholder="Não entendi sua mensagem. Digite AJUDA..."
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card data-tutorial="bot-prompt">
                <CardHeader>
                  <CardTitle>Prompt do Sistema de IA</CardTitle>
                  <CardDescription>Instruções para a IA quando responder perguntas abertas</CardDescription>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={config?.ai_system_prompt || ""}
                    onChange={(e) => handleConfigChange("ai_system_prompt", e.target.value)}
                    placeholder="Você é um assistente virtual amigável..."
                    rows={5}
                  />
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Keywords Tab */}
        <TabsContent value="keywords" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Palavras-Chave</CardTitle>
                <CardDescription>Configure comandos e respostas automáticas</CardDescription>
              </div>
              <Button onClick={openNewKeywordDialog}>
                <Plus className="h-4 w-4 mr-2" /> Nova Palavra-Chave
              </Button>
            </CardHeader>
            <CardContent>
              {loadingKeywords ? (
                <Skeleton className="h-64 w-full" />
              ) : keywords && keywords.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Palavra-Chave</TableHead>
                      <TableHead>Aliases</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {keywords.map((kw) => (
                      <TableRow key={kw.id}>
                        <TableCell className="font-mono font-semibold">{kw.keyword}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {(kw.aliases || []).join(", ") || "-"}
                        </TableCell>
                        <TableCell>{getResponseTypeBadge(kw.response_type)}</TableCell>
                        <TableCell>
                          <Switch
                            checked={kw.is_active}
                            onCheckedChange={(checked) =>
                              updateKeyword.mutate({ id: kw.id, is_active: checked })
                            }
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditKeywordDialog(kw)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteKeyword(kw.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma palavra-chave configurada
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Conversas</CardTitle>
              <CardDescription>Últimas interações do chatbot com líderes</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingLogs ? (
                <Skeleton className="h-64 w-full" />
              ) : logs && logs.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Líder</TableHead>
                      <TableHead>Mensagem Recebida</TableHead>
                      <TableHead>Comando</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Tempo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-sm">
                          {format(new Date(log.created_at), "dd/MM HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          {log.leader?.nome_completo || log.phone}
                        </TableCell>
                        <TableCell className="max-w-xs truncate" title={log.message_in}>
                          {log.message_in}
                        </TableCell>
                        <TableCell>
                          {log.keyword_matched ? (
                            <Badge variant="outline">{log.keyword_matched}</Badge>
                          ) : "-"}
                        </TableCell>
                        <TableCell>
                          {log.response_type ? getResponseTypeBadge(log.response_type) : "-"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {log.processing_time_ms ? `${log.processing_time_ms}ms` : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma conversa registrada ainda
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Communities Tab */}
        <TabsContent value="communities" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Comunidades WhatsApp por Município</CardTitle>
              <CardDescription>
                Configure os links das comunidades WhatsApp para cada município. Quando uma pessoa entrar em contato, será direcionada para a comunidade do seu município.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingCommunities ? (
                <Skeleton className="h-64 w-full" />
              ) : communities && communities.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Município</TableHead>
                      <TableHead>Link da Comunidade</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {communities.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-mono font-bold">{c.numero_lista}</TableCell>
                        <TableCell className="font-semibold">{c.municipio}</TableCell>
                        <TableCell>
                          <Input
                            placeholder="https://chat.whatsapp.com/..."
                            value={c.community_link || ""}
                            onChange={(e) =>
                              updateCommunity.mutate({ id: c.id, community_link: e.target.value || null })
                            }
                            className="max-w-md"
                          />
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={c.is_active}
                            onCheckedChange={(checked) =>
                              updateCommunity.mutate({ id: c.id, is_active: checked })
                            }
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma comunidade configurada
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contacts Tab - Chat States */}
        <TabsContent value="contacts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Contatos no Fluxo</CardTitle>
              <CardDescription>Pessoas que interagiram com o WhatsApp oficial e em qual etapa estão</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingChatStates ? (
                <Skeleton className="h-64 w-full" />
              ) : chatStates && chatStates.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Município</TableHead>
                      <TableHead>Última Atividade</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {chatStates.map((cs) => (
                      <TableRow key={cs.id}>
                        <TableCell className="font-mono">{cs.phone}</TableCell>
                        <TableCell>
                          <Badge variant={
                            cs.state === 'registered' ? 'default' :
                            cs.state === 'awaiting_municipality' ? 'secondary' : 'outline'
                          }>
                            {cs.state === 'new' ? 'Novo' :
                             cs.state === 'awaiting_municipality' ? 'Aguardando município' :
                             cs.state === 'registered' ? 'Registrado' : cs.state}
                          </Badge>
                        </TableCell>
                        <TableCell>{cs.municipio || '-'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(cs.updated_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum contato interagiu com o fluxo ainda
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sessions Tab */}
        <TabsContent value="sessions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Sessões Ativas
              </CardTitle>
              <CardDescription>
                Usuários que interagiram com o chatbot recentemente (últimas 50 sessões)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingSessions ? (
                <Skeleton className="h-64 w-full" />
              ) : !sessions || sessions.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Nenhuma sessão registrada ainda.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Nome Coletado</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Fluxo Evento</TableHead>
                      <TableHead>Primeira Mensagem</TableHead>
                      <TableHead>Atualizado</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessions.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-mono text-sm">
                          {s.phone ? `***${s.phone.slice(-4)}` : '-'}
                        </TableCell>
                        <TableCell>{s.collected_name || <span className="text-muted-foreground">-</span>}</TableCell>
                        <TableCell>
                          {s.registration_completed_at ? (
                            <Badge className="bg-green-500">Cadastrado</Badge>
                          ) : s.registration_state === 'awaiting_confirmation' ? (
                            <Badge variant="secondary">Aguardando confirmação</Badge>
                          ) : s.registration_state ? (
                            <Badge variant="outline">{s.registration_state}</Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">Sem fluxo</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {s.event_reg_state ? (
                            <Badge variant="outline" className="text-blue-600">{s.event_reg_state}</Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {s.first_message_at
                            ? formatDistanceToNow(new Date(s.first_message_at), { addSuffix: true, locale: ptBR })
                            : '-'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {s.updated_at
                            ? formatDistanceToNow(new Date(s.updated_at), { addSuffix: true, locale: ptBR })
                            : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                disabled={deleteSession.isPending}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Encerrar sessão?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Deseja encerrar a sessão de {s.phone ? `***${s.phone.slice(-4)}` : 'usuário'}? O usuário poderá reiniciar a conversa do zero.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteSession.mutate(s.id!)}>
                                  Encerrar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Stats Tab */}
        <TabsContent value="stats" className="space-y-4">
          {loadingStats ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
            </div>
          ) : !stats ? (
            <p className="text-muted-foreground text-center py-8">Sem dados de estatísticas ainda.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                      <Activity className="h-4 w-4" /> Total de Interações
                    </div>
                    <p className="text-2xl font-bold">{(stats.total_interactions || 0).toLocaleString('pt-BR')}</p>
                    <p className="text-xs text-muted-foreground mt-1">Últimas 24h: {stats.interactions_24h || 0}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                      <Users className="h-4 w-4" /> Usuários Únicos
                    </div>
                    <p className="text-2xl font-bold">{(stats.unique_users || 0).toLocaleString('pt-BR')}</p>
                    <p className="text-xs text-muted-foreground mt-1">Hoje: {stats.unique_users_24h || 0}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                      <TrendingUp className="h-4 w-4" /> Interações (7 dias)
                    </div>
                    <p className="text-2xl font-bold">{(stats.interactions_7d || 0).toLocaleString('pt-BR')}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                      <Clock className="h-4 w-4" /> Tempo Médio de Resposta
                    </div>
                    <p className="text-2xl font-bold">
                      {stats.avg_processing_ms != null ? `${stats.avg_processing_ms}ms` : '-'}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Distribuição de Tipos de Resposta</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-purple-600">{stats.ai_responses || 0}</p>
                      <p className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                        <Brain className="h-3 w-3" /> IA
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-blue-600">{stats.dynamic_responses || 0}</p>
                      <p className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                        <Zap className="h-3 w-3" /> Dinâmica
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-600">{stats.static_responses || 0}</p>
                      <p className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                        <FileText className="h-3 w-3" /> Estática
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-gray-500">{stats.fallback_responses || 0}</p>
                      <p className="text-sm text-muted-foreground">Fallback</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {stats.last_interaction_at && (
                <p className="text-xs text-muted-foreground text-right flex items-center justify-end gap-1">
                  <RefreshCw className="h-3 w-3" />
                  Última interação: {formatDistanceToNow(new Date(stats.last_interaction_at), { addSuffix: true, locale: ptBR })}
                  {' · '}Atualiza automaticamente a cada minuto
                </p>
              )}
            </>
          )}
        </TabsContent>

        {/* Inbox Tab */}
        <TabsContent value="inbox">
          <WhatsAppInboxContent />
        </TabsContent>
      </Tabs>

      {/* Keyword Dialog */}
      <Dialog open={keywordDialogOpen} onOpenChange={setKeywordDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingKeyword ? "Editar Palavra-Chave" : "Nova Palavra-Chave"}
            </DialogTitle>
            <DialogDescription>
              Configure um comando que o chatbot reconhecerá
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Palavra-Chave Principal *</Label>
              <Input
                value={keywordForm.keyword}
                onChange={(e) => setKeywordForm({ ...keywordForm, keyword: e.target.value.toUpperCase() })}
                placeholder="Ex: ARVORE"
              />
            </div>

            <div className="space-y-2">
              <Label>Aliases (sinônimos, separados por vírgula)</Label>
              <Input
                value={keywordForm.aliases}
                onChange={(e) => setKeywordForm({ ...keywordForm, aliases: e.target.value })}
                placeholder="Ex: rede, equipe, time"
              />
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input
                value={keywordForm.description}
                onChange={(e) => setKeywordForm({ ...keywordForm, description: e.target.value })}
                placeholder="O que este comando faz?"
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo de Resposta *</Label>
              <Select
                value={keywordForm.response_type}
                onValueChange={(value: "static" | "dynamic" | "ai") =>
                  setKeywordForm({ ...keywordForm, response_type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dynamic">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4" /> Dinâmica (função do sistema)
                    </div>
                  </SelectItem>
                  <SelectItem value="static">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" /> Estática (texto fixo)
                    </div>
                  </SelectItem>
                  <SelectItem value="ai">
                    <div className="flex items-center gap-2">
                      <Brain className="h-4 w-4" /> IA (resposta inteligente)
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {keywordForm.response_type === "static" && (
              <div className="space-y-2">
                <Label>Resposta Estática *</Label>
                <Textarea
                  value={keywordForm.static_response}
                  onChange={(e) => setKeywordForm({ ...keywordForm, static_response: e.target.value })}
                  placeholder="Texto que será enviado. Use {{nome}} para o nome do líder."
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  Variáveis: {"{{nome}}"}, {"{{nome_completo}}"}, {"{{pontos}}"}, {"{{cadastros}}"}
                </p>
              </div>
            )}

            {keywordForm.response_type === "dynamic" && (
              <div className="space-y-2">
                <Label>Função Dinâmica *</Label>
                <Select
                  value={keywordForm.dynamic_function}
                  onValueChange={(value) => setKeywordForm({ ...keywordForm, dynamic_function: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma função" />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_DYNAMIC_FUNCTIONS.map((fn) => (
                      <SelectItem key={fn.value} value={fn.value}>
                        <div>
                          <div className="font-medium">{fn.label}</div>
                          <div className="text-xs text-muted-foreground">{fn.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex items-center gap-4">
              <div className="flex-1 space-y-2">
                <Label>Prioridade</Label>
                <Input
                  type="number"
                  value={keywordForm.priority}
                  onChange={(e) => setKeywordForm({ ...keywordForm, priority: parseInt(e.target.value) || 0 })}
                  min={0}
                  max={100}
                />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch
                  checked={keywordForm.is_active}
                  onCheckedChange={(checked) => setKeywordForm({ ...keywordForm, is_active: checked })}
                />
                <Label>Ativo</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setKeywordDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSaveKeyword}
              disabled={!keywordForm.keyword ||
                (keywordForm.response_type === "static" && !keywordForm.static_response) ||
                (keywordForm.response_type === "dynamic" && !keywordForm.dynamic_function)
              }
            >
              {editingKeyword ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WhatsAppChatbot;
