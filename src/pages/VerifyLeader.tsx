import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { CheckCircle, XCircle, Loader2, AlertCircle, Crown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface VerificationResult {
  success: boolean;
  already_verified?: boolean;
  nome?: string;
  leader_id?: string;
  affiliate_token?: string;
  error?: string;
  message?: string;
}

export default function VerifyLeader() {
  const { codigo } = useParams<{ codigo: string }>();
  const { data: organization } = useOrganization();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<VerificationResult | null>(null);

  useEffect(() => {
    async function verifyLeader() {
      if (!codigo) {
        setResult({ success: false, error: "no_code", message: "Código não fornecido." });
        setLoading(false);
        return;
      }

      try {
        console.log("[VerifyLeader] Iniciando verificação com código:", codigo);
        const { data, error } = await supabase.rpc("verify_leader_by_code", {
          _code: codigo,
        });

        if (error) {
          console.error("[VerifyLeader] Erro na verificação RPC:", error);
          setResult({ success: false, error: "rpc_error", message: "Erro ao verificar cadastro." });
        } else {
          const verificationResult = data as unknown as VerificationResult;
          console.log("[VerifyLeader] Resultado da verificação:", verificationResult);
          setResult(verificationResult);

          // Após verificação bem-sucedida, chamar edge function para enviar links de afiliado
          if (verificationResult.success && !verificationResult.already_verified && verificationResult.leader_id) {
            console.log("[VerifyLeader] Líder verificado! Chamando send-leader-affiliate-links para:", verificationResult.leader_id);
            try {
              const { error: sendError } = await supabase.functions.invoke("send-leader-affiliate-links", {
                body: { leader_id: verificationResult.leader_id },
              });
              if (sendError) {
                console.error("[VerifyLeader] Erro ao enviar links de afiliado:", sendError);
              } else {
                console.log("[VerifyLeader] Links de afiliado enviados com sucesso!");
              }
            } catch (sendErr) {
              console.error("[VerifyLeader] Exceção ao enviar links:", sendErr);
            }
          }
        }
      } catch (err) {
        console.error("[VerifyLeader] Erro inesperado:", err);
        setResult({ success: false, error: "unknown", message: "Erro inesperado." });
      } finally {
        setLoading(false);
      }
    }

    verifyLeader();
  }, [codigo]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-8 flex flex-col items-center gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-muted-foreground">Verificando seu cadastro de apoiador...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-8 pb-8 flex flex-col items-center gap-6">
          {/* Logo */}
          {organization?.logo_url && (
            <img
              src={organization.logo_url}
              alt={organization.nome}
              className="h-16 w-auto object-contain"
            />
          )}

          {result?.success ? (
            <>
              {/* Success Icon */}
              <div className="rounded-full bg-amber-100 p-4">
                <Crown className="h-16 w-16 text-amber-600" />
              </div>

              {/* Success Message */}
              <div className="text-center space-y-2">
                <h1 className="text-2xl font-bold text-foreground">
                  {result.already_verified
                    ? "Cadastro Já Verificado!"
                    : "Bem-vindo(a) à Nossa Rede de Apoiadores!"}
                </h1>

                {result.nome && (
                  <p className="text-lg text-muted-foreground">
                    Olá, <span className="font-semibold text-foreground">{result.nome}</span>!
                  </p>
                )}

                {!result.already_verified ? (
                  <div className="space-y-4">
                    <p className="text-muted-foreground">
                      Seu cadastro como apoiador foi confirmado com sucesso!
                    </p>

                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center justify-center gap-2 text-green-700">
                        <CheckCircle className="h-5 w-5" />
                        <span className="font-medium">Cadastro verificado!</span>
                      </div>
                      <p className="text-sm text-green-600 mt-2">
                        Você receberá seu link exclusivo de indicação via SMS e Email em instantes.
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground">
                    Você já havia confirmado seu cadastro anteriormente.
                    Seu link de indicação já foi enviado.
                  </p>
                )}
              </div>
            </>
          ) : result?.error === "invalid_code" ? (
            <>
              {/* Invalid Code Icon */}
              <div className="rounded-full bg-amber-100 p-4">
                <AlertCircle className="h-16 w-16 text-amber-600" />
              </div>

              {/* Invalid Message */}
              <div className="text-center space-y-2">
                <h1 className="text-2xl font-bold text-foreground">Código Inválido</h1>
                <p className="text-muted-foreground">
                  O código de verificação informado não é válido ou já expirou.
                </p>
              </div>
            </>
          ) : (
            <>
              {/* Error Icon */}
              <div className="rounded-full bg-red-100 p-4">
                <XCircle className="h-16 w-16 text-red-600" />
              </div>

              {/* Error Message */}
              <div className="text-center space-y-2">
                <h1 className="text-2xl font-bold text-foreground">Erro na Verificação</h1>
                <p className="text-muted-foreground">
                  {result?.message || "Ocorreu um erro ao processar sua verificação."}
                </p>
              </div>
            </>
          )}

          {/* Organization Name */}
          <div className="pt-4 border-t w-full text-center">
            <p className="text-sm text-muted-foreground">{organization?.nome || "Plataforma"}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
