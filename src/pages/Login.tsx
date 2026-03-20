import { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Eye, EyeOff, Lock, User } from "lucide-react";
import { z } from "zod";
import logo from "@/assets/logo-eleitor360-login.png";
import { lovable } from "@/integrations/lovable";

const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres")
});

const Login = () => {
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, isLoading: authLoading } = useAuth();

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

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    setError("");
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        setError("Erro ao entrar com Google. Tente novamente.");
      }
    } catch {
      setError("Erro ao entrar com Google. Tente novamente.");
    } finally {
      setIsGoogleLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#2A2D35' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-400">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col" style={{ background: '#2A2D35' }}>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center relative z-10 px-6">
        {/* Logo */}
        <img
          src={logo}
          alt="Eleitor 360.ai"
          className="h-28 md:h-36 object-contain mb-14 drop-shadow-[0_0_40px_rgba(240,229,0,0.12)]"
        />

        {/* Form */}
        <form onSubmit={handleLoginSubmit} className="w-full max-w-sm space-y-6">
          {error && (
            <Alert variant="destructive" className="bg-red-500/10 border-red-500/30 text-red-400 rounded-xl">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Email field — underline style */}
          <div className="relative">
            <User className="absolute left-0 bottom-3 h-5 w-5 text-gray-500" />
            <input
              type="email"
              placeholder="E-mail"
              value={loginData.email}
              onChange={(e) => { setLoginData(prev => ({ ...prev, email: e.target.value })); setError(""); }}
              disabled={isSubmitting}
              required
              className="w-full bg-transparent border-0 border-b-2 border-gray-600 focus:border-primary text-white placeholder:text-gray-500 pl-8 pb-3 pt-1 text-base outline-none transition-colors"
            />
          </div>

          {/* Password field — underline style */}
          <div className="relative">
            <Lock className="absolute left-0 bottom-3 h-5 w-5 text-gray-500" />
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Senha"
              value={loginData.password}
              onChange={(e) => { setLoginData(prev => ({ ...prev, password: e.target.value })); setError(""); }}
              disabled={isSubmitting}
              required
              className="w-full bg-transparent border-0 border-b-2 border-gray-600 focus:border-primary text-white placeholder:text-gray-500 pl-8 pr-10 pb-3 pt-1 text-base outline-none transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-0 bottom-3 text-gray-500 hover:text-gray-300 transition-colors"
              disabled={isSubmitting}
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>

          {/* Remember me + Forgot */}
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 rounded border-gray-600 bg-transparent text-primary focus:ring-primary accent-[#F0E500]" />
              <span className="text-sm text-gray-400">Lembrar-me</span>
            </label>
            <Link to="/forgot-password" className="text-sm text-primary hover:underline">
              Esqueceu a senha?
            </Link>
          </div>

          {/* Login button */}
          <Button
            type="submit"
            className="w-full h-12 rounded-xl text-base font-bold shadow-lg transition-all"
            style={{
              background: '#F0E500',
              color: '#2A2D35',
              boxShadow: '0 4px 24px rgba(240, 229, 0, 0.25)'
            }}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-800 border-t-transparent" />
                Entrando...
              </div>
            ) : "Login"}
          </Button>

          {/* Divider */}
          <div className="flex items-center gap-3 pt-2">
            <div className="flex-1 h-px bg-gray-600" />
            <span className="text-xs text-gray-500 uppercase tracking-wider">ou</span>
            <div className="flex-1 h-px bg-gray-600" />
          </div>

          {/* Google button */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isGoogleLoading || isSubmitting}
            className="w-full h-12 rounded-xl text-base font-medium border border-gray-600 bg-transparent text-white hover:bg-white/5 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {isGoogleLoading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-400 border-t-transparent" />
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            )}
            {isGoogleLoading ? "Conectando..." : "Entrar com Google"}
          </button>
        </form>
      </div>

      {/* Footer */}
      <p className="text-center text-xs text-gray-600 py-6 relative z-10">
        © 2026 Eleitor 360.ai — Desenvolvida por MEGA GLOBAL DIGITAL
      </p>
    </div>
  );
};

export default Login;
