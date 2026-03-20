import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Copy,
  Check,
  Search,
  Download,
  QrCode,
  Users,
  Loader2
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import type { Survey } from "@/hooks/surveys/useSurveys";

interface SurveyLeaderLinksDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  survey: Survey;
}

export function SurveyLeaderLinksDialog({ open, onOpenChange, survey }: SurveyLeaderLinksDialogProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const { data: leaders, isLoading } = useQuery({
    queryKey: ["leaders_for_survey_links"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lideres")
        .select("id, nome_completo, affiliate_token, cidade:office_cities(nome)")
        .eq("is_active", true)
        .order("nome_completo");

      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const baseUrl = window.location.origin;

  const getSurveyLink = (affiliateToken?: string) => {
    const url = `${baseUrl}/pesquisa/${survey.slug}`;
    return affiliateToken ? `${url}?ref=${affiliateToken}` : url;
  };

  const copyLink = async (leaderId: string, affiliateToken: string) => {
    const link = getSurveyLink(affiliateToken);
    await navigator.clipboard.writeText(link);
    setCopiedId(leaderId);
    toast.success("Link copiado!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const generatePdf = async () => {
    if (!leaders || leaders.length === 0) return;

    setGeneratingPdf(true);
    try {
      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      const qrSize = 50;
      const itemHeight = 70;

      let currentY = margin;
      let currentPage = 1;

      // Title
      pdf.setFontSize(16);
      pdf.setFont("helvetica", "bold");
      pdf.text(`Links de Pesquisa: ${survey.titulo}`, margin, currentY);
      currentY += 10;

      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")}`, margin, currentY);
      currentY += 15;

      for (let i = 0; i < leaders.length; i++) {
        const leader = leaders[i];
        if (!leader.affiliate_token) continue;

        // Check if we need a new page
        if (currentY + itemHeight > pageHeight - margin) {
          pdf.addPage();
          currentPage++;
          currentY = margin;
        }

        const link = getSurveyLink(leader.affiliate_token);

        // Generate QR code
        const qrDataUrl = await QRCode.toDataURL(link, { width: 200, margin: 1 });
        pdf.addImage(qrDataUrl, "PNG", margin, currentY, qrSize, qrSize);

        // Leader info
        const textX = margin + qrSize + 10;
        pdf.setFontSize(12);
        pdf.setFont("helvetica", "bold");
        pdf.text(leader.nome_completo, textX, currentY + 10);

        pdf.setFontSize(9);
        pdf.setFont("helvetica", "normal");
        if (leader.cidade) {
          pdf.text(`Região: ${(leader.cidade as any).nome}`, textX, currentY + 20);
        }

        pdf.setFontSize(8);
        pdf.setTextColor(100);

        // Wrap long URLs
        const maxWidth = pageWidth - textX - margin;
        const linkLines = pdf.splitTextToSize(link, maxWidth);
        pdf.text(linkLines, textX, currentY + 30);

        pdf.setTextColor(0);

        // Separator line
        currentY += itemHeight;
        if (i < leaders.length - 1) {
          pdf.setDrawColor(200);
          pdf.line(margin, currentY - 10, pageWidth - margin, currentY - 10);
        }
      }

      // Footer on each page
      const totalPages = pdf.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(150);
        pdf.text(
          `Página ${i} de ${totalPages}`,
          pageWidth / 2,
          pageHeight - 10,
          { align: "center" }
        );
      }

      pdf.save(`pesquisa-${survey.slug}-links-lideres.pdf`);
      toast.success("PDF gerado com sucesso!");
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast.error("Erro ao gerar PDF");
    } finally {
      setGeneratingPdf(false);
    }
  };

  const filteredLeaders = leaders?.filter(leader =>
    leader.nome_completo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (leader.cidade as any)?.nome?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Links de Afiliados - {survey.titulo}
          </DialogTitle>
          <DialogDescription>
            Distribua links personalizados para líderes compartilharem a pesquisa
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar líder..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button
            onClick={generatePdf}
            disabled={generatingPdf || !leaders || leaders.length === 0}
          >
            {generatingPdf ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            PDF com QR Codes
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-2">
          {isLoading ? (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
            </div>
          ) : filteredLeaders.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Nenhum líder encontrado</p>
            </div>
          ) : (
            filteredLeaders.map((leader) => (
              <div
                key={leader.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{leader.nome_completo}</p>
                  {leader.cidade && (
                    <Badge variant="outline" className="text-xs mt-1">
                      {(leader.cidade as any).nome}
                    </Badge>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => leader.affiliate_token && copyLink(leader.id, leader.affiliate_token)}
                  disabled={!leader.affiliate_token}
                  className="shrink-0 ml-2"
                >
                  {copiedId === leader.id ? (
                    <>
                      <Check className="h-4 w-4 mr-1 text-green-500" />
                      Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-1" />
                      Copiar Link
                    </>
                  )}
                </Button>
              </div>
            ))
          )}
        </div>

        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground text-center">
            {filteredLeaders.length} líder(es) encontrado(s) •
            Links incluem rastreamento de indicação
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
