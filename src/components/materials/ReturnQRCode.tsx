import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, QrCode } from "lucide-react";
import QRCodeLib from "qrcode";
import { buildWhatsAppLink } from "@/lib/whatsappLink";
import { useIntegrationsSettings } from "@/hooks/useIntegrationsSettings";

const DEFAULT_WA_PHONE = "556198189-4864";

interface ReturnQRCodeProps {
  confirmationCode: string;
  materialName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReturnQRCode({ confirmationCode, materialName, open, onOpenChange }: ReturnQRCodeProps) {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const { data: settings } = useIntegrationsSettings();

  const getSystemPhone = () => {
    if (!settings) return DEFAULT_WA_PHONE;
    const provider = settings.whatsapp_provider_active;
    if (provider === "meta_cloud" && settings.meta_cloud_phone) {
      return settings.meta_cloud_phone.replace(/\D/g, "");
    }
    if (settings.verification_wa_zapi_phone) {
      return settings.verification_wa_zapi_phone.replace(/\D/g, "");
    }
    return DEFAULT_WA_PHONE;
  };

  const waPhone = getSystemPhone();
  const whatsappMessage = `DEVOLVER ${confirmationCode}`;
  const whatsappLink = buildWhatsAppLink(waPhone, whatsappMessage);

  useEffect(() => {
    if (!open) return;
    QRCodeLib.toDataURL(whatsappLink, { width: 512, margin: 3, color: { dark: "#000000", light: "#FFFFFF" } })
      .then(setQrDataUrl)
      .catch(console.error);
  }, [whatsappLink, open]);

  const handleDownload = async () => {
    const hd = await QRCodeLib.toDataURL(whatsappLink, { width: 1024, margin: 4 });
    const link = document.createElement("a");
    link.download = `qr-devolucao-${confirmationCode}.png`;
    link.href = hd;
    link.click();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" /> QR Code de Devolução
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            Escaneie este QR Code para abrir o WhatsApp e enviar o código de confirmação de devolução.
          </p>
          <Badge variant="secondary" className="font-mono text-base px-3 py-1">
            {confirmationCode}
          </Badge>
          <p className="text-xs text-muted-foreground">{materialName}</p>
          {qrDataUrl && (
            <div className="bg-white p-4 rounded-lg border inline-block mx-auto">
              <img src={qrDataUrl} alt="QR Code Devolução" className="w-48 h-48 mx-auto" />
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Ao escanear, será enviado <strong>DEVOLVER {confirmationCode}</strong> no WhatsApp para confirmar a devolução.
          </p>
          <Button variant="outline" size="sm" className="w-full" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" /> Baixar QR Code
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
