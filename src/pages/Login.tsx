import { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Eye, EyeOff, Lock, User } from "lucide-react";
import { z } from "zod";
import logo from "@/assets/logo-eleitor360.png";

const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres")
});

const Login = () => {
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
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
      {/* Signal wave — top right */}
      <svg className="absolute -top-8 -right-8 w-[280px] h-[280px] md:w-[360px] md:h-[360px]" viewBox="0 0 300 300" fill="none">
        <path d="M260 190 A110 110 0 0 0 150 80" stroke="#F0E500" strokeWidth="18" fill="none" strokeLinecap="round"/>
        <path d="M240 190 A90 90 0 0 0 150 100" stroke="#F0E500" strokeWidth="16" fill="none" strokeLinecap="round"/>
        <path d="M220 190 A70 70 0 0 0 150 120" stroke="#F0E500" strokeWidth="14" fill="none" strokeLinecap="round"/>
        <circle cx="150" cy="190" r="10" fill="#F0E500"/>
      </svg>

      {/* Signal wave — bottom left */}
      <svg className="absolute -bottom-8 -left-8 w-[240px] h-[240px] md:w-[320px] md:h-[320px] rotate-180" viewBox="0 0 300 300" fill="none">
        <path d="M260 190 A110 110 0 0 0 150 80" stroke="#F0E500" strokeWidth="18" fill="none" strokeLinecap="round"/>
        <path d="M240 190 A90 90 0 0 0 150 100" stroke="#F0E500" strokeWidth="16" fill="none" strokeLinecap="round"/>
        <path d="M220 190 A70 70 0 0 0 150 120" stroke="#F0E500" strokeWidth="14" fill="none" strokeLinecap="round"/>
        <circle cx="150" cy="190" r="10" fill="#F0E500"/>
      </svg>

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
        </form>
      </div>

      {/* Footer */}
      <p className="text-center text-xs text-gray-600 py-6 relative z-10">
        © 2026 Eleitor 360.ai — Plataforma criada por João Mendes Miranda
      </p>
    </div>
  );
};

export default Login;
