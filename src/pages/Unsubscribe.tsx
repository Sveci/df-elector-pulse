import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

type UnsubscribeStatus = "loading" | "success" | "already_unsubscribed" | "error";

export default function Unsubscribe() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<UnsubscribeStatus>("loading");
  const [contactName, setContactName] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");

  const token = searchParams.get("token");

  useEffect(() => {
    async function processUnsubscribe() {
      if (!token) {
        setStatus("error");
        setErrorMessage("Token de descadastro não fornecido.");
        return;
      }

      try {
        const { data, error } = await supabase.rpc("unsubscribe_contact_by_token", {
          p_token: token,
          p_reason: "Solicitação via email"
        });

        if (error) {
          console.error("[Unsubscribe] RPC error:", error);
          setStatus("error");
          setErrorMessage("Ocorreu um erro ao processar sua solicitação.");
          return;
        }

        const result = data as { success: boolean; error?: string; already_unsubscribed?: boolean; nome?: string };

        if (!result.success) {
          if (result.error === "token_invalid") {
            setStatus("error");
            setErrorMessage("Este link de descadastro não é válido ou já foi utilizado.");
          } else {
            setStatus("error");
            setErrorMessage("Ocorreu um erro ao processar sua solicitação.");
          }
          return;
        }

        setContactName(result.nome || "");

        if (result.already_unsubscribed) {
          setStatus("already_unsubscribed");
        } else {
          setStatus("success");
        }
      } catch (err) {
        console.error("[Unsubscribe] Error:", err);
        setStatus("error");
        setErrorMessage("Ocorreu um erro inesperado. Tente novamente mais tarde.");
      }
    }

    processUnsubscribe();
  }, [token]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-muted/50 to-muted flex items-center justify-center p-4">
      <Card className="max-w-md w-full shadow-lg">
        <CardContent className="pt-8 pb-8 text-center">
          {status === "loading" && (
            <>
              <Loader2 className="h-16 w-16 text-primary mx-auto mb-6 animate-spin" />
              <h1 className="text-2xl font-semibold text-foreground mb-3">
                Processando...
              </h1>
              <p className="text-muted-foreground">
                Aguarde enquanto processamos sua solicitação.
              </p>
            </>
          )}

          {status === "success" && (
            <>
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-6" />
              <h1 className="text-2xl font-semibold text-foreground mb-3">
                Descadastro Confirmado
              </h1>
              <p className="text-muted-foreground">
                {contactName ? `${contactName}, você foi` : "Você foi"} descadastrado(a) com sucesso e não receberá mais nossas comunicações.
              </p>
            </>
          )}

          {status === "already_unsubscribed" && (
            <>
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-6" />
              <h1 className="text-2xl font-semibold text-foreground mb-3">
                Já Descadastrado
              </h1>
              <p className="text-muted-foreground">
                {contactName ? `${contactName}, você já está` : "Você já está"} descadastrado(a) de nossas comunicações.
              </p>
            </>
          )}

          {status === "error" && (
            <>
              <XCircle className="h-16 w-16 text-destructive mx-auto mb-6" />
              <h1 className="text-2xl font-semibold text-foreground mb-3">
                Erro
              </h1>
              <p className="text-muted-foreground">
                {errorMessage}
              </p>
            </>
          )}

          <div className="mt-8 pt-6 border-t border-border">
            <p className="text-sm text-muted-foreground">
              Se isso foi um engano, entre em contato conosco.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
