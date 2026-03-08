import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Users, CheckCircle2, ShieldCheck } from "lucide-react";
import { LocationSelect } from "@/components/office/LocationSelect";
import { useTenantLocationConfig } from "@/hooks/useTenantLocationConfig";
import type { OfficeLeader } from "@/types/office";
import { trackLead, pushToDataLayer } from "@/lib/trackingUtils";
import { useTemas } from "@/hooks/useTemas";
import { sendVerificationMessage, addPendingMessage } from "@/hooks/contacts/useContactVerification";

export default function AffiliateForm() {
  const { leaderToken } = useParams();
  const locationConfig = useTenantLocationConfig();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [isExistingLeader, setIsExistingLeader] = useState(false);
  const [leader, setLeader] = useState<OfficeLeader | null>(null);

  const { data: temas = [], isLoading: temasLoading } = useTemas();

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cidadeId, setCidadeId] = useState("");
  const [localidade, setLocalidade] = useState("");
  const [endereco, setEndereco] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [instagram, setInstagram] = useState("");
  const [facebook, setFacebook] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [temaId, setTemaId] = useState("");

  useEffect(() => {
    loadLeader();
  }, [leaderToken]);

  const loadLeader = async () => {
    if (!leaderToken) return;

    try {
      setLoading(true);
      
      // Usar função RPC SECURITY DEFINER para buscar líder (bypassa RLS para usuários públicos)
      const { data, error } = await supabase
        .rpc("get_leader_by_affiliate_token", { _token: leaderToken });

      if (error) throw error;
      
      if (!data || data.length === 0) {
        toast.error("Link inválido ou líder inativo");
        return;
      }

      // Mapear para estrutura esperada pelo componente
      const leaderData = {
        id: data[0].id,
        nome_completo: data[0].nome_completo,
        cidade_id: data[0].cidade_id,
        cidade: { nome: data[0].cidade_nome, codigo_ra: "" }
      };

      setLeader(leaderData as OfficeLeader);
    } catch (error: any) {
      console.error("Error loading leader:", error);
      toast.error("Erro ao carregar informações do líder");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nome || !telefone || !cidadeId || !endereco || !dataNascimento || 
        !instagram || !facebook || !observacoes || !temaId) {
      toast.error("Por favor, preencha todos os campos");
      return;
    }

    if (!leader) return;

    try {
      setSubmitting(true);

      const telefoneNorm = telefone.startsWith('+') ? telefone : `+55${telefone.replace(/\D/g, '')}`;

      // Verificar se a pessoa já é um líder cadastrado
      const { data: existingLeader } = await supabase
        .from("lideres")
        .select("id, nome_completo")
        .or(`telefone.eq.${telefoneNorm}`)
        .eq("is_active", true)
        .maybeSingle();

      if (existingLeader) {
        toast.info(`${existingLeader.nome_completo}, você já é um apoiador cadastrado!`);
        setIsExistingLeader(true);
        setSubmitted(true);
        setNeedsVerification(false);
        setSubmitting(false);
        return;
      }

      // Verificar se já existe contato com este telefone
      const { data: existingContact } = await supabase
        .from("office_contacts")
        .select("id, nome, is_verified, verification_code, source_type, source_id, pending_messages")
        .eq("telefone_norm", telefoneNorm)
        .maybeSingle();

      let contactId: string;
      let verificationCode: string;
      let isAlreadyVerified = false;

      if (existingContact) {
        // Contato já existe - atualizar dados
        const updateData: Record<string, unknown> = {
          nome,
          cidade_id: cidadeId,
          endereco,
          data_nascimento: dataNascimento,
          instagram,
          facebook,
        };

        // Se não tinha source_type='lider', atualizar
        if (existingContact.source_type !== 'lider') {
          updateData.source_type = 'lider';
          updateData.source_id = leader.id;
        }

        const { error: updateError } = await supabase
          .from("office_contacts")
          .update(updateData)
          .eq("id", existingContact.id);

        if (updateError) throw updateError;

        contactId = existingContact.id;
        isAlreadyVerified = existingContact.is_verified || false;

        // Se não está verificado, gerar código se não tiver
        if (!isAlreadyVerified) {
          if (!existingContact.verification_code) {
            const { data: newCode } = await supabase.rpc("generate_verification_code");
            verificationCode = newCode;
            
            await supabase
              .from("office_contacts")
              .update({ verification_code: verificationCode })
              .eq("id", contactId);
          } else {
            verificationCode = existingContact.verification_code;
          }
        }
      } else {
        // Novo contato - inserir (trigger gera código automaticamente)
        const { data: contact, error: contactError } = await supabase
          .from("office_contacts")
          .insert({
            nome,
            telefone_norm: telefoneNorm,
            cidade_id: cidadeId,
            endereco,
            data_nascimento: dataNascimento,
            instagram,
            facebook,
            source_type: "lider",
            source_id: leader.id,
            is_verified: false,
          })
          .select('id, verification_code')
          .single();

        if (contactError) throw contactError;

        contactId = contact.id;
        verificationCode = contact.verification_code;
      }

      // Gerar protocolo
      const { data: protocolData, error: protocolError } = await supabase
        .rpc("generate_office_protocol", { _prefix: "RP-GB" });

      if (protocolError) throw protocolError;
      const protocolo = protocolData as string;

      // Criar visita
      const { data: visit, error: visitError } = await supabase
        .from("office_visits")
        .insert({
          protocolo,
          contact_id: contactId,
          leader_id: leader.id,
          city_id: cidadeId,
          status: "FORM_SUBMITTED",
          created_by: null,
        })
        .select()
        .single();

      if (visitError) throw visitError;

      const { error: formError } = await supabase
        .from("office_visit_forms")
        .insert({
          visit_id: visit.id,
          data_nascimento: dataNascimento,
          endereco,
          instagram,
          facebook,
          aceita_reuniao: true,
          continua_projeto: true,
          observacoes,
          tema_id: temaId,
          submitted_at: new Date().toISOString(),
        });

      if (formError) throw formError;

      // Record page view for this contact
      await supabase.from('contact_page_views').insert({
        contact_id: contactId,
        page_type: 'indicacao',
        page_identifier: `lider-${leader.id}`,
        page_name: `Indicação: ${leader.nome_completo}`,
      });

      // Se já está verificado, processar normalmente
      if (isAlreadyVerified) {
        // Enviar mensagem de link do formulário via WhatsApp
        try {
          await supabase.functions.invoke('send-whatsapp', {
            body: {
              phone: telefoneNorm,
              templateSlug: 'visita-link-formulario',
              variables: {
                nome,
                protocolo,
                lider_nome: leader.nome_completo,
              },
              contactId,
              visitId: visit.id,
            },
          });
        } catch (whatsappError) {
          console.error('Error sending WhatsApp:', whatsappError);
        }
        
        setNeedsVerification(false);
      } else {
        // Não está verificado - armazenar mensagens pendentes e enviar verificação
        const pendingMessages = addPendingMessage(
          existingContact?.pending_messages || [],
          'visita-link-formulario',
          {
            nome,
            protocolo,
            lider_nome: leader.nome_completo,
          }
        );

        await supabase
          .from("office_contacts")
          .update({ pending_messages: JSON.parse(JSON.stringify(pendingMessages)) })
          .eq("id", contactId);

        // Enviar mensagem de verificação
        await sendVerificationMessage({
          contactId,
          contactName: nome,
          contactPhone: telefoneNorm,
          leaderName: leader.nome_completo,
          verificationCode: verificationCode!,
        });

        setNeedsVerification(true);
      }

      setSubmitted(true);
      toast.success(isAlreadyVerified ? "Cadastro realizado com sucesso!" : "Cadastro realizado! Verifique seu WhatsApp.");

      // Track Lead event
      trackLead({ 
        content_name: `indicacao_${leader?.nome_completo}`,
        value: 1
      });
      
      // Push to GTM dataLayer
      pushToDataLayer('lead', { 
        source: 'indicacao',
        leader_id: leader?.id,
        leader_name: leader?.nome_completo
      });
    } catch (error: any) {
      console.error("Error submitting form:", error);
      toast.error("Erro ao enviar formulário. Tente novamente.");
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

  if (!leader) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Link inválido</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Este link de indicação não é válido ou expirou.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            {needsVerification ? (
              <>
                <div className="mx-auto w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center mb-4">
                  <ShieldCheck className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                </div>
                <CardTitle className="text-amber-600 dark:text-amber-400">Quase Lá!</CardTitle>
              </>
            ) : (
              <>
                <div className="mx-auto w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center mb-4">
                  <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <CardTitle className="text-green-600 dark:text-green-400">
                  {isExistingLeader ? "Você já é um Apoiador!" : "Cadastro Realizado!"}
                </CardTitle>
              </>
            )}
          </CardHeader>
          <CardContent>
            {needsVerification ? (
              <div className="space-y-4">
                <p className="text-center text-muted-foreground">
                  Enviamos um código de verificação para seu WhatsApp. 
                  <strong> Responda a mensagem com o código</strong> para confirmar seu cadastro.
                </p>
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-sm text-amber-800 dark:text-amber-200">
                  <p className="font-semibold mb-1">⚠️ Importante</p>
                  <p>Seu cadastro só será confirmado após a verificação. Verifique seu WhatsApp!</p>
                </div>
              </div>
            ) : (
              <p className="text-center text-muted-foreground">
                {isExistingLeader 
                  ? "Identificamos que você já faz parte da nossa rede de apoiadores. Continue engajado!"
                  : "Obrigado por se cadastrar! Entraremos em contato em breve."
                }
              </p>
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
          <CardHeader className="bg-primary text-primary-foreground rounded-t-lg">
            <CardTitle className="text-center text-xl md:text-2xl font-bold">
              FORMULÁRIO DE CADASTRO - VISITA AO GABINETE
            </CardTitle>
            
            <div className="mt-4 flex items-center justify-center gap-2 bg-white/10 rounded-lg p-3">
              <Users className="h-5 w-5" />
              <p className="text-sm font-medium">
                Indicado por: <span className="font-bold">{leader.nome_completo}</span>
              </p>
            </div>
          </CardHeader>
          
          <CardContent className="p-6 space-y-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <h3 className="font-semibold text-lg border-b pb-2">Dados Pessoais</h3>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nome">Nome Completo *</Label>
                    <Input
                      id="nome"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      placeholder="João Silva"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="telefone">WhatsApp *</Label>
                    <Input
                      id="telefone"
                      value={telefone}
                      onChange={(e) => setTelefone(e.target.value)}
                      placeholder="(61) 99999-9999"
                      required
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cidade">{locationConfig.label} *</Label>
                    <LocationSelect
                      value={cidadeId}
                      localidadeValue={localidade}
                      onLocationChange={({ cidadeId: cid, localidade: loc }) => {
                        setCidadeId(cid || "");
                        setLocalidade(loc || "");
                      }}
                    />
                  </div>
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
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-lg border-b pb-2">Redes Sociais</h3>
                
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
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-lg border-b pb-2">Informações Adicionais</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="pauta">Pauta da Reunião *</Label>
                  <Select value={temaId} onValueChange={setTemaId} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma pauta" />
                    </SelectTrigger>
                    <SelectContent>
                      {temasLoading ? (
                        <SelectItem value="loading" disabled>Carregando...</SelectItem>
                      ) : temas.length === 0 ? (
                        <SelectItem value="empty" disabled>Nenhuma pauta disponível</SelectItem>
                      ) : (
                        temas.map((tema) => (
                          <SelectItem key={tema.id} value={tema.id}>{tema.tema}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
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
                  "Enviar Cadastro"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}