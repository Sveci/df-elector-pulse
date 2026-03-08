import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { MessageSquare, Bot, Brain, ExternalLink, CheckCircle2, AlertCircle, Eye, EyeOff, Save, Loader2, Mail, Phone, Wallet, Radio, Zap, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ApiConfig {
  key: string;
  name: string;
  icon: React.ElementType;
  description: string;
  purpose: string;
  howToGet: string;
  link: string;
  secretName: string;
  category: string;
  optional?: boolean;
  hasRegionSelector?: boolean;
  /** Field name in integrations_settings for the enabled toggle */
  enabledField?: string;
  /** Whether this API has a test connection function */
  hasTestConnection?: boolean;
}

const apis: ApiConfig[] = [
  {
    key: "meta_cloud",
    name: "Meta WhatsApp Cloud API",
    icon: MessageSquare,
    description: "API oficial da Meta para envio de mensagens via WhatsApp Business Cloud.",
    purpose: "Token global usado por todos os tenants. Cada tenant configura seu próprio Phone Number ID, WABA ID e demais campos nas configurações do workspace.",
    howToGet: "Acesse developers.facebook.com → crie um App do tipo 'Business' → adicione o produto 'WhatsApp' → vá em WhatsApp > API Setup → copie o 'Temporary access token' ou gere um token permanente via System User.",
    link: "https://developers.facebook.com/apps/",
    secretName: "META_WA_ACCESS_TOKEN",
    category: "Comunicação",
    enabledField: "meta_cloud_enabled",
    hasTestConnection: true,
  },
  {
    key: "apify",
    name: "Apify",
    icon: Bot,
    description: "Plataforma de automação web e scraping com actors pré-construídos para redes sociais.",
    purpose: "Utilizada para coletar dados de redes sociais (Twitter/X, Facebook, Instagram) no módulo de Opinião Pública.",
    howToGet: "Acesse console.apify.com → faça login → clique no seu perfil → Settings > Integrations → copie o 'Personal API Token'.",
    link: "https://console.apify.com/account/integrations",
    secretName: "APIFY_API_TOKEN",
    category: "Coleta de Dados",
    hasTestConnection: true,
  },
  {
    key: "openai",
    name: "OpenAI (Opcional)",
    icon: Brain,
    description: "Plataforma de inteligência artificial para modelos de linguagem.",
    purpose: "Opcional. O sistema já utiliza IAs integradas do Lovable Cloud. Configure apenas se desejar usar modelos OpenAI específicos.",
    howToGet: "Acesse platform.openai.com → faça login → vá em API Keys → clique em 'Create new secret key'.",
    link: "https://platform.openai.com/api-keys",
    secretName: "OPENAI_API_KEY",
    category: "IA",
    optional: true,
    hasTestConnection: true,
  },
  {
    key: "resend",
    name: "Resend — Email Marketing",
    icon: MessageSquare,
    description: "Envie emails automatizados e em massa com a plataforma Resend.",
    purpose: "Token global para envio de emails. Cada tenant configura seu próprio email e nome de remetente nas configurações do workspace.",
    howToGet: "Acesse resend.com → faça login → vá em API Keys → clique em 'Create API Key' → copie a chave gerada.",
    link: "https://resend.com/api-keys",
    secretName: "RESEND_API_KEY",
    category: "Comunicação",
    enabledField: "resend_enabled",
    hasTestConnection: true,
  },
  {
    key: "smsbarato",
    name: "SMSBarato — Envio de SMS",
    icon: Phone,
    description: "Plataforma de envio de SMS em massa com cobertura nacional.",
    purpose: "Token global para envio de SMS via SMSBarato. Utilizado como provedor de SMS no sistema.",
    howToGet: "Acesse smsbarato.com.br → faça login → vá em Configurações → API → copie sua chave de API.",
    link: "https://www.smsbarato.com.br/",
    secretName: "SMSBARATO_API_KEY",
    category: "SMS",
    enabledField: "smsbarato_enabled",
    hasTestConnection: true,
  },
  {
    key: "disparopro",
    name: "DisparoPro — Envio de SMS",
    icon: Phone,
    description: "Plataforma profissional de disparo de SMS com relatórios detalhados.",
    purpose: "Token global para envio de SMS via DisparoPro. Provedor alternativo de SMS.",
    howToGet: "Acesse disparopro.com.br → faça login → vá em Integrações → API → copie o token de acesso.",
    link: "https://www.disparopro.com.br/",
    secretName: "DISPAROPRO_TOKEN",
    category: "SMS",
    enabledField: "disparopro_enabled",
    hasTestConnection: true,
  },
  {
    key: "smsdev",
    name: "SMSDEV — Envio de SMS",
    icon: Phone,
    description: "API de SMS para desenvolvedores com envio rápido e confiável.",
    purpose: "Token global para envio de SMS via SMSDEV. Provedor principal de SMS do sistema.",
    howToGet: "Acesse smsdev.com.br → faça login → vá em Minha Conta → API Key → copie a chave.",
    link: "https://www.smsdev.com.br/",
    secretName: "SMSDEV_API_KEY",
    category: "SMS",
    enabledField: "smsdev_enabled",
    hasTestConnection: true,
  },
  {
    key: "passkit",
    name: "PassKit — Carteira Digital",
    icon: Wallet,
    description: "Plataforma para criação e gestão de cartões digitais (Apple Wallet e Google Wallet).",
    purpose: "Token global para integração com carteiras digitais. Cada tenant configura seu próprio Program ID e Tier ID. A região da API é definida aqui globalmente.",
    howToGet: "Acesse app.passkit.com → faça login → vá em Settings → API Keys → copie o 'API Token'.",
    link: "https://app.passkit.com/",
    secretName: "PASSKIT_API_TOKEN",
    category: "Carteira Digital",
    hasRegionSelector: true,
    enabledField: "passkit_enabled",
    hasTestConnection: true,
  },
];

const categoryColors: Record<string, string> = {
  "Comunicação": "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800",
  "Coleta de Dados": "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
  "IA": "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800",
  "SMS": "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
  "Carteira Digital": "bg-pink-100 text-pink-800 border-pink-200 dark:bg-pink-900/30 dark:text-pink-300 dark:border-pink-800",
};

function ApiCard({ api, enabledStates, onToggle }: { api: ApiConfig; enabledStates: Record<string, boolean>; onToggle: (field: string, value: boolean) => void }) {
  const Icon = api.icon;
  const [tokenValue, setTokenValue] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [regionUrl, setRegionUrl] = useState("https://api.pub1.passkit.io");
  const [isLoadingRegion, setIsLoadingRegion] = useState(false);

  const isEnabled = api.enabledField ? (enabledStates[api.enabledField] ?? false) : undefined;

  useEffect(() => {
    if (api.hasRegionSelector) {
      const fetchRegion = async () => {
        setIsLoadingRegion(true);
        const { data } = await supabase
          .from("integrations_settings")
          .select("passkit_api_base_url")
          .limit(1)
          .maybeSingle();
        if (data?.passkit_api_base_url) {
          setRegionUrl(data.passkit_api_base_url);
        }
        setIsLoadingRegion(false);
      };
      fetchRegion();
    }
  }, [api.hasRegionSelector]);

  const handleSave = async () => {
    if (!tokenValue.trim()) {
      toast.error("Informe o valor do token");
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase.functions.invoke("update-secret", {
        body: { secretName: api.secretName, secretValue: tokenValue.trim() },
      });

      if (error) throw error;

      toast.success(`${api.name} — token salvo com sucesso!`);
      setTokenValue("");
      setIsEditing(false);
    } catch (err: any) {
      toast.error(`Erro ao salvar: ${err.message || "Tente novamente"}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("test-api-connection", {
        body: { provider: api.key },
      });

      if (error) throw error;

      if (data?.success) {
        setTestResult({
          success: true,
          message: data.data?.description || "Conexão bem-sucedida!",
        });
        toast.success(`${api.name} — conexão OK!`);
      } else {
        const errorMsg = data?.error || "Falha na conexão";
        const isNotConfigured = errorMsg.toLowerCase().includes("não configurad");
        setTestResult({
          success: false,
          message: isNotConfigured
            ? "⚠️ Credencial não configurada. Preencha a chave na tela de Integrações primeiro."
            : errorMsg,
        });
        if (!isNotConfigured) {
          toast.error(`${api.name} — ${errorMsg}`);
        } else {
          toast.warning(`${api.name} — credencial não configurada`);
        }
      }
    } catch (err: any) {
      const message = err.message || "Erro ao testar";
      setTestResult({ success: false, message });
      toast.error(`Erro ao testar ${api.name}: ${message}`);
    } finally {
      setIsTesting(false);
    }
  };

  const handleToggleEnabled = async (checked: boolean) => {
    if (!api.enabledField) return;
    onToggle(api.enabledField, checked);
  };

  return (
    <Card className={`hover:shadow-md transition-shadow ${isEnabled === false ? "opacity-60" : ""}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <CardTitle className="flex items-center gap-3 text-lg">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            {api.name}
          </CardTitle>
          <div className="flex items-center gap-2">
            {api.optional && (
              <Badge variant="outline" className="text-muted-foreground border-muted">
                Opcional
              </Badge>
            )}
            <Badge variant="outline" className={categoryColors[api.category] || ""}>
              {api.category}
            </Badge>
            {api.enabledField && (
              <div className="flex items-center gap-2 ml-2">
                <span className="text-xs text-muted-foreground">
                  {isEnabled ? "Ativo" : "Inativo"}
                </span>
                <Switch
                  checked={isEnabled ?? false}
                  onCheckedChange={handleToggleEnabled}
                />
              </div>
            )}
          </div>
        </div>
        <CardDescription className="mt-1">{api.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <div>
          <p className="text-sm font-medium text-foreground mb-1">Para que serve:</p>
          <p className="text-sm text-muted-foreground">{api.purpose}</p>
        </div>

        <div>
          <p className="text-sm font-medium text-foreground mb-1">Como obter:</p>
          <p className="text-sm text-muted-foreground">{api.howToGet}</p>
        </div>

        {/* Region selector for PassKit */}
        {api.hasRegionSelector && (
          <div className="border-t pt-4 space-y-2">
            <Label htmlFor={`region-${api.key}`} className="text-sm font-medium">Região da API</Label>
            {isLoadingRegion ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Carregando...</span>
              </div>
            ) : (
              <>
                <select
                  id={`region-${api.key}`}
                  value={regionUrl}
                  onChange={async (e) => {
                    const newUrl = e.target.value;
                    setRegionUrl(newUrl);
                    const { error } = await supabase
                      .from("integrations_settings")
                      .update({ passkit_api_base_url: newUrl })
                      .not("id", "is", null);
                    if (error) {
                      toast.error("Erro ao salvar região");
                    } else {
                      toast.success(`Região alterada para ${newUrl.includes("pub1") ? "Região 1 (pub1)" : "Região 2 (pub2)"}`);
                    }
                  }}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="https://api.pub1.passkit.io">Região 1 (pub1) - Padrão</option>
                  <option value="https://api.pub2.passkit.io">Região 2 (pub2)</option>
                </select>
                <p className="text-xs text-muted-foreground">
                  Selecione a região correspondente à sua conta PassKit
                </p>
              </>
            )}
          </div>
        )}

        {/* Token input section */}
        <div className="border-t pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <code className="text-xs bg-muted px-2 py-1 rounded font-mono">{api.secretName}</code>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-xs text-muted-foreground">Configurado</span>
            </div>
            <div className="flex items-center gap-2">
              {api.hasTestConnection && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTestConnection}
                  disabled={isTesting}
                  className="gap-1.5"
                >
                  {isTesting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Zap className="h-3.5 w-3.5" />
                  )}
                  Testar Conexão
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(api.link, "_blank")}
                className="gap-1"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Obter chave
              </Button>
              {!isEditing && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                >
                  Atualizar Token
                </Button>
              )}
            </div>
          </div>

          {/* Test result */}
          {testResult && (
            <div className={`flex items-center gap-2 p-3 rounded-lg border text-sm ${
              testResult.success
                ? "bg-green-50 border-green-200 text-green-800 dark:bg-green-950/30 dark:border-green-800 dark:text-green-300"
                : "bg-red-50 border-red-200 text-red-800 dark:bg-red-950/30 dark:border-red-800 dark:text-red-300"
            }`}>
              {testResult.success ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 shrink-0" />
              )}
              <span>{testResult.message}</span>
            </div>
          )}

          {isEditing && (
            <div className="space-y-2 p-4 rounded-lg border border-border bg-muted/30">
              <Label htmlFor={`token-${api.key}`} className="text-sm font-medium">
                Novo valor para <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{api.secretName}</code>
              </Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id={`token-${api.key}`}
                    type={showToken ? "text" : "password"}
                    placeholder={`Cole aqui o token da ${api.name}...`}
                    value={tokenValue}
                    onChange={(e) => setTokenValue(e.target.value)}
                    className="pr-10 font-mono text-sm"
                    disabled={isSaving}
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Button onClick={handleSave} disabled={isSaving || !tokenValue.trim()} className="gap-2">
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Salvar
                </Button>
                <Button variant="ghost" onClick={() => { setIsEditing(false); setTokenValue(""); }} disabled={isSaving}>
                  Cancelar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                O token será armazenado de forma segura e criptografada. Por segurança, o valor atual não é exibido.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

const smsProviders = [
  { value: "smsdev", label: "SMSDEV", description: "Provedor principal — API rápida e confiável" },
  { value: "smsbarato", label: "SMSBarato", description: "Cobertura nacional com custo reduzido" },
  { value: "disparopro", label: "DisparoPro", description: "Plataforma profissional com relatórios detalhados" },
];

function ActiveSmsProviderCard() {
  const [activeProvider, setActiveProvider] = useState<string>("smsdev");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchProvider = async () => {
      const { data } = await supabase
        .from("integrations_settings")
        .select("sms_active_provider")
        .limit(1)
        .maybeSingle();
      if (data?.sms_active_provider) {
        setActiveProvider(data.sms_active_provider);
      }
      setIsLoading(false);
    };
    fetchProvider();
  }, []);

  const handleSave = async (newProvider: string) => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("integrations_settings")
        .update({ sms_active_provider: newProvider })
        .not("id", "is", null);

      if (error) throw error;

      setActiveProvider(newProvider);
      const providerLabel = smsProviders.find(p => p.value === newProvider)?.label || newProvider;
      toast.success(`Provedor SMS ativo alterado para ${providerLabel}`);
    } catch (err: any) {
      toast.error(`Erro ao salvar: ${err.message || "Tente novamente"}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-3 text-lg">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Radio className="h-5 w-5 text-primary" />
          </div>
          Provedor SMS Ativo
        </CardTitle>
        <CardDescription>
          Selecione qual provedor será usado para envio de SMS em toda a plataforma
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Carregando configuração...</span>
          </div>
        ) : (
          <RadioGroup
            value={activeProvider}
            onValueChange={handleSave}
            disabled={isSaving}
            className="space-y-3"
          >
            {smsProviders.map((provider) => (
              <label
                key={provider.value}
                className={`flex items-center gap-4 p-4 rounded-lg border cursor-pointer transition-colors ${
                  activeProvider === provider.value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/30"
                } ${isSaving ? "opacity-50 pointer-events-none" : ""}`}
              >
                <RadioGroupItem value={provider.value} />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{provider.label}</span>
                    {activeProvider === provider.value && (
                      <Badge variant="default" className="text-xs">Ativo</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{provider.description}</p>
                </div>
                {isSaving && activeProvider !== provider.value && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </label>
            ))}
          </RadioGroup>
        )}
        <p className="text-xs text-muted-foreground mt-4">
          Certifique-se de que o token do provedor selecionado esteja configurado abaixo antes de ativá-lo.
        </p>
      </CardContent>
    </Card>
  );
}

const AdminApis = () => {
  const [enabledStates, setEnabledStates] = useState<Record<string, boolean>>({});
  const [isLoadingStates, setIsLoadingStates] = useState(true);

  useEffect(() => {
    const fetchEnabledStates = async () => {
      const { data } = await supabase
        .from("integrations_settings")
        .select("meta_cloud_enabled, resend_enabled, smsbarato_enabled, disparopro_enabled, smsdev_enabled, passkit_enabled")
        .limit(1)
        .maybeSingle();

      if (data) {
        setEnabledStates({
          meta_cloud_enabled: data.meta_cloud_enabled ?? false,
          resend_enabled: data.resend_enabled ?? false,
          smsbarato_enabled: data.smsbarato_enabled ?? false,
          disparopro_enabled: data.disparopro_enabled ?? false,
          smsdev_enabled: data.smsdev_enabled ?? false,
          passkit_enabled: data.passkit_enabled ?? false,
        });
      }
      setIsLoadingStates(false);
    };
    fetchEnabledStates();
  }, []);

  const handleToggle = async (field: string, value: boolean) => {
    const previousStates = { ...enabledStates };
    setEnabledStates(prev => ({ ...prev, [field]: value }));

    try {
      const { error } = await supabase
        .from("integrations_settings")
        .update({ [field]: value })
        .not("id", "is", null);

      if (error) throw error;

      const apiName = apis.find(a => a.enabledField === field)?.name || field;
      toast.success(`${apiName} — ${value ? "ativado" : "desativado"}`);
    } catch (err: any) {
      setEnabledStates(previousStates);
      toast.error(`Erro ao atualizar: ${err.message || "Tente novamente"}`);
    }
  };

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">APIs Externas</h1>
          <p className="text-muted-foreground text-sm">
            Gerencie as credenciais dos serviços externos utilizados na plataforma
          </p>
        </div>

        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-900 dark:text-amber-200">
                As chaves de API são usadas globalmente por todos os tenants da plataforma.
                Os tokens são armazenados de forma segura e criptografada.
              </p>
            </div>
          </CardContent>
        </Card>

        <ActiveSmsProviderCard />

        {isLoadingStates ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {apis.map((api) => (
              <ApiCard
                key={api.key}
                api={api}
                enabledStates={enabledStates}
                onToggle={handleToggle}
              />
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminApis;
