import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lgpdRightsLimiter } from "@/lib/rateLimiter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft,
  Shield,
  CheckCircle2,
  Loader2,
  FileText,
  User,
  Trash2,
  Download,
  Edit,
  Info,
  XCircle,
  Eye,
} from "lucide-react";
import { toast } from "sonner";

// ── Schema ────────────────────────────────────────────────────
const schema = z.object({
  requester_name: z.string().min(3, "Nome completo obrigatório (mínimo 3 caracteres)"),
  requester_email: z.string().email("E-mail inválido"),
  requester_phone: z.string().optional(),
  request_type: z.enum(
    ["access", "correction", "deletion", "portability", "revoke_consent", "anonymization", "info"],
    { required_error: "Selecione o tipo de solicitação" }
  ),
  description: z.string().min(10, "Descreva sua solicitação (mínimo 10 caracteres)"),
  lgpd_consent: z.literal(true, {
    errorMap: () => ({ message: "Você precisa aceitar os termos para enviar a solicitação" }),
  }),
});

type FormValues = z.infer<typeof schema>;

// ── Request type options ──────────────────────────────────────
const REQUEST_TYPES = [
  {
    value: "access",
    label: "Acesso aos meus dados",
    description: "Receber uma cópia de todos os dados pessoais tratados",
    icon: Eye,
    article: "Art. 18, II",
  },
  {
    value: "correction",
    label: "Correção de dados",
    description: "Corrigir dados incompletos, inexatos ou desatualizados",
    icon: Edit,
    article: "Art. 18, III",
  },
  {
    value: "deletion",
    label: "Exclusão de dados",
    description: "Eliminar dados pessoais tratados com o consentimento",
    icon: Trash2,
    article: "Art. 18, VI",
  },
  {
    value: "portability",
    label: "Portabilidade dos dados",
    description: "Exportar dados em formato estruturado e interoperável",
    icon: Download,
    article: "Art. 18, V",
  },
  {
    value: "revoke_consent",
    label: "Revogação de consentimento",
    description: "Revogar o consentimento dado anteriormente",
    icon: XCircle,
    article: "Art. 18, IX",
  },
  {
    value: "anonymization",
    label: "Anonimização ou bloqueio",
    description: "Anonimizar ou bloquear dados desnecessários ou excessivos",
    icon: Shield,
    article: "Art. 18, IV",
  },
  {
    value: "info",
    label: "Informações sobre o tratamento",
    description: "Saber com quais entidades os dados foram compartilhados",
    icon: Info,
    article: "Art. 18, VII",
  },
] as const;

