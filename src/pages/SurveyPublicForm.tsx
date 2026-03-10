import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LocationSelect } from "@/components/office/LocationSelect";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  ClipboardList 
} from "lucide-react";
import { useSurvey, useSurveyQuestions, useSubmitSurveyResponse } from "@/hooks/surveys/useSurveys";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const normalizePhone = (phone: string): string => {
  let clean = phone.replace(/[^0-9]/g, "");
  if (clean.startsWith("55")) clean = clean.substring(2);
  if (clean.length === 10 && clean.startsWith("61")) clean = "61" + "9" + clean.substring(2);
  if (clean.length === 9) clean = "61" + clean;
  if (clean.length === 8) clean = "619" + clean;
  return "+55" + clean;
};

interface RegistrationData {
  nome: string;
  whatsapp: string;
  email: string;
  cidadeId: string;
  lgpdConsent: boolean;
}

export default function SurveyPublicForm() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const refToken = searchParams.get("ref");

  const { data: survey, isLoading: loadingSurvey, error: surveyError } = useSurvey(slug);
  const { data: questions, isLoading: loadingQuestions } = useSurveyQuestions(survey?.id);
  const submitResponse = useSubmitSurveyResponse();

  const [step, setStep] = useState<"register" | "questions" | "success">("register");
  const [registration, setRegistration] = useState<RegistrationData>({
    nome: "",
    whatsapp: "",
    email: "",
    cidadeId: "",
    lgpdConsent: false,
  });

  // Fetch cities for region dropdown
  const { data: cities } = useQuery({
    queryKey: ['office_cities_public'],
    queryFn: async () => {
      const { data } = await supabase
        .from('office_cities')
        .select('id, nome')
        .eq('status', 'active')
        .order('nome');
      return data || [];
    }
  });
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [contactId, setContactId] = useState<string | null>(null);
  const [leaderId, setLeaderId] = useState<string | null>(null);
  const [isLeader, setIsLeader] = useState(false);
  const [referrerLeaderId, setReferrerLeaderId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch referrer leader info
  useEffect(() => {
    const fetchReferrer = async () => {
      if (!refToken) return;
      
      const { data } = await supabase
        .rpc("get_leader_by_affiliate_token", { _token: refToken });
      
      if (data && data.length > 0) {
        setReferrerLeaderId(data[0].id);
      }
    };
    fetchReferrer();
  }, [refToken]);

  const handleRegistrationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registration.cidadeId) {
      toast.error("Por favor, selecione sua região");
      return;
    }
    if (!registration.lgpdConsent) {
      toast.error("Você precisa aceitar os termos para continuar");
      return;
    }

    setIsSubmitting(true);

    try {
      const normalizedPhone = normalizePhone(registration.whatsapp);

      // Check if it's a leader
      const { data: leaderData } = await supabase
        .rpc("get_leader_by_phone_or_email", { 
          _phone: normalizedPhone, 
          _email: registration.email 
        });

      if (leaderData) {
        setIsLeader(true);
        setLeaderId(leaderData);
        setContactId(null);
      } else {
        // Create or update contact
        const { data: newContactId } = await supabase.rpc("upsert_contact_from_public_form", {
          _nome: registration.nome,
          _telefone_norm: normalizedPhone,
          _email: registration.email,
          _cidade_id: registration.cidadeId,
          _source_type: "pesquisa",
          _source_id: referrerLeaderId || null,
          _utm_source: searchParams.get("utm_source"),
          _utm_medium: searchParams.get("utm_medium"),
          _utm_campaign: searchParams.get("utm_campaign"),
          _utm_content: searchParams.get("utm_content"),
        });

        setContactId(newContactId);
        setIsLeader(false);
      }

      setStep("questions");
    } catch (error) {
      console.error("Erro no cadastro:", error);
      toast.error("Erro ao processar cadastro");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitAnswers = async () => {
    if (!survey) return;

    // Validate required questions
    const requiredQuestions = questions?.filter(q => q.obrigatoria) || [];
    const missingAnswers = requiredQuestions.filter(q => !answers[q.id]);
    
    if (missingAnswers.length > 0) {
      toast.error("Por favor, responda todas as perguntas obrigatórias");
      return;
    }

    setIsSubmitting(true);

    try {
      await submitResponse.mutateAsync({
        survey_id: survey.id,
        contact_id: contactId || undefined,
        leader_id: isLeader ? leaderId || undefined : undefined,
        referred_by_leader_id: (!isLeader && referrerLeaderId) ? referrerLeaderId : undefined,
        respostas: answers,
        is_leader: isLeader,
        utm_source: searchParams.get("utm_source") || undefined,
        utm_medium: searchParams.get("utm_medium") || undefined,
        utm_campaign: searchParams.get("utm_campaign") || undefined,
        utm_content: searchParams.get("utm_content") || undefined,
      });

      // Send thank you message
      try {
        await supabase.functions.invoke("send-whatsapp", {
          body: {
            phone: registration.whatsapp,
            templateSlug: "pesquisa-agradecimento",
            variables: {
              nome: registration.nome.split(" ")[0],
              pesquisa_titulo: survey.titulo,
            },
          },
        });
      } catch (err) {
        console.log("WhatsApp agradecimento não enviado:", err);
      }

      setStep("success");
    } catch (error) {
      console.error("Erro ao enviar respostas:", error);
      toast.error("Erro ao enviar respostas");
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateAnswer = (questionId: string, value: any) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  if (loadingSurvey || loadingQuestions) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (surveyError || !survey || survey.status !== "active") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Pesquisa não disponível</h2>
            <p className="text-muted-foreground">
              Esta pesquisa não está mais ativa ou não foi encontrada.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground py-8 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <ClipboardList className="h-12 w-12 mx-auto mb-4 opacity-80" />
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">{survey.titulo}</h1>
          {survey.descricao && (
            <p className="text-primary-foreground/80">{survey.descricao}</p>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 -mt-8">
        {step === "register" && (
          <Card>
            <CardHeader>
              <CardTitle>Identificação</CardTitle>
              <p className="text-sm text-muted-foreground">
                Preencha seus dados para participar da pesquisa
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleRegistrationSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome Completo *</Label>
                  <Input
                    id="nome"
                    value={registration.nome}
                    onChange={(e) => setRegistration({ ...registration, nome: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="whatsapp">WhatsApp *</Label>
                  <Input
                    id="whatsapp"
                    type="tel"
                    placeholder="(61) 99999-9999"
                    value={registration.whatsapp}
                    onChange={(e) => setRegistration({ ...registration, whatsapp: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={registration.email}
                    onChange={(e) => setRegistration({ ...registration, email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cidade">Região onde mora *</Label>
                  <Select
                    value={registration.cidadeId}
                    onValueChange={(value) => setRegistration({ ...registration, cidadeId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione sua região" />
                    </SelectTrigger>
                    <SelectContent>
                      {cities?.map((city) => (
                        <SelectItem key={city.id} value={city.id}>
                          {city.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="lgpd"
                    checked={registration.lgpdConsent}
                    onCheckedChange={(checked) => 
                      setRegistration({ ...registration, lgpdConsent: checked as boolean })
                    }
                  />
                  <Label htmlFor="lgpd" className="text-sm leading-relaxed">
                    Concordo com o tratamento dos meus dados pessoais conforme a LGPD para 
                    fins de pesquisa e comunicação.
                  </Label>
                </div>
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : null}
                  Continuar para Pesquisa
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {step === "questions" && questions && (
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">
                  Olá, <strong>{registration.nome.split(" ")[0]}</strong>! 
                  Responda as perguntas abaixo. Sua opinião é muito importante.
                </p>
              </CardContent>
            </Card>

            {questions.map((question, index) => (
              <Card key={question.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3 mb-4">
                    <Badge variant="outline" className="shrink-0">{index + 1}</Badge>
                    <div>
                      <p className="font-medium">{question.pergunta}</p>
                      {question.obrigatoria && (
                        <span className="text-xs text-destructive">* Obrigatória</span>
                      )}
                    </div>
                  </div>

                  {question.tipo === "multipla_escolha" && question.opcoes && (
                    <RadioGroup
                      value={answers[question.id] || ""}
                      onValueChange={(value) => updateAnswer(question.id, value)}
                    >
                      {question.opcoes.map((option, i) => (
                        <div key={i} className="flex items-center space-x-2">
                          <RadioGroupItem value={option} id={`${question.id}-${i}`} />
                          <Label htmlFor={`${question.id}-${i}`}>{option}</Label>
                        </div>
                      ))}
                    </RadioGroup>
                  )}

                  {question.tipo === "sim_nao" && (
                    <RadioGroup
                      value={answers[question.id] || ""}
                      onValueChange={(value) => updateAnswer(question.id, value)}
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Sim" id={`${question.id}-sim`} />
                        <Label htmlFor={`${question.id}-sim`}>Sim</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Não" id={`${question.id}-nao`} />
                        <Label htmlFor={`${question.id}-nao`}>Não</Label>
                      </div>
                    </RadioGroup>
                  )}

                  {question.tipo === "escala" && (
                    <div className="flex justify-between gap-2">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Button
                          key={n}
                          type="button"
                          variant={answers[question.id] === n ? "default" : "outline"}
                          className="flex-1"
                          onClick={() => updateAnswer(question.id, n)}
                        >
                          {n}
                        </Button>
                      ))}
                    </div>
                  )}

                  {question.tipo === "nps" && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Nada provável</span>
                        <span>Muito provável</span>
                      </div>
                      <div className="grid grid-cols-11 gap-1">
                        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                          <Button
                            key={n}
                            type="button"
                            size="sm"
                            variant={answers[question.id] === n ? "default" : "outline"}
                            onClick={() => updateAnswer(question.id, n)}
                          >
                            {n}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  {question.tipo === "texto_curto" && (
                    <Input
                      placeholder="Sua resposta..."
                      value={answers[question.id] || ""}
                      onChange={(e) => updateAnswer(question.id, e.target.value)}
                      maxLength={150}
                    />
                  )}

                  {question.tipo === "texto_longo" && (
                    <Textarea
                      placeholder="Sua resposta..."
                      value={answers[question.id] || ""}
                      onChange={(e) => updateAnswer(question.id, e.target.value)}
                      rows={4}
                      maxLength={500}
                    />
                  )}
                </CardContent>
              </Card>
            ))}

            <Button 
              onClick={handleSubmitAnswers} 
              className="w-full" 
              size="lg"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Enviar Respostas
            </Button>
          </div>
        )}

        {step === "success" && (
          <Card>
            <CardContent className="pt-8 pb-8 text-center">
              <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Obrigado!</h2>
              <p className="text-muted-foreground">
                Sua participação na pesquisa "{survey.titulo}" foi registrada com sucesso.
              </p>
              <p className="text-muted-foreground mt-2">
                Sua opinião é muito importante para nós!
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
