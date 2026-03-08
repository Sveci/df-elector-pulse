import { useState, useEffect } from "react";
import QRCode from "qrcode";
import { Copy, Download, ExternalLink, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { generateLeaderRegistrationUrl } from "@/lib/urlHelper";
import { useTenantDomain } from "@/hooks/useTenantDomain";

interface LeaderRegistrationQRDialogProps {
  children: React.ReactNode;
}

export function LeaderRegistrationQRDialog({ children }: LeaderRegistrationQRDialogProps) {
  const tenantDomain = useTenantDomain();
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const registrationUrl = generateLeaderRegistrationUrl(tenantDomain);

  useEffect(() => {
    generateQRCode();
  }, []);

  async function generateQRCode() {
    try {
      const url = await QRCode.toDataURL(registrationUrl, {
        width: 400,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
      });
      setQrCodeUrl(url);
    } catch (error) {
      console.error("Erro ao gerar QR Code:", error);
    }
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(registrationUrl);
      setCopied(true);
      toast.success("Link copiado!");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("Erro ao copiar link");
    }
  }

  async function handleDownloadQR() {
    try {
      const highResUrl = await QRCode.toDataURL(registrationUrl, {
        width: 1024,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
      });

      const link = document.createElement("a");
      link.href = highResUrl;
      link.download = "qrcode-cadastro-lider.png";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("QR Code baixado!");
    } catch (error) {
      toast.error("Erro ao baixar QR Code");
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Formulário de Cadastro de Líder</DialogTitle>
          <DialogDescription>
            Compartilhe este QR Code ou link para permitir que novos líderes se cadastrem
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center space-y-4 py-4">
          {/* QR Code */}
          {qrCodeUrl && (
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <img
                src={qrCodeUrl}
                alt="QR Code do formulário de cadastro"
                className="w-48 h-48"
              />
            </div>
          )}

          {/* URL Preview */}
          <div className="w-full p-3 bg-muted rounded-lg">
            <p className="text-xs text-muted-foreground break-all text-center">
              {registrationUrl}
            </p>
          </div>

          {/* Ações */}
          <div className="flex gap-2 w-full">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleCopyLink}
            >
              {copied ? (
                <Check className="h-4 w-4 mr-2" />
              ) : (
                <Copy className="h-4 w-4 mr-2" />
              )}
              {copied ? "Copiado!" : "Copiar Link"}
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleDownloadQR}
            >
              <Download className="h-4 w-4 mr-2" />
              Baixar QR Code
            </Button>
          </div>

          <Button
            variant="secondary"
            className="w-full"
            onClick={() => window.open(registrationUrl, "_blank")}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Abrir Página
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
