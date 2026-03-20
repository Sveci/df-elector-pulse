import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Camera, Send, Mail, MessageSquare, Users, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { useSendEventPhotos } from "@/hooks/events/useSendEventPhotos";

interface SendEventPhotosDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: {
    id: string;
    name: string;
    checkedin_count?: number;
  } | null;
}

export function SendEventPhotosDialog({ open, onOpenChange, event }: SendEventPhotosDialogProps) {
  const [photoUrl, setPhotoUrl] = useState("");
  const [sendSms, setSendSms] = useState(true);
  const [sendEmail, setSendEmail] = useState(true);
  const [checkedInCount, setCheckedInCount] = useState<number>(0);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [sendResult, setSendResult] = useState<{
    smsSent: number;
    emailSent: number;
  } | null>(null);

  const { sendEventPhotos, getCheckedInCount, isLoading } = useSendEventPhotos();

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open && event) {
      setPhotoUrl("");
      setSendSms(true);
      setSendEmail(true);
      setShowConfirmation(false);
      setSendResult(null);

      // Get accurate checked-in count
      getCheckedInCount(event.id).then(count => {
        setCheckedInCount(count);
      });
    }
  }, [open, event]);

  // Use the passed count as fallback
  useEffect(() => {
    if (event?.checkedin_count !== undefined && checkedInCount === 0) {
      setCheckedInCount(event.checkedin_count);
    }
  }, [event?.checkedin_count]);

  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleContinue = () => {
    if (!isValidUrl(photoUrl)) return;
    if (!sendSms && !sendEmail) return;
    setShowConfirmation(true);
  };

  const handleSend = async () => {
    if (!event) return;

    const result = await sendEventPhotos({
      eventId: event.id,
      photoUrl,
      sendSms,
      sendEmail
    });

    if (result) {
      setSendResult({
        smsSent: result.smsSent,
        emailSent: result.emailSent
      });
    }
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  if (!event) return null;

  // Success state
  if (sendResult) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Fotos enviadas!
            </DialogTitle>
          </DialogHeader>

          <div className="py-6 text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
              <Camera className="h-8 w-8 text-green-600" />
            </div>

            <div className="space-y-2">
              <p className="text-lg font-medium">
                Envio realizado com sucesso!
              </p>
              <div className="flex justify-center gap-6 text-sm text-muted-foreground">
                {sendResult.smsSent > 0 && (
                  <div className="flex items-center gap-1">
                    <MessageSquare className="h-4 w-4" />
                    {sendResult.smsSent} SMS
                  </div>
                )}
                {sendResult.emailSent > 0 && (
                  <div className="flex items-center gap-1">
                    <Mail className="h-4 w-4" />
                    {sendResult.emailSent} emails
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-center">
            <Button onClick={handleClose}>Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Confirmation state
  if (showConfirmation) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar envio</DialogTitle>
            <DialogDescription>
              Revise os detalhes antes de enviar
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Evento:</span>
                <span className="font-medium">{event.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Destinatários:</span>
                <span className="font-medium flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {checkedInCount} participantes
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Canais:</span>
                <div className="flex gap-2">
                  {sendSms && (
                    <span className="bg-primary/10 text-primary text-xs px-2 py-1 rounded flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" /> SMS
                    </span>
                  )}
                  {sendEmail && (
                    <span className="bg-primary/10 text-primary text-xs px-2 py-1 rounded flex items-center gap-1">
                      <Mail className="h-3 w-3" /> Email
                    </span>
                  )}
                </div>
              </div>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Esta ação enviará mensagens para todos os {checkedInCount} participantes que realizaram check-in.
              </AlertDescription>
            </Alert>
          </div>

          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => setShowConfirmation(false)}
              disabled={isLoading}
            >
              Voltar
            </Button>
            <Button
              onClick={handleSend}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Confirmar envio
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Initial form state
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Enviar fotos do evento
          </DialogTitle>
          <DialogDescription>
            Compartilhe as fotos com os participantes que fizeram check-in
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Event info */}
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="font-medium">{event.name}</p>
            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
              <Users className="h-4 w-4" />
              {checkedInCount} participantes com check-in
            </p>
          </div>

          {/* Photo URL input */}
          <div className="space-y-2">
            <Label htmlFor="photoUrl">Link das fotos *</Label>
            <Input
              id="photoUrl"
              type="url"
              placeholder="https://drive.google.com/..."
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Cole o link do álbum de fotos (Google Drive, OneDrive, Flickr, etc.)
            </p>
          </div>

          {/* Channel selection */}
          <div className="space-y-3">
            <Label>Canais de envio</Label>

            <div className="flex items-center space-x-3 p-3 border rounded-lg">
              <Checkbox
                id="sendSms"
                checked={sendSms}
                onCheckedChange={(checked) => setSendSms(checked === true)}
              />
              <div className="flex-1">
                <label htmlFor="sendSms" className="text-sm font-medium cursor-pointer flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-green-600" />
                  Enviar por SMS
                </label>
                <p className="text-xs text-muted-foreground">
                  Link será automaticamente encurtado
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-3 border rounded-lg">
              <Checkbox
                id="sendEmail"
                checked={sendEmail}
                onCheckedChange={(checked) => setSendEmail(checked === true)}
              />
              <div className="flex-1">
                <label htmlFor="sendEmail" className="text-sm font-medium cursor-pointer flex items-center gap-2">
                  <Mail className="h-4 w-4 text-blue-600" />
                  Enviar por E-mail
                </label>
                <p className="text-xs text-muted-foreground">
                  Email com botão para acessar as fotos
                </p>
              </div>
            </div>
          </div>

          {/* Validation messages */}
          {photoUrl && !isValidUrl(photoUrl) && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Insira uma URL válida (ex: https://drive.google.com/...)
              </AlertDescription>
            </Alert>
          )}

          {!sendSms && !sendEmail && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Selecione pelo menos um canal de envio
              </AlertDescription>
            </Alert>
          )}

          {checkedInCount === 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Nenhum participante realizou check-in neste evento
              </AlertDescription>
            </Alert>
          )}
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleContinue}
            disabled={!isValidUrl(photoUrl) || (!sendSms && !sendEmail) || checkedInCount === 0}
          >
            Continuar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
