import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, QrCode as QrCodeIcon, Download, Calendar as CalendarIcon } from "lucide-react";
import { trackLead, pushToDataLayer } from "@/lib/trackingUtils";
import { useTemas } from "@/hooks/useTemas";
import QRCode from "qrcode";
import { generateVisitCheckinUrl } from "@/lib/urlHelper";

export default function ScheduleVisit() {
  const { visitId } = useParams();
  const { toast } = useToast();
  const { data: temas = [], isLoading: temasLoading } = useTemas();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [visit, setVisit] = useState<any>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");

  // Form data
  const [dataNascimento, setDataNascimento] = useState("");
  const [endereco, setEndereco] = useState("");
  const [instagram, setInstagram] = useState("");
  const [facebook, setFacebook] = useState("");
  const [aceitaReuniao, setAceitaReuniao] = useState<string>("");
  const [continuaProjeto, setContinuaProjeto] = useState<string>("");
  const [observacoes, setObservacoes] = useState("");
  const [temaId, setTemaId] = useState<string>("");
  const [confirmaAgendamento, setConfirmaAgendamento] = useState(false);

  useEffect(() => {
    loadVisit();
  }, [visitId]);

  const loadVisit = async () => {
    if (!visitId) return;

    try {
      setLoading(true);

      // Usar função RPC SECURITY DEFINER para buscar visita (bypassa RLS para usuários públicos)
      const { data, error } = await supabase
        .rpc("get_visit_for_public_form", { _visit_id: visitId });

      if (error) throw error;

      if (!data || data.length === 0) {
        setVisit(null);
        return;
      }

      const visitData = data[0] as any;

      // Mapear para estrutura esperada pelo componente
      setVisit({
        id: visitData.id,
        protocolo: visitData.protocolo,
        status: visitData.status,
        contact_id: visitData.contact_id,
        qr_code: visitData.qr_code,
        scheduled_date: visitData.scheduled_date || null,
        scheduled_time: visitData.scheduled_time || null,
        contact: {
          nome: visitData.contact_nome,
          telefone_norm: visitData.contact_telefone,
        },
        city: {
          nome: visitData.city_nome,
        },
      });

      // Atualizar status para FORM_OPENED se ainda estiver em LINK_SENT, SCHEDULED ou REGISTERED
      if (["LINK_SENT", "SCHEDULED", "REGISTERED"].includes(visitData.status)) {
        const { error: updateError } = await supabase.rpc("update_visit_status_form_opened", { _visit_id: visitId });
        if (updateError) {
          console.error("Erro ao atualizar status para FORM_OPENED:", updateError);
        }
      }
    } catch (error: any) {
      console.error("Error loading visit:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar dados da visita",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    if (!dataNascimento || !endereco || !instagram || !facebook || !aceitaReuniao || !continuaProjeto || !observacoes || !temaId) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    // Validar confirmação de agendamento se visita for agendada
    if (visit?.scheduled_date && visit?.scheduled_time && !confirmaAgendamento) {
      toast({
        title: "Confirmação necessária",
        description: "Por favor, confirme o dia e horário da visita",
        variant: "destructive",
      });
      return;
    }

    try {
      setSubmitting(true);

      // 1. Upsert form data into office_visit_forms
      const { error: formError } = await supabase
        .from("office_visit_forms")
        .upsert({
          visit_id: visitId,
          data_nascimento: dataNascimento,
          endereco,
          instagram,
          facebook,
          aceita_reuniao: aceitaReuniao === "sim",
          continua_projeto: continuaProjeto === "sim",
          observacoes,
          tema_id: temaId,
          submitted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'visit_id',
        });

      if (formError) throw formError;

      // 2. Update contact with form data
      const { error: contactError } = await supabase
        .from("office_contacts")
        .update({
          endereco,
          data_nascimento: dataNascimento,
          instagram,
          facebook,
        })
        .eq("id", visit?.contact_id);

      if (contactError) throw contactError;

      // 3. Update visit status and confirmed_at if scheduled
      const visitUpdate: any = { status: "FORM_SUBMITTED" };
      if (visit?.scheduled_date && visit?.scheduled_time) {
        visitUpdate.confirmed_at = new Date().toISOString();
      }

      const { error: visitError } = await supabase
        .from("office_visits")
        .update(visitUpdate)
        .eq("id", visitId);

      if (visitError) throw visitError;

      // 4. Reload visit data to get generated QR code using RPC (bypasses RLS)
      const { data: reloadedData, error: reloadError } = await supabase
        .rpc("get_visit_for_public_form", { _visit_id: visitId });

      if (reloadError) throw reloadError;

      const updatedVisit = reloadedData?.[0];
      if (!updatedVisit) throw new Error("Visita não encontrada após submit");

      // 5. Generate QR Code image
      if (updatedVisit.qr_code) {
        const checkinUrl = generateVisitCheckinUrl(updatedVisit.qr_code);
        const qrDataUrl = await QRCode.toDataURL(checkinUrl, { width: 400 });
        setQrCodeDataUrl(qrDataUrl);
      }

      setSubmitted(true);
      toast({
        title: "Formulário enviado!",
        description: "Obrigado por preencher o formulário",
      });

      // Track Lead event
      trackLead({
        content_name: 'visita_gabinete',
        value: 1
      });

      // Push to GTM dataLayer
      pushToDataLayer('lead', {
        source: 'visita_gabinete',
        visit_id: visitId
      });
    } catch (error: any) {
      console.error("Error submitting form:", error);
      toast({
        title: "Erro",
        description: "Erro ao enviar formulário. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!visit) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Visita não encontrada</CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-green-600 text-2xl">✓ Formulário Enviado</CardTitle>
            <p className="text-sm text-muted-foreground mt-2">
              Obrigado por preencher o formulário!
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {qrCodeDataUrl && (
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-2 text-primary">
                  <QrCodeIcon className="h-5 w-5" />
                  <p className="font-semibold">Seu QR Code para Check-in</p>
                </div>

                <div className="flex justify-center p-6 bg-muted rounded-lg">
                  <img src={qrCodeDataUrl} alt="QR Code Check-in" className="w-64 h-64" />
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-900 font-medium text-center">
                    📱 Apresente este QR Code na entrada do gabinete para realizar o check-in
                  </p>
                </div>

                <Button
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = qrCodeDataUrl;
                    link.download = 'qrcode-visita-gabinete.png';
                    link.click();
                  }}
                  variant="outline"
                  className="w-full"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Baixar QR Code
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 py-8">
      <div className="max-w-3xl mx-auto">
        <Card>
          <CardHeader className="bg-orange-500 text-white rounded-t-lg">
            <CardTitle className="text-center text-xl md:text-2xl font-bold">
              FICHA CADASTRAL - BANCO DE DADOS - REDES SOCIAIS
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Pre-filled fields (disabled) */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome Completo</Label>
                  <Input
                    id="nome"
                    value={visit.contact?.nome || ""}
                    disabled
                    className="bg-muted"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telefone">Telefone</Label>
                  <Input
                    id="telefone"
                    value={visit.contact?.telefone_norm || ""}
                    disabled
                    className="bg-muted"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cidade">Cidade</Label>
                <Input
                  id="cidade"
                  value={visit.city?.nome || ""}
                  disabled
                  className="bg-muted"
                />
              </div>

              {/* Seção de Confirmação de Data/Hora Agendados */}
              {visit.scheduled_date && visit.scheduled_time && (
                <div className="p-4 border border-primary/30 rounded-lg bg-primary/5 space-y-3">
                  <div className="flex items-center gap-2 text-primary font-semibold">
                    <CalendarIcon className="h-5 w-5" />
                    Data e Horário Agendados
                  </div>
                  <div className="text-lg font-medium">
                    {new Date(visit.scheduled_date + 'T12:00:00').toLocaleDateString('pt-BR', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })} às {visit.scheduled_time.substring(0, 5)}
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="checkbox"
                      id="confirmaAgendamento"
                      checked={confirmaAgendamento}
                      onChange={(e) => setConfirmaAgendamento(e.target.checked)}
                      className="h-4 w-4 rounded border-primary text-primary focus:ring-primary"
                    />
                    <Label htmlFor="confirmaAgendamento" className="cursor-pointer font-normal">
                      Confirmo o dia e horário acima *
                    </Label>
                  </div>
                </div>
              )}

              {/* Required fields */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dataNascimento">Data de Nascimento *</Label>
                  <Input
                    id="dataNascimento"
                    type="date"
                    value={dataNascimento}
                    onChange={(e) => setDataNascimento(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pauta">Pauta *</Label>
                  <Select value={temaId} onValueChange={setTemaId} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma pauta" />
                    </SelectTrigger>
                    <SelectContent>
                      {temasLoading ? (
                        <SelectItem value="loading" disabled>
                          Carregando...
                        </SelectItem>
                      ) : temas.length === 0 ? (
                        <SelectItem value="empty" disabled>
                          Nenhuma pauta disponível
                        </SelectItem>
                      ) : (
                        temas.map((tema) => (
                          <SelectItem key={tema.id} value={tema.id}>
                            {tema.tema}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="endereco">Endereço Completo *</Label>
                <Textarea
                  id="endereco"
                  value={endereco}
                  onChange={(e) => setEndereco(e.target.value)}
                  placeholder="Rua, número, complemento, bairro, CEP"
                  required
                  rows={3}
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="instagram">Instagram *</Label>
                  <Input
                    id="instagram"
                    value={instagram}
                    onChange={(e) => setInstagram(e.target.value)}
                    placeholder="@seu_instagram"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="facebook">Facebook *</Label>
                  <Input
                    id="facebook"
                    value={facebook}
                    onChange={(e) => setFacebook(e.target.value)}
                    placeholder="facebook.com/seu_perfil"
                    required
                  />
                </div>
              </div>

              {/* Radio buttons */}
              <div className="space-y-4">
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Aceita fazer reunião? *</Label>
                  <RadioGroup value={aceitaReuniao} onValueChange={setAceitaReuniao} required>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="sim" id="reuniao-sim" />
                      <Label htmlFor="reuniao-sim" className="font-normal cursor-pointer">SIM</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="nao" id="reuniao-nao" />
                      <Label htmlFor="reuniao-nao" className="font-normal cursor-pointer">NÃO</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-3">
                  <Label className="text-base font-semibold">Continua no Projeto? *</Label>
                  <RadioGroup value={continuaProjeto} onValueChange={setContinuaProjeto} required>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="sim" id="projeto-sim" />
                      <Label htmlFor="projeto-sim" className="font-normal cursor-pointer">SIM</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="nao" id="projeto-nao" />
                      <Label htmlFor="projeto-nao" className="font-normal cursor-pointer">NÃO</Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="observacoes">Observações *</Label>
                <Textarea
                  id="observacoes"
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Digite aqui suas observações"
                  required
                  rows={4}
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  "Enviar Formulário"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
