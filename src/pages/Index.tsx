import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Users,
  BarChart3,
  Calendar,
  MessageSquare,
  Shield,
  Map,
  Zap,
  Target,
  CheckCircle2,
  Globe,
  Brain,
  Smartphone,
  TrendingUp,
  Award,
  FileText,
  Bell,
  Lock,
  Layers,
  ChevronRight,
  Star,
  QrCode,
  Mail,
} from "lucide-react";
import logo from "@/assets/logo-eleitor360.png";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.1, ease: "easeOut" as const },
  }),
};

const stagger = {
  visible: { transition: { staggerChildren: 0.08 } },
};

const features = [
  {
    icon: Users,
    title: "Captação Inteligente",
    desc: "Formulários com UTM tracking, indicações por lideranças e QR codes personalizados para eventos presenciais.",
  },
  {
    icon: BarChart3,
    title: "Ranking de Lideranças",
    desc: "Pódio visual com pontuação dinâmica, métricas por região administrativa e período configurável.",
  },
  {
    icon: Calendar,
    title: "Gestão de Eventos",
    desc: "Inscrições online, QR codes individuais, check-in automático e relatórios detalhados por categoria.",
  },
  {
    icon: MessageSquare,
    title: "WhatsApp Automatizado",
    desc: "Fluxos conversacionais com IA, menu interativo e direcionamento para comunidades municipais.",
  },
  {
    icon: Map,
    title: "Mapa de Influência",
    desc: "Visualização geográfica de contatos e lideranças com heatmap e análise territorial por IA.",
  },
  {
    icon: Brain,
    title: "Inteligência Artificial",
    desc: "Assistente IA integrado para análises, classificação de intenções e suporte à tomada de decisão.",
  },
  {
    icon: Mail,
    title: "E-mail Marketing",
    desc: "Templates personalizáveis, disparo segmentado por região e histórico completo de envios.",
  },
  {
    icon: QrCode,
    title: "Funis de Captação",
    desc: "Landing pages com lead magnets, download automático e rastreamento completo de conversões.",
  },
  {
    icon: Smartphone,
    title: "Cartão Digital",
    desc: "Integração com Apple Wallet e Google Wallet para cartões de fidelidade e identificação.",
  },
  {
    icon: Shield,
    title: "Verificação de Contatos",
    desc: "Validação por WhatsApp ou SMS com opt-in responsável e conformidade com LGPD.",
  },
  {
    icon: FileText,
    title: "Materiais de Campanha",
    desc: "Controle de estoque, reservas por lideranças e rastreamento de retiradas com confirmação.",
  },
  {
    icon: Globe,
    title: "Multi-Tenant",
    desc: "Arquitetura preparada para múltiplas organizações com isolamento completo de dados.",
  },
];

const benefits = [
  {
    icon: Target,
    title: "Decisões Baseadas em Dados",
    desc: "Dashboards em tempo real com métricas que importam. Saiba exatamente onde concentrar esforços.",
  },
  {
    icon: Zap,
    title: "Automação que Escala",
    desc: "Processos manuais eliminados. De captação a comunicação, tudo funciona no automático.",
  },
  {
    icon: TrendingUp,
    title: "Engajamento Mensurável",
    desc: "Cada interação é rastreada. Rankings, pontuações e relatórios que motivam sua rede.",
  },
  {
    icon: Lock,
    title: "Segurança & Conformidade",
    desc: "Autenticação robusta, RLS em todas as tabelas e total conformidade com a LGPD.",
  },
];

