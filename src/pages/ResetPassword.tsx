import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Eye, EyeOff, Lock, AlertCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo-rafael-prudente.png";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: "",
  });
  const [showPasswords, setShowPasswords] = useState({
    password: false,
    confirmPassword: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isValidSession, setIsValidSession] = useState<boolean | null>(null);
  const [error, setError] = useState("");

  // Check for valid recovery session on mount
  useEffect(() => {
    const checkRecoverySession = async () => {
      // Check if there's a hash fragment with recovery token
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const type = hashParams.get('type');

      if (accessToken && type === 'recovery') {
        // Set the session using the recovery token
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: hashParams.get('refresh_token') || '',
        });

        if (error) {
          console.error('Error setting recovery session:', error);
          setIsValidSession(false);
          return;
        }

        if (data.session) {
          setIsValidSession(true);
          // Clean the URL hash
          window.history.replaceState(null, '', window.location.pathname);
          return;
        }
      }

      // Check if user already has an active session (might have clicked link)
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setIsValidSession(true);
      } else {
        setIsValidSession(false);
      }
    };

    checkRecoverySession();

    // Listen for password recovery events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsValidSession(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    if (!formData.password || !formData.confirmPassword) {
      setError("Por favor, preencha todos os campos.");
      setIsLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      setIsLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("As senhas não coincidem.");
      setIsLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: formData.password
      });

      if (error) {
        setError(error.message || "Erro ao redefinir senha. Tente novamente.");
        setIsLoading(false);
        return;
      }

      // Sign out user after password change for security
      await supabase.auth.signOut();

      navigate("/reset-success");
    } catch (err: any) {
      setError(err.message || "Erro ao redefinir senha. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (error) setError("");
  };

  const togglePasswordVisibility = (field: "password" | "confirmPassword") => {
    setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }));
  };

  // Loading state while checking session
  if (isValidSession === null) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary-500 mx-auto mb-4" />
          <p className="text-gray-600">Verificando sessão...</p>
        </div>
      </div>
    );
  }

  // Invalid session - user accessed page directly without recovery link
  if (isValidSession === false) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <img
              src={logo}
              alt="Rafael Prudente - Deputado Federal"
              className="h-20 w-auto mx-auto mb-4"
            />
          </div>

          <Card className="card-default">
            <CardHeader className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="h-8 w-8 text-red-600" />
              </div>
              <CardTitle className="text-xl text-red-600">Link Inválido ou Expirado</CardTitle>
              <CardDescription className="text-center">
                O link de recuperação de senha é inválido ou expirou.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p className="text-sm text-gray-600">
                Por favor, solicite um novo link de recuperação de senha.
              </p>

              <div className="space-y-2">
                <Button
                  onClick={() => navigate("/forgot-password")}
                  className="w-full bg-primary-500 hover:bg-primary-600"
                >
                  Solicitar Novo Link
                </Button>

                <Button
                  variant="ghost"
                  onClick={() => navigate("/login")}
                  className="w-full"
                >
                  Voltar ao Login
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <img
            src={logo}
            alt="Rafael Prudente - Deputado Federal"
            className="h-20 w-auto mx-auto mb-4"
          />
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">
            Redefinir Senha
          </h1>
          <p className="text-gray-600">
            Digite sua nova senha abaixo
          </p>
        </div>

        {/* Form */}
        <Card className="card-default">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl text-center">Nova Senha</CardTitle>
            <CardDescription className="text-center">
              Complete os campos abaixo para redefinir sua senha
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="password">Nova Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-600" />
                  <Input
                    id="password"
                    type={showPasswords.password ? "text" : "password"}
                    placeholder="Sua nova senha"
                    value={formData.password}
                    onChange={(e) => handleInputChange("password", e.target.value)}
                    className="pl-10 pr-10 focus-ring"
                    disabled={isLoading}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility("password")}
                    className="absolute right-3 top-3 text-gray-600 hover:text-gray-800 focus:outline-none"
                    disabled={isLoading}
                  >
                    {showPasswords.password ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-600" />
                  <Input
                    id="confirmPassword"
                    type={showPasswords.confirmPassword ? "text" : "password"}
                    placeholder="Confirme sua nova senha"
                    value={formData.confirmPassword}
                    onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                    className="pl-10 pr-10 focus-ring"
                    disabled={isLoading}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility("confirmPassword")}
                    className="absolute right-3 top-3 text-gray-600 hover:text-gray-800 focus:outline-none"
                    disabled={isLoading}
                  >
                    {showPasswords.confirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="bg-gray-50 p-3 rounded-lg text-sm text-gray-600">
                <p className="font-medium mb-1">Requisitos da senha:</p>
                <ul className="space-y-1 text-xs">
                  <li>• Mínimo de 6 caracteres</li>
                  <li>• Use uma combinação de letras e números</li>
                  <li>• Evite informações pessoais</li>
                </ul>
              </div>

              <Button
                type="submit"
                className="w-full bg-primary-500 hover:bg-primary-600 focus:ring-primary-500"
                disabled={isLoading}
              >
                {isLoading ? "Redefinindo..." : "Redefinir Senha"}
              </Button>
            </form>

            <div className="mt-4 pt-4 border-t border-gray-200 text-center">
              <Link
                to="/login"
                className="text-sm text-gray-600 hover:text-primary-600 focus:outline-none focus:text-primary-600"
              >
                Voltar ao login
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-sm text-gray-600 mt-6">
          © 2025 Rafael Prudente - Deputado Federal
        </p>
      </div>
    </div>
  );
};

export default ResetPassword;
