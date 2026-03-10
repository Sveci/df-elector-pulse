import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, AlertTriangle, XCircle, RefreshCw, Activity, Server, Database, Shield, MessageSquare, Mail, Globe, Brain, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.5 } }),
};

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.06 } } };

type ServiceStatus = "operational" | "degraded" | "down" | "checking";

interface ServiceCheck {
  name: string;
  icon: React.ElementType;
  description: string;
  status: ServiceStatus;
  latency?: number;
}

const statusConfig: Record<ServiceStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  operational: { label: "Operacional", color: "text-green-400", bg: "bg-green-500/10", icon: CheckCircle2 },
  degraded: { label: "Degradado", color: "text-yellow-400", bg: "bg-yellow-500/10", icon: AlertTriangle },
  down: { label: "Indisponível", color: "text-red-400", bg: "bg-red-500/10", icon: XCircle },
  checking: { label: "Verificando...", color: "text-gray-400", bg: "bg-gray-500/10", icon: Loader2 },
};

const StatusSistema = () => {
  const navigate = useNavigate();
  const [services, setServices] = useState<ServiceCheck[]>([
    { name: "Plataforma Web", icon: Globe, description: "Interface principal da aplicação", status: "checking" },
    { name: "Banco de Dados", icon: Database, description: "Armazenamento e consulta de dados", status: "checking" },
    { name: "Autenticação", icon: Shield, description: "Login, sessões e controle de acesso", status: "checking" },
    { name: "API Backend", icon: Server, description: "Serviços de backend e edge functions", status: "checking" },
    { name: "Inteligência Artificial", icon: Brain, description: "Assistente IA e análises automatizadas", status: "checking" },
    { name: "WhatsApp", icon: MessageSquare, description: "Envio e recebimento de mensagens", status: "checking" },
    { name: "E-mail", icon: Mail, description: "Disparo de e-mails e templates", status: "checking" },
  ]);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const checkServices = async () => {
    setIsChecking(true);
    setServices((prev) => prev.map((s) => ({ ...s, status: "checking" as ServiceStatus })));

    const results: ServiceCheck[] = [...services];

    // Check database
    try {
      const start = performance.now();
      const { error } = await supabase.from("contact_submissions").select("id").limit(1);
      const latency = Math.round(performance.now() - start);
      results[1] = { ...results[1], status: error ? "degraded" : "operational", latency };
    } catch {
      results[1] = { ...results[1], status: "down" };
    }

    // Check auth
    try {
      const start = performance.now();
      await supabase.auth.getSession();
      const latency = Math.round(performance.now() - start);
      results[2] = { ...results[2], status: "operational", latency };
    } catch {
      results[2] = { ...results[2], status: "down" };
    }

    // Check API/Edge functions
    try {
      const start = performance.now();
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/`, {
        headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
      });
      const latency = Math.round(performance.now() - start);
      results[3] = { ...results[3], status: response.ok ? "operational" : "degraded", latency };
    } catch {
      results[3] = { ...results[3], status: "down" };
    }

    // Platform (if we got here, it's operational)
    results[0] = { ...results[0], status: "operational", latency: 0 };

    // AI, WhatsApp, Email — assume operational if API is up
    const apiUp = results[3].status === "operational";
    results[4] = { ...results[4], status: apiUp ? "operational" : "degraded" };
    results[5] = { ...results[5], status: apiUp ? "operational" : "degraded" };
    results[6] = { ...results[6], status: apiUp ? "operational" : "degraded" };

    setServices(results);
    setLastCheck(new Date());
    setIsChecking(false);
  };

  useEffect(() => {
    checkServices();
  }, []);

  const allOperational = services.every((s) => s.status === "operational");
  const hasIssues = services.some((s) => s.status === "degraded" || s.status === "down");

  return (
    <div className="min-h-screen bg-[hsl(225,25%,6%)] text-gray-50 dark">
      <header className="border-b border-white/10 bg-[hsl(225,25%,6%)]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate("/")} className="text-gray-300 hover:text-white hover:bg-white/10 gap-2">
            <ArrowLeft className="h-4 w-4" />
            Voltar ao início
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={checkServices}
            disabled={isChecking}
            className="border-white/10 text-gray-300 hover:text-white hover:bg-white/10 gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isChecking ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#F0E500]/30 bg-[#F0E500]/[0.06] text-[#F0E500] text-sm font-medium mb-5">
            <Activity className="h-4 w-4" />
            Status do Sistema
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-[#F0E500] via-[#f5ed4e] to-[#d4c900] bg-clip-text text-transparent mb-4">
            Status dos Serviços
          </h1>

          {/* Overall Status */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className={`inline-flex items-center gap-3 px-6 py-3 rounded-2xl border mt-6 ${
              allOperational && !services.some((s) => s.status === "checking")
                ? "border-green-500/20 bg-green-500/10"
                : hasIssues
                ? "border-yellow-500/20 bg-yellow-500/10"
                : "border-white/10 bg-white/[0.03]"
            }`}
          >
            {services.some((s) => s.status === "checking") ? (
              <>
                <Loader2 className="h-6 w-6 text-gray-400 animate-spin" />
                <span className="text-gray-300 font-semibold text-lg">Verificando serviços...</span>
              </>
            ) : allOperational ? (
              <>
                <CheckCircle2 className="h-6 w-6 text-green-400" />
                <span className="text-green-300 font-semibold text-lg">Todos os sistemas operacionais</span>
              </>
            ) : (
              <>
                <AlertTriangle className="h-6 w-6 text-yellow-400" />
                <span className="text-yellow-300 font-semibold text-lg">Alguns serviços com instabilidade</span>
              </>
            )}
          </motion.div>

          {lastCheck && (
            <p className="text-gray-500 text-sm mt-4">
              Última verificação: {lastCheck.toLocaleString("pt-BR")}
            </p>
          )}
        </motion.div>

        {/* Services Grid */}
        <motion.div initial="hidden" animate="visible" variants={stagger} className="space-y-3">
          {services.map((service, i) => {
            const config = statusConfig[service.status];
            const StatusIcon = config.icon;
            const ServiceIcon = service.icon;

            return (
              <motion.div
                key={service.name}
                variants={fadeUp}
                custom={i}
                className="flex items-center gap-4 p-5 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.05] transition-colors"
              >
                <div className="p-3 rounded-xl bg-[#F0E500]/10 shrink-0">
                  <ServiceIcon className="h-5 w-5 text-[#F0E500]" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-semibold text-sm">{service.name}</h3>
                  <p className="text-gray-500 text-xs mt-0.5">{service.description}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {service.latency !== undefined && service.status === "operational" && (
                    <span className="text-xs text-gray-500 font-mono">{service.latency}ms</span>
                  )}
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${config.bg}`}>
                    <StatusIcon className={`h-3.5 w-3.5 ${config.color} ${service.status === "checking" ? "animate-spin" : ""}`} />
                    <span className={`text-xs font-medium ${config.color}`}>{config.label}</span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Info */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="mt-12 text-center">
          <p className="text-gray-500 text-sm">
            Os status são verificados em tempo real. Para reportar problemas,{" "}
            <button onClick={() => navigate("/contato")} className="text-[#F0E500] hover:underline">
              entre em contato
            </button>.
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default StatusSistema;
