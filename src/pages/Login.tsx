import { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Eye, EyeOff, Lock, Mail, ArrowRight } from "lucide-react";
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
      if (err instanceof z.ZodError) setError(err.errors[0].message);
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
        setTimeout(async () => { await login(signupData.email, signupData.password); }, 500);
      }
    } catch (err) {
      if (err instanceof z.ZodError) setError(err.errors[0].message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-400">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-gray-900 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Large signal wave top-right */}
        <svg className="absolute -top-20 -right-20 w-[500px] h-[500px] text-primary opacity-[0.07]" viewBox="0 0 400 400">
          <path d="M300 200 A100 100 0 0 0 200 100" stroke="currentColor" strokeWidth="4" fill="none" strokeLinecap="round"/>
          <path d="M280 200 A80 80 0 0 0 200 120" stroke="currentColor" strokeWidth="4" fill="none" strokeLinecap="round"/>
          <path d="M260 200 A60 60 0 0 0 200 140" stroke="currentColor" strokeWidth="4" fill="none" strokeLinecap="round"/>
          <path d="M240 200 A40 40 0 0 0 200 160" stroke="currentColor" strokeWidth="4" fill="none" strokeLinecap="round"/>
          <circle cx="200" cy="200" r="8" fill="currentColor"/>
        </svg>
        {/* Bottom-left wave */}
        <svg className="absolute -bottom-32 -left-32 w-[600px] h-[600px] text-primary opacity-[0.05] rotate-180" viewBox="0 0 400 400">
          <path d="M300 200 A100 100 0 0 0 200 100" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round"/>
          <path d="M280 200 A80 80 0 0 0 200 120" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round"/>
          <path d="M260 200 A60 60 0 0 0 200 140" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round"/>
        </svg>
        {/* Subtle gradient orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/3 w-64 h-64 bg-primary/3 rounded-full blur-3xl" />
      </div>

      {/* Left panel — Branding (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 relative items-center justify-center p-12">
        <div className="max-w-lg text-center relative z-10">
          <img 
            src={logo} 
            alt="Eleitor 360.ai" 
            className="h-24 mx-auto object-contain mb-10 drop-shadow-[0_0_30px_rgba(240,229,0,0.15)]"
          />
          <h1 className="text-4xl font-bold text-white mb-4 leading-tight">
            A plataforma política <br/>
            <span className="text-primary">mais inteligente</span>
          </h1>
          <p className="text-gray-400 text-lg leading-relaxed mb-8">
            Visibilidade e controle de tudo que acontece dentro do seu mandato. 
            Lideranças, eventos, comunicação e IA — tudo em um só lugar.
          </p>
          
          {/* Feature pills */}
          <div className="flex flex-wrap justify-center gap-3">
            {["Ranking de Lideranças", "Eventos com QR", "Agente IA", "Opinião Pública"].map((feat) => (
              <span key={feat} className="px-4 py-2 rounded-full text-sm font-medium bg-primary/10 text-primary border border-primary/20">
                {feat}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — Login form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 relative z-10">
        <div className="w-full max-w-[420px]">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-10">
            <img 
              src={logo} 
              alt="Eleitor 360.ai" 
              className="h-16 mx-auto object-contain mb-4"
            />
            <p className="text-gray-500 text-sm">Plataforma de Gestão Política com IA</p>
          </div>

          {/* Form card */}
          <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-3xl p-8 shadow-2xl shadow-black/20">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-white mb-1">Bem-vindo de volta</h2>
              <p className="text-gray-500">Entre com suas credenciais para acessar</p>
            </div>

            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-1 mb-6 bg-gray-700/30 rounded-xl h-11">
                <TabsTrigger 
                  value="login" 
                  className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-gray-900 data-[state=active]:font-semibold transition-all"
                >
                  Entrar
                </TabsTrigger>
              </TabsList>
                
              <TabsContent value="login">
                <form onSubmit={handleLoginSubmit} className="space-y-5">
                  {error && (
                    <Alert variant="destructive" className="bg-red-500/10 border-red-500/30 text-red-400">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                  <div className="space-y-1.5">
                    <Label htmlFor="login-email" className="text-gray-400 text-xs uppercase tracking-wider font-medium">E-mail</Label>
                    <div className="relative group">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-600 group-focus-within:text-primary transition-colors" />
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="seu@email.com"
                        value={loginData.email}
                        onChange={(e) => { setLoginData(prev => ({ ...prev, email: e.target.value })); setError(""); }}
                        disabled={isSubmitting}
                        required
                        className="pl-11 h-12 bg-gray-900/60 border-gray-700/50 text-gray-100 placeholder:text-gray-600 rounded-xl focus:border-primary/50 focus:ring-primary/20 focus:ring-2 transition-all"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="login-password" className="text-gray-400 text-xs uppercase tracking-wider font-medium">Senha</Label>
                    <div className="relative group">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-600 group-focus-within:text-primary transition-colors" />
                      <Input
                        id="login-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={loginData.password}
                        onChange={(e) => { setLoginData(prev => ({ ...prev, password: e.target.value })); setError(""); }}
                        disabled={isSubmitting}
                        required
                        className="pl-11 pr-11 h-12 bg-gray-900/60 border-gray-700/50 text-gray-100 placeholder:text-gray-600 rounded-xl focus:border-primary/50 focus:ring-primary/20 focus:ring-2 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-300 transition-colors"
                        disabled={isSubmitting}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-end">
                    <Link to="/forgot-password" className="text-sm text-primary/80 hover:text-primary transition-colors">
                      Esqueceu a senha?
                    </Link>
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full bg-primary hover:bg-primary-600 text-gray-900 font-bold h-12 rounded-xl text-base shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all group"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-900 border-t-transparent" />
                        Entrando...
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        Login
                        <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    )}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignupSubmit} className="space-y-4">
                  {error && (
                    <Alert variant="destructive" className="bg-red-500/10 border-red-500/30 text-red-400">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                  <div className="space-y-1.5">
                    <Label htmlFor="signup-name" className="text-gray-400 text-xs uppercase tracking-wider font-medium">Nome</Label>
                    <Input id="signup-name" type="text" placeholder="Seu nome completo" value={signupData.name}
                      onChange={(e) => { setSignupData(prev => ({ ...prev, name: e.target.value })); setError(""); }}
                      disabled={isSubmitting} required
                      className="h-12 bg-gray-900/60 border-gray-700/50 text-gray-100 placeholder:text-gray-600 rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="signup-email" className="text-gray-400 text-xs uppercase tracking-wider font-medium">E-mail</Label>
                    <Input id="signup-email" type="email" placeholder="seu@email.com" value={signupData.email}
                      onChange={(e) => { setSignupData(prev => ({ ...prev, email: e.target.value })); setError(""); }}
                      disabled={isSubmitting} required
                      className="h-12 bg-gray-900/60 border-gray-700/50 text-gray-100 placeholder:text-gray-600 rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="signup-password" className="text-gray-400 text-xs uppercase tracking-wider font-medium">Senha</Label>
                    <Input id="signup-password" type={showPassword ? "text" : "password"} placeholder="••••••••" value={signupData.password}
                      onChange={(e) => { setSignupData(prev => ({ ...prev, password: e.target.value })); setError(""); }}
                      disabled={isSubmitting} required
                      className="h-12 bg-gray-900/60 border-gray-700/50 text-gray-100 placeholder:text-gray-600 rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="signup-confirm-password" className="text-gray-400 text-xs uppercase tracking-wider font-medium">Confirmar Senha</Label>
                    <Input id="signup-confirm-password" type={showPassword ? "text" : "password"} placeholder="••••••••" value={signupData.confirmPassword}
                      onChange={(e) => { setSignupData(prev => ({ ...prev, confirmPassword: e.target.value })); setError(""); }}
                      disabled={isSubmitting} required
                      className="h-12 bg-gray-900/60 border-gray-700/50 text-gray-100 placeholder:text-gray-600 rounded-xl" />
                  </div>
                  <Button type="submit" className="w-full bg-primary hover:bg-primary-600 text-gray-900 font-bold h-12 rounded-xl" disabled={isSubmitting}>
                    {isSubmitting ? "Cadastrando..." : "Cadastrar"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </div>

          {/* Footer */}
          <p className="text-center text-xs text-gray-600 mt-8">
            © 2026 Eleitor 360.ai — Plataforma criada por João Mendes Miranda
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