// ── Component ─────────────────────────────────────────────────
const LgpdDireitos = () => {
  const [submitted, setSubmitted] = useState(false);
  const [protocol, setProtocol] = useState("");

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const selectedType = watch("request_type");
  const lgpdConsent = watch("lgpd_consent");

  const selectedTypeInfo = REQUEST_TYPES.find((t) => t.value === selectedType);

  const onSubmit = async (data: FormValues) => {
    // Client-side rate limiting
    if (!lgpdRightsLimiter.isAllowed()) {
      const secs = lgpdRightsLimiter.retryAfterSeconds();
      const mins = Math.ceil(secs / 60);
      toast.error(`Muitas solicitações. Tente novamente em ${mins} minuto${mins !== 1 ? "s" : ""}.`);
      return;
    }

    try {
      // Insert into lgpd_rights_requests (public insert, no auth required)
      const { data: inserted, error } = await supabase
        .from("lgpd_rights_requests")
        .insert({
          requester_name: data.requester_name,
          requester_email: data.requester_email,
          requester_phone: data.requester_phone || null,
          request_type: data.request_type,
          description: data.description,
          status: "pending",
          user_agent: navigator.userAgent.slice(0, 200),
          ip_address: "", // populated by DB/edge
        })
        .select("id")
        .single();

      if (error) throw error;

      // Generate a short protocol number from the UUID
      const protocolNumber = (inserted?.id as string)?.slice(0, 8).toUpperCase();
      setProtocol(protocolNumber || "---");
      lgpdRightsLimiter.record();
      setSubmitted(true);

      toast.success("Solicitação enviada com sucesso!");
    } catch (err: unknown) {
      toast.error((err as Error).message || "Erro ao enviar solicitação. Tente novamente.");
    }
  };

  // ── Success screen ────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
        <Card className="max-w-lg w-full">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
            </div>
            <h2 className="text-xl font-bold">Solicitação enviada!</h2>
            <p className="text-muted-foreground text-sm">
              Sua solicitação foi registrada com sucesso. Você receberá uma resposta em até{" "}
              <strong>15 dias úteis</strong>, conforme o prazo previsto na LGPD.
            </p>
            {protocol && (
              <div className="bg-muted/50 rounded-lg px-4 py-3 inline-block">
                <p className="text-xs text-muted-foreground">Número do protocolo</p>
                <p className="text-lg font-mono font-bold text-primary">{protocol}</p>
                <p className="text-xs text-muted-foreground">Guarde este número para acompanhamento</p>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Dúvidas? Entre em contato com nosso DPO:{" "}
              <a href="mailto:dpo@eleitor360.ai" className="text-primary underline">
                dpo@eleitor360.ai
              </a>
            </p>
            <div className="flex gap-2 justify-center pt-2">
              <Link to="/">
                <Button variant="outline" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar ao início
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Form ──────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar ao início
        </Link>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Exercício de Direitos – LGPD</h1>
              <p className="text-sm text-muted-foreground">Lei Geral de Proteção de Dados – Lei nº 13.709/2018</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Como titular de dados pessoais, você pode exercer os direitos previstos no{" "}
            <strong>Art. 18 da LGPD</strong>. Preencha o formulário abaixo e responderemos em até{" "}
            <strong>15 dias úteis</strong>.
          </p>
        </div>

        {/* Rights overview cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-8">
          {REQUEST_TYPES.slice(0, 6).map(({ value, label, icon: Icon, article }) => (
            <button
              key={value}
              type="button"
              onClick={() => setValue("request_type", value as FormValues["request_type"], { shouldValidate: true })}
              className={`rounded-lg border p-3 text-left text-xs transition-colors hover:border-primary/50 ${
                selectedType === value
                  ? "border-primary bg-primary/5"
                  : "border-border bg-muted/20"
              }`}
            >
              <Icon className={`h-4 w-4 mb-1.5 ${selectedType === value ? "text-primary" : "text-muted-foreground"}`} />
              <p className="font-medium text-foreground leading-tight">{label}</p>
              <p className="text-muted-foreground mt-0.5">{article}</p>
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4" />
                Seus dados de identificação
              </CardTitle>
              <CardDescription className="text-xs">
                Necessários para verificar sua identidade e responder à solicitação
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="requester_name">
                    Nome completo <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="requester_name"
                    placeholder="Seu nome completo"
                    {...register("requester_name")}
                    className={errors.requester_name ? "border-destructive" : ""}
                  />
                  {errors.requester_name && (
                    <p className="text-xs text-destructive">{errors.requester_name.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="requester_email">
                    E-mail <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="requester_email"
                    type="email"
                    placeholder="seu@email.com"
                    {...register("requester_email")}
                    className={errors.requester_email ? "border-destructive" : ""}
                  />
                  {errors.requester_email && (
                    <p className="text-xs text-destructive">{errors.requester_email.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="requester_phone">Telefone (opcional)</Label>
                <Input
                  id="requester_phone"
                  type="tel"
                  placeholder="(61) 99999-9999"
                  {...register("requester_phone")}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Detalhes da solicitação
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="request_type">
                  Tipo de solicitação <span className="text-destructive">*</span>
                </Label>
                <Select
                  onValueChange={(v) =>
                    setValue("request_type", v as FormValues["request_type"], { shouldValidate: true })
                  }
                  value={selectedType}
                >
                  <SelectTrigger className={errors.request_type ? "border-destructive" : ""}>
                    <SelectValue placeholder="Selecione o tipo de solicitação" />
                  </SelectTrigger>
                  <SelectContent>
                    {REQUEST_TYPES.map(({ value, label, article }) => (
                      <SelectItem key={value} value={value}>
                        {label} — {article}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.request_type && (
                  <p className="text-xs text-destructive">{errors.request_type.message}</p>
                )}
                {selectedTypeInfo && (
                  <p className="text-xs text-muted-foreground">{selectedTypeInfo.description}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="description">
                  Descrição da solicitação <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="description"
                  placeholder="Descreva com detalhes o que você solicita..."
                  rows={4}
                  {...register("description")}
                  className={errors.description ? "border-destructive" : ""}
                />
                {errors.description && (
                  <p className="text-xs text-destructive">{errors.description.message}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Consent checkbox */}
          <div className="rounded-lg border border-border/50 p-4 bg-muted/20 space-y-2">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-border"
                checked={!!lgpdConsent}
                onChange={(e) =>
                  setValue("lgpd_consent", e.target.checked as true, { shouldValidate: true })
                }
              />
              <span className="text-sm text-muted-foreground">
                Autorizo o tratamento dos dados pessoais fornecidos neste formulário para
                fins de análise e resposta à minha solicitação, conforme a{" "}
                <Link to="/politica-de-privacidade" className="text-primary underline" target="_blank">
                  Política de Privacidade
                </Link>{" "}
                e a LGPD (Art. 7º, I).{" "}
                <span className="text-destructive">*</span>
              </span>
            </label>
            {errors.lgpd_consent && (
              <p className="text-xs text-destructive">{errors.lgpd_consent.message}</p>
            )}
          </div>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Shield className="h-4 w-4 mr-2" />
            )}
            Enviar Solicitação
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            Prazo de resposta: até <strong>15 dias úteis</strong> conforme LGPD Art. 18 §4.
            <br />
            DPO:{" "}
            <a href="mailto:dpo@eleitor360.ai" className="text-primary underline">
              dpo@eleitor360.ai
            </a>
          </p>
        </form>
      </div>
    </div>
  );
};

export default LgpdDireitos;
