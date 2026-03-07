import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ExternalLink, ShieldCheck, MessageSquare, Brain, Search, Bot, BarChart3 } from "lucide-react";

interface SecretConfig {
  name: string;
  envKey: string;
  icon: React.ElementType;
  description: string;
  purpose: string;
  whereToGet: string;
  link: string;
  category: string;
}

const secrets: SecretConfig[] = [
  {
    name: "OpenAI",
    envKey: "OPENAI_API_KEY",
    icon: Brain,
    description: "Plataforma de inteligência artificial para modelos de linguagem (GPT-5, GPT-5 Mini).",
    purpose: "Utilizada pelo Agente IA para responder perguntas, gerar análises, criar conteúdos e automatizar tarefas inteligentes dentro da plataforma.",
    whereToGet: "Acesse platform.openai.com → faça login → vá em API Keys → clique em 'Create new secret key'. Copie a chave gerada (começa com sk-proj-...).",
    link: "https://platform.openai.com/api-keys",
    category: "IA",
  },
  {
    name: "Meta WhatsApp Cloud API",
    envKey: "META_WA_ACCESS_TOKEN",
    icon: MessageSquare,
    description: "API oficial da Meta para envio de mensagens via WhatsApp Business Cloud.",
    purpose: "Permite enviar mensagens de WhatsApp em massa, notificações automáticas, e templates de mensagens aprovados pela Meta. É o provedor oficial de WhatsApp.",
    whereToGet: "Acesse developers.facebook.com → crie um App do tipo 'Business' → adicione o produto 'WhatsApp' → vá em WhatsApp > API Setup → copie o 'Temporary access token' ou gere um token permanente via System User.",
    link: "https://developers.facebook.com/apps/",
    category: "Comunicação",
  },
  {
    name: "360dialog",
    envKey: "DIALOG360_API_KEY",
    icon: MessageSquare,
    description: "Provedor alternativo de WhatsApp Business API com integração simplificada.",
    purpose: "Funciona como provedor alternativo ou fallback para envio de WhatsApp. Oferece uma API mais simples que a Meta Cloud API direta, com suporte a templates e mensagens interativas.",
    whereToGet: "Acesse hub.360dialog.com → crie uma conta → registre seu número de WhatsApp → vá em Settings > API Keys → copie sua API Key.",
    link: "https://hub.360dialog.com/",
    category: "Comunicação",
  },
  {
    name: "Datastream (Pipeline)",
    envKey: "DATASTREAM_API_KEY / DATASTREAM_PIPELINE_ID / DATASTREAM_COMPONENT_ID",
    icon: BarChart3,
    description: "Plataforma de integração e automação de dados em tempo real.",
    purpose: "Utilizada para pipelines de dados, processamento de webhooks e automações de fluxos entre sistemas externos e a plataforma.",
    whereToGet: "Acesse app.datastream.co → faça login → vá em Settings > API → copie a API Key. Para Pipeline ID e Component ID, acesse o pipeline desejado e copie os IDs da URL ou das configurações.",
    link: "https://app.datastream.co/",
    category: "Automação",
  },
  {
    name: "Zenscrape",
    envKey: "ZENSCRAPE_API_KEY",
    icon: Search,
    description: "API de web scraping que permite extrair dados de páginas web de forma confiável.",
    purpose: "Utilizada pelo módulo de Opinião Pública para coletar menções, notícias e dados públicos de sites e portais de notícias para análise de sentimento.",
    whereToGet: "Acesse zenscrape.com → crie uma conta → vá em Dashboard > API Key → copie sua chave de API.",
    link: "https://zenscrape.com/",
    category: "Coleta de Dados",
  },
  {
    name: "Apify",
    envKey: "APIFY_API_TOKEN",
    icon: Bot,
    description: "Plataforma de automação web e scraping com actors pré-construídos para redes sociais.",
    purpose: "Utilizada para coletar dados de redes sociais (Twitter/X, Facebook, Instagram) no módulo de Opinião Pública. Os actors do Apify fazem a coleta automatizada de posts e comentários.",
    whereToGet: "Acesse console.apify.com → faça login → clique no seu perfil (canto superior direito) → Settings > Integrations → copie o 'Personal API Token'.",
    link: "https://console.apify.com/account/integrations",
    category: "Coleta de Dados",
  },
];

const categoryColors: Record<string, string> = {
  "IA": "bg-purple-100 text-purple-800 border-purple-200",
  "Comunicação": "bg-green-100 text-green-800 border-green-200",
  "Automação": "bg-blue-100 text-blue-800 border-blue-200",
  "Coleta de Dados": "bg-amber-100 text-amber-800 border-amber-200",
};

const ExternalSecrets = () => {
  const navigate = useNavigate();

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/settings")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            Chaves de API Externas
          </h1>
          <p className="text-muted-foreground">
            Referência de todas as integrações externas e onde obter cada credencial
          </p>
        </div>
      </div>

      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="pt-4 pb-4">
          <p className="text-sm text-amber-900">
            <strong>Atenção:</strong> As chaves de API são armazenadas com segurança no Lovable Cloud (Secrets). 
            Esta página serve como referência para saber onde obter cada chave e para que cada serviço é utilizado. 
            Para configurar os valores, utilize o painel de segredos do projeto.
          </p>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {secrets.map((secret) => {
          const Icon = secret.icon;
          return (
            <Card key={secret.envKey} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="flex items-center gap-3 text-lg">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    {secret.name}
                  </CardTitle>
                  <Badge variant="outline" className={categoryColors[secret.category] || ""}>
                    {secret.category}
                  </Badge>
                </div>
                <CardDescription className="mt-1">{secret.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <div>
                  <p className="text-sm font-medium text-foreground mb-1">Para que serve:</p>
                  <p className="text-sm text-muted-foreground">{secret.purpose}</p>
                </div>

                <div>
                  <p className="text-sm font-medium text-foreground mb-1">Como obter:</p>
                  <p className="text-sm text-muted-foreground">{secret.whereToGet}</p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                  <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                    {secret.envKey}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(secret.link, "_blank")}
                    className="gap-1"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Abrir site
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default ExternalSecrets;
