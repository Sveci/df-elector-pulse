import { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { z } from "zod";
import logo from "@/assets/logo-eleitor360.png";

const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres")
});

const signupSchema = z.object({
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"]
});

const Login = () => {
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [signupData, setSignupData] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { login, signup, isAuthenticated, isLoading: authLoading } = useAuth();

  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      const from = (location.state as any)?.from || "/dashboard";
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, authLoading, navigate, location]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      loginSchema.parse(loginData);
      const success = await login(loginData.email, loginData.password);
      
      if (success) {
        const from = (location.state as any)?.from || "/dashboard";
        navigate(from, { replace: true });
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        setError(err.errors[0].message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      signupSchema.parse(signupData);
      const success = await signup(signupData.email, signupData.password, signupData.name);
      
      if (success) {
        setTimeout(async () => {
          await login(signupData.email, signupData.password);
        }, 500);
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        setError(err.errors[0].message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-200">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative signal waves */}
      <div className="absolute top-0 right-0 w-64 h-64 opacity-20">
        <svg viewBox="0 0 200 200" className="w-full h-full text-primary">
          <path d="M160 100 A60 60 0 0 0 100 40" stroke="currentColor" strokeWidth="6" fill="none" strokeLinecap="round"/>
          <path d="M145 100 A45 45 0 0 0 100 55" stroke="currentColor" strokeWidth="6" fill="none" strokeLinecap="round"/>
          <path d="M130 100 A30 30 0 0 0 100 70" stroke="currentColor" strokeWidth="6" fill="none" strokeLinecap="round"/>
          <circle cx="100" cy="100" r="6" fill="currentColor"/>
        </svg>
      </div>
      <div className="absolute bottom-0 left-0 w-48 h-48 opacity-15 rotate-180">
        <svg viewBox="0 0 200 200" className="w-full h-full text-primary">
          <path d="M160 100 A60 60 0 0 0 100 40" stroke="currentColor" strokeWidth="6" fill="none" strokeLinecap="round"/>
          <path d="M145 100 A45 45 0 0 0 100 55" stroke="currentColor" strokeWidth="6" fill="none" strokeLinecap="round"/>
          <path d="M130 100 A30 30 0 0 0 100 70" stroke="currentColor" strokeWidth="6" fill="none" strokeLinecap="round"/>
        </svg>
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <img 
            src={logo} 
            alt="Eleitor 360.ai" 
            className="h-20 mx-auto object-contain"
          />
        </div>

        {/* Login Form Card */}
        <div className="bg-gray-800/80 backdrop-blur-sm border border-gray-700 rounded-2xl p-8">
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-1 mb-6 bg-gray-700/50">
              <TabsTrigger value="login" className="data-[state=active]:bg-primary data-[state=active]:text-gray-900">Entrar</TabsTrigger>
            </TabsList>
              
            <TabsContent value="login">
              <form onSubmit={handleLoginSubmit} className="space-y-5">
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <div className="space-y-2">
                  <Label htmlFor="login-email" className="text-gray-300 text-sm">E-mail</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="seu@email.com"
                      value={loginData.email}
                      onChange={(e) => {
                        setLoginData(prev => ({ ...prev, email: e.target.value }));
                        setError("");
                      }}
                      disabled={isSubmitting}
                      required
                      className="pl-10 bg-gray-900/50 border-gray-600 text-gray-100 placeholder:text-gray-500 focus:border-primary focus:ring-primary"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password" className="text-gray-300 text-sm">Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                    <Input
                      id="login-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={loginData.password}
                      onChange={(e) => {
                        setLoginData(prev => ({ ...prev, password: e.target.value }));
                        setError("");
                      }}
                      disabled={isSubmitting}
                      required
                      className="pl-10 pr-10 bg-gray-900/50 border-gray-600 text-gray-100 placeholder:text-gray-500 focus:border-primary focus:ring-primary"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                      disabled={isSubmitting}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-end">
                  <Link 
                    to="/forgot-password" 
                    className="text-sm text-primary hover:text-primary-400"
                  >
                    Esqueceu a senha?
                  </Link>
                </div>
                <Button 
                  type="submit" 
                  className="w-full bg-primary hover:bg-primary-600 text-gray-900 font-semibold h-11"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Entrando..." : "Login"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignupSubmit} className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <div className="space-y-2">
                  <Label htmlFor="signup-name" className="text-gray-300 text-sm">Nome</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="Seu nome completo"
                    value={signupData.name}
                    onChange={(e) => {
                      setSignupData(prev => ({ ...prev, name: e.target.value }));
                      setError("");
                    }}
                    disabled={isSubmitting}
                    required
                    className="bg-gray-900/50 border-gray-600 text-gray-100 placeholder:text-gray-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email" className="text-gray-300 text-sm">E-mail</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={signupData.email}
                    onChange={(e) => {
                      setSignupData(prev => ({ ...prev, email: e.target.value }));
                      setError("");
                    }}
                    disabled={isSubmitting}
                    required
                    className="bg-gray-900/50 border-gray-600 text-gray-100 placeholder:text-gray-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password" className="text-gray-300 text-sm">Senha</Label>
                  <Input
                    id="signup-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={signupData.password}
                    onChange={(e) => {
                      setSignupData(prev => ({ ...prev, password: e.target.value }));
                      setError("");
                    }}
                    disabled={isSubmitting}
                    required
                    className="bg-gray-900/50 border-gray-600 text-gray-100 placeholder:text-gray-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-confirm-password" className="text-gray-300 text-sm">Confirmar Senha</Label>
                  <Input
                    id="signup-confirm-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={signupData.confirmPassword}
                    onChange={(e) => {
                      setSignupData(prev => ({ ...prev, confirmPassword: e.target.value }));
                      setError("");
                    }}
                    disabled={isSubmitting}
                    required
                    className="bg-gray-900/50 border-gray-600 text-gray-100 placeholder:text-gray-500"
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full bg-primary hover:bg-primary-600 text-gray-900 font-semibold"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Cadastrando..." : "Cadastrar"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-gray-500 mt-6">
          © 2026 Eleitor 360.ai — Plataforma criada por João Mendes Miranda
        </p>
      </div>
    </div>
  );
};

export default Login;
