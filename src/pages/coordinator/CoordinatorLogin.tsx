import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCoordinatorAuth } from "@/contexts/CoordinatorAuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Shield } from "lucide-react";
import { toast } from "sonner";
import { normalizePhoneToE164 } from "@/utils/phoneNormalizer";
import logo from "@/assets/logo-horizontal-coordenador.png";

export default function CoordinatorLogin() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useCoordinatorAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || !password) return;

    setLoading(true);
    try {
      const normalizedPhone = normalizePhoneToE164(phone);
      const { data, error } = await (supabase.rpc as any)("coordinator_login", {
        p_phone: normalizedPhone,
        p_password: password,
      });

      if (error) throw error;

      const result = data as any;
      if (!result?.success) throw new Error(result?.error || "Credenciais inválidas.");

      const coord = result.coordinator;
      login({
        leader_id: coord.id,
        nome_completo: coord.nome_completo,
        telefone: coord.telefone,
        email: coord.email,
        affiliate_token: coord.affiliate_token,
        pontuacao_total: coord.pontuacao_total,
        cadastros: coord.cadastros,
        hierarchy_level: null,
        is_verified: null,
        cidade_nome: null,
        session_token: crypto.randomUUID(),
      });

      toast.success("Login realizado com sucesso!");
      navigate("/coordenador/dashboard");
    } catch (err: any) {
      console.error("Login error:", err);
      toast.error(err?.message || "Erro ao fazer login.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-muted p-4">
      <img src={logo} alt="Logo" className="h-10 mb-6" />
      <Card className="max-w-sm w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Portal do Coordenador</CardTitle>
          <CardDescription>Entre com seu telefone e senha</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone (WhatsApp)</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="(61) 99999-9999"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Entrar
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
