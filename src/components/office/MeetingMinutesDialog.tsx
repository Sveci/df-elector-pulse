import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useVisitMeetingActions } from "@/hooks/office/useVisitMeetingActions";
import { FileText, Upload, Loader2, QrCode, Camera, Copy } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import QRCodeLib from "qrcode";

interface MeetingMinutesDialogProps {
  visit: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MeetingMinutesDialog({
  visit,
  open,
  onOpenChange,
}: MeetingMinutesDialogProps) {
  const [contentType, setContentType] = useState<"text" | "file">("text");
  const [contentText, setContentText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const { saveMeetingMinutes } = useVisitMeetingActions();
  const [photoQr, setPhotoQr] = useState<string | null>(null);
  const [photoLink, setPhotoLink] = useState<string | null>(null);
  const [generatingQr, setGeneratingQr] = useState(false);

  // Reset state when dialog opens
  useEffect(() => {
    if (!open) {
      setPhotoQr(null);
      setPhotoLink(null);
    }
  }, [open]);

  if (!visit) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const validTypes = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
      if (!validTypes.includes(selectedFile.type)) {
        toast.error("Apenas arquivos PDF ou DOCX são permitidos");
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleSave = () => {
    if (contentType === "text" && !contentText.trim()) {
      toast.error("Digite o texto da ata");
      return;
    }
    if (contentType === "file" && !file) {
      toast.error("Selecione um arquivo");
      return;
    }

    saveMeetingMinutes.mutate(
      {
        visitId: visit.id,
        contentType,
        contentText: contentType === "text" ? contentText : undefined,
        file: contentType === "file" ? file : undefined,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          setContentText("");
          setFile(null);
        },
      }
    );
  };

  const handleGeneratePhotoQr = async () => {
    setGeneratingQr(true);
    try {
      // Create upload token
      const { data: session } = await supabase.auth.getSession();
      const { data: tokenData, error } = await supabase
        .from("office_meeting_upload_tokens")
        .insert({
          visit_id: visit.id,
          created_by: session?.session?.user?.id,
        })
        .select("token")
        .single();

      if (error) throw error;

      const uploadUrl = `${window.location.origin}/meeting-photo-upload/${tokenData.token}`;
      setPhotoLink(uploadUrl);

      const qrDataUrl = await QRCodeLib.toDataURL(uploadUrl);
      setPhotoQr(qrDataUrl);

      toast.success("QR Code gerado! Escaneie com o celular.");
    } catch (err: any) {
      console.error("Error generating QR:", err);
      toast.error("Erro ao gerar QR Code");
    } finally {
      setGeneratingQr(false);
    }
  };

  const handleCopyPhotoLink = () => {
    if (photoLink) {
      navigator.clipboard.writeText(photoLink);
      toast.success("Link copiado!");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Cadastrar Ata da Reunião</DialogTitle>
          <DialogDescription>
            Registre a documentação da reunião realizada
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={contentType}
          onValueChange={(value) => setContentType(value as "text" | "file")}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="text">
              <FileText className="mr-2 h-4 w-4" />
              Texto
            </TabsTrigger>
            <TabsTrigger value="file">
              <Upload className="mr-2 h-4 w-4" />
              Arquivo
            </TabsTrigger>
          </TabsList>

          <TabsContent value="text" className="space-y-4 mt-4">
            <div>
              <Label htmlFor="content-text">Conteúdo da Ata</Label>
              <Textarea
                id="content-text"
                placeholder="Digite ou cole o texto da ata aqui..."
                value={contentText}
                onChange={(e) => setContentText(e.target.value)}
                className="min-h-[300px] mt-2"
              />
            </div>
          </TabsContent>

          <TabsContent value="file" className="space-y-4 mt-4">
            <div>
              <Label htmlFor="file-upload">Arquivo da Ata</Label>
              <div className="mt-2">
                <input
                  id="file-upload"
                  type="file"
                  accept=".pdf,.docx"
                  onChange={handleFileChange}
                  className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                />
              </div>
              {file && (
                <div className="mt-2 p-3 bg-muted rounded-md text-sm">
                  <strong>Arquivo selecionado:</strong> {file.name}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                Formatos aceitos: PDF, DOCX
              </p>
            </div>
          </TabsContent>
        </Tabs>

        {/* Photo Upload via QR Code */}
        <div className="border-t pt-4 mt-2">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Camera className="h-4 w-4" />
                Foto da Ata (via celular)
              </h4>
              <p className="text-xs text-muted-foreground">
                Escaneie o QR Code com o celular para enviar uma foto da ata manuscrita
              </p>
            </div>
            {!photoQr && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleGeneratePhotoQr}
                disabled={generatingQr}
              >
                {generatingQr ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <QrCode className="mr-2 h-4 w-4" />
                    Gerar QR Code
                  </>
                )}
              </Button>
            )}
          </div>

          {photoQr && (
            <div className="flex flex-col items-center gap-3 p-4 bg-muted rounded-lg">
              <img src={photoQr} alt="QR Code Upload" className="w-48 h-48" />
              <p className="text-xs text-muted-foreground text-center">
                Escaneie com a câmera do celular para enviar a foto
              </p>
              <Button variant="outline" size="sm" onClick={handleCopyPhotoLink}>
                <Copy className="mr-2 h-3 w-3" />
                Copiar Link
              </Button>
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1"
            disabled={saveMeetingMinutes.isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            className="flex-1"
            disabled={saveMeetingMinutes.isPending}
          >
            {saveMeetingMinutes.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              "Salvar e Finalizar Reunião"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
