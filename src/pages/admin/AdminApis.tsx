import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { MessageSquare, Bot, Brain, ExternalLink, Save, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

interface ApiConfig {
  key: string;
  name: string;
  icon: React.ElementType;
  description: string;
  purpose: string;
  howToGet: string;
  link: string;
  secretName: string;
  fields: { key: string; label: string; placeholder: string; dbColumn: string }[];
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

function MetaCloudFields() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});

  const { data: settings, isLoading } = useQuery({
    queryKey: ["integrations_settings_admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integrations_settings")
        .select("meta_cloud_phone_number_id, meta_cloud_waba_id, meta_cloud_phone, meta_cloud_api_version, id")
        .limit(1)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const fields = apis[0].fields;

  const getFieldValue = (field: typeof fields[0]) => {
    if (fieldValues[field.key] !== undefined) return fieldValues[field.key];
    if (settings) return (settings as any)[field.dbColumn] || "";
    return "";
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const updates: Record<string, any> = {};
      fields.forEach((field) => {
        if (fieldValues[field.key] !== undefined) {
          updates[field.dbColumn] = fieldValues[field.key] || null;
        }
      });
      if (Object.keys(updates).length === 0) throw new Error("Nenhuma alteração detectada.");

      const { error } = await supabase
        .from("integrations_settings")
        .update(updates)
        .eq("id", settings!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations_settings_admin"] });
      queryClient.invalidateQueries({ queryKey: ["integrations_settings"] });
      toast({ title: "Configurações salvas", description: "Campos da Meta Cloud API atualizados." });
      setFieldValues({});
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) return <div className="text-sm text-muted-foreground">Carregando...</div>;

  return (
    <div className="border-t pt-4 space-y-3">
      <p className="text-sm font-medium text-foreground">Configurações adicionais:</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {fields.map((field) => (
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
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending || Object.keys(fieldValues).length === 0}
        className="gap-1"
      >
        {saveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
        Salvar configurações
      </Button>
    </div>
  );
}

function ApiCard({ api }: { api: ApiConfig }) {
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

        <div className="border-t pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <code className="text-xs bg-muted px-2 py-1 rounded font-mono">{api.secretName}</code>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-xs text-muted-foreground">Configurado no Lovable Cloud</span>
            </div>
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
        </div>

        {api.key === "meta_cloud" && <MetaCloudFields />}
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
                Os tokens são armazenados de forma segura e criptografada no Lovable Cloud.
                Para alterar os valores dos tokens, utilize o painel de Secrets do projeto.
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
