import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle, Loader2, MessageCircle, Phone,
  ShieldCheck, ShieldAlert, AlertCircle,
} from "lucide-react";
import { buildWhatsAppLink } from "@/lib/whatsappLink";
const logo = "/lovable-uploads/7fcd39d2-d59f-4493-8232-a462c15b3f07.png";

type VerificationState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "already_verified"; nome: string }
  | { status: "not_found" }
  | {
      status: "ready";
      leader: {
        id: string;
        nome_completo: string;
        telefone: string;
        verification_code: string;
      };
      keyword: string;
      whatsAppPhone: string;
    }
  | { status: "error"; message: string };

export default function CoordinatorVerifyLeader() {
  const [phoneInput, setPhoneInput] = useState("");
  const [state, setState] = useState<VerificationState>({ status: "idle" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const digits = phoneInput.replace(/\D/g, "");

    if (digits.length < 10) {
      setState({ status: "error", message: "Número inválido. Digite DDD + número." });
      return;
    }

    setState({ status: "loading" });

    try {
      const { data, error } = await supabase.rpc("lookup_leader_for_verification", {
        phone_digits: digits,
      });

      if (error) {
        console.error("[VerifyLeader] RPC error:", error);
        setState({ status: "error", message: "Erro ao buscar apoiador. Tente novamente." });
        return;
      }

      const result = data as any;

      if (result.status === "not_found") {
        setState({ status: "not_found" });
      } else if (result.status === "already_verified") {
        setState({ status: "already_verified", nome: result.nome });
      } else if (result.status === "error") {
        setState({ status: "error", message: result.message });
      } else if (result.status === "ready") {
        setState({
          status: "ready",
          leader: result.leader,
          keyword: result.keyword,
          whatsAppPhone: result.whatsAppPhone,
        });
      }
    } catch (err: any) {
      console.error("[VerifyLeader] Error:", err);
      setState({ status: "error", message: "Erro ao buscar apoiador. Tente novamente." });
    }
  };

  const handleReset = () => {
    setPhoneInput("");
    setState({ status: "idle" });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <img src={logo} alt="Logo" className="h-8 w-auto" />
          <div className="flex-1">
            <h1 className="text-lg font-semibold">Verificação de Apoiador</h1>
            <p className="text-xs text-muted-foreground">Via WhatsApp</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Search form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Phone className="h-5 w-5" />
              Buscar Apoiador por Telefone
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Número de Celular</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="(61) 99999-9999"
                  value={phoneInput}
                  onChange={e => setPhoneInput(e.target.value)}
                  disabled={state.status === "loading"}
                />
                <p className="text-xs text-muted-foreground">
                  Digite o DDD + número do celular do apoiador
                </p>
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={state.status === "loading" || !phoneInput.trim()}
              >
                {state.status === "loading" ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Buscando...
                  </>
                ) : (
                  <>
                    <Phone className="h-4 w-4 mr-2" />
                    Buscar
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Already verified */}
        {state.status === "already_verified" && (
          <Card className="border-green-200 bg-green-50/50">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center gap-4">
                <div className="rounded-full bg-green-100 p-4">
                  <ShieldCheck className="h-12 w-12 text-green-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-green-800">Já Verificado!</h2>
                  <p className="text-green-700 mt-1">
                    O apoiador <strong>{state.nome}</strong> já foi verificado anteriormente.
                  </p>
                </div>
                <Badge className="bg-green-600">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Verificado
                </Badge>
                <Button variant="outline" onClick={handleReset} className="mt-2">
                  Buscar outro número
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Not found */}
        {state.status === "not_found" && (
          <Card className="border-amber-200 bg-amber-50/50">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center gap-4">
                <div className="rounded-full bg-amber-100 p-4">
                  <ShieldAlert className="h-12 w-12 text-amber-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-amber-800">Não Encontrado</h2>
                  <p className="text-amber-700 mt-1">
                    Nenhum apoiador cadastrado com este número de telefone.
                  </p>
                </div>
                <Button variant="outline" onClick={handleReset} className="mt-2">
                  Tentar outro número
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error */}
        {state.status === "error" && (
          <Card className="border-red-200 bg-red-50/50">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center gap-4">
                <div className="rounded-full bg-red-100 p-4">
                  <AlertCircle className="h-12 w-12 text-red-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-red-800">Erro</h2>
                  <p className="text-red-700 mt-1">{state.message}</p>
                </div>
                <Button variant="outline" onClick={handleReset} className="mt-2">
                  Tentar novamente
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Ready to verify */}
        {state.status === "ready" && (
          <Card className="border-green-200 bg-green-50/50">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center gap-4">
                <div className="rounded-full bg-green-100 p-4">
                  <MessageCircle className="h-12 w-12 text-green-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">Verificação Iniciada!</h2>
                  <p className="text-muted-foreground mt-1">
                    Apoiador: <strong>{state.leader.nome_completo}</strong>
                  </p>
                </div>

                <div className="w-full bg-white border rounded-lg p-4 space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Para confirmar o cadastro, envie a mensagem abaixo pelo WhatsApp:
                  </p>
                  <div className="bg-green-100 border border-green-300 rounded-lg p-3 text-center">
                    <span className="text-lg font-bold text-green-800">
                      {state.keyword} {state.leader.verification_code}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    ⚠️ A mensagem deve ser enviada do número <strong>{state.leader.telefone}</strong> para que a verificação funcione. Se outra pessoa enviar este código, o sistema não validará.
                  </p>
                </div>

                {(() => {
                  const phone = state.whatsAppPhone.replace(/\D/g, "");
                  const messageText = `${state.keyword} ${state.leader.verification_code}`;
                  const href = buildWhatsAppLink(phone, messageText);

                  return (
                    <Button asChild className="w-full bg-green-600 hover:bg-green-700 text-white" size="lg">
                      <a href={href} target="_blank" rel="noreferrer">
                        <MessageCircle className="h-5 w-5 mr-2" />
                        Confirmar via WhatsApp
                      </a>
                    </Button>
                  );
                })()}

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 w-full">
                  <p className="font-semibold mb-1">📱 Importante!</p>
                  <p>
                    Após enviar "{state.keyword} {state.leader.verification_code}" do número cadastrado, 
                    o apoiador receberá automaticamente seu link de indicação.
                  </p>
                </div>

                <Button variant="outline" onClick={handleReset} className="mt-2">
                  Buscar outro número
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
