import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Settings as SettingsIcon, Save, Loader2, Link2, FileText, Volume2, Copy, Check } from "lucide-react";
import { useOfficeSettings, useUpdateOfficeSettings } from "@/hooks/office/useOfficeSettings";
import { toast } from "sonner";
import { useTutorial } from "@/hooks/useTutorial";
import { TutorialOverlay } from "@/components/TutorialOverlay";
import { TutorialButton } from "@/components/TutorialButton";
import type { Step } from "react-joyride";
import { useAuth } from "@/contexts/AuthContext";

const officeSettingsTutorialSteps: Step[] = [
  {
    target: '[data-tutorial="office-settings-header"]',
    title: "Configurações do Gabinete",
    content: "Configure o prefixo do protocolo, webhook e regras de pontuação de líderes.",
    placement: "bottom",
    disableBeacon: true,
  },
  {
    target: '[data-tutorial="office-settings-protocol"]',
    title: "Prefixo do Protocolo",
    content: "Defina o prefixo usado nos protocolos de visitas (ex: RP-GB-20251009-0001).",
    placement: "bottom",
  },
  {
    target: '[data-tutorial="office-settings-points"]',
    title: "Pontuação de Líderes",
    content: "Configure quantos pontos os líderes ganham quando um visitante preenche o formulário ou aceita reunião.",
    placement: "top",
  },
];

export default function Settings() {
  const { user } = useAuth();
  const { data: settings, isLoading } = useOfficeSettings();
  const updateSettings = useUpdateOfficeSettings();
  const { restartTutorial } = useTutorial("office-settings", officeSettingsTutorialSteps);

  const [prefix, setPrefix] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [pontosFormSubmitted, setPontosFormSubmitted] = useState(1);
  const [pontosAceitaReuniao, setPontosAceitaReuniao] = useState(3);

  useEffect(() => {
    if (settings) {
      setPrefix(settings.protocolo_prefix);
      setWebhookUrl(settings.webhook_url);
      setPontosFormSubmitted(settings.pontos_form_submitted);
      setPontosAceitaReuniao(settings.pontos_aceita_reuniao);
    }
  }, [settings]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    updateSettings.mutate({
      protocolo_prefix: prefix,
      webhook_url: webhookUrl,
      pontos_form_submitted: pontosFormSubmitted,
      pontos_aceita_reuniao: pontosAceitaReuniao
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 max-w-3xl">
      <TutorialOverlay page="office-settings" />
      <div className="mb-6" data-tutorial="office-settings-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Configurações do Gabinete</h1>
            <p className="text-muted-foreground">
              Gerencie as configurações do módulo de visitas
            </p>
          </div>
          <TutorialButton onClick={restartTutorial} />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card data-tutorial="office-settings-protocol">
          <CardHeader>
            <CardTitle>Protocolo</CardTitle>
            <CardDescription>
              Configure o formato do protocolo de visitas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="prefix">Prefixo do Protocolo</Label>
              <Input
                id="prefix"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                placeholder="RP-GB"
                disabled={updateSettings.isPending}
              />
              <p className="text-xs text-muted-foreground">
                Exemplo: {prefix}-20251009-0001
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Webhook</CardTitle>
            <CardDescription>
              URL para envio de notificações via WhatsApp
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="webhook">URL do Webhook</Label>
              <Input
                id="webhook"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://webhook.escaladigital.ai/webhook/gabinete/envio-formulario"
                disabled={updateSettings.isPending}
              />
            </div>
          </CardContent>
        </Card>

        <Card data-tutorial="office-settings-points">
          <CardHeader>
            <CardTitle>Pontuação de Líderes</CardTitle>
            <CardDescription>
              Defina os pontos concedidos aos líderes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pontos-form">Pontos por Form Submetido</Label>
              <Input
                id="pontos-form"
                type="number"
                min="0"
                value={pontosFormSubmitted}
                onChange={(e) => setPontosFormSubmitted(parseInt(e.target.value) || 0)}
                disabled={updateSettings.isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pontos-reuniao">Pontos por Aceitar Reunião</Label>
              <Input
                id="pontos-reuniao"
                type="number"
                min="0"
                value={pontosAceitaReuniao}
                onChange={(e) => setPontosAceitaReuniao(parseInt(e.target.value) || 0)}
                disabled={updateSettings.isPending}
              />
            </div>
          </CardContent>
        </Card>

        <Button
          type="submit"
          className="w-full"
          disabled={updateSettings.isPending}
        >
          {updateSettings.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Salvar Configurações
            </>
          )}
        </Button>
      </form>
    </div>
  );
}
