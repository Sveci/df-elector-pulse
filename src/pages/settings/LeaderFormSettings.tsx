import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Upload, X, Loader2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAppSettings, useUpdateAppSettings } from "@/hooks/useAppSettings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { generateLeaderRegistrationUrl } from "@/lib/urlHelper";
import { useTutorial } from "@/hooks/useTutorial";
import { TutorialOverlay } from "@/components/TutorialOverlay";
import { TutorialButton } from "@/components/TutorialButton";
import type { Step } from "react-joyride";

const leaderFormTutorialSteps: Step[] = [
  { target: '[data-tutorial="leader-form-header"]', title: 'Formulário de Liderança', content: 'Personalize a página pública de cadastro de líderes.', placement: 'bottom', disableBeacon: true },
  { target: '[data-tutorial="leader-form-preview"]', title: 'Preview', content: 'Veja em tempo real como o formulário aparecerá para os usuários.', placement: 'right' },
  { target: '[data-tutorial="leader-form-config"]', title: 'Configurações', content: 'Configure capa, logo, título e subtítulo do formulário.', placement: 'left' },
];

export default function LeaderFormSettings() {
  const navigate = useNavigate();
  const { data: settings, isLoading } = useAppSettings();
  const updateSettings = useUpdateAppSettings();
  const { restartTutorial } = useTutorial("leader-form-settings", leaderFormTutorialSteps);

  const [coverUrl, setCoverUrl] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [title, setTitle] = useState("Cadastro de Liderança");
  const [subtitle, setSubtitle] = useState("");
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    if (settings) {
      setCoverUrl(settings.leader_form_cover_url || "");
      setLogoUrl(settings.leader_form_logo_url || "");
      setTitle(settings.leader_form_title || "Cadastro de Liderança");
      setSubtitle(settings.leader_form_subtitle || "");
    }
  }, [settings]);

  async function uploadFile(file: File, folder: string): Promise<string | null> {
    const fileExt = file.name.split(".").pop();
    const fileName = `${folder}/${Date.now()}.${fileExt}`;

    const { error } = await supabase.storage
      .from("avatars")
      .upload(fileName, file, { upsert: true });

    if (error) {
      toast.error("Erro ao fazer upload: " + error.message);
      return null;
    }

    const { data } = supabase.storage.from("avatars").getPublicUrl(fileName);
    return data.publicUrl;
  }

  async function handleCoverUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingCover(true);
    const url = await uploadFile(file, "leader-form-covers");
    if (url) setCoverUrl(url);
    setUploadingCover(false);
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    const url = await uploadFile(file, "leader-form-logos");
    if (url) setLogoUrl(url);
    setUploadingLogo(false);
  }

  async function handleSave() {
    updateSettings.mutate({
      leader_form_cover_url: coverUrl || null,
      leader_form_logo_url: logoUrl || null,
      leader_form_title: title,
      leader_form_subtitle: subtitle || null,
    } as any);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      <TutorialOverlay page="leader-form-settings" />
      <div className="flex items-center gap-4" data-tutorial="leader-form-header">
        <Button variant="ghost" size="icon" onClick={() => navigate("/settings")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Formulário de Cadastro de Líder</h1>
          <p className="text-muted-foreground">
            Configure a aparência da página pública de cadastro de líderes
          </p>
        </div>
        <TutorialButton onClick={restartTutorial} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Preview */}
        <Card data-tutorial="leader-form-preview">
          <CardHeader>
            <CardTitle className="text-lg">Preview</CardTitle>
            <CardDescription>Visualização da página de cadastro</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <div
                className="relative h-32 bg-cover bg-center"
                style={{
                  backgroundImage: coverUrl
                    ? `url(${coverUrl})`
                    : "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary)/0.8) 100%)",
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
                {logoUrl && (
                  <div className="absolute top-3 left-0 right-0 flex justify-center">
                    <img src={logoUrl} alt="Logo" className="h-8 object-contain" />
                  </div>
                )}
                <div className="absolute bottom-2 left-0 right-0 px-3 text-center">
                  <h3 className="text-sm font-bold text-foreground">{title}</h3>
                  {subtitle && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{subtitle}</p>
                  )}
                </div>
              </div>
              <div className="p-3 bg-card">
                <div className="space-y-2">
                  <div className="h-8 bg-muted rounded" />
                  <div className="h-8 bg-muted rounded" />
                  <div className="h-8 bg-muted rounded" />
                  <div className="h-8 bg-primary rounded" />
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              className="w-full mt-4"
              onClick={() => window.open(generateLeaderRegistrationUrl(), "_blank")}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Ver página completa
            </Button>
          </CardContent>
        </Card>

        {/* Configurações */}
        <Card data-tutorial="leader-form-config">
          <CardHeader>
            <CardTitle className="text-lg">Configurações</CardTitle>
            <CardDescription>Personalize o formulário de cadastro</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Cover */}
            <div className="space-y-2">
              <Label>Imagem de Capa</Label>
              <div className="flex items-center gap-2">
                {coverUrl ? (
                  <div className="relative">
                    <img
                      src={coverUrl}
                      alt="Cover"
                      className="h-16 w-24 object-cover rounded"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute -top-2 -right-2 h-6 w-6"
                      onClick={() => setCoverUrl("")}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <label className="flex items-center justify-center h-16 w-24 border-2 border-dashed rounded cursor-pointer hover:border-primary transition-colors">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleCoverUpload}
                      disabled={uploadingCover}
                    />
                    {uploadingCover ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4 text-muted-foreground" />
                    )}
                  </label>
                )}
              </div>
            </div>

            {/* Logo */}
            <div className="space-y-2">
              <Label>Logo</Label>
              <div className="flex items-center gap-2">
                {logoUrl ? (
                  <div className="relative">
                    <img
                      src={logoUrl}
                      alt="Logo"
                      className="h-12 object-contain rounded"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute -top-2 -right-2 h-6 w-6"
                      onClick={() => setLogoUrl("")}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <label className="flex items-center justify-center h-12 w-24 border-2 border-dashed rounded cursor-pointer hover:border-primary transition-colors">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleLogoUpload}
                      disabled={uploadingLogo}
                    />
                    {uploadingLogo ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4 text-muted-foreground" />
                    )}
                  </label>
                )}
              </div>
            </div>

            {/* Título */}
            <div className="space-y-2">
              <Label>Título</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Cadastro de Liderança"
              />
            </div>

            {/* Subtítulo */}
            <div className="space-y-2">
              <Label>Subtítulo</Label>
              <Textarea
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="Faça parte da nossa rede de lideranças..."
                rows={3}
              />
            </div>

            <Button
              className="w-full"
              onClick={handleSave}
              disabled={updateSettings.isPending}
            >
              {updateSettings.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar Configurações"
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
