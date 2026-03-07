import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Upload, Trash2, Loader2, Image, ExternalLink, ImageIcon } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { useTutorial } from "@/hooks/useTutorial";
import { TutorialOverlay } from "@/components/TutorialOverlay";
import { TutorialButton } from "@/components/TutorialButton";
import type { Step } from "react-joyride";

const affiliateFormTutorialSteps: Step[] = [
  { target: '[data-tutorial="affiliate-header"]', title: 'Formulário de Indicação', content: 'Personalize a aparência do formulário usado pelos líderes para indicar contatos.', placement: 'bottom', disableBeacon: true },
  { target: '[data-tutorial="affiliate-cover"]', title: 'Imagem de Capa', content: 'Upload de imagem que aparece no topo do formulário com efeito de fade.', placement: 'bottom' },
  { target: '[data-tutorial="affiliate-logo"]', title: 'Logo', content: 'Logo centralizada sobre a imagem de capa. PNG transparente recomendado.', placement: 'top' },
];

export default function AffiliateFormSettings() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const { restartTutorial } = useTutorial("affiliate-form-settings", affiliateFormTutorialSteps);

  // Buscar configurações
  const { data: settings, isLoading } = useQuery({
    queryKey: ["app_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("id, affiliate_form_cover_url, affiliate_form_logo_url")
        .limit(1)
        .single();
      
      if (error) throw error;
      return data;
    }
  });

  // Mutation para atualizar settings
  const updateSettings = useMutation({
    mutationFn: async (updates: { affiliate_form_cover_url?: string | null; affiliate_form_logo_url?: string | null }) => {
      if (!settings?.id) throw new Error("Settings not found");
      
      const { error } = await supabase
        .from("app_settings")
        .update(updates)
        .eq("id", settings.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["app_settings"] });
    },
    onError: (error) => {
      console.error("Erro ao atualizar configuração:", error);
      toast.error("Erro ao atualizar configuração.");
    }
  });

  const handleCoverUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem válido.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 5MB.");
      return;
    }

    setIsUploadingCover(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `affiliate-form-cover-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("event-covers")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("event-covers")
        .getPublicUrl(fileName);

      await updateSettings.mutateAsync({ affiliate_form_cover_url: urlData.publicUrl });
      toast.success("Imagem de capa atualizada!");
    } catch (error) {
      console.error("Erro ao fazer upload:", error);
      toast.error("Erro ao fazer upload da imagem.");
    } finally {
      setIsUploadingCover(false);
    }
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem válido.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("A logo deve ter no máximo 2MB.");
      return;
    }

    setIsUploadingLogo(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `affiliate-form-logo-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("event-covers")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("event-covers")
        .getPublicUrl(fileName);

      await updateSettings.mutateAsync({ affiliate_form_logo_url: urlData.publicUrl });
      toast.success("Logo atualizada!");
    } catch (error) {
      console.error("Erro ao fazer upload:", error);
      toast.error("Erro ao fazer upload da logo.");
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleRemoveCover = async () => {
    if (!settings?.affiliate_form_cover_url) return;
    
    try {
      const urlParts = settings.affiliate_form_cover_url.split("/");
      const fileName = urlParts[urlParts.length - 1];
      
      await supabase.storage.from("event-covers").remove([fileName]);
      await updateSettings.mutateAsync({ affiliate_form_cover_url: null });
      toast.success("Imagem de capa removida!");
    } catch (error) {
      console.error("Erro ao remover capa:", error);
      toast.error("Erro ao remover imagem de capa.");
    }
  };

  const handleRemoveLogo = async () => {
    if (!settings?.affiliate_form_logo_url) return;
    
    try {
      const urlParts = settings.affiliate_form_logo_url.split("/");
      const fileName = urlParts[urlParts.length - 1];
      
      await supabase.storage.from("event-covers").remove([fileName]);
      await updateSettings.mutateAsync({ affiliate_form_logo_url: null });
      toast.success("Logo removida! Será usada a logo padrão.");
    } catch (error) {
      console.error("Erro ao remover logo:", error);
      toast.error("Erro ao remover logo.");
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <TutorialOverlay page="affiliate-form-settings" />
      {/* Header */}
      <div className="flex items-center gap-4 mb-6" data-tutorial="affiliate-header">
        <Button variant="ghost" size="icon" onClick={() => navigate("/settings")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Formulário de Indicação</h1>
          <p className="text-muted-foreground">
            Configure a aparência do formulário de cadastro via link de líder
          </p>
        </div>
        <TutorialButton onClick={restartTutorial} />
      </div>

      <div className="space-y-6">
        {/* Cover Image Card */}
        <Card data-tutorial="affiliate-cover">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Image className="h-5 w-5 text-primary" />
              Imagem de Capa
            </CardTitle>
            <CardDescription>
              Esta imagem aparecerá no topo do formulário com um efeito de fade.
              Recomendamos uma imagem de 1200x400 pixels.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {settings?.affiliate_form_cover_url ? (
              <div className="relative">
                <img 
                  src={settings.affiliate_form_cover_url} 
                  alt="Capa do formulário"
                  className="w-full h-48 object-cover rounded-lg border"
                />
                <div className="absolute top-2 right-2 flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => window.open(settings.affiliate_form_cover_url!, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleRemoveCover}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="w-full h-48 bg-muted rounded-lg border-2 border-dashed border-muted-foreground/25 flex flex-col items-center justify-center">
                <Image className="h-12 w-12 text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">Nenhuma imagem configurada</p>
                <p className="text-xs text-muted-foreground mt-1">Será exibido um gradiente padrão</p>
              </div>
            )}

            <div className="flex items-center gap-4">
              <Label htmlFor="cover-upload" className="cursor-pointer">
                <div className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors">
                  {isUploadingCover ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {isUploadingCover ? "Enviando..." : "Fazer Upload"}
                </div>
                <Input
                  id="cover-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleCoverUpload}
                  disabled={isUploadingCover}
                />
              </Label>
              <span className="text-sm text-muted-foreground">
                JPG, PNG ou WebP (máx. 5MB)
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Logo Card */}
        <Card data-tutorial="affiliate-logo">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-primary" />
              Logo do Formulário
            </CardTitle>
            <CardDescription>
              Esta logo aparecerá centralizada sobre a imagem de capa.
              Recomendamos um PNG com fundo transparente para melhor resultado.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-6">
              {/* Preview */}
              <div className="w-32 h-32 bg-muted rounded-lg border flex items-center justify-center p-4">
                {settings?.affiliate_form_logo_url ? (
                  <img 
                    src={settings.affiliate_form_logo_url} 
                    alt="Logo do formulário"
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  <ImageIcon className="h-12 w-12 text-muted-foreground/50" />
                )}
              </div>
              
              <div className="flex-1 space-y-3">
                {settings?.affiliate_form_logo_url ? (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <span>Logo personalizada configurada</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Nenhuma logo configurada</span>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <Label htmlFor="logo-upload" className="cursor-pointer">
                    <div className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors">
                      {isUploadingLogo ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      {isUploadingLogo ? "Enviando..." : "Upload Logo"}
                    </div>
                    <Input
                      id="logo-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleLogoUpload}
                      disabled={isUploadingLogo}
                    />
                  </Label>
                  
                  {settings?.affiliate_form_logo_url && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRemoveLogo}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Usar Padrão
                    </Button>
                  )}
                </div>
                
                <p className="text-xs text-muted-foreground">
                  PNG com transparência recomendado (máx. 2MB)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Preview Link */}
        <Card>
          <CardHeader>
            <CardTitle>Pré-visualização</CardTitle>
            <CardDescription>
              Visualize como o formulário aparecerá para os usuários
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Para testar o formulário, você precisa de um link de líder válido.
              Acesse a página de Campanhas {">"} Links de Líderes para copiar um link.
            </p>
            <Link to="/campaigns">
              <Button variant="outline">
                <ExternalLink className="h-4 w-4 mr-2" />
                Ir para Campanhas
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
