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
import { Badge } from "@/components/ui/badge";
import { ProtocolBadge } from "./ProtocolBadge";
import { OfficeStatusBadge } from "./OfficeStatusBadge";
import { formatPhoneBR } from "@/services/office/officeService";
import { generateVisitFormUrl, generateVisitCheckinUrl } from "@/lib/urlHelper";
import { Copy, QrCode, Printer, CheckCircle2, XCircle, Download, Instagram, Users } from "lucide-react";
import { toast } from "sonner";
import QRCode from "qrcode";
import jsPDF from "jspdf";
import { useUpdateVisitCheckInById } from "@/hooks/office/useUpdateVisitCheckIn";
import { useMeetingMinutes } from "@/hooks/office/useMeetingMinutes";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface VisitDetailsDialogProps {
  visit: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VisitDetailsDialog({ visit, open, onOpenChange }: VisitDetailsDialogProps) {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const updateCheckIn = useUpdateVisitCheckInById();
  const { data: meetingMinutes } = useMeetingMinutes(visit?.id);

  useEffect(() => {
    if (open && visit) {
      // Generate QR Code for form link or check-in link based on status
      if (visit.status === 'FORM_SUBMITTED' && visit.qr_code) {
        const checkinUrl = generateVisitCheckinUrl(visit.qr_code);
        QRCode.toDataURL(checkinUrl).then(setQrCode);
      } else {
        const link = generateVisitFormUrl(visit.id);
        QRCode.toDataURL(link).then(setQrCode);
      }
    }
  }, [open, visit]);

  if (!visit) return null;

  const link = visit.qr_code && visit.status === 'FORM_SUBMITTED'
    ? generateVisitCheckinUrl(visit.qr_code)
    : generateVisitFormUrl(visit.id);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(link);
    toast.success("Link copiado!");
  };

  const handleCheckIn = async () => {
    await updateCheckIn.mutateAsync({
      id: visit.id,
      checked_in: true
    });
    onOpenChange(false);
  };

  const handleUndoCheckIn = async () => {
    await updateCheckIn.mutateAsync({
      id: visit.id,
      checked_in: false
    });
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const formData = visit.form?.[0] || visit.form;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Ficha de Visita - ${visit.protocolo}</title>
            <style>
              @page { size: portrait; margin: 15mm; }
              body { font-family: Arial, sans-serif; padding: 20px; max-width: 100%; margin: 0 auto; }
              .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 15px; }
              .logo { font-size: 20px; font-weight: bold; color: #f97316; }
              .section { margin-bottom: 15px; }
              .section-title { font-size: 14px; font-weight: bold; color: #333; margin-bottom: 8px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
              .field { margin-bottom: 6px; font-size: 12px; }
              .field-label { font-weight: bold; color: #666; }
              .field-value { color: #333; }
              .protocol { font-size: 18px; color: #f97316; font-weight: bold; }
              .status-badge { display: inline-block; padding: 3px 10px; border-radius: 4px; font-size: 11px; font-weight: 600; }
              .status-checked-in { background-color: #dcfce7; color: #166534; }
              .status-form-submitted { background-color: #dbeafe; color: #1e40af; }
              .notes-section { margin-top: 20px; border: 1px solid #ccc; border-radius: 4px; padding: 10px; min-height: 200px; }
              .notes-title { font-size: 14px; font-weight: bold; color: #333; margin-bottom: 8px; }
              .notes-lines { border-bottom: 1px solid #eee; height: 28px; }
              @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo">GABINETE - FICHA DE VISITA</div>
            <div class="protocol">${visit.protocolo}</div>
            ${visit.checked_in ? `<div class="status-badge status-checked-in">✓ CHECK-IN REALIZADO</div>` : `<div class="status-badge status-form-submitted">Aguardando Check-in</div>`}
          </div>

          <div class="section">
            <div class="section-title">Informações do Visitante</div>
            <div class="field">
              <span class="field-label">Nome:</span>
              <span class="field-value">${visit.contact?.nome || '-'}</span>
            </div>
            <div class="field">
              <span class="field-label">WhatsApp:</span>
              <span class="field-value">${visit.contact?.telefone_norm ? formatPhoneBR(visit.contact.telefone_norm) : '-'}</span>
            </div>
            <div class="field">
              <span class="field-label">Cidade/RA:</span>
              <span class="field-value">${visit.city?.nome || '-'}</span>
            </div>
            ${formData?.data_nascimento ? `
            <div class="field">
              <span class="field-label">Data de Nascimento:</span>
              <span class="field-value">${format(new Date(formData.data_nascimento), 'dd/MM/yyyy', { locale: ptBR })}</span>
            </div>` : ''}
            ${formData?.endereco ? `
            <div class="field">
              <span class="field-label">Endereço:</span>
              <span class="field-value">${formData.endereco}</span>
            </div>` : ''}
          </div>

          ${formData ? `
          <div class="section">
            <div class="section-title">Dados da Reunião</div>
            ${formData.tema ? `
            <div class="field">
              <span class="field-label">Pauta/Tema:</span>
              <span class="field-value">${formData.tema.tema}</span>
            </div>` : ''}
            <div class="field">
              <span class="field-label">Aceita Reunião:</span>
              <span class="field-value">${formData.aceita_reuniao ? 'Sim' : 'Não'}</span>
            </div>
            <div class="field">
              <span class="field-label">Continua no Projeto:</span>
              <span class="field-value">${formData.continua_projeto ? 'Sim' : 'Não'}</span>
            </div>
            ${formData.observacoes ? `
            <div class="field">
              <span class="field-label">Observações:</span>
              <span class="field-value">${formData.observacoes}</span>
            </div>` : ''}
          </div>

          <div class="section">
            <div class="section-title">Redes Sociais</div>
            ${formData.instagram ? `
            <div class="field">
              <span class="field-label">Instagram:</span>
              <span class="field-value">${formData.instagram}</span>
            </div>` : ''}
            ${formData.facebook ? `
            <div class="field">
              <span class="field-label">Facebook:</span>
              <span class="field-value">${formData.facebook}</span>
            </div>` : ''}
          </div>
          ` : ''}

          <div class="section">
            <div class="section-title">Informações Administrativas</div>
            ${visit.leader ? `
            <div class="field">
              <span class="field-label">Líder Responsável:</span>
              <span class="field-value">${visit.leader.nome_completo}</span>
            </div>` : ''}
            <div class="field">
              <span class="field-label">Criado em:</span>
              <span class="field-value">${format(new Date(visit.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
            </div>
            ${visit.checked_in_at ? `
            <div class="field">
              <span class="field-label">Check-in realizado em:</span>
              <span class="field-value">${format(new Date(visit.checked_in_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
            </div>` : ''}
          </div>

          ${formData?.segue_instagram !== undefined ? `
          <div class="section">
            <div class="section-title">Instagram</div>
            <div class="field">
              <span class="field-label">Segue @rafaelprudentedep:</span>
              <span class="field-value">${formData.segue_instagram ? 'Sim ✓' : 'Não'}</span>
            </div>
          </div>` : ''}

          <div class="notes-section">
            <div class="notes-title">📝 Anotações</div>
            ${Array.from({ length: 8 }).map(() => '<div class="notes-lines"></div>').join('')}
          </div>

          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() {
                window.close();
              };
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleDownloadMinutes = async () => {
    if (!meetingMinutes) return;

    try {
      if (meetingMinutes.content_type === 'text') {
        // Gerar PDF do texto usando jsPDF
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 15;
        const maxWidth = pageWidth - 2 * margin;

        // Título
        doc.setFontSize(16);
        doc.text('Ata da Reunião', margin, 20);

        // Protocolo
        doc.setFontSize(12);
        doc.text(`Protocolo: ${visit.protocolo}`, margin, 30);

        // Data
        doc.setFontSize(10);
        doc.text(`Data: ${format(new Date(meetingMinutes.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`, margin, 38);

        // Conteúdo
        doc.setFontSize(11);
        const lines = doc.splitTextToSize(meetingMinutes.content_text || '', maxWidth);
        doc.text(lines, margin, 50);

        doc.save(`ata-${visit.protocolo}.pdf`);
        toast.success('PDF baixado com sucesso!');
      } else if (meetingMinutes.content_type === 'file' && meetingMinutes.file_path) {
        // Baixar arquivo do storage
        const { data, error } = await supabase.storage
          .from('meeting-minutes')
          .download(meetingMinutes.file_path);

        if (error) throw error;

        // Criar URL temporária e baixar
        const url = URL.createObjectURL(data);
        const a = document.createElement('a');
        a.href = url;
        a.download = meetingMinutes.file_name || `ata-${visit.protocolo}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast.success('Arquivo baixado com sucesso!');
      }
    } catch (error) {
      console.error('Error downloading minutes:', error);
      toast.error('Erro ao baixar ata');
    }
  };

  const formData = visit.form?.[0] || visit.form;
  const isFinished = visit.status === 'MEETING_COMPLETED' || visit.status === 'CANCELLED';
  const hasFormData = visit.status === 'FORM_SUBMITTED' ||
                      visit.status === 'CHECKED_IN' ||
                      visit.status === 'MEETING_COMPLETED' ||
                      visit.status === 'CANCELLED' ||
                      visit.status === 'RESCHEDULED';
  const isCheckedIn = visit.status === 'CHECKED_IN' || visit.checked_in;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalhes da Visita</DialogTitle>
          <DialogDescription>
            Informações completas sobre a visita registrada
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Protocolo e Status */}
          <div className="flex items-center justify-between">
            <div>
              <Label>Protocolo</Label>
              <div className="mt-2">
                <ProtocolBadge protocolo={visit.protocolo} />
              </div>
            </div>
            <div>
              <Label>Status</Label>
              <div className="mt-2">
                <OfficeStatusBadge status={visit.status} />
              </div>
            </div>
          </div>

          {/* Check-in Badge */}
          {isCheckedIn && visit.checked_in_at && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-green-700 font-semibold mb-1">
                <CheckCircle2 className="h-5 w-5" />
                Check-in Realizado
              </div>
              <p className="text-sm text-green-600">
                {format(new Date(visit.checked_in_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            </div>
          )}

          {/* Informações do Visitante */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Visitante</Label>
              <p className="text-sm mt-1 font-medium">{visit.contact?.nome}</p>
            </div>

            <div>
              <Label>WhatsApp</Label>
              <p className="text-sm mt-1 font-mono">
                {visit.contact?.telefone_norm && formatPhoneBR(visit.contact.telefone_norm)}
              </p>
            </div>
          </div>

          {visit.city && (
            <div>
              <Label>Cidade / RA</Label>
              <p className="text-sm mt-1">{visit.city.nome}</p>
            </div>
          )}

          {/* Dados do Formulário (se disponível) */}
          {hasFormData && formData && (
            <>
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3">Dados do Formulário</h3>

                <div className="grid md:grid-cols-2 gap-4 mb-4">
                  {formData.data_nascimento && (
                    <div>
                      <Label>Data de Nascimento</Label>
                      <p className="text-sm mt-1">
                        {format(new Date(formData.data_nascimento), 'dd/MM/yyyy', { locale: ptBR })}
                      </p>
                    </div>
                  )}

                  <div>
                    <Label>Aceita Reunião</Label>
                    <p className="text-sm mt-1">
                      <Badge variant={formData.aceita_reuniao ? "default" : "secondary"}>
                        {formData.aceita_reuniao ? "Sim" : "Não"}
                      </Badge>
                    </p>
                  </div>

                  {formData.tema && (
                    <div>
                      <Label>Pauta/Tema</Label>
                      <p className="text-sm mt-1">{formData.tema.tema}</p>
                    </div>
                  )}

                  <div>
                    <Label>Continua no Projeto</Label>
                    <p className="text-sm mt-1">
                      <Badge variant={formData.continua_projeto ? "default" : "secondary"}>
                        {formData.continua_projeto ? "Sim" : "Não"}
                      </Badge>
                    </p>
                  </div>
                </div>

                {formData.endereco && (
                  <div className="mb-4">
                    <Label>Endereço</Label>
                    <p className="text-sm mt-1">{formData.endereco}</p>
                  </div>
                )}

                <div className="grid md:grid-cols-2 gap-4 mb-4">
                  {formData.instagram && (
                    <div>
                      <Label>Instagram</Label>
                      <p className="text-sm mt-1">{formData.instagram}</p>
                    </div>
                  )}

                  {formData.facebook && (
                    <div>
                      <Label>Facebook</Label>
                      <p className="text-sm mt-1">{formData.facebook}</p>
                    </div>
                  )}
                </div>

                {/* Instagram Follow Status */}
                {formData.segue_instagram !== undefined && (
                  <div className="mb-4">
                    <Label className="flex items-center gap-2">
                      <Instagram className="h-4 w-4" />
                      Segue @rafaelprudentedep
                    </Label>
                    <p className="text-sm mt-1">
                      <Badge variant={formData.segue_instagram ? "default" : "secondary"}>
                        {formData.segue_instagram ? "✓ Segue" : "Não segue"}
                      </Badge>
                    </p>
                  </div>
                )}

                {formData.observacoes && (
                  <div>
                    <Label>Observações</Label>
                    <p className="text-sm mt-1">{formData.observacoes}</p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Líder */}
          {visit.leader && (
            <div className="border-t pt-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Líder Responsável
              </h3>
              <p className="text-sm font-medium">{visit.leader.nome_completo}</p>
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div className="p-2 bg-muted rounded-md text-center">
                  <p className="text-lg font-bold">{visit.leader.cadastros || 0}</p>
                  <p className="text-xs text-muted-foreground">Cadastros</p>
                </div>
                <div className="p-2 bg-muted rounded-md text-center">
                  <p className="text-lg font-bold">{visit.leader.pontuacao_total || 0}</p>
                  <p className="text-xs text-muted-foreground">Pontos</p>
                </div>
              </div>
            </div>
          )}

          {/* Botões de Ação - apenas para visitas em andamento */}
          {hasFormData && !isFinished && (
            <div className="flex gap-3 pt-4 border-t">
              {!isCheckedIn ? (
                <Button
                  onClick={handleCheckIn}
                  disabled={updateCheckIn.isPending}
                  className="flex-1"
                >
                  {updateCheckIn.isPending ? (
                    "Processando..."
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Realizar Check-in
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  onClick={handleUndoCheckIn}
                  disabled={updateCheckIn.isPending}
                  variant="outline"
                  className="flex-1"
                >
                  {updateCheckIn.isPending ? (
                    "Processando..."
                  ) : (
                    <>
                      <XCircle className="mr-2 h-4 w-4" />
                      Desfazer Check-in
                    </>
                  )}
                </Button>
              )}

              <Button
                onClick={handlePrint}
                variant="outline"
                className="flex-1"
              >
                <Printer className="mr-2 h-4 w-4" />
                Imprimir Ficha
              </Button>
            </div>
          )}

          {/* Botões para visitas finalizadas */}
          {isFinished && (
            <div className="flex gap-3 pt-4 border-t">
              <Button onClick={handlePrint} variant="outline" className="flex-1">
                <Printer className="mr-2 h-4 w-4" />
                Imprimir Ficha
              </Button>

              {meetingMinutes && (
                <Button onClick={handleDownloadMinutes} variant="outline" className="flex-1">
                  <Download className="mr-2 h-4 w-4" />
                  Baixar Ata (PDF)
                </Button>
              )}
            </div>
          )}

          {/* Link do Formulário/Check-in - apenas para visitas em andamento */}
          {!isFinished && (
            <div>
              <Label>{hasFormData && visit.qr_code ? 'Link de Check-in' : 'Link do Formulário'}</Label>
              <div className="mt-2 p-3 bg-muted rounded-md break-all text-sm font-mono">
                {link}
              </div>
              <Button
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={handleCopyLink}
              >
                <Copy className="mr-2 h-4 w-4" />
                Copiar Link
              </Button>
            </div>
          )}

          {/* QR Code - apenas para visitas em andamento */}
          {!isFinished && qrCode && (
            <div>
              <Label className="flex items-center gap-2">
                <QrCode className="h-4 w-4" />
                QR Code {hasFormData && visit.qr_code ? 'para Check-in' : 'do Formulário'}
              </Label>
              <div className="mt-2 flex justify-center p-4 bg-muted rounded-lg">
                <img src={qrCode} alt="QR Code" className="w-48 h-48" />
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
