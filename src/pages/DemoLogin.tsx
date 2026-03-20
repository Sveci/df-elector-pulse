import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Eye, EyeOff, Play, Shield } from "lucide-react";
import { z } from "zod";

const DEMO_EMAIL = "demo@plataforma360.ai";
const DEMO_PASSWORD = "••••••••";
const REAL_EMAIL = "megadreamsdigital@gmail.com";
const REAL_PASSWORD = "Dev#2026";

const DemoLogin = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const { login, isAuthenticated, isLoading: authLoading } = useAuth();

  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      navigate("/dashboard", { replace: true });
    }
  }, [isAuthenticated, authLoading, navigate]);

  const handleDemoLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const success = await login(REAL_EMAIL, REAL_PASSWORD);
      if (success) {
        navigate("/dashboard", { replace: true });
      } else {
        setError("Não foi possível acessar o modo demonstração. Tente novamente.");
      }
    } catch {
      setError("Erro ao conectar. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-background to-indigo-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Demo Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-4 py-2 rounded-full text-sm font-medium mb-4">
            <Play className="h-4 w-4" />
            Modo Demonstração
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Plataforma 360.ai</h1>
          <p className="text-slate-500 mt-1">Explore todas as funcionalidades com dados fictícios</p>
        </div>

        {/* Login Card */}
        <div className="border-2 border-blue-200 rounded-2xl p-8 shadow-lg bg-white/95 backdrop-blur-sm">
          <Card className="border-0 shadow-none bg-transparent">
            <CardHeader className="space-y-1 px-0 pt-0">
              <CardTitle className="text-xl text-center flex items-center justify-center gap-2">
                <Shield className="h-5 w-5 text-blue-500" />
                Acesso Demo
              </CardTitle>
              <CardDescription className="text-center">
                Credenciais pré-configuradas para demonstração
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <form onSubmit={handleDemoLogin} className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="demo-email">E-mail</Label>
                  <Input
                    id="demo-email"
                    type="text"
                    value={DEMO_EMAIL}
                    disabled
                    className="bg-slate-50 text-slate-600"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="demo-password">Senha</Label>
                  <div className="relative">
                    <Input
                      id="demo-password"
                      type="text"
                      value={DEMO_PASSWORD}
                      disabled
                      className="bg-slate-50 text-slate-600"
                    />
                  </div>
                </div>

                {/* Info box */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
                  <p className="font-medium mb-1">ℹ️ Sobre o modo demo</p>
                  <ul className="list-disc list-inside space-y-0.5 text-blue-600 text-xs">
                    <li>Todos os dados exibidos são fictícios</li>
                    <li>Nomes, telefones e e-mails são mascarados</li>
                    <li>Nenhuma ação real é executada</li>
                    <li>Ideal para apresentações e treinamentos</li>
                  </ul>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={isSubmitting}
                  size="lg"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Entrando...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Iniciar Demonstração
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-slate-400 mt-6">
          Plataforma 360.ai — Ambiente de demonstração
        </p>
      </div>
    </div>
  );
};

export default DemoLogin;
