import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LeaderAutocomplete } from "@/components/office/LeaderAutocomplete";
import { Copy, Download, QrCode as QrCodeIcon, FileText, Crown } from "lucide-react";
import { generateEventAffiliateUrl } from "@/lib/urlHelper";
import { useTenantDomain } from "@/hooks/useTenantDomain";
import { useToast } from "@/hooks/use-toast";
import QRCodeComponent from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import jsPDF from "jspdf";

interface EventAffiliateDialogProps {
  event: {
    id: string;
    slug: string;
    name: string;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EventAffiliateDialog({ event, open, onOpenChange }: EventAffiliateDialogProps) {
  const tenantDomain = useTenantDomain();
  const [selectedLeaderId, setSelectedLeaderId] = useState("");
  const [affiliateUrl, setAffiliateUrl] = useState("");
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isGeneratingCoordinatorsPdf, setIsGeneratingCoordinatorsPdf] = useState(false);
  const { toast } = useToast();

  const handleGenerateLink = async () => {
    if (!selectedLeaderId) {
      toast({
        title: "Selecione um líder",
        description: "Escolha o líder que receberá o link de afiliado.",
        variant: "destructive"
      });
      return;
    }

    try {
      // Buscar o affiliate_token do líder usando o cliente já importado
      const { data: leader, error } = await supabase
        .from("lideres")
        .select("affiliate_token")
        .eq("id", selectedLeaderId)
        .single();

      if (error) {
        console.error("Erro ao buscar líder:", error);
        toast({
          title: "Erro",
          description: "Não foi possível buscar os dados do líder. Tente novamente.",
          variant: "destructive"
        });
        return;
      }

      if (!leader?.affiliate_token) {
        toast({
          title: "Erro",
          description: "Não foi possível gerar o link. Líder sem token de afiliado.",
          variant: "destructive"
        });
        return;
      }

    const url = generateEventAffiliateUrl(event.slug, leader.affiliate_token, tenantDomain);
    setAffiliateUrl(url);

    // Gerar QR Code
    try {
      const qrData = await QRCodeComponent.toDataURL(url, {
        width: 300,
        margin: 2,
      });
      setQrCodeUrl(qrData);
    } catch (error) {
      console.error("Erro ao gerar QR Code:", error);
    }

      toast({
        title: "Link gerado!",
        description: "Link do líder criado com sucesso."
      });
    } catch (error) {
      console.error("Erro inesperado ao gerar link:", error);
      toast({
        title: "Erro",
        description: "Ocorreu um erro inesperado. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(affiliateUrl);
    toast({
      title: "Link copiado!",
      description: "O link foi copiado para a área de transferência."
    });
  };

  const handleDownloadQR = () => {
    if (!qrCodeUrl) return;

    const link = document.createElement("a");
    link.download = `qr-evento-${event.slug}.png`;
    link.href = qrCodeUrl;
    link.click();

    toast({
      title: "QR Code baixado!",
      description: "O QR Code foi salvo no seu dispositivo."
    });
  };

  const handleGeneratePdfForAll = async () => {
    setIsGeneratingPdf(true);
    try {
      // Buscar todos os líderes ativos com affiliate_token
      const { data: leaders, error } = await supabase
        .from("lideres")
        .select("id, nome_completo, affiliate_token, cidade:office_cities(nome)")
        .eq("is_active", true)
        .not("affiliate_token", "is", null)
        .order("nome_completo");

      if (error) throw error;
      if (!leaders || leaders.length === 0) {
        toast({
          title: "Nenhum líder encontrado",
          description: "Não há líderes ativos com token de afiliado.",
          variant: "destructive"
        });
        return;
      }

      // Criar PDF
      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      let yPosition = margin;

      // Título
      pdf.setFontSize(16);
      pdf.setFont("helvetica", "bold");
      pdf.text(`Links do Evento: ${event.name}`, margin, yPosition);
      yPosition += 10;

      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.text(`Total de líderes: ${leaders.length}`, margin, yPosition);
      yPosition += 15;

      // Processar cada líder
      for (let i = 0; i < leaders.length; i++) {
        const leader = leaders[i];
        const url = generateEventAffiliateUrl(event.slug, leader.affiliate_token!, tenantDomain);

        // Verificar se precisa de nova página
        if (yPosition > pageHeight - 80) {
          pdf.addPage();
          yPosition = margin;
        }

        // Gerar QR Code
        const qrDataUrl = await QRCodeComponent.toDataURL(url, {
          width: 200,
          margin: 1,
        });

        // Adicionar QR Code
        pdf.addImage(qrDataUrl, "PNG", margin, yPosition, 40, 40);

        // Adicionar informações do líder
        const textX = margin + 45;
        pdf.setFontSize(12);
        pdf.setFont("helvetica", "bold");
        pdf.text(`Líder: ${leader.nome_completo}`, textX, yPosition + 5);

        pdf.setFontSize(9);
        pdf.setFont("helvetica", "normal");
        if (leader.cidade) {
          pdf.text(`Cidade: ${leader.cidade.nome}`, textX, yPosition + 12);
        }

        pdf.setFontSize(8);
        pdf.setTextColor(100);
        pdf.text(url, textX, yPosition + 20, { maxWidth: pageWidth - textX - margin });
        pdf.setTextColor(0);

        yPosition += 50;

        // Adicionar linha separadora
        if (i < leaders.length - 1) {
          pdf.setDrawColor(200);
          pdf.line(margin, yPosition, pageWidth - margin, yPosition);
          yPosition += 10;
        }
      }

      // Download
      pdf.save(`links-lideres-${event.slug}.pdf`);

      toast({
        title: "PDF gerado!",
        description: `PDF com links de ${leaders.length} líderes foi baixado.`
      });
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast({
        title: "Erro ao gerar PDF",
        description: "Não foi possível gerar o PDF com os links.",
        variant: "destructive"
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleGeneratePdfForCoordinators = async () => {
    setIsGeneratingCoordinatorsPdf(true);
    try {
      const { data: coordinators, error } = await supabase
        .from("lideres")
        .select("id, nome_completo, affiliate_token, cidade:office_cities(nome)")
        .eq("is_active", true)
        .eq("is_coordinator", true)
        .not("affiliate_token", "is", null)
        .order("nome_completo");

      if (error) throw error;
      if (!coordinators || coordinators.length === 0) {
        toast({
          title: "Nenhum coordenador encontrado",
          description: "Não há coordenadores ativos com token de afiliado.",
          variant: "destructive"
        });
        return;
      }

      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      let yPosition = margin;

      pdf.setFontSize(16);
      pdf.setFont("helvetica", "bold");
      pdf.text(`Links do Evento: ${event.name}`, margin, yPosition);
      yPosition += 10;

      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.text(`Total de coordenadores: ${coordinators.length}`, margin, yPosition);
      yPosition += 15;

      for (let i = 0; i < coordinators.length; i++) {
        const coordinator = coordinators[i];
        const url = generateEventAffiliateUrl(event.slug, coordinator.affiliate_token!, tenantDomain);

        if (yPosition > pageHeight - 80) {
          pdf.addPage();
          yPosition = margin;
        }

        const qrDataUrl = await QRCodeComponent.toDataURL(url, {
          width: 200,
          margin: 1,
        });

        pdf.addImage(qrDataUrl, "PNG", margin, yPosition, 40, 40);

        const textX = margin + 45;
        pdf.setFontSize(12);
        pdf.setFont("helvetica", "bold");
        pdf.text(`Coordenador: ${coordinator.nome_completo}`, textX, yPosition + 5);

        pdf.setFontSize(9);
        pdf.setFont("helvetica", "normal");
        if (coordinator.cidade) {
          pdf.text(`Cidade: ${coordinator.cidade.nome}`, textX, yPosition + 12);
        }

        pdf.setFontSize(8);
        pdf.setTextColor(100);
        pdf.text(url, textX, yPosition + 20, { maxWidth: pageWidth - textX - margin });
        pdf.setTextColor(0);

        yPosition += 50;

        if (i < coordinators.length - 1) {
          pdf.setDrawColor(200);
          pdf.line(margin, yPosition, pageWidth - margin, yPosition);
          yPosition += 10;
        }
      }

      pdf.save(`links-coordenadores-${event.slug}.pdf`);

      toast({
        title: "PDF gerado!",
        description: `PDF com links de ${coordinators.length} coordenadores foi baixado.`
      });
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast({
        title: "Erro ao gerar PDF",
        description: "Não foi possível gerar o PDF com os links.",
        variant: "destructive"
      });
    } finally {
      setIsGeneratingCoordinatorsPdf(false);
    }
  };

  const handleClose = () => {
    setSelectedLeaderId("");
    setAffiliateUrl("");
    setQrCodeUrl("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Gerar Link do Líder</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div>
            <p className="text-sm text-muted-foreground mb-4">
              Selecione o líder que receberá o link personalizado para o evento <strong>{event.name}</strong>.
              As inscrições feitas através deste link serão atribuídas ao líder selecionado.
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleGeneratePdfForAll}
              variant="outline"
              className="flex-1"
              disabled={isGeneratingPdf}
            >
              <FileText className="h-4 w-4 mr-2" />
              {isGeneratingPdf ? "Gerando PDF..." : "Gerar PDF para Todos os Líderes"}
            </Button>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleGeneratePdfForCoordinators}
              variant="outline"
              className="flex-1"
              disabled={isGeneratingCoordinatorsPdf}
            >
              <Crown className="h-4 w-4 mr-2" />
              {isGeneratingCoordinatorsPdf ? "Gerando PDF..." : "Gerar PDF para Coordenadores"}
            </Button>
          </div>

          <div className="space-y-4">
            <div>
              <Label>Líder</Label>
              <LeaderAutocomplete
                value={selectedLeaderId}
                onValueChange={setSelectedLeaderId}
                placeholder="Busque por nome do líder..."
                allowAllLeaders={true}
              />
            </div>

            <Button onClick={handleGenerateLink} className="w-full">
              Gerar Link do Líder
            </Button>
          </div>

          {affiliateUrl && (
            <div className="space-y-4 pt-4 border-t border-border">
              <div>
                <Label>Link Gerado</Label>
                <div className="flex gap-2 mt-2">
                  <Input value={affiliateUrl} readOnly className="flex-1" />
                  <Button variant="outline" size="icon" onClick={handleCopyLink}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {qrCodeUrl && (
                <div className="flex flex-col items-center gap-4 p-4 bg-muted rounded-lg">
                  <img src={qrCodeUrl} alt="QR Code" className="w-48 h-48 border-4 border-background rounded-lg" />
                  <Button variant="outline" onClick={handleDownloadQR} className="w-full">
                    <Download className="h-4 w-4 mr-2" />
                    Baixar QR Code
                  </Button>
                  <p className="text-xs text-center text-muted-foreground">
                    O líder pode compartilhar este QR Code para facilitar o acesso ao link de inscrição
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
