import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Download, Copy, Link2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import QRCode from 'qrcode';
import { generateEventRegistrationUrl } from "@/lib/urlHelper";
import { useTenantDomain } from "@/hooks/useTenantDomain";

interface EventQRCodeProps {
  event: {
    id: string;
    name: string;
    slug: string;
    date: string;
    category: string;
  };
}

// Função para gerar código randômico
const generateTrackingCode = (eventId: string, eventName: string) => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  const eventPrefix = eventName
    .substring(0, 3)
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
  const eventIdShort = eventId.substring(0, 8).toUpperCase();

  return `${eventPrefix}${eventIdShort}${random}${timestamp.substring(0, 4).toUpperCase()}`;
};

const EventQRCode = ({ event }: EventQRCodeProps) => {
  const [trackingCode] = useState(() => generateTrackingCode(event.id, event.name));
  const [eventQR, setEventQR] = useState<string>("");
  const { toast } = useToast();

  // URL do evento
  const eventURL = generateEventRegistrationUrl(event.slug, event.id, trackingCode);

  useEffect(() => {
    const generateQRCode = async () => {
      try {
        const qrData = await QRCode.toDataURL(eventURL, {
          width: 256,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });

        setEventQR(qrData);
      } catch (error) {
        console.error('Erro ao gerar QR code:', error);
      }
    };

    generateQRCode();
  }, [eventURL]);

  const downloadQRCode = async () => {
    try {
      const eventIdShort = event.id.substring(0, 8);
      const filename = `qr-evento-${eventIdShort}-${trackingCode}`;

      // Gerar QR code em alta definição
      const qrDataURL = await QRCode.toDataURL(eventURL, {
        width: 1024,
        margin: 4,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      // Download
      const link = document.createElement('a');
      link.download = `${filename}.png`;
      link.href = qrDataURL;
      link.click();

      toast({
        title: "QR Code baixado!",
        description: "QR Code do evento salvo em alta definição."
      });
    } catch (error) {
      toast({
        title: "Erro ao baixar",
        description: "Não foi possível gerar o QR Code.",
        variant: "destructive"
      });
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(eventURL);
    toast({
      title: "Link copiado!",
      description: "Link do evento copiado para a área de transferência."
    });
  };

  return (
    <div className="w-full space-y-3">
      {/* QR Code do Evento */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center text-sm">
            <Link2 className="h-4 w-4 mr-2 text-blue-600" />
            QR Code do Evento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-center">
            <Badge variant="secondary" className="text-xs font-mono mb-2">
              {trackingCode}
            </Badge>
          </div>

          {eventQR && (
            <div className="bg-white p-3 rounded-lg border text-center">
              <img
                src={eventQR}
                alt="QR Code do Evento"
                className="w-24 h-24 mx-auto"
              />
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={downloadQRCode}
            className="w-full text-xs"
          >
            <Download className="h-3 w-3 mr-2" />
            Baixar QR Code
          </Button>
        </CardContent>
      </Card>

      {/* Link de Cadastro */}
      <Button
        variant="secondary"
        size="sm"
        onClick={copyToClipboard}
        className="w-full text-xs"
      >
        <Copy className="h-3 w-3 mr-2" />
        Copiar Link
      </Button>
    </div>
  );
};

export default EventQRCode;
