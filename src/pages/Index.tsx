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
  Lock,
  Layers,
  ChevronRight,
  QrCode,
  Mail,
  Eye,
  Radar,
  MessageCircle,
  Newspaper,
  Hash,
} from "lucide-react";
import logo from "@/assets/logo-eleitor360.png";

/* ── animation variants ── */
const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.1, ease: "easeOut" as const },
  }),
};
const stagger = { visible: { transition: { staggerChildren: 0.08 } } };

/* ── data ── */
const features = [
  { icon: Users, title: "Captação Inteligente", desc: "Formulários com UTM tracking, indicações por lideranças e QR codes personalizados para eventos presenciais." },
  { icon: BarChart3, title: "Ranking de Lideranças", desc: "Pódio visual com pontuação dinâmica, métricas por região administrativa e período configurável." },
  { icon: Calendar, title: "Gestão de Eventos", desc: "Inscrições online, QR codes individuais, check-in automático e relatórios detalhados por categoria." },
  { icon: MessageSquare, title: "WhatsApp Automatizado", desc: "Fluxos conversacionais com IA, menu interativo e direcionamento para comunidades municipais." },
  { icon: Map, title: "Mapa de Influência", desc: "Visualização geográfica de contatos e lideranças com heatmap e análise territorial por IA." },
  { icon: Brain, title: "Inteligência Artificial", desc: "Assistente IA integrado para análises, classificação de intenções e suporte à tomada de decisão." },
  { icon: Mail, title: "E-mail Marketing", desc: "Templates personalizáveis, disparo segmentado por região e histórico completo de envios." },
  { icon: QrCode, title: "Funis de Captação", desc: "Landing pages com lead magnets, download automático e rastreamento completo de conversões." },
  { icon: Smartphone, title: "Cartão Digital", desc: "Integração com Apple Wallet e Google Wallet para cartões de fidelidade e identificação." },
  { icon: Shield, title: "Verificação de Contatos", desc: "Validação por WhatsApp ou SMS com opt-in responsável e conformidade com LGPD." },
  { icon: FileText, title: "Materiais de Campanha", desc: "Controle de estoque, reservas por lideranças e rastreamento de retiradas com confirmação." },
  { icon: Globe, title: "Multi-Tenant", desc: "Arquitetura preparada para múltiplas organizações com isolamento completo de dados." },
];

const benefits = [
  { icon: Target, title: "Decisões Baseadas em Dados", desc: "Dashboards em tempo real com métricas que importam. Saiba exatamente onde concentrar esforços." },
  { icon: Zap, title: "Automação que Escala", desc: "Processos manuais eliminados. De captação a comunicação, tudo funciona no automático." },
  { icon: TrendingUp, title: "Engajamento Mensurável", desc: "Cada interação é rastreada. Rankings, pontuações e relatórios que motivam sua rede." },
  { icon: Lock, title: "Segurança & Conformidade", desc: "Autenticação robusta, RLS em todas as tabelas e total conformidade com a LGPD." },
];

const plans = [
  { name: "Essencial", highlight: false, sub: "Para começar", features: ["Até 5.000 contatos", "Captação por formulário", "Gestão de lideranças", "Ranking básico", "1 usuário administrador", "Suporte por e-mail"] },
  { name: "Profissional", highlight: true, badge: "Mais Popular", sub: "Para operações completas", features: ["Até 50.000 contatos", "Tudo do Essencial +", "WhatsApp automatizado", "Funis de captação ilimitados", "Gestão de eventos com QR", "Mapa de influência", "E-mail marketing", "Até 5 usuários", "Suporte prioritário"] },
  { name: "Enterprise", highlight: false, sub: "Para grandes redes", features: ["Contatos ilimitados", "Tudo do Profissional +", "IA assistente integrada", "Cartão digital (Wallet)", "Multi-tenant", "API personalizada", "Usuários ilimitados", "Gerente de conta dedicado"] },
];

