import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Loader2, MessageSquare, Mail, Link2, Eye, EyeOff, CheckCircle2, XCircle, Copy, Check, Smartphone, ChevronDown, Shield, Target, ClipboardList, CalendarCheck, Users, UserPlus, FileText, Ban, MessageCircle, Radio, Wallet, ArrowLeft, QrCode, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useIntegrationsSettings, useUpdateIntegrationsSettings, useTestZapiConnection, useTestSmsdevConnection, useTestSmsdevWebhook, useTestSmsbaratoConnection, useTestDisparoproConnection } from "@/hooks/useIntegrationsSettings";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

import { toast } from "sonner";
import { useTutorial } from "@/hooks/useTutorial";
import { TutorialOverlay } from "@/components/TutorialOverlay";
import { TutorialButton } from "@/components/TutorialButton";
import { ZapiQRCodeDialog } from "@/components/settings/ZapiQRCodeDialog";
import { useZapiConnectionStatus } from "@/hooks/useZapiConnectionStatus";
import { ZapiConnectionIndicator } from "@/components/settings/ZapiConnectionIndicator";
import { VerificationSettingsCard } from "@/components/settings/VerificationSettingsCard";
import { QuietHoursCard } from "@/components/settings/QuietHoursCard";
import { MetaCloudConfigCard } from "@/components/settings/MetaCloudConfigCard";

import type { Step } from "react-joyride";

const integrationsTutorialSteps: Step[] = [
  { target: '[data-tutorial="int-header"]', title: 'Integrações', content: 'Conecte serviços externos para ampliar as funcionalidades.' },
  { target: '[data-tutorial="int-zapi"]', title: 'Z-API WhatsApp', content: 'Configure o envio automático de mensagens via WhatsApp.' },
  { target: '[data-tutorial="int-resend"]', title: 'Email Remetente', content: 'Configure o email e nome do remetente para envios.' },
  { target: '[data-tutorial="int-smsdev"]', title: 'SMSDEV', content: 'Configure o envio de SMS.' },
  { target: '[data-tutorial="int-passkit"]', title: 'PassKit', content: 'Configure cartões de liderança para Apple/Google Wallet.' },
  { target: '[data-tutorial="int-greatpages"]', title: 'GreatPages Webhook', content: 'Receba leads automaticamente das landing pages.' },
  { target: '[data-tutorial="int-auto-messages"]', title: 'Mensagens Automáticas', content: 'Configure quais mensagens são enviadas automaticamente.' },
  { target: '[data-tutorial="int-save"]', title: 'Salvar e Testar', content: 'Salve as configurações e teste as conexões.' },
];

const WEBHOOK_URL = "https://eydqducvsddckhyatcux.supabase.co/functions/v1/greatpages-webhook";
const SMSDEV_WEBHOOK_URL = "https://eydqducvsddckhyatcux.supabase.co/functions/v1/smsdev-webhook";

const GreatPagesWebhookCard = () => {
  const [copied, setCopied] = useState(false);

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(WEBHOOK_URL);
      setCopied(true);
      toast.success("URL copiada!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Erro ao copiar URL");
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <Link2 className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <CardTitle className="text-lg">GreatPages - Captura de Leads</CardTitle>
              <CardDescription>
                Receba leads automaticamente das suas landing pages GreatPages
              </CardDescription>
            </div>
          </div>
          <Badge variant="default" className="bg-green-500 hover:bg-green-600">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Ativo
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>URL do Webhook</Label>
          <div className="flex gap-2">
            <Input 
              value={WEBHOOK_URL} 
              readOnly 
              className="font-mono text-xs sm:text-sm bg-muted"
            />
            <Button 
              variant="outline" 
              size="icon"
              onClick={handleCopyUrl}
              className="shrink-0"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        <div className="bg-muted/50 rounded-lg p-4 space-y-3">
          <h4 className="font-medium text-sm">Como configurar na GreatPages:</h4>
          <ol className="list-decimal list-inside space-y-1.5 text-sm text-muted-foreground">
            <li>Acesse sua página no GreatPages</li>
            <li>Vá em <strong className="text-foreground">Configurações → Integrações → Webhook</strong></li>
            <li>Cole a URL acima no campo de webhook</li>
            <li>Selecione método <strong className="text-foreground">POST</strong></li>
            <li>Salve as configurações</li>
          </ol>
        </div>

        <div className="space-y-2">
          <Label className="text-sm">Campos aceitos</Label>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="font-mono text-xs">nome / name</Badge>
            <Badge variant="secondary" className="font-mono text-xs">email</Badge>
            <Badge variant="secondary" className="font-mono text-xs">telefone / phone / whatsapp</Badge>
            <Badge variant="secondary" className="font-mono text-xs">cidade / city</Badge>
            <Badge variant="secondary" className="font-mono text-xs">utm_source</Badge>
            <Badge variant="secondary" className="font-mono text-xs">utm_medium</Badge>
            <Badge variant="secondary" className="font-mono text-xs">utm_campaign</Badge>
          </div>
        </div>

        <div className="text-sm text-muted-foreground bg-muted/30 rounded-lg p-3 border border-border/50">
          <p>
            <strong className="text-foreground">Comportamento:</strong> O webhook verifica automaticamente se o lead já é uma liderança cadastrada. 
            Se for, atualiza apenas dados faltantes. Se não for, cria um novo contato com origem "Webhook" 
            e dispara mensagens de boas-vindas automaticamente.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

interface AutoMessageToggleProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}