const plans = [
  {
    name: "Essencial",
    highlight: false,
    features: [
      "Até 5.000 contatos",
      "Captação por formulário",
      "Gestão de lideranças",
      "Ranking básico",
      "1 usuário administrador",
      "Suporte por e-mail",
    ],
  },
  {
    name: "Profissional",
    highlight: true,
    badge: "Mais Popular",
    features: [
      "Até 50.000 contatos",
      "Tudo do Essencial +",
      "WhatsApp automatizado",
      "Funis de captação ilimitados",
      "Gestão de eventos com QR",
      "Mapa de influência",
      "E-mail marketing",
      "Até 5 usuários",
      "Suporte prioritário",
    ],
  },
  {
    name: "Enterprise",
    highlight: false,
    features: [
      "Contatos ilimitados",
      "Tudo do Profissional +",
      "IA assistente integrada",
      "Cartão digital (Wallet)",
      "Multi-tenant",
      "API personalizada",
      "Usuários ilimitados",
      "Gerente de conta dedicado",
    ],
  },
];

const stats = [
  { value: "50k+", label: "Contatos gerenciados" },
  { value: "500+", label: "Eventos realizados" },
  { value: "98%", label: "Satisfação dos clientes" },
  { value: "16", label: "Municípios atendidos" },
];

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-900 overflow-x-hidden">
      {/* ─── HEADER ─── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-gray-900/80 backdrop-blur-xl border-b border-gray-800/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <img src={logo} alt="Eleitor 360.ai" className="h-10 w-auto" />
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              onClick={() => navigate("/login")}
              className="text-gray-300 hover:text-white hover:bg-gray-800"
            >
              Entrar
            </Button>
            <Button
              onClick={() => navigate("/login")}
              className="bg-primary hover:bg-primary-600 text-gray-900 font-semibold"
            >
              Começar Agora
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* ─── HERO ─── */}
      <section className="relative pt-32 pb-20 lg:pt-44 lg:pb-32">
        {/* Background glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full bg-primary/5 blur-[120px]" />
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={stagger}
          >
            <motion.div
              variants={fadeUp}
              custom={0}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-primary text-sm font-medium mb-8"
            >
              <Zap className="h-3.5 w-3.5" />
              Plataforma completa de gestão política
            </motion.div>

            <motion.h1
              variants={fadeUp}
              custom={1}
              className="text-4xl sm:text-5xl lg:text-7xl font-bold text-white leading-[1.1] tracking-tight mb-6"
            >
              Transforme sua
              <br />
              <span className="text-primary">comunicação política</span>
              <br />
              com inteligência
            </motion.h1>

            <motion.p
              variants={fadeUp}
              custom={2}
              className="text-lg sm:text-xl text-gray-400 max-w-3xl mx-auto mb-10 leading-relaxed"
            >
              Captação inteligente, WhatsApp automatizado, ranking de lideranças,
              gestão de eventos e IA integrada — tudo em uma única plataforma
              projetada para escalar sua influência.
            </motion.p>

            <motion.div variants={fadeUp} custom={3} className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                onClick={() => navigate("/login")}
                size="lg"
                className="bg-primary hover:bg-primary-600 text-gray-900 font-bold text-lg px-10 py-6 shadow-[0_0_40px_hsl(54_100%_50%/0.15)]"
              >
                Acessar Plataforma
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => {
                  document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white text-lg px-10 py-6"
              >
                Conhecer Recursos
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ─── STATS BAR ─── */}
      <section className="relative border-y border-gray-800/60 bg-gray-800/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={stagger}
            className="grid grid-cols-2 lg:grid-cols-4 gap-8"
          >
            {stats.map((s, i) => (
              <motion.div key={i} variants={fadeUp} custom={i} className="text-center">
                <p className="text-3xl sm:text-4xl font-bold text-primary mb-1">{s.value}</p>
                <p className="text-sm text-gray-500 uppercase tracking-wider">{s.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── FEATURES ─── */}
      <section id="features" className="py-24 lg:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={stagger}
            className="text-center mb-16"
          >
            <motion.p variants={fadeUp} custom={0} className="text-primary font-semibold text-sm uppercase tracking-widest mb-3">
              Recursos
            </motion.p>
            <motion.h2 variants={fadeUp} custom={1} className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
              Tudo que você precisa,{" "}
              <span className="text-primary">em um só lugar</span>
            </motion.h2>
            <motion.p variants={fadeUp} custom={2} className="text-gray-400 text-lg max-w-2xl mx-auto">
              Do primeiro contato ao engajamento contínuo, cada funcionalidade
              foi projetada para maximizar seus resultados.
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={stagger}
            className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
          >
            {features.map((f, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                custom={i}
                className="group relative rounded-2xl border border-gray-800 bg-gray-800/40 p-6 hover:border-primary/40 hover:bg-gray-800/70 transition-all duration-300"
              >
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-white font-semibold text-base mb-2">{f.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── BENEFITS ─── */}
      <section className="py-24 lg:py-32 bg-gray-800/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={stagger}
          >
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              {/* Left */}
              <div>
                <motion.p variants={fadeUp} custom={0} className="text-primary font-semibold text-sm uppercase tracking-widest mb-3">
                  Por que escolher a Eleitor 360.ai?
                </motion.p>
                <motion.h2 variants={fadeUp} custom={1} className="text-3xl sm:text-4xl font-bold text-white mb-6 leading-tight">
                  A plataforma que{" "}
                  <span className="text-primary">transforma dados</span>{" "}
                  em resultados reais
                </motion.h2>
                <motion.p variants={fadeUp} custom={2} className="text-gray-400 text-lg mb-8 leading-relaxed">
                  Mais do que um sistema, é uma central de inteligência política
                  que conecta captação, comunicação e gestão territorial em uma
                  experiência integrada e poderosa.
                </motion.p>
                <motion.div variants={fadeUp} custom={3}>
                  <Button
                    onClick={() => navigate("/login")}
                    className="bg-primary hover:bg-primary-600 text-gray-900 font-semibold px-8"
                  >
                    Comece Agora
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </motion.div>
              </div>

              {/* Right — benefit cards */}
              <div className="grid sm:grid-cols-2 gap-5">
                {benefits.map((b, i) => (
                  <motion.div
                    key={i}
                    variants={fadeUp}
                    custom={i + 3}
                    className="rounded-2xl border border-gray-800 bg-gray-900/80 p-6"
                  >
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                      <b.icon className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="text-white font-semibold mb-2">{b.title}</h3>
                    <p className="text-gray-500 text-sm leading-relaxed">{b.desc}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section className="py-24 lg:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={stagger}
            className="text-center mb-16"
          >
            <motion.p variants={fadeUp} custom={0} className="text-primary font-semibold text-sm uppercase tracking-widest mb-3">
              Como funciona
            </motion.p>
            <motion.h2 variants={fadeUp} custom={1} className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Simples de usar, <span className="text-primary">poderoso nos resultados</span>
            </motion.h2>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={stagger}
            className="grid md:grid-cols-3 gap-8 relative"
          >
            {/* Connecting line */}
            <div className="hidden md:block absolute top-16 left-[16.5%] right-[16.5%] h-px bg-gradient-to-r from-primary/0 via-primary/30 to-primary/0" />

            {[
              {
                step: "01",
                title: "Configure sua organização",
                desc: "Cadastre regiões, lideranças e personalize formulários de captação em minutos.",
                icon: Layers,
              },
              {
                step: "02",
                title: "Capture e engaje",
                desc: "Use QR codes, funis e WhatsApp automatizado para construir sua base de contatos.",
                icon: Users,
              },
              {
                step: "03",
                title: "Analise e decida",
                desc: "Dashboards, mapas e IA transformam dados brutos em insights estratégicos acionáveis.",
                icon: TrendingUp,
              },
            ].map((step, i) => (
              <motion.div key={i} variants={fadeUp} custom={i} className="relative text-center">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-6">
                  <step.icon className="h-6 w-6 text-primary" />
                </div>
                <span className="text-xs font-bold text-primary/60 uppercase tracking-widest mb-2 block">
                  Passo {step.step}
                </span>
                <h3 className="text-white font-semibold text-lg mb-3">{step.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed max-w-xs mx-auto">{step.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── PLANS ─── */}
      <section className="py-24 lg:py-32 bg-gray-800/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={stagger}
            className="text-center mb-16"
          >
            <motion.p variants={fadeUp} custom={0} className="text-primary font-semibold text-sm uppercase tracking-widest mb-3">
              Planos
            </motion.p>
            <motion.h2 variants={fadeUp} custom={1} className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Escolha o plano ideal{" "}
              <span className="text-primary">para seu mandato</span>
            </motion.h2>
            <motion.p variants={fadeUp} custom={2} className="text-gray-400 text-lg max-w-2xl mx-auto">
              Todos os planos incluem atualizações gratuitas e suporte técnico.
              Entre em contato para valores personalizados.
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={stagger}
            className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto"
          >
            {plans.map((plan, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                custom={i}
                className={`relative rounded-2xl p-8 flex flex-col ${
                  plan.highlight
                    ? "border-2 border-primary bg-gray-800/80 shadow-[0_0_60px_hsl(54_100%_50%/0.08)]"
                    : "border border-gray-800 bg-gray-800/40"
                }`}
              >
                {plan.badge && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-primary text-gray-900 text-xs font-bold uppercase tracking-wider">
                    {plan.badge}
                  </span>
                )}
                <h3 className="text-white text-xl font-bold mb-1">{plan.name}</h3>
                <p className="text-gray-500 text-sm mb-6">
                  {plan.highlight ? "Para operações completas" : plan.name === "Essencial" ? "Para começar" : "Para grandes redes"}
                </p>
                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((feat, fi) => (
                    <li key={fi} className="flex items-start gap-2 text-sm text-gray-300">
                      <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      {feat}
                    </li>
                  ))}
                </ul>
                <Button
                  onClick={() => navigate("/login")}
                  className={
                    plan.highlight
                      ? "bg-primary hover:bg-primary-600 text-gray-900 font-semibold w-full"
                      : "bg-gray-700 hover:bg-gray-600 text-white font-semibold w-full"
                  }
                >
                  Fale Conosco
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── FINAL CTA ─── */}
      <section className="py-24 lg:py-32 relative">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-primary/5 blur-[100px]" />
        </div>
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
          >
            <motion.div variants={fadeUp} custom={0} className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-8">
              <Award className="h-8 w-8 text-primary" />
            </motion.div>
            <motion.h2 variants={fadeUp} custom={1} className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6">
              Pronto para{" "}
              <span className="text-primary">revolucionar</span>
              <br />
              sua comunicação política?
            </motion.h2>
            <motion.p variants={fadeUp} custom={2} className="text-gray-400 text-lg mb-10 max-w-2xl mx-auto">
              Junte-se a centenas de lideranças que já utilizam a plataforma mais
              completa do mercado para gestão política inteligente.
            </motion.p>
            <motion.div variants={fadeUp} custom={3} className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                onClick={() => navigate("/login")}
                size="lg"
                className="bg-primary hover:bg-primary-600 text-gray-900 font-bold text-lg px-10 py-6 shadow-[0_0_40px_hsl(54_100%_50%/0.15)]"
              >
                Acessar Plataforma
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => navigate("/forgot-password")}
                className="border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white text-lg px-10 py-6"
              >
                Esqueci minha senha
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-gray-800/60 bg-gray-900/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <img src={logo} alt="Eleitor 360.ai" className="h-8 w-auto" />
              <div className="h-5 w-px bg-gray-800" />
              <p className="text-gray-500 text-sm">© 2026 Eleitor 360.ai</p>
            </div>
            <p className="text-sm text-gray-600">
              Desenvolvida por{" "}
              <span className="text-gray-400 font-medium">MEGA GLOBAL DIGITAL</span>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