const stats = [
  { value: "50k+", label: "Contatos gerenciados" },
  { value: "500+", label: "Eventos realizados" },
  { value: "98%", label: "Satisfação dos clientes" },
  { value: "16", label: "Municípios atendidos" },
];

const opinionFeatures = [
  { icon: Radar, title: "Monitoramento em Tempo Real", desc: "Varredura contínua de portais de notícias, blogs e fóruns na região do candidato, identificando pautas emergentes e sentimentos predominantes." },
  { icon: Hash, title: "Análise de Redes Sociais", desc: "Coleta e análise de menções no Instagram, Facebook, X (Twitter) e TikTok com classificação automática de sentimento por IA." },
  { icon: Newspaper, title: "Clipping Inteligente", desc: "Curadoria automatizada de matérias e publicações relevantes, organizadas por tema, veículo e impacto na opinião pública." },
  { icon: MessageCircle, title: "Relatórios Estratégicos", desc: "Insights acionáveis gerados por IA para guiar a comunicação, antecipar crises e identificar oportunidades de posicionamento." },
];

/* ── SVG dot pattern ── */
const DotPattern = ({ className = "" }: { className?: string }) => (
  <svg className={`absolute pointer-events-none ${className}`} width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <pattern id="dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
        <circle cx="1.5" cy="1.5" r="1" fill="currentColor" />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#dots)" />
  </svg>
);

const GridPattern = ({ className = "" }: { className?: string }) => (
  <svg className={`absolute pointer-events-none ${className}`} width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <pattern id="grid" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
        <path d="M 60 0 L 0 0 0 60" fill="none" stroke="currentColor" strokeWidth="0.5" />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#grid)" />
  </svg>
);

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-900 overflow-x-hidden font-inter">
      {/* ─── HEADER ─── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-gray-900/80 backdrop-blur-xl border-b border-gray-800/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <img src={logo} alt="Eleitor 360.ai" className="h-8 w-auto" />
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => navigate("/login")} className="text-gray-200 hover:text-white hover:bg-gray-800/60">
              Entrar
            </Button>
            <Button onClick={() => navigate("/login")} className="bg-primary hover:bg-primary-600 text-gray-900 font-semibold">
              Começar Agora <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* ─── HERO ─── */}
      <section className="relative pt-32 pb-20 lg:pt-44 lg:pb-32 overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[900px] h-[700px] rounded-full bg-primary/[0.04] blur-[140px]" />
          <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full bg-primary/[0.03] blur-[100px]" />
          <DotPattern className="inset-0 text-gray-800/40 opacity-40" />
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial="hidden" animate="visible" variants={stagger}>
            <motion.div variants={fadeUp} custom={0} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/[0.06] text-primary text-sm font-medium mb-8">
              <Zap className="h-3.5 w-3.5" />
              Plataforma completa de gestão política
            </motion.div>

            <motion.h1 variants={fadeUp} custom={1} className="font-display text-4xl sm:text-5xl lg:text-7xl font-bold text-white leading-[1.08] tracking-tight mb-6">
              Transforme sua
              <br />
              <span className="bg-gradient-to-r from-primary to-primary-400 bg-clip-text text-transparent">comunicação política</span>
              <br />
              com inteligência
            </motion.h1>

            <motion.p variants={fadeUp} custom={2} className="text-lg sm:text-xl text-gray-400 max-w-3xl mx-auto mb-10 leading-relaxed">
              Captação inteligente, WhatsApp automatizado, ranking de lideranças, gestão de eventos e IA integrada — tudo em uma única plataforma projetada para escalar sua influência.
            </motion.p>

            <motion.div variants={fadeUp} custom={3} className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button onClick={() => navigate("/login")} size="lg" className="bg-primary hover:bg-primary-600 text-gray-900 font-bold text-lg px-10 py-6 shadow-[0_0_50px_hsl(54_100%_50%/0.12)]">
                Acessar Plataforma <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button variant="outline" size="lg" onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })} className="border-primary/30 text-primary hover:bg-primary/10 hover:border-primary/50 text-lg px-10 py-6">
                Conhecer Recursos
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ─── STATS BAR ─── */}
      <section className="relative border-y border-gray-800/60 bg-gradient-to-r from-gray-900 via-gray-800/50 to-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} variants={stagger} className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((s, i) => (
              <motion.div key={i} variants={fadeUp} custom={i} className="text-center">
                <p className="font-display text-3xl sm:text-4xl font-bold text-primary mb-1">{s.value}</p>
                <p className="text-sm text-gray-500 uppercase tracking-wider">{s.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── FEATURES ─── */}
      <section id="features" className="relative py-24 lg:py-32 overflow-hidden">
        <GridPattern className="inset-0 text-gray-800/30 opacity-30" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={stagger} className="text-center mb-16">
            <motion.p variants={fadeUp} custom={0} className="text-primary font-semibold text-sm uppercase tracking-widest mb-3">Recursos</motion.p>
            <motion.h2 variants={fadeUp} custom={1} className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
              Tudo que você precisa,{" "}<span className="bg-gradient-to-r from-primary to-primary-400 bg-clip-text text-transparent">em um só lugar</span>
            </motion.h2>
            <motion.p variants={fadeUp} custom={2} className="text-gray-400 text-lg max-w-2xl mx-auto">
              Do primeiro contato ao engajamento contínuo, cada funcionalidade foi projetada para maximizar seus resultados.
            </motion.p>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} variants={stagger} className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {features.map((f, i) => (
              <motion.div key={i} variants={fadeUp} custom={i} className="group relative rounded-2xl border border-gray-800 bg-gray-800/40 backdrop-blur-sm p-6 hover:border-primary/40 hover:bg-gray-800/70 transition-all duration-300">
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

      {/* ─── PUBLIC OPINION ─── */}
      <section className="relative py-24 lg:py-32 overflow-hidden">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-800/60 to-gray-900 pointer-events-none" />
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-0 w-[500px] h-[500px] -translate-y-1/2 rounded-full bg-primary/[0.04] blur-[120px]" />
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-info-500/[0.03] blur-[100px]" />
          <DotPattern className="inset-0 text-gray-700/20 opacity-30" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={stagger}>
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              {/* Left */}
              <div>
                <motion.div variants={fadeUp} custom={0} className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/[0.06] text-primary text-xs font-semibold uppercase tracking-widest mb-5">
                  <Eye className="h-3.5 w-3.5" />
                  Exclusivo
                </motion.div>
                <motion.h2 variants={fadeUp} custom={1} className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6 leading-tight">
                  Opinião Pública{" "}
                  <span className="bg-gradient-to-r from-primary to-primary-400 bg-clip-text text-transparent">em tempo real</span>
                </motion.h2>
                <motion.p variants={fadeUp} custom={2} className="text-gray-400 text-lg mb-4 leading-relaxed">
                  Saiba o que estão falando sobre você, sua gestão e os temas mais relevantes na sua região — direto de portais de notícias, redes sociais e comunidades online.
                </motion.p>
                <motion.p variants={fadeUp} custom={3} className="text-gray-500 text-base mb-8 leading-relaxed">
                  O módulo de Opinião Pública varre toda a web, incluindo Instagram, Facebook, X (Twitter), TikTok, portais locais e blogs, para entregar uma visão completa do cenário político onde você atua. Use os insights para pautar sua comunicação, antecipar crises e se posicionar com precisão.
                </motion.p>
                <motion.div variants={fadeUp} custom={4}>
                  <Button onClick={() => navigate("/login")} className="bg-primary hover:bg-primary-600 text-gray-900 font-semibold px-8">
                    Conhecer o Módulo <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </motion.div>
              </div>

              {/* Right — feature cards */}
              <div className="grid sm:grid-cols-2 gap-5">
                {opinionFeatures.map((f, i) => (
                  <motion.div key={i} variants={fadeUp} custom={i + 3} className="rounded-2xl border border-gray-700/60 bg-gray-900/80 backdrop-blur-sm p-6 hover:border-primary/30 transition-colors duration-300">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-4">
                      <f.icon className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="text-white font-semibold mb-2">{f.title}</h3>
                    <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── BENEFITS ─── */}
      <section className="relative py-24 lg:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-gray-800/20 via-gray-800/40 to-gray-800/20 pointer-events-none" />
        <DotPattern className="inset-0 text-gray-700/20 opacity-20" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={stagger}>
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <div>
                <motion.p variants={fadeUp} custom={0} className="text-primary font-semibold text-sm uppercase tracking-widest mb-3">Por que escolher a Eleitor 360.ai?</motion.p>
                <motion.h2 variants={fadeUp} custom={1} className="font-display text-3xl sm:text-4xl font-bold text-white mb-6 leading-tight">
                  A plataforma que{" "}<span className="bg-gradient-to-r from-primary to-primary-400 bg-clip-text text-transparent">transforma dados</span>{" "}em resultados reais
                </motion.h2>
                <motion.p variants={fadeUp} custom={2} className="text-gray-400 text-lg mb-8 leading-relaxed">
                  Mais do que um sistema, é uma central de inteligência política que conecta captação, comunicação e gestão territorial em uma experiência integrada e poderosa.
                </motion.p>
                <motion.div variants={fadeUp} custom={3}>
                  <Button onClick={() => navigate("/login")} className="bg-primary hover:bg-primary-600 text-gray-900 font-semibold px-8">
                    Comece Agora <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </motion.div>
              </div>
              <div className="grid sm:grid-cols-2 gap-5">
                {benefits.map((b, i) => (
                  <motion.div key={i} variants={fadeUp} custom={i + 3} className="rounded-2xl border border-gray-800 bg-gray-900/80 backdrop-blur-sm p-6">
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
      <section className="relative py-24 lg:py-32 overflow-hidden">
        <GridPattern className="inset-0 text-gray-800/20 opacity-20" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={stagger} className="text-center mb-16">
            <motion.p variants={fadeUp} custom={0} className="text-primary font-semibold text-sm uppercase tracking-widest mb-3">Como funciona</motion.p>
            <motion.h2 variants={fadeUp} custom={1} className="font-display text-3xl sm:text-4xl font-bold text-white mb-4">
              Simples de usar, <span className="bg-gradient-to-r from-primary to-primary-400 bg-clip-text text-transparent">poderoso nos resultados</span>
            </motion.h2>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} variants={stagger} className="grid md:grid-cols-3 gap-8 relative">
            <div className="hidden md:block absolute top-16 left-[16.5%] right-[16.5%] h-px bg-gradient-to-r from-primary/0 via-primary/30 to-primary/0" />
            {[
              { step: "01", title: "Configure sua organização", desc: "Cadastre regiões, lideranças e personalize formulários de captação em minutos.", icon: Layers },
              { step: "02", title: "Capture e engaje", desc: "Use QR codes, funis e WhatsApp automatizado para construir sua base de contatos.", icon: Users },
              { step: "03", title: "Analise e decida", desc: "Dashboards, mapas e IA transformam dados brutos em insights estratégicos acionáveis.", icon: TrendingUp },
            ].map((s, i) => (
              <motion.div key={i} variants={fadeUp} custom={i} className="relative text-center">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/20 flex items-center justify-center mx-auto mb-6">
                  <s.icon className="h-6 w-6 text-primary" />
                </div>
                <span className="text-xs font-bold text-primary/60 uppercase tracking-widest mb-2 block">Passo {s.step}</span>
                <h3 className="text-white font-semibold text-lg mb-3">{s.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed max-w-xs mx-auto">{s.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── PLANS ─── */}
      <section className="relative py-24 lg:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-gray-800/30 via-gray-900 to-gray-900 pointer-events-none" />
        <DotPattern className="inset-0 text-gray-700/15 opacity-20" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={stagger} className="text-center mb-16">
            <motion.p variants={fadeUp} custom={0} className="text-primary font-semibold text-sm uppercase tracking-widest mb-3">Planos</motion.p>
            <motion.h2 variants={fadeUp} custom={1} className="font-display text-3xl sm:text-4xl font-bold text-white mb-4">
              Escolha o plano ideal{" "}<span className="bg-gradient-to-r from-primary to-primary-400 bg-clip-text text-transparent">para seu mandato</span>
            </motion.h2>
            <motion.p variants={fadeUp} custom={2} className="text-gray-400 text-lg max-w-2xl mx-auto">
              Todos os planos incluem atualizações gratuitas e suporte técnico. Entre em contato para valores personalizados.
            </motion.p>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} variants={stagger} className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {plans.map((plan, i) => (
              <motion.div key={i} variants={fadeUp} custom={i} className={`relative rounded-2xl p-8 flex flex-col backdrop-blur-sm ${plan.highlight ? "border-2 border-primary bg-gray-800/80 shadow-[0_0_80px_hsl(54_100%_50%/0.06)]" : "border border-gray-800 bg-gray-800/40"}`}>
                {plan.badge && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-primary text-gray-900 text-xs font-bold uppercase tracking-wider">{plan.badge}</span>
                )}
                <h3 className="font-display text-white text-xl font-bold mb-1">{plan.name}</h3>
                <p className="text-gray-500 text-sm mb-6">{plan.sub}</p>
                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((feat, fi) => (
                    <li key={fi} className="flex items-start gap-2 text-sm text-gray-300">
                      <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />{feat}
                    </li>
                  ))}
                </ul>
                <Button onClick={() => navigate("/login")} className={plan.highlight ? "bg-primary hover:bg-primary-600 text-gray-900 font-semibold w-full" : "bg-gray-700 hover:bg-gray-600 text-white font-semibold w-full"}>
                  Fale Conosco <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── FINAL CTA ─── */}
      <section className="relative py-24 lg:py-32 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[700px] h-[500px] rounded-full bg-primary/[0.04] blur-[120px]" />
          <GridPattern className="inset-0 text-gray-800/20 opacity-15" />
        </div>
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.div variants={fadeUp} custom={0} className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center mx-auto mb-8">
              <Award className="h-8 w-8 text-primary" />
            </motion.div>
            <motion.h2 variants={fadeUp} custom={1} className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6">
              Pronto para{" "}<span className="bg-gradient-to-r from-primary to-primary-400 bg-clip-text text-transparent">revolucionar</span><br />sua comunicação política?
            </motion.h2>
            <motion.p variants={fadeUp} custom={2} className="text-gray-400 text-lg mb-10 max-w-2xl mx-auto">
              Junte-se a centenas de lideranças que já utilizam a plataforma mais completa do mercado para gestão política inteligente.
            </motion.p>
            <motion.div variants={fadeUp} custom={3} className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button onClick={() => navigate("/login")} size="lg" className="bg-primary hover:bg-primary-600 text-gray-900 font-bold text-lg px-10 py-6 shadow-[0_0_50px_hsl(54_100%_50%/0.12)]">
                Acessar Plataforma <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button variant="outline" size="lg" onClick={() => navigate("/forgot-password")} className="border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white text-lg px-10 py-6">
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
              <img src={logo} alt="Eleitor 360.ai" className="h-6 w-auto" />
              <div className="h-5 w-px bg-gray-800" />
              <p className="text-gray-500 text-sm">© 2026 Eleitor 360.ai</p>
            </div>
            <p className="text-sm text-gray-600">
              Desenvolvida por{" "}<span className="text-gray-400 font-medium">MEGA GLOBAL DIGITAL</span>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
