import { useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { MessageSquare, Bot, Brain, Eye, EyeOff, ExternalLink, Save, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface ApiConfig {
  key: string;
  name: string;
  icon: React.ElementType;
  description: string;
  purpose: string;
  howToGet: string;
  link: string;
  secretName: string;
  fields: { key: string; label: string; placeholder: string; dbColumn?: string }[];
  category: string;
  optional?: boolean;
}

const apis: ApiConfig[] = [
  {
    key: "meta_cloud",
    name: "Meta WhatsApp Cloud API",
    icon: MessageSquare,
    description: "API oficial da Meta para envio de mensagens via WhatsApp Business Cloud.",
    purpose: "Permite enviar mensagens de WhatsApp em massa, notificações automáticas e templates de mensagens aprovados pela Meta.",
    howToGet: "Acesse developers.facebook.com → crie um App do tipo 'Business' → adicione o produto 'WhatsApp' → vá em WhatsApp > API Setup → copie o 'Temporary access token' ou gere um token permanente via System User.",
    link: "https://developers.facebook.com/apps/",
    secretName: "META_WA_ACCESS_TOKEN",
    fields: [
      { key: "phone_number_id", label: "Phone Number ID", placeholder: "Ex: 123456789012345", dbColumn: "meta_cloud_phone_number_id" },
      { key: "waba_id", label: "WABA ID", placeholder: "Ex: 123456789012345", dbColumn: "meta_cloud_waba_id" },
      { key: "phone", label: "Número do WhatsApp", placeholder: "Ex: 5561999999999", dbColumn: "meta_cloud_phone" },
      { key: "api_version", label: "Versão da API", placeholder: "Ex: v20.0", dbColumn: "meta_cloud_api_version" },
    ],
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
    fields: [],
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
    fields: [],
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
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showToken, setShowToken] = useState(false);
  const [tokenValue, setTokenValue] = useState("");
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [editingToken, setEditingToken] = useState(false);

  // Load DB fields for Meta Cloud
  const { data: settings } = useQuery({
    queryKey: ["integrations_settings_admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integrations_settings")
        .select("*")
        .limit(1)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: api.fields.length > 0,
  });

  // Initialize field values from DB
  const getFieldValue = (field: typeof api.fields[0]) => {
    if (fieldValues[field.key] !== undefined) return fieldValues[field.key];
    if (settings && field.dbColumn) return (settings as any)[field.dbColumn] || "";
    return "";
  };

  const saveDbFields = useMutation({
    mutationFn: async () => {
      const updates: Record<string, any> = {};
      api.fields.forEach((field) => {
        if (field.dbColumn && fieldValues[field.key] !== undefined) {
          updates[field.dbColumn] = fieldValues[field.key] || null;
        }
      });

      if (Object.keys(updates).length === 0) return;

      const { data: existing } = await supabase
        .from("integrations_settings")
        .select("id")
        .limit(1)
        .single();

      if (!existing) throw new Error("Configurações não encontradas");

      const { error } = await supabase
        .from("integrations_settings")
        .update(updates)
        .eq("id", existing.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations_settings_admin"] });
      queryClient.invalidateQueries({ queryKey: ["integrations_settings"] });
      toast({ title: "Campos salvos", description: "As configurações foram atualizadas." });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    },
  });

  const saveSecret = async () => {
    if (!tokenValue.trim()) {
      toast({ title: "Token vazio", description: "Informe o valor do token/chave.", variant: "destructive" });
      return;
    }

    try {
      const { error } = await supabase.functions.invoke("update-secret", {
        body: { name: api.secretName, value: tokenValue },
      });
      if (error) throw error;
      toast({ title: "Token salvo", description: `${api.secretName} atualizado com sucesso.` });
      setTokenValue("");
      setEditingToken(false);
    } catch (err: any) {
      toast({ title: "Erro ao salvar token", description: err.message, variant: "destructive" });
    }
  };

  const Icon = api.icon;

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

        {/* Secret / Token field */}
        <div className="border-t pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium flex items-center gap-2">
              <code className="text-xs bg-muted px-2 py-1 rounded font-mono">{api.secretName}</code>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-xs text-muted-foreground">Configurado</span>
            </Label>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(api.link, "_blank")}
              className="gap-1"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Obter chave
            </Button>
          </div>

          {!editingToken ? (
            <Button variant="outline" size="sm" onClick={() => setEditingToken(true)}>
              Alterar token
            </Button>
          ) : (
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showToken ? "text" : "password"}
                  placeholder={`Cole o novo ${api.secretName} aqui...`}
                  value={tokenValue}
                  onChange={(e) => setTokenValue(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Button size="sm" onClick={saveSecret} className="gap-1">
                <Save className="h-3.5 w-3.5" />
                Salvar
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setEditingToken(false); setTokenValue(""); }}>
                Cancelar
              </Button>
            </div>
          )}
        </div>

        {/* Additional DB fields (e.g. Meta Cloud) */}
        {api.fields.length > 0 && (
          <div className="border-t pt-4 space-y-3">
            <p className="text-sm font-medium text-foreground">Configurações adicionais:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {api.fields.map((field) => (
                <div key={field.key}>
                  <Label className="text-xs text-muted-foreground mb-1 block">{field.label}</Label>
                  <Input
                    placeholder={field.placeholder}
                    value={getFieldValue(field)}
                    onChange={(e) => setFieldValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <Button
              size="sm"
              onClick={() => saveDbFields.mutate()}
              disabled={saveDbFields.isPending}
              className="gap-1"
            >
              {saveDbFields.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Salvar configurações
            </Button>
          </div>
        )}
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
            Gerencie as chaves de API e credenciais dos serviços externos utilizados na plataforma
          </p>
        </div>

        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-900 dark:text-amber-200">
                As chaves configuradas aqui são usadas globalmente por todos os tenants da plataforma.
                Alterações afetam o sistema como um todo. Os tokens são armazenados de forma segura e criptografada.
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