const AutoMessageToggle = ({ icon, label, description, checked, onCheckedChange, disabled }: AutoMessageToggleProps) => (
  <div className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center">
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
    <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
  </div>
);

const Integrations = () => {
  const navigate = useNavigate();
  const { restartTutorial } = useTutorial("integrations", integrationsTutorialSteps);
  const { data: settings, isLoading } = useIntegrationsSettings();
  const updateSettings = useUpdateIntegrationsSettings();
  const testZapiConnection = useTestZapiConnection();
  
  const testSmsdevConnection = useTestSmsdevConnection();
  const testSmsbaratoConnection = useTestSmsbaratoConnection();
  const testDisparoproConnection = useTestDisparoproConnection();
  const testSmsdevWebhook = useTestSmsdevWebhook();

  // Z-API state
  const [zapiInstanceId, setZapiInstanceId] = useState("");
  const [zapiToken, setZapiToken] = useState("");
  const [zapiClientToken, setZapiClientToken] = useState("");
  const [zapiEnabled, setZapiEnabled] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [showClientToken, setShowClientToken] = useState(false);
  const [autoMessagesOpen, setAutoMessagesOpen] = useState(false);
  const [qrCodeDialogOpen, setQrCodeDialogOpen] = useState(false);

  // Auto message toggles
  const [waAutoVerificacao, setWaAutoVerificacao] = useState(true);
  const [waAutoCaptacao, setWaAutoCaptacao] = useState(true);
  const [waAutoPesquisa, setWaAutoPesquisa] = useState(true);
  const [waAutoEvento, setWaAutoEvento] = useState(true);
  const [waAutoLideranca, setWaAutoLideranca] = useState(true);
  const [waAutoMembro, setWaAutoMembro] = useState(true);
  const [waAutoVisita, setWaAutoVisita] = useState(true);
  const [waAutoOptout, setWaAutoOptout] = useState(true);
  const [waAutoSmsFallback, setWaAutoSmsFallback] = useState(false);

  // Resend state (apenas remetente - API Key e habilitação são configurados pelo super admin)
  const [resendFromEmail, setResendFromEmail] = useState("");
  const [resendFromName, setResendFromName] = useState("");

  // SMSDEV state
  const [smsdevApiKey, setSmsdevApiKey] = useState("");
  const [smsdevEnabled, setSmsdevEnabled] = useState(false);
  const [showSmsdevKey, setShowSmsdevKey] = useState(false);
  const [webhookCopied, setWebhookCopied] = useState(false);

  // SMSBarato state
  const [smsbaratoApiKey, setSmsbaratoApiKey] = useState("");
  const [smsbaratoEnabled, setSmsbaratoEnabled] = useState(false);
  const [showSmsbaratoKey, setShowSmsbaratoKey] = useState(false);

  // Disparopro state
  const [disparoproToken, setDisparoproToken] = useState("");
  const [disparoproEnabled, setDisparoproEnabled] = useState(false);
  const [showDisparoproToken, setShowDisparoproToken] = useState(false);

  const [smsActiveProvider, setSmsActiveProvider] = useState<'smsdev' | 'smsbarato' | 'disparopro'>('smsdev');

  // PassKit state
  const [passkitApiToken, setPasskitApiToken] = useState("");
  const [passkitApiBaseUrl, setPasskitApiBaseUrl] = useState("https://api.pub1.passkit.io");
  const [passkitProgramId, setPasskitProgramId] = useState("");
  const [passkitTierId, setPasskitTierId] = useState("");
  const [passkitEnabled, setPasskitEnabled] = useState(false);
  const [showPasskitToken, setShowPasskitToken] = useState(false);

  const handleCopyWebhookUrl = async () => {
    try {
      await navigator.clipboard.writeText(SMSDEV_WEBHOOK_URL);
      setWebhookCopied(true);
      toast.success("URL do webhook copiada!");
      setTimeout(() => setWebhookCopied(false), 2000);
    } catch {
      toast.error("Erro ao copiar URL");
    }
  };

  const handleTestWebhook = () => {
    testSmsdevWebhook.mutate();
  };

  useEffect(() => {
    if (settings) {
      setZapiInstanceId(settings.zapi_instance_id || "");
      setZapiToken(settings.zapi_token || "");
      setZapiClientToken(settings.zapi_client_token || "");
      setZapiEnabled(settings.zapi_enabled || false);
      setResendFromEmail(settings.resend_from_email || "");
      setResendFromName(settings.resend_from_name || "");
      setSmsdevApiKey(settings.smsdev_api_key || "");
      setSmsdevEnabled(settings.smsdev_enabled || false);
      // SMSBarato
      setSmsbaratoApiKey(settings.smsbarato_api_key || "");
      setSmsbaratoEnabled(settings.smsbarato_enabled || false);
      // Disparopro
      setDisparoproToken(settings.disparopro_token || "");
      setDisparoproEnabled(settings.disparopro_enabled || false);
      setSmsActiveProvider((settings.sms_active_provider as 'smsdev' | 'smsbarato' | 'disparopro') || 'smsdev');
      // PassKit
      setPasskitApiToken(settings.passkit_api_token || "");
      setPasskitApiBaseUrl(settings.passkit_api_base_url || "https://api.pub1.passkit.io");
      setPasskitProgramId(settings.passkit_program_id || "");
      setPasskitTierId(settings.passkit_tier_id || "");
      setPasskitEnabled(settings.passkit_enabled || false);
      // Auto message toggles
      setWaAutoVerificacao(settings.wa_auto_verificacao_enabled ?? true);
      setWaAutoCaptacao(settings.wa_auto_captacao_enabled ?? true);
      setWaAutoPesquisa(settings.wa_auto_pesquisa_enabled ?? true);
      setWaAutoEvento(settings.wa_auto_evento_enabled ?? true);
      setWaAutoLideranca(settings.wa_auto_lideranca_enabled ?? true);
      setWaAutoMembro(settings.wa_auto_membro_enabled ?? true);
      setWaAutoVisita(settings.wa_auto_visita_enabled ?? true);
      setWaAutoOptout(settings.wa_auto_optout_enabled ?? true);
      setWaAutoSmsFallback(settings.wa_auto_sms_fallback_enabled ?? false);
    }
  }, [settings]);

  const handleSaveZapi = () => {
    updateSettings.mutate({
      zapi_instance_id: zapiInstanceId || null,
      zapi_token: zapiToken || null,
      zapi_client_token: zapiClientToken || null,
      zapi_enabled: zapiEnabled,
      wa_auto_verificacao_enabled: waAutoVerificacao,
      wa_auto_captacao_enabled: waAutoCaptacao,
      wa_auto_pesquisa_enabled: waAutoPesquisa,
      wa_auto_evento_enabled: waAutoEvento,
      wa_auto_lideranca_enabled: waAutoLideranca,
      wa_auto_membro_enabled: waAutoMembro,
      wa_auto_visita_enabled: waAutoVisita,
      wa_auto_optout_enabled: waAutoOptout,
      wa_auto_sms_fallback_enabled: waAutoSmsFallback,
    });
  };


  const handleSaveSmsdev = () => {
    updateSettings.mutate({
      smsdev_api_key: smsdevApiKey || null,
      smsdev_enabled: smsdevEnabled,
      sms_active_provider: smsActiveProvider,
    });
  };

  const handleSaveSmsbarato = () => {
    updateSettings.mutate({
      smsbarato_api_key: smsbaratoApiKey || null,
      smsbarato_enabled: smsbaratoEnabled,
      sms_active_provider: smsActiveProvider,
    });
  };

  const handleSaveDisparopro = () => {
    updateSettings.mutate({
      disparopro_token: disparoproToken || null,
      disparopro_enabled: disparoproEnabled,
      sms_active_provider: smsActiveProvider,
    });
  };

  const handleSaveActiveProvider = (provider: 'smsdev' | 'smsbarato' | 'disparopro') => {
    setSmsActiveProvider(provider);
    updateSettings.mutate({
      sms_active_provider: provider,
    } as any);
  };

  const handleSavePasskit = () => {
    updateSettings.mutate({
      passkit_api_token: passkitApiToken || null,
      passkit_api_base_url: passkitApiBaseUrl || "https://api.pub1.passkit.io",
      passkit_program_id: passkitProgramId || null,
      passkit_tier_id: passkitTierId || null,
      passkit_enabled: passkitEnabled,
    });
  };

  const handleTestZapi = () => {
    if (!zapiInstanceId || !zapiToken) return;
    testZapiConnection.mutate({
      instanceId: zapiInstanceId,
      token: zapiToken,
      clientToken: zapiClientToken || undefined,
    });
  };


  const handleTestSmsdev = () => {
    if (!smsdevApiKey) return;
    testSmsdevConnection.mutate(smsdevApiKey);
  };

  const handleTestSmsbarato = () => {
    if (!smsbaratoApiKey) return;
    testSmsbaratoConnection.mutate(smsbaratoApiKey);
  };

  const handleTestDisparopro = () => {
    if (!disparoproToken) return;
    testDisparoproConnection.mutate(disparoproToken);
  };

  const isZapiConfigured = zapiInstanceId && zapiToken;
  
  const isSmsdevConfigured = !!smsdevApiKey;
  const isSmsbaratoConfigured = !!smsbaratoApiKey;
  const isDisparoproConfigured = !!disparoproToken;
  const isPasskitConfigured = !!passkitApiToken && !!passkitProgramId && !!passkitTierId;

  // Z-API connection status check
  const { data: zapiStatus, isLoading: isCheckingZapi, refetch: refetchZapiStatus } = 
    useZapiConnectionStatus(
      settings?.zapi_instance_id || zapiInstanceId,
      settings?.zapi_token || zapiToken,
      settings?.zapi_client_token || zapiClientToken,
      !!isZapiConfigured && zapiEnabled
    );

  const enabledAutoMessagesCount = [
    waAutoVerificacao, waAutoCaptacao, waAutoPesquisa, waAutoEvento,
    waAutoLideranca, waAutoMembro, waAutoVisita, waAutoOptout, waAutoSmsFallback
  ].filter(Boolean).length;

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <TutorialOverlay page="integrations" />
      <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-4" data-tutorial="int-header">
          <Button variant="ghost" size="icon" onClick={() => navigate("/settings")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Integrações</h1>
            <p className="text-muted-foreground">
              Conecte serviços externos para ampliar as funcionalidades do sistema
            </p>
          </div>
          <TutorialButton onClick={restartTutorial} />
        </div>

        {/* Z-API WhatsApp */}
        <Card data-tutorial="int-zapi">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                  <MessageSquare className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">Z-API WhatsApp</CardTitle>
                  <CardDescription>
                    Envie mensagens automáticas via WhatsApp
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {isZapiConfigured ? (
                  zapiEnabled ? (
                    <Badge variant="default" className="bg-green-500 hover:bg-green-600">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Ativo
                    </Badge>
                  ) : (
                    <Badge variant="secondary">
                      Configurado
                    </Badge>
                  )
                ) : (
                  <Badge variant="outline" className="text-muted-foreground">
                    <XCircle className="h-3 w-3 mr-1" />
                    Não configurado
                  </Badge>
                )}
                <Switch
                  checked={zapiEnabled}
                  onCheckedChange={setZapiEnabled}
                  disabled={!isZapiConfigured}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="zapi-instance">Instance ID</Label>
                <Input
                  id="zapi-instance"
                  placeholder="Ex: 3C9ABCDEF123456789"
                  value={zapiInstanceId}
                  onChange={(e) => setZapiInstanceId(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Encontre o Instance ID no painel do Z-API
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="zapi-token">Token</Label>
                <div className="relative">
                  <Input
                    id="zapi-token"
                    type={showToken ? "text" : "password"}
                    placeholder="Token de autenticação da instância"
                    value={zapiToken}
                    onChange={(e) => setZapiToken(e.target.value)}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowToken(!showToken)}
                  >
                    {showToken ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="zapi-client-token">Client Token (opcional)</Label>
                <div className="relative">
                  <Input
                    id="zapi-client-token"
                    type={showClientToken ? "text" : "password"}
                    placeholder="Token de segurança da conta"
                    value={zapiClientToken}
                    onChange={(e) => setZapiClientToken(e.target.value)}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowClientToken(!showClientToken)}
                  >
                    {showClientToken ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Recomendado para maior segurança
                </p>
              </div>
            </div>

            {/* Auto Messages Section */}
            <Collapsible open={autoMessagesOpen} onOpenChange={setAutoMessagesOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" className="w-full justify-between mt-4">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    <span>Mensagens Automáticas</span>
                    <Badge variant="secondary" className="ml-2">
                      {enabledAutoMessagesCount}/9 ativas
                    </Badge>
                  </div>
                  <ChevronDown className={`h-4 w-4 transition-transform ${autoMessagesOpen ? "rotate-180" : ""}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-4">
                <div className="bg-muted/30 rounded-lg p-4 border border-border/50">
                  <p className="text-sm text-muted-foreground mb-4">
                    Controle quais categorias de mensagens automáticas serão enviadas pelo WhatsApp.
                  </p>
                  <div className="space-y-1">
                    <AutoMessageToggle
                      icon={<Shield className="h-4 w-4 text-blue-600" />}
                      label="Verificação de Contatos"
                      description="Código de verificação e confirmação de cadastro"
                      checked={waAutoVerificacao}
                      onCheckedChange={setWaAutoVerificacao}
                      disabled={!zapiEnabled}
                    />
                    <AutoMessageToggle
                      icon={<Target className="h-4 w-4 text-green-600" />}
                      label="Captação de Leads"
                      description="Boas-vindas para leads de landing pages"
                      checked={waAutoCaptacao}
                      onCheckedChange={setWaAutoCaptacao}
                      disabled={!zapiEnabled}
                    />
                    <AutoMessageToggle
                      icon={<ClipboardList className="h-4 w-4 text-purple-600" />}
                      label="Pesquisas"
                      description="Agradecimento após responder pesquisa"
                      checked={waAutoPesquisa}
                      onCheckedChange={setWaAutoPesquisa}
                      disabled={!zapiEnabled}
                    />
                    <AutoMessageToggle
                      icon={<CalendarCheck className="h-4 w-4 text-orange-600" />}
                      label="Eventos"
                      description="Confirmação de inscrição em eventos"
                      checked={waAutoEvento}
                      onCheckedChange={setWaAutoEvento}
                      disabled={!zapiEnabled}
                    />
                    <AutoMessageToggle
                      icon={<Users className="h-4 w-4 text-indigo-600" />}
                      label="Lideranças"
                      description="Link de afiliado para novas lideranças"
                      checked={waAutoLideranca}
                      onCheckedChange={setWaAutoLideranca}
                      disabled={!zapiEnabled}
                    />
                    <AutoMessageToggle
                      icon={<UserPlus className="h-4 w-4 text-cyan-600" />}
                      label="Equipe"
                      description="Boas-vindas para novos membros da equipe"
                      checked={waAutoMembro}
                      onCheckedChange={setWaAutoMembro}
                      disabled={!zapiEnabled}
                    />
                    <AutoMessageToggle
                      icon={<FileText className="h-4 w-4 text-amber-600" />}
                      label="Visitas"
                      description="Link do formulário de visita"
                      checked={waAutoVisita}
                      onCheckedChange={setWaAutoVisita}
                      disabled={!zapiEnabled}
                    />
                    <AutoMessageToggle
                      icon={<Ban className="h-4 w-4 text-red-600" />}
                      label="Opt-out"
                      description="Confirmação de SAIR/VOLTAR"
                      checked={waAutoOptout}
                      onCheckedChange={setWaAutoOptout}
                      disabled={!zapiEnabled}
                    />
                    <AutoMessageToggle
                      icon={<MessageCircle className="h-4 w-4 text-teal-600" />}
                      label="Fallback SMS → WhatsApp"
                      description="Envia verificação via WhatsApp após 6 falhas de SMS"
                      checked={waAutoSmsFallback}
                      onCheckedChange={setWaAutoSmsFallback}
                      disabled={!zapiEnabled}
                    />
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            <div className="flex flex-wrap items-center gap-3 pt-4">
              <Button
                variant="outline"
                onClick={handleTestZapi}
                disabled={!isZapiConfigured || testZapiConnection.isPending}
              >
                {testZapiConnection.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Testar Conexão
              </Button>
              <ZapiConnectionIndicator 
                isConnected={zapiStatus?.connected || false}
                isLoading={isCheckingZapi}
                isConfigured={!!isZapiConfigured && zapiEnabled}
                phone={zapiStatus?.phone}
              />
              <Button
                variant="outline"
                onClick={() => setQrCodeDialogOpen(true)}
                disabled={!isZapiConfigured}
                className="text-green-600 border-green-200 hover:bg-green-50 hover:border-green-300"
              >
                <QrCode className="h-4 w-4 mr-2" />
                Reconectar WhatsApp
              </Button>
              <Button
                onClick={handleSaveZapi}
                disabled={updateSettings.isPending}
              >
                {updateSettings.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Salvar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* WhatsApp Cloud API (Meta) */}
        <MetaCloudConfigCard settings={settings as any} />


        {/* Resend - Configurações do Remetente */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Mail className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-lg">Email - Remetente</CardTitle>
                <CardDescription>
                  Configure o email e nome que aparecerão como remetente nos envios
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="resend-email">Email Remetente</Label>
                <Input
                  id="resend-email"
                  type="email"
                  placeholder="naoresponda@seudominio.com"
                  value={resendFromEmail}
                  onChange={(e) => setResendFromEmail(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Domínio deve estar verificado no provedor de email
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="resend-name">Nome do Remetente</Label>
                <Input
                  id="resend-name"
                  placeholder="Ex: Gabinete Rafael Prudente"
                  value={resendFromName}
                  onChange={(e) => setResendFromName(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button
                onClick={() => {
                  updateSettings.mutate({
                    resend_from_email: resendFromEmail || null,
                    resend_from_name: resendFromName || null,
                  });
                }}
                disabled={updateSettings.isPending}
              >
                {updateSettings.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Salvar
              </Button>
            </div>
          </CardContent>
        </Card>



        {/* PassKit - Carteira Digital */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <Wallet className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">PassKit - Carteira Digital</CardTitle>
                  <CardDescription>
                    Gere cartões digitais para Apple Wallet e Google Pay
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {isPasskitConfigured ? (
                  passkitEnabled ? (
                    <Badge variant="default" className="bg-green-500 hover:bg-green-600">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Ativo
                    </Badge>
                  ) : (
                    <Badge variant="secondary">
                      Configurado
                    </Badge>
                  )
                ) : (
                  <Badge variant="outline" className="text-muted-foreground">
                    <XCircle className="h-3 w-3 mr-1" />
                    Não configurado
                  </Badge>
                )}
                <Switch
                  checked={passkitEnabled}
                  onCheckedChange={setPasskitEnabled}
                  disabled={!isPasskitConfigured}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="passkit-program-id">Program ID</Label>
                <Input
                  id="passkit-program-id"
                  placeholder="ID do programa de membros"
                  value={passkitProgramId}
                  onChange={(e) => setPasskitProgramId(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Encontre em <a href="https://app.passkit.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">app.passkit.com</a> → Programs → Seu Programa → Program ID
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="passkit-tier-id">Tier ID</Label>
                <Input
                  id="passkit-tier-id"
                  placeholder="ID do tier/nível de membro"
                  value={passkitTierId}
                  onChange={(e) => setPasskitTierId(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Encontre em <a href="https://app.passkit.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">app.passkit.com</a> → Programs → Seu Programa → Tiers → Tier ID
                </p>
              </div>
            </div>

            <div className="bg-muted/30 rounded-lg p-4 border border-border/50 space-y-2">
              <h4 className="font-medium text-sm">Funcionalidades</h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Cartões digitais para líderes com link de afiliado</li>
                <li>• Compatível com Apple Wallet e Google Pay</li>
                <li>• QR Code para compartilhar link de indicação</li>
                <li>• Atualização automática de pontuação</li>
              </ul>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                onClick={handleSavePasskit}
                disabled={updateSettings.isPending}
              >
                {updateSettings.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Salvar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* GreatPages Webhook */}
        <GreatPagesWebhookCard />

        {/* Verificação de Cadastro */}
        <VerificationSettingsCard />

        {/* Horário de Silêncio */}
        <QuietHoursCard />
      </div>

      {/* Z-API QR Code Reconnect Dialog */}
      <ZapiQRCodeDialog
        open={qrCodeDialogOpen}
        onOpenChange={setQrCodeDialogOpen}
        instanceId={zapiInstanceId}
        token={zapiToken}
        clientToken={zapiClientToken}
        onConnected={() => {
          refetchZapiStatus();
        }}
      />
    </DashboardLayout>
  );
};

export default Integrations;
