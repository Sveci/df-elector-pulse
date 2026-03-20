/**
 * LeaderRegistrationForm - Formulário de cadastro de líder via link de afiliado
 *
 * IMPORTANTE: Este formulário envia SMS de VERIFICAÇÃO (verificacao-lider-sms)
 * O link de indicação SÓ é enviado APÓS o líder confirmar o cadastro em /verificar-lider/:codigo
 *
 * Fluxo correto:
 * 1. Líder se cadastra via este formulário
 * 2. Sistema envia SMS com link de VERIFICAÇÃO (verificacao-lider-sms)
 * 3. Líder clica no link de verificação
 * 4. Sistema marca como verificado e envia SMS com link de INDICAÇÃO (lider-cadastro-confirmado-sms)
 *
 * @version 2.0.0 - Corrigido fluxo de verificação (19/12/2025)
 */
import { useState } from "react";
import { useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { LocationSelect } from "@/components/office/LocationSelect";
import { useTenantLocationConfig } from "@/hooks/useTenantLocationConfig";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "sonner";
import { User, MapPin, Loader2, CheckCircle2, Crown, AlertTriangle, MessageCircle } from "lucide-react";
import { trackLead, pushToDataLayer } from "@/lib/trackingUtils";
import { normalizePhoneToE164 } from "@/utils/phoneNormalizer";
import { MaskedDateInput, parseDateBR, isValidDateBR, isNotFutureDate } from "@/components/ui/masked-date-input";
import { generateLeaderVerificationUrl } from "@/lib/urlHelper";
import { buildWhatsAppLink } from "@/lib/whatsappLink";
import logo from "@/assets/logo-rafael-prudente.png";

interface VerificationSettings {
  verification_method: string | null;
  verification_wa_enabled: boolean;
  verification_wa_test_mode: boolean;
  verification_wa_keyword: string | null;
  verification_wa_whitelist: string[] | null;
  verification_wa_zapi_phone: string | null;
}

// Constante para identificar versão do código (debug)
const FORM_VERSION = "2.0.0-verificacao-fix";

const formSchema = z.object({
  nome: z.string().min(3, "Nome deve ter pelo menos 3 caracteres").max(100),
  email: z.string().email("E-mail inválido").max(255),
  whatsapp: z.string().min(10, "WhatsApp inválido").max(15),
  data_nascimento: z.string()
    .min(10, "Data de nascimento é obrigatória")
    .refine((val) => isValidDateBR(val), "Data inválida. Use o formato DD/MM/AAAA")
    .refine((val) => isNotFutureDate(val), "Data não pode ser futura"),
  cidade_id: z.string().min(1, "Selecione sua região"),
  endereco: z.string().min(5, "Endereço deve ter pelo menos 5 caracteres").max(500),
  consentimento: z.boolean().refine(val => val === true, "Você deve aceitar os termos")
});

type FormData = z.infer<typeof formSchema>;

export default function LeaderRegistrationForm() {
  const { leaderToken } = useParams<{ leaderToken: string }>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localidade, setLocalidade] = useState("");
  const locationConfig = useTenantLocationConfig();
  const [isSuccess, setIsSuccess] = useState(false);
  const [isNewLeader, setIsNewLeader] = useState(false);
  const [isAlreadyLeader, setIsAlreadyLeader] = useState(false);
  const [isAlreadyContact, setIsAlreadyContact] = useState(false);
  const [alreadyReferredByOther, setAlreadyReferredByOther] = useState(false);
  const [hierarchyLevelExceeded, setHierarchyLevelExceeded] = useState(false);
  const [originalLeaderName, setOriginalLeaderName] = useState<string | null>(null);
  const [newLeaderAffiliateToken, setNewLeaderAffiliateToken] = useState<string | null>(null);
  const [registeredPhone, setRegisteredPhone] = useState<string | null>(null);
  const [useWhatsAppVerification, setUseWhatsAppVerification] = useState(false);
  const [whatsAppKeyword, setWhatsAppKeyword] = useState<string>("CONFIRMAR");
  const [whatsAppPhone, setWhatsAppPhone] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState<string | null>(null);

  // Buscar líder pelo affiliate_token
  const { data: leader, isLoading: leaderLoading, error: leaderError } = useQuery({
    queryKey: ["leader_by_token", leaderToken],
    queryFn: async () => {
      if (!leaderToken) return null;

      // Usar função RPC SECURITY DEFINER para buscar líder (bypassa RLS para usuários públicos)
      const { data, error } = await supabase
        .rpc("get_leader_by_affiliate_token", { _token: leaderToken });

      if (error) throw error;
      if (!data || data.length === 0) return null;

      // Mapear para estrutura esperada pelo componente
      return {
        id: data[0].id,
        nome_completo: data[0].nome_completo,
        cidade_id: data[0].cidade_id,
        cidade: { nome: data[0].cidade_nome }
      };
    },
    enabled: !!leaderToken
  });

  // Buscar cidades (regiões do DF)
  const { data: cities = [] } = useQuery({
    queryKey: ["office_cities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("office_cities")
        .select("id, nome")
        .eq("status", "active")
        .order("nome");

      if (error) throw error;
      return data;
    }
  });

  // Buscar configurações via secure RPC (only safe columns - no API credentials)
  const { data: settings } = useQuery({
    queryKey: ["public_form_settings"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_public_form_settings");
      if (error) throw error;
      return data?.[0] || null;
    }
  });

  // Buscar configurações de verificação via WhatsApp
  const { data: verificationSettings } = useQuery<VerificationSettings | null>({
    queryKey: ["verification_settings"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_verification_settings");
      if (error) {
        console.error("[LeaderRegistrationForm] Erro ao buscar verification_settings:", error);
        return null;
      }
      if (!data || data.length === 0) return null;
      return data[0] as VerificationSettings;
    }
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome: "",
      email: "",
      whatsapp: "",
      data_nascimento: "",
      cidade_id: "",
      endereco: "",
      consentimento: false
    }
  });

  const onSubmit = async (data: FormData) => {
    if (!leader) return;

    setIsSubmitting(true);
    try {
      // Normalizar telefone
      const telefone_norm = normalizePhoneToE164(data.whatsapp);

      // Converter data DD/MM/AAAA para YYYY-MM-DD
      const dataNascimentoISO = parseDateBR(data.data_nascimento);

      // Usar nova função RPC para criar líder diretamente na hierarquia
      const { data: result, error } = await supabase.rpc('register_leader_from_affiliate', {
        p_nome: data.nome.trim(),
        p_email: data.email.trim().toLowerCase(),
        p_telefone_norm: telefone_norm,
        p_data_nascimento: dataNascimentoISO || '',
        p_cidade_id: data.cidade_id,
        p_endereco: data.endereco.trim(),
        p_referring_leader_id: leader.id
      });

      if (error) {
        console.error("RPC error:", error);
        throw error;
      }

      const leaderResult = result?.[0];

      // Se não retornou resultado, erro genérico
      if (!leaderResult) {
        throw new Error("Erro ao processar cadastro. Tente novamente.");
      }

      // Já é líder ativo?
      if (leaderResult.is_already_leader) {
        setIsAlreadyLeader(true);
        setIsSuccess(true);
        setIsSubmitting(false);
        toast.info("Você já é um apoiador cadastrado!");
        return;
      }

      // is_already_contact não bloqueia mais - cadastro sempre prossegue
      // Se ambos telefone e email coincidirem, o contato é desativado automaticamente pela RPC

      // Já está indicado por OUTRO líder - bloquear
      if (leaderResult.already_referred_by_other_leader) {
        setOriginalLeaderName(leaderResult.original_leader_name || "outro apoiador");
        setAlreadyReferredByOther(true);
        setIsSuccess(true);
        setIsSubmitting(false);
        return;
      }

      // Hierarquia máxima atingida
      if (leaderResult.hierarchy_level_exceeded) {
        setHierarchyLevelExceeded(true);
        setIsSuccess(true);
        setIsSubmitting(false);
        toast.error("Nível máximo de hierarquia atingido.");
        return;
      }

      // Novo líder criado com sucesso!
      if (leaderResult?.leader_id && leaderResult?.verification_code) {
        setNewLeaderAffiliateToken(leaderResult.affiliate_token);
        setIsNewLeader(true);
        setRegisteredPhone(telefone_norm);

        // SEMPRE usa URL de produção (via função dedicada)
        const verificationLink = generateLeaderVerificationUrl(leaderResult.verification_code);

        // Verificar se deve usar WhatsApp ou SMS para verificação
        const shouldUseWhatsApp =
          (verificationSettings?.verification_method === 'whatsapp_consent' ||
           verificationSettings?.verification_method === 'whatsapp_meta_cloud') &&
          verificationSettings?.verification_wa_enabled === true;

        // Em modo de teste, verificar se o número está na whitelist
        let phoneInWhitelist = true;
        if (shouldUseWhatsApp && verificationSettings?.verification_wa_test_mode) {
          const whitelist = verificationSettings?.verification_wa_whitelist || [];
          // Normalizar números da whitelist para comparação
          const normalizedWhitelist = whitelist.map((p: string) =>
            p.replace(/\D/g, '').replace(/^55/, '')
          );
          const phoneToCheck = telefone_norm.replace(/\D/g, '').replace(/^55/, '');
          phoneInWhitelist = normalizedWhitelist.some((wp: string) =>
            wp.endsWith(phoneToCheck.slice(-8)) || phoneToCheck.endsWith(wp.slice(-8))
          );
          console.log(`[LeaderRegistrationForm] Test mode: phone ${telefone_norm} in whitelist: ${phoneInWhitelist}`, {
            whitelist,
            normalizedWhitelist,
            phoneToCheck
          });
        }

        const useWhatsApp = shouldUseWhatsApp && phoneInWhitelist;

        console.log(`[LeaderRegistrationForm v${FORM_VERSION}] === VERIFICAÇÃO ===`, {
          method: verificationSettings?.verification_method,
          waEnabled: verificationSettings?.verification_wa_enabled,
          testMode: verificationSettings?.verification_wa_test_mode,
          whitelist: verificationSettings?.verification_wa_whitelist,
          phoneInWhitelist,
          useWhatsApp,
          phone: telefone_norm
        });

        if (useWhatsApp) {
          // USAR WHATSAPP: Não enviar SMS, mostrar botão do WhatsApp
          console.log(`[LeaderRegistrationForm v${FORM_VERSION}] Usando verificação via WhatsApp - NÃO enviando SMS`);
          setUseWhatsAppVerification(true);
          setWhatsAppKeyword(verificationSettings?.verification_wa_keyword || "CONFIRMAR");
          setWhatsAppPhone(verificationSettings?.verification_wa_zapi_phone || null);

          // Criar verificação WhatsApp na tabela contact_verifications (token validado por process_verification_keyword)
          try {
            const { data: waVerification, error: waVerificationError } = await (supabase.rpc as any)("create_whatsapp_verification", {
              _contact_type: "leader",
              _contact_id: leaderResult.leader_id,
              _phone: telefone_norm,
            });

            if (waVerificationError) throw waVerificationError;

            const waToken = waVerification?.[0]?.token;
            setVerificationCode(waToken || leaderResult.verification_code);
          } catch (waError) {
            console.error("[LeaderRegistrationForm] Error creating WhatsApp verification:", waError);
            // Fallback para manter a UI utilizável (embora o backend valide pelo token de contact_verifications)
            setVerificationCode(leaderResult.verification_code);
          }

          // NÃO atualiza verification_sent_at ainda - será atualizado quando o user enviar a mensagem
        } else {
          // USAR SMS: Fluxo padrão
          console.log(`[LeaderRegistrationForm v${FORM_VERSION}] Usando verificação via SMS`);

          // DEBUG: Identificar versão do código - CRÍTICO para debug
          console.log(`[LeaderRegistrationForm v${FORM_VERSION}] Dados SMS:`, {
            phone: telefone_norm,
            templateSlug: "verificacao-lider-sms",
            verificationLink,
            leaderName: data.nome.trim(),
            leaderId: leaderResult.leader_id,
            timestamp: new Date().toISOString()
          });

          // Enviar SMS de VERIFICAÇÃO
          const smsResult = await supabase.functions.invoke("send-sms", {
            body: {
              phone: telefone_norm,
              templateSlug: "verificacao-lider-sms",
              variables: {
                nome: data.nome.trim(),
                link_verificacao: verificationLink,
              },
            },
          });

          console.log(`[LeaderRegistrationForm v${FORM_VERSION}] Resultado SMS:`, smsResult);

          if (smsResult.error) {
            console.error(`[LeaderRegistrationForm v${FORM_VERSION}] ERRO ao enviar SMS:`, smsResult.error);
          }

          // Atualizar verification_sent_at
          await supabase.rpc("update_leader_verification_sent", {
            _leader_id: leaderResult.leader_id,
          });
        }

        // Tracking
        trackLead({ content_name: "leader_registration_promotion" });
        pushToDataLayer("new_leader_registered", {
          source: "leader_referral",
          referring_leader_id: leader.id,
          new_leader_id: leaderResult.leader_id
        });

        toast.success("Cadastro realizado! Verifique seu celular para confirmar.");
      }

      setIsSuccess(true);
    } catch (error: any) {
      console.error("Erro ao cadastrar:", error);

      // Verificar se o erro contém informação de duplicidade (fallback)
      const errorMessage = error?.message?.toLowerCase() || '';
      if (errorMessage.includes('already') || errorMessage.includes('duplicate') || error?.code === '23505') {
        setIsAlreadyLeader(true);
        setIsSuccess(true);
        toast.info("Você já é um apoiador cadastrado!");
        return;
      }

      toast.error(error?.message || "Erro ao realizar cadastro. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading state
  if (leaderLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Líder não encontrado
  if (!leader || leaderError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-muted p-4">
        <img src={logo} alt="Logo" className="h-16 mb-6" />
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center">
            <h2 className="text-xl font-bold text-destructive mb-2">Link Inválido</h2>
            <p className="text-muted-foreground">
              Este link de cadastro não é válido ou o líder não está mais ativo.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Tela de sucesso
  if (isSuccess) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-muted p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            {isAlreadyContact ? (
              <>
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <User className="h-8 w-8 text-blue-600" />
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-2">Você Já Está Cadastrado!</h2>
                <p className="text-muted-foreground mb-4">
                  Identificamos que você já possui um cadastro como contato em nosso sistema.
                  Não é possível criar um novo cadastro como apoiador.
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
                  <p>Se acredita que isso é um erro, entre em contato com a equipe.</p>
                </div>
              </>
            ) : alreadyReferredByOther ? (
              <>
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="h-8 w-8 text-blue-600" />
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-2">Você Já Está Cadastrado!</h2>
                <p className="text-muted-foreground mb-4">
                  Identificamos que você já foi indicado por <strong>{originalLeaderName}</strong>.
                  Seu cadastro continua válido!
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
                  <p>Não é possível alterar a indicação original.</p>
                </div>
              </>
            ) : hierarchyLevelExceeded ? (
              <>
                <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="h-8 w-8 text-amber-600" />
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-2">Limite de Hierarquia Atingido</h2>
                <p className="text-muted-foreground mb-4">
                  Não é possível adicionar mais níveis na estrutura de apoiadores.
                  Entre em contato com a equipe para mais informações.
                </p>
              </>
            ) : isNewLeader ? (
              <>
                <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  {useWhatsAppVerification ? (
                    <MessageCircle className="h-8 w-8 text-green-600" />
                  ) : (
                    <Crown className="h-8 w-8 text-amber-600" />
                  )}
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-2">Falta Apenas uma Etapa!</h2>

                {useWhatsAppVerification ? (
                  <>
                    <p className="text-muted-foreground mb-4">
                      Para confirmar seu cadastro, envie <strong>{whatsAppKeyword} {verificationCode}</strong> pelo WhatsApp clicando no botão abaixo.
                    </p>
                    {(() => {
                      const phone = whatsAppPhone?.replace(/\D/g, "") || "5561981894692";
                      const messageText = `${whatsAppKeyword} ${verificationCode}`;
                      const href = buildWhatsAppLink(phone, messageText);

                      return (
                        <Button asChild className="w-full bg-green-600 hover:bg-green-700 text-white mb-4">
                          <a href={href} target="_blank" rel="noreferrer">
                            <MessageCircle className="h-5 w-5 mr-2" />
                            Confirmar via WhatsApp
                          </a>
                        </Button>
                      );
                    })()}
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800">
                      <p className="font-semibold mb-1">📱 Clique no botão acima!</p>
                      <p>Após enviar "{whatsAppKeyword} {verificationCode}", você receberá automaticamente seu link de indicação.</p>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-muted-foreground mb-4">
                      Enviamos um <strong>SMS de verificação</strong> para seu celular.
                      Clique no link para confirmar seu cadastro e receber seu link exclusivo de indicação.
                    </p>
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
                      <p className="font-semibold mb-1">📱 Verifique seu celular!</p>
                      <p>O link de indicação será liberado após a confirmação.</p>
                    </div>
                  </>
                )}

                <p className="text-sm text-muted-foreground mt-4">
                  Indicado por: <strong>{leader.nome_completo}</strong>
                </p>
              </>
            ) : isAlreadyLeader ? (
              <>
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-2">Você já é um Apoiador!</h2>
                <p className="text-muted-foreground mb-4">
                  Identificamos que você já faz parte da nossa rede de apoiadores. Continue engajado!
                </p>
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>
    );
  }

  const cityName = leader.cidade && typeof leader.cidade === 'object' && 'nome' in leader.cidade
    ? (leader.cidade as { nome: string }).nome
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      {/* Cover Image with Fade and Centered Logo */}
      <div className="relative h-56 md:h-72 w-full overflow-hidden">
        {/* Background image or gradient */}
        {settings?.affiliate_form_cover_url ? (
          <img
            src={settings.affiliate_form_cover_url}
            alt="Capa"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary to-primary/60" />
        )}

        {/* Fade effect - gradient from bottom to top */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />

        {/* Centered Logo */}
        <div className="absolute inset-0 flex items-center justify-center">
          <img
            src={settings?.affiliate_form_logo_url || logo}
            alt="Logo"
            className="h-20 md:h-24 drop-shadow-lg object-contain"
          />
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-8 -mt-8">

        {/* Leader Info */}
        <Card className="mb-6 border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center">
                <User className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Indicado por</p>
                <p className="font-semibold text-foreground">{leader.nome_completo}</p>
                {cityName && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {cityName}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-center">Formulário de Cadastro</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="nome"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome Completo *</FormLabel>
                      <FormControl>
                        <Input placeholder="Seu nome completo" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-mail *</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="seu@email.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="whatsapp"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>WhatsApp *</FormLabel>
                      <FormControl>
                        <Input placeholder="(61) 99999-9999" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="data_nascimento"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data de Nascimento *</FormLabel>
                      <FormControl>
                        <MaskedDateInput value={field.value} onChange={field.onChange} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="cidade_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{locationConfig.label} *</FormLabel>
                      <FormControl>
                        <LocationSelect
                          value={field.value}
                          localidadeValue={localidade}
                          onLocationChange={({ cidadeId: cid, localidade: loc }) => {
                            field.onChange(cid || "");
                            setLocalidade(loc || "");
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="endereco"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Endereço Completo *</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Rua, número, complemento, bairro, CEP"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="consentimento"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="text-sm font-normal">
                          Concordo com os termos de uso e política de privacidade (LGPD).
                          Autorizo o armazenamento e uso dos meus dados para contato.
                        </FormLabel>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    "Enviar Cadastro"
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <p className="text-xs text-center text-muted-foreground mt-6">
          Seus dados estão protegidos pela Lei Geral de Proteção de Dados (LGPD).
        </p>
      </div>
    </div>
  );
}