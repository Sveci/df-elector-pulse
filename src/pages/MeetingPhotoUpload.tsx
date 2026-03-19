import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Camera, Upload, CheckCircle2, Loader2, AlertCircle, Image } from "lucide-react";
import { toast } from "sonner";

export default function MeetingPhotoUpload() {
  const { token } = useParams<{ token: string }>();
  const [tokenData, setTokenData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function validateToken() {
      if (!token) {
        setError("Token inválido");
        setLoading(false);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from("office_meeting_upload_tokens")
        .select("*, visit:office_visits(id, protocolo, contact:office_contacts(nome))")
        .eq("token", token)
        .maybeSingle();

      if (fetchError || !data) {
        setError("Token não encontrado ou inválido");
        setLoading(false);
        return;
      }

      if (data.used_at) {
        setError("Este link já foi utilizado");
        setLoading(false);
        return;
      }

      if (new Date(data.expires_at) < new Date()) {
        setError("Este link expirou. Gere um novo QR Code no sistema.");
        setLoading(false);
        return;
      }

      setTokenData(data);
      setLoading(false);
    }

    validateToken();
  }, [token]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Selecione apenas imagens");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Imagem deve ter no máximo 10MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    const file = fileInputRef.current?.files?.[0] || cameraInputRef.current?.files?.[0];
    if (!file || !tokenData) return;

    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const filePath = `${tokenData.visit_id}/${Date.now()}.${ext}`;

      // Upload photo to storage
      const { error: uploadError } = await supabase.storage
        .from("meeting-photos")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("meeting-photos")
        .getPublicUrl(filePath);

      const photoUrl = urlData.publicUrl;

      // Check if meeting minutes exist for this visit
      const { data: existingMinutes } = await supabase
        .from("office_meeting_minutes")
        .select("id")
        .eq("visit_id", tokenData.visit_id)
        .maybeSingle();

      let minutesId: string;

      if (existingMinutes) {
        // Update existing minutes with photo
        const { error: updateError } = await supabase
          .from("office_meeting_minutes")
          .update({ photo_path: filePath })
          .eq("id", existingMinutes.id);
        if (updateError) throw updateError;
        minutesId = existingMinutes.id;
      } else {
        // Create new minutes entry with photo
        const { data: newMinutes, error: insertError } = await supabase
          .from("office_meeting_minutes")
          .insert({
            visit_id: tokenData.visit_id,
            content_type: "photo",
            photo_path: filePath,
          })
          .select("id")
          .single();
        if (insertError) throw insertError;
        minutesId = newMinutes.id;
      }

      // Mark token as used
      await supabase
        .from("office_meeting_upload_tokens")
        .update({ used_at: new Date().toISOString() })
        .eq("id", tokenData.id);

      // Trigger AI transcription in background
      supabase.functions.invoke("transcribe-meeting-photo", {
        body: {
          photo_url: photoUrl,
          visit_id: tokenData.visit_id,
          minutes_id: minutesId,
        },
      }).catch(err => console.warn("Transcription background error:", err));

      setUploaded(true);
      toast.success("Foto enviada com sucesso!");
    } catch (err: any) {
      console.error("Upload error:", err);
      toast.error("Erro ao enviar foto: " + (err.message || "Erro desconhecido"));
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-16 w-16 mx-auto mb-4 text-destructive" />
            <h2 className="text-xl font-bold mb-2">Link Inválido</h2>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (uploaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <CheckCircle2 className="h-16 w-16 mx-auto mb-4 text-green-500" />
            <h2 className="text-xl font-bold mb-2">Foto Enviada!</h2>
            <p className="text-muted-foreground">
              A foto foi enviada com sucesso e será transcrita automaticamente pela IA.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const visitContact = (tokenData?.visit as any)?.contact;
  const visitProtocolo = (tokenData?.visit as any)?.protocolo;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">📸 Enviar Foto da Ata</CardTitle>
          <CardDescription>
            {visitProtocolo && (
              <span className="block font-mono text-primary font-semibold">{visitProtocolo}</span>
            )}
            {visitContact?.nome && (
              <span className="block mt-1">Visita de: {visitContact.nome}</span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {preview ? (
            <div className="relative">
              <img
                src={preview}
                alt="Preview"
                className="w-full rounded-lg border max-h-[400px] object-contain"
              />
              <Button
                variant="outline"
                size="sm"
                className="absolute top-2 right-2"
                onClick={() => {
                  setPreview(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                  if (cameraInputRef.current) cameraInputRef.current.value = "";
                }}
              >
                Trocar
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="h-32 flex flex-col gap-2"
                onClick={() => cameraInputRef.current?.click()}
              >
                <Camera className="h-8 w-8" />
                <span className="text-sm">Tirar Foto</span>
              </Button>
              <Button
                variant="outline"
                className="h-32 flex flex-col gap-2"
                onClick={() => fileInputRef.current?.click()}
              >
                <Image className="h-8 w-8" />
                <span className="text-sm">Galeria</span>
              </Button>
            </div>
          )}

          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileSelect}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
          />

          {preview && (
            <Button
              className="w-full"
              onClick={handleUpload}
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Enviar Foto
                </>
              )}
            </Button>
          )}

          <p className="text-xs text-muted-foreground text-center">
            Este link é válido por 2 horas. A foto será transcrita automaticamente por IA.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
