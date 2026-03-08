import { useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MessageSquare, Bot, Brain, ExternalLink, CheckCircle2, AlertCircle, Eye, EyeOff, Save, Loader2 } from "lucide-react";
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
  },
];

const categoryColors: Record<string, string> = {
  "Comunicação": "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800",
  "Coleta de Dados": "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
  "IA": "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800",
};

function ApiCard({ api }: { api: ApiConfig }) {
  const Icon = api.icon;
  const [tokenValue, setTokenValue] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = async () => {
    if (!tokenValue.trim()) {
      toast.error("Informe o valor do token");
      return;
    }

    setIsSaving(true);
    try {
      // Salvar via edge function que atualiza o secret
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

  return (
    <Card className="hover:shadow-md transition-shadow">
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

        {/* Token input section */}
        <div className="border-t pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <code className="text-xs bg-muted px-2 py-1 rounded font-mono">{api.secretName}</code>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-xs text-muted-foreground">Configurado</span>
            </div>
            <div className="flex items-center gap-2">
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

const AdminApis = () => {
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

        <div className="space-y-4">
          {apis.map((api) => (
            <ApiCard key={api.key} api={api} />
          ))}
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminApis;