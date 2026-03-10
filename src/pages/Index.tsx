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
  ChevronDown,
  QrCode,
  Mail,
  Eye,
  Radar,
  MessageCircle,
  Newspaper,
  Hash,
  Clock,
  DollarSign,
  AlertTriangle,
  XCircle,
  Check,
  X,
  Star,
  Quote,
} from "lucide-react";
import logo from "@/assets/logo-eleitor360.png";
import { useState } from "react";

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

const painPoints = [
  { icon: DollarSign, title: "Gestão política cara e fragmentada", desc: "Contratar equipe de captação, comunicação e análise custa caro. Ferramentas desconectadas geram retrabalho e desperdício.", stat: "+R$10k/mês" },
  { icon: Clock, title: "Você não tem tempo para isso", desc: "São mais de 30 horas por semana gerenciando planilhas, grupos de WhatsApp e relatórios manuais que ninguém lê.", stat: "30h/semana" },
  { icon: AlertTriangle, title: "Decisões sem dados reais", desc: "Sem métricas claras, você investe em regiões erradas, ignora lideranças engajadas e perde oportunidades estratégicas.", stat: "Achismo puro" },
  { icon: XCircle, title: "Comunicação descoordenada", desc: "Mensagens duplicadas, contatos sem verificação e nenhum controle sobre o que é enviado em nome da organização.", stat: "Zero controle" },
];

const opinionFeatures = [
  { icon: Radar, title: "Monitoramento em Tempo Real", desc: "Varredura contínua de portais de notícias, blogs e fóruns na região do candidato." },
  { icon: Hash, title: "Análise de Redes Sociais", desc: "Coleta e análise de menções no Instagram, Facebook, X e TikTok com classificação de sentimento." },
  { icon: Newspaper, title: "Clipping Inteligente", desc: "Curadoria automatizada de matérias relevantes, organizadas por tema e impacto." },
  { icon: MessageCircle, title: "Relatórios Estratégicos", desc: "Insights acionáveis por IA para guiar comunicação e antecipar crises." },
];

const beforeAfter = {
  before: [
    "Planilhas e grupos de WhatsApp desorganizados",
    "Captação manual porta a porta sem rastreamento",
    "Comunicação genérica sem segmentação",
    "Relatórios que levam dias para montar",
    "Depender de equipe grande e cara",
  ],
  after: [
    "Plataforma centralizada com dados em tempo real",
    "Captação digital com QR codes e UTM tracking",
    "Comunicação segmentada por região e perfil",
    "Dashboards automáticos com 1 clique",
    "IA + automação que substitui 5 profissionais",
  ],
};

const personas = [
  { title: "Vereadores & Deputados", desc: "Mandato ativo com base de apoiadores", pain: "Precisa manter o engajamento da base e captar novos contatos sem equipe grande.", solution: "Automação de WhatsApp, ranking de lideranças e captação por QR code em eventos.", result: "Base organizada, lideranças engajadas e comunicação ativa 24/7." },
  { title: "Pré-Candidatos", desc: "Construindo rede de apoio do zero", pain: "Precisa crescer rápido, mas não tem estrutura nem dados para decisões estratégicas.", solution: "Funis de captação, mapa de influência e IA para análise territorial.", result: "Rede estruturada com dados de cada região antes mesmo da campanha." },
  { title: "Coordenadores de Campanha", desc: "Gerenciando múltiplas frentes", pain: "Precisa de visão unificada de todas as operações: eventos, materiais, lideranças e contatos.", solution: "Dashboard centralizado, gestão de materiais e relatórios por coordenador.", result: "Controle total da operação com métricas de cada frente em tempo real." },
];

const testimonials = [
  { name: "Carlos M.", role: "Vereador — SP", text: "O ranking de lideranças transformou minha gestão. Consigo ver quem realmente está engajado e direcionar os esforços para onde importa. Minha base cresceu 300% em 6 meses.", avatar: "CM" },
  { name: "Patricia S.", role: "Coordenadora de Campanha — MG", text: "Gerenciava tudo por planilha e WhatsApp. Com a plataforma, centralizei eventos, captação e comunicação. A equipe diminuiu mas o resultado triplicou.", avatar: "PS" },
  { name: "Roberto A.", role: "Deputado Estadual — RJ", text: "O módulo de opinião pública é um game-changer. Consigo pautar minha comunicação com base no que as pessoas realmente falam nas redes. É como ter um instituto de pesquisa particular.", avatar: "RA" },
];

const plans = [
  { name: "Essencial", highlight: false, sub: "Para começar", features: ["Até 5.000 contatos", "Captação por formulário", "Gestão de lideranças", "Ranking básico", "1 usuário administrador", "Suporte por e-mail"] },
  { name: "Profissional", highlight: true, badge: "Mais Popular", sub: "Para operações completas", features: ["Até 50.000 contatos", "Tudo do Essencial +", "WhatsApp automatizado", "Funis de captação ilimitados", "Gestão de eventos com QR", "Mapa de influência", "E-mail marketing", "Até 5 usuários", "Suporte prioritário"] },
  { name: "Enterprise", highlight: false, sub: "Para grandes redes", features: ["Contatos ilimitados", "Tudo do Profissional +", "IA assistente integrada", "Cartão digital (Wallet)", "Multi-tenant", "API personalizada", "Usuários ilimitados", "Gerente de conta dedicado"] },
];

const faqs = [
  { q: "Preciso entender de tecnologia para usar?", a: "Não. A plataforma foi projetada para ser intuitiva. Em menos de 30 minutos você já estará operando. Além disso, oferecemos onboarding guiado e suporte dedicado." },
  { q: "Meus dados ficam seguros?", a: "Absolutamente. Utilizamos criptografia de ponta, autenticação robusta e RLS (Row Level Security) em todas as tabelas. Total conformidade com a LGPD." },
  { q: "Posso testar antes de assinar?", a: "Sim. Oferecemos uma demonstração personalizada para que você conheça todas as funcionalidades antes de tomar sua decisão." },
  { q: "Funciona para qualquer cargo político?", a: "Sim. A plataforma é flexível e atende desde vereadores até governadores. A arquitetura multi-tenant permite escalar para qualquer tamanho de operação." },
  { q: "Meus dados estão seguros?", a: "Totalmente. Utilizamos criptografia de ponta a ponta, servidores com certificação internacional e estamos em conformidade total com a LGPD. Seus dados são seus e nunca são compartilhados com terceiros." },
  { q: "Quantas pessoas podem usar a plataforma?", a: "Depende do plano. O Essencial inclui 1 usuário, o Profissional até 5, e o Enterprise é ilimitado. Cada usuário tem permissões configuráveis." },
];

const stats = [
  { value: "50k+", label: "Contatos gerenciados" },
  { value: "500+", label: "Eventos realizados" },
  { value: "98%", label: "Satisfação dos clientes" },
  { value: "16", label: "Municípios atendidos" },
];

/* ── SVG patterns ── */
let patternCounter = 0;
const DotPattern = ({ className = "" }: { className?: string }) => {
  const id = `dots-${++patternCounter}`;
  return (
    <svg className={`absolute pointer-events-none ${className}`} width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id={id} x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="1.5" r="1" fill="currentColor" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
};

const GridPattern = ({ className = "" }: { className?: string }) => {
  const id = `grid-${++patternCounter}`;
  return (
    <svg className={`absolute pointer-events-none ${className}`} width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id={id} x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
          <path d="M 60 0 L 0 0 0 60" fill="none" stroke="currentColor" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
};

/* ── FAQ Item ── */
const FaqItem = ({ q, a }: { q: string; a: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-800 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-6 py-5 text-left hover:bg-gray-800/40 transition-colors">
        <span className="text-white font-medium pr-4">{q}</span>
        <ChevronDown className={`h-5 w-5 text-primary flex-shrink-0 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${open ? "max-h-48" : "max-h-0"}`}>
        <p className="px-6 pb-5 text-gray-400 leading-relaxed">{a}</p>
      </div>
    </div>
  );
};

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-900 overflow-x-hidden font-inter">
      {/* ─── HEADER ─── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-gray-900/80 backdrop-blur-xl border-b border-gray-800/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <img src={logo} alt="Eleitor 360.ai" className="h-8 w-auto" />
          <nav className="hidden md:flex items-center gap-8">
            <button onClick={() => document.getElementById("como-funciona")?.scrollIntoView({ behavior: "smooth" })} className="text-gray-400 hover:text-white text-sm transition-colors">Como funciona</button>
            <button onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })} className="text-gray-400 hover:text-white text-sm transition-colors">Recursos</button>
            <button onClick={() => document.getElementById("planos")?.scrollIntoView({ behavior: "smooth" })} className="text-gray-400 hover:text-white text-sm transition-colors">Planos</button>
            <button onClick={() => document.getElementById("faq")?.scrollIntoView({ behavior: "smooth" })} className="text-gray-400 hover:text-white text-sm transition-colors">FAQ</button>
          </nav>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => navigate("/login")} className="text-gray-200 hover:text-white hover:bg-gray-800/60 hidden sm:inline-flex">
              Entrar
            </Button>
            <Button onClick={() => navigate("/contato")} className="bg-primary hover:bg-primary-600 text-gray-900 font-semibold">
              Entrar em contato
            </Button>
          </div>
        </div>
      </header>

      {/* ─── HERO ─── */}
      <section className="relative pt-28 pb-20 lg:pt-36 lg:pb-28 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/3 w-[700px] h-[500px] rounded-full bg-primary/[0.04] blur-[140px]" />
          <DotPattern className="inset-0 text-gray-800/40 opacity-30" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left — text */}
            <motion.div initial="hidden" animate="visible" variants={stagger}>
              <motion.div variants={fadeUp} custom={0} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/[0.06] text-primary text-sm font-medium mb-6">
                <Zap className="h-3.5 w-3.5" />
                Plataforma completa de gestão política
              </motion.div>

              <motion.h1 variants={fadeUp} custom={1} className="font-display text-4xl sm:text-5xl lg:text-[3.5rem] font-bold text-white leading-[1.1] tracking-tight mb-6">
                Transforme o custo de{" "}
                <span className="bg-gradient-to-r from-primary to-primary-400 bg-clip-text text-transparent">uma equipe inteira</span>{" "}
                em inteligência política.
              </motion.h1>

              <motion.p variants={fadeUp} custom={2} className="text-lg text-gray-400 mb-8 leading-relaxed max-w-xl">
                O Eleitor 360.ai é a plataforma que cuida da sua captação, comunicação e análise territorial como uma equipe de 10 pessoas faria — mas 24h por dia, sem erros e com IA integrada.
              </motion.p>

              <motion.div variants={fadeUp} custom={3} className="flex flex-col sm:flex-row gap-3 mb-6">
                <Button onClick={() => navigate("/login")} size="lg" className="bg-primary hover:bg-primary-600 text-gray-900 font-bold text-base px-8 py-6 shadow-[0_0_40px_hsl(54_100%_50%/0.1)]">
                  Acessar agora! <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button size="lg" onClick={() => document.getElementById("como-funciona")?.scrollIntoView({ behavior: "smooth" })} className="bg-gray-800 hover:bg-gray-700 text-gray-200 font-medium text-base px-8 py-6 border border-gray-700">
                  Ver como funciona →
                </Button>
              </motion.div>

              <motion.div variants={fadeUp} custom={4} className="flex flex-wrap gap-x-5 gap-y-2">
                {["Configurado em minutos", "Sem burocracia", "Suporte dedicado"].map((t) => (
                  <span key={t} className="flex items-center gap-1.5 text-sm text-gray-500">
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary" />{t}
                  </span>
                ))}
              </motion.div>
            </motion.div>

            {/* Right — dashboard mockup */}
            <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 0.3 }} className="relative">
              <div className="rounded-2xl border border-gray-700/60 bg-gray-800/60 backdrop-blur-sm p-1 shadow-2xl">
                {/* Stats row */}
                <div className="grid grid-cols-3 gap-3 p-4">
                  {[
                    { icon: Radar, label: "Opinião pública", value: "94%+", color: "text-emerald-400" },
                    { icon: Clock, label: "Horas economizadas", value: "30h/sem", color: "text-primary" },
                    { icon: TrendingUp, label: "Engajamento", value: "+340%", color: "text-sky-400" },
                  ].map((s, i) => (
                    <div key={i} className="rounded-xl bg-gray-900/80 border border-gray-700/40 p-4 text-center">
                      <s.icon className="h-4 w-4 mx-auto mb-1.5 text-gray-500" />
                      <p className="text-[11px] text-gray-500 mb-0.5">{s.label}</p>
                      <p className={`font-display text-lg font-bold ${s.color}`}>{s.value}</p>
                    </div>
                  ))}
                </div>

                {/* AI notification */}
                <div className="mx-4 mb-3 rounded-xl bg-gray-900/80 border border-gray-700/40 p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Brain className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white mb-1">IA detectou uma oportunidade</p>
                      <p className="text-xs text-gray-400 leading-relaxed">"A região Norte apresenta 340 contatos sem liderança ativa. Recomendo designar um coordenador para maximizar o engajamento."</p>
                    </div>
                  </div>
                </div>

                {/* Action applied */}
                <div className="mx-4 mb-4 rounded-xl bg-emerald-500/[0.08] border border-emerald-500/20 p-3 flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-white font-medium">Relatório gerado automaticamente</p>
                    <p className="text-xs text-emerald-400">12 insights estratégicos identificados</p>
                  </div>
                </div>
              </div>

              {/* Glow behind */}
              <div className="absolute -inset-4 bg-primary/[0.03] rounded-3xl blur-2xl -z-10" />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── PAIN POINTS ─── */}
      <section className="relative py-24 lg:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-gray-900 via-gray-800/30 to-gray-900 pointer-events-none" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={stagger} className="text-center mb-16">
            <motion.div variants={fadeUp} custom={0} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-danger-500/30 bg-danger-500/[0.06] text-danger-500 text-sm font-medium mb-5">
              Isso te parece familiar?
            </motion.div>
            <motion.h2 variants={fadeUp} custom={1} className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
              O cenário mudou. Gerir politicamente{" "}
              <span className="bg-gradient-to-r from-danger-500 to-warning-500 bg-clip-text text-transparent">do jeito antigo</span> já não funciona.
            </motion.h2>
            <motion.p variants={fadeUp} custom={2} className="text-gray-400 text-lg max-w-2xl mx-auto">
              Se você atua na política, provavelmente está enfrentando pelo menos um desses problemas agora.
            </motion.p>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} variants={stagger} className="grid sm:grid-cols-2 gap-5 max-w-4xl mx-auto">
            {painPoints.map((p, i) => (
              <motion.div key={i} variants={fadeUp} custom={i} className="rounded-2xl border border-gray-800 bg-gray-800/40 backdrop-blur-sm p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-11 h-11 rounded-xl bg-danger-500/10 flex items-center justify-center">
                    <p.icon className="h-5 w-5 text-danger-500" />
                  </div>
                  <span className="text-xs font-bold text-danger-500/80 bg-danger-500/[0.08] px-2.5 py-1 rounded-md">{p.stat}</span>
                </div>
                <h3 className="text-white font-semibold text-base mb-2">{p.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{p.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── SOLUTION / FEATURES ─── */}
      <section id="features" className="relative py-24 lg:py-32 overflow-hidden">
        <GridPattern className="inset-0 text-gray-800/30 opacity-30" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={stagger} className="text-center mb-6">
            <motion.div variants={fadeUp} custom={0} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/[0.06] text-primary text-sm font-medium mb-5">
              A solução
            </motion.div>
            <motion.h2 variants={fadeUp} custom={1} className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
              Sua central de inteligência política —{" "}
              <span className="bg-gradient-to-r from-primary to-primary-400 bg-clip-text text-transparent">que nunca dorme.</span>
            </motion.h2>
            <motion.p variants={fadeUp} custom={2} className="text-gray-400 text-lg max-w-3xl mx-auto">
              O Eleitor 360.ai combina automação, dados e IA para cuidar da sua gestão com a mesma qualidade de uma equipe completa — mas 24h por dia.
            </motion.p>
          </motion.div>

          {/* Feature highlights — 3 big cards */}
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} variants={stagger} className="grid md:grid-cols-3 gap-6 mb-16 mt-12">
            {[
              { icon: Brain, title: "Motor de IA", desc: "O sistema analisa contatos, lideranças e territórios 24h por dia, identifica oportunidades e age — sem você precisar abrir uma planilha.", bullets: ["Diagnóstico territorial automático", "Recomendações de ação claras", "Insights em tempo real"] },
              { icon: Shield, title: "Segurança Total", desc: "Criptografia, conformidade LGPD e controle granular de permissões. Seus dados nunca ficam expostos.", bullets: ["RLS em todas as tabelas", "Conformidade LGPD completa", "Logs de auditoria"] },
              { icon: MessageSquare, title: "Comunicação Integrada", desc: "WhatsApp automatizado, e-mail marketing e SMS em uma única plataforma com verificação e opt-out.", bullets: ["Fluxos automáticos de WhatsApp", "Templates de e-mail profissionais", "Verificação de contatos"] },
            ].map((f, i) => (
              <motion.div key={i} variants={fadeUp} custom={i} className="rounded-2xl border border-gray-700/60 bg-gray-800/50 backdrop-blur-sm p-8 hover:border-primary/30 transition-colors duration-300">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/20 flex items-center justify-center mb-5">
                  <f.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-white font-semibold text-lg mb-3">{f.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed mb-4">{f.desc}</p>
                <ul className="space-y-2">
                  {f.bullets.map((b, bi) => (
                    <li key={bi} className="flex items-center gap-2 text-sm text-gray-300">
                      <Check className="h-3.5 w-3.5 text-primary flex-shrink-0" />{b}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </motion.div>

          {/* All features grid */}
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} variants={stagger} className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {features.map((f, i) => (
              <motion.div key={i} variants={fadeUp} custom={i} className="group rounded-xl border border-gray-800 bg-gray-800/30 p-5 hover:border-primary/30 hover:bg-gray-800/60 transition-all duration-300">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
                  <f.icon className="h-4 w-4 text-primary" />
                </div>
                <h3 className="text-white font-semibold text-sm mb-1.5">{f.title}</h3>
                <p className="text-gray-500 text-xs leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section id="como-funciona" className="relative py-24 lg:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-gray-800/20 via-gray-800/40 to-gray-800/20 pointer-events-none" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={stagger} className="text-center mb-16">
            <motion.div variants={fadeUp} custom={0} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/[0.06] text-primary text-sm font-medium mb-5">
              Como funciona
            </motion.div>
            <motion.h2 variants={fadeUp} custom={1} className="font-display text-3xl sm:text-4xl font-bold text-white mb-4">
              Comece em{" "}<span className="bg-gradient-to-r from-primary to-primary-400 bg-clip-text text-transparent">3 passos simples</span>
            </motion.h2>
            <motion.p variants={fadeUp} custom={2} className="text-gray-400 text-lg max-w-xl mx-auto">
              Do setup à automação completa em menos de 30 minutos. Sem código, sem complicação.
            </motion.p>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} variants={stagger} className="grid md:grid-cols-3 gap-8 relative">
            <div className="hidden md:block absolute top-16 left-[16.5%] right-[16.5%] h-px bg-gradient-to-r from-primary/0 via-primary/30 to-primary/0" />
            {[
              { step: "01", title: "Configure sua organização", desc: "Cadastre regiões, lideranças e personalize formulários de captação.", icon: Layers, time: "5 minutos" },
              { step: "02", title: "Capture e engaje", desc: "Use QR codes, funis e WhatsApp automatizado para construir sua base.", icon: Users, time: "15 minutos" },
              { step: "03", title: "Analise e decida", desc: "Dashboards, mapas e IA transformam dados em insights estratégicos.", icon: TrendingUp, time: "24/7" },
            ].map((s, i) => (
              <motion.div key={i} variants={fadeUp} custom={i} className="relative text-center">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/20 flex items-center justify-center mx-auto mb-5">
                  <s.icon className="h-6 w-6 text-primary" />
                </div>
                <span className="text-xs font-bold text-primary/60 uppercase tracking-widest mb-2 block">Passo {s.step}</span>
                <h3 className="text-white font-semibold text-lg mb-2">{s.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed max-w-xs mx-auto mb-3">{s.desc}</p>
                <span className="text-xs text-primary/80 font-medium">⏱ {s.time}</span>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── BEFORE / AFTER ─── */}
      <section className="relative py-24 lg:py-32 overflow-hidden">
        <DotPattern className="inset-0 text-gray-700/20 opacity-20" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={stagger} className="text-center mb-16">
            <motion.div variants={fadeUp} custom={0} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/[0.06] text-primary text-sm font-medium mb-5">
              Transformação real
            </motion.div>
            <motion.h2 variants={fadeUp} custom={1} className="font-display text-3xl sm:text-4xl font-bold text-white mb-4">
              De caos operacional para{" "}
              <span className="bg-gradient-to-r from-primary to-primary-400 bg-clip-text text-transparent">gestão inteligente</span>
            </motion.h2>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} variants={stagger} className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {/* Before */}
            <motion.div variants={fadeUp} custom={0} className="rounded-2xl border border-danger-500/20 bg-danger-500/[0.03] p-8">
              <h3 className="flex items-center gap-2 text-lg font-bold text-white mb-6">
                <span className="text-2xl">😩</span> Antes — Gestão Manual
              </h3>
              <ul className="space-y-4">
                {beforeAfter.before.map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-gray-400">
                    <X className="h-4 w-4 text-danger-500 mt-0.5 flex-shrink-0" />{item}
                  </li>
                ))}
              </ul>
              <div className="mt-6 pt-4 border-t border-danger-500/10">
                <p className="text-xs text-danger-500 font-medium">Resultado: Custo alto, equipe estressada, zero previsibilidade</p>
              </div>
            </motion.div>

            {/* After */}
            <motion.div variants={fadeUp} custom={1} className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.03] p-8">
              <h3 className="flex items-center gap-2 text-lg font-bold text-white mb-6">
                <span className="text-2xl">🚀</span> Depois — Com Eleitor 360.ai
              </h3>
              <ul className="space-y-4">
                {beforeAfter.after.map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-gray-300">
                    <Check className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />{item}
                  </li>
                ))}
              </ul>
              <div className="mt-6 pt-4 border-t border-emerald-500/10">
                <p className="text-xs text-emerald-400 font-medium">Resultado: Menos custo, mais engajamento, controle total</p>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ─── PUBLIC OPINION ─── */}
      <section className="relative py-24 lg:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-800/60 to-gray-900 pointer-events-none" />
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-0 w-[500px] h-[500px] -translate-y-1/2 rounded-full bg-primary/[0.04] blur-[120px]" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={stagger}>
            <div className="grid lg:grid-cols-2 gap-16 items-center">
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
                  Saiba o que estão falando sobre você, sua gestão e os temas mais relevantes na sua região — direto de portais, redes sociais e comunidades online.
                </motion.p>
                <motion.p variants={fadeUp} custom={3} className="text-gray-500 text-base mb-8 leading-relaxed">
                  O módulo varre toda a web — Instagram, Facebook, X, TikTok, portais locais e blogs — para entregar uma visão completa do cenário político onde você atua.
                </motion.p>
                <motion.div variants={fadeUp} custom={4}>
                  <Button onClick={() => navigate("/login")} className="bg-primary hover:bg-primary-600 text-gray-900 font-semibold px-8">
                    Conhecer o Módulo <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </motion.div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
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

      {/* ─── FOR WHO ─── */}
      <section className="relative py-24 lg:py-32 overflow-hidden">
        <GridPattern className="inset-0 text-gray-800/20 opacity-20" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={stagger} className="text-center mb-16">
            <motion.div variants={fadeUp} custom={0} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/[0.06] text-primary text-sm font-medium mb-5">
              Para quem é
            </motion.div>
            <motion.h2 variants={fadeUp} custom={1} className="font-display text-3xl sm:text-4xl font-bold text-white mb-4">
              Feito para quem quer{" "}
              <span className="bg-gradient-to-r from-primary to-primary-400 bg-clip-text text-transparent">resultado real,</span>{" "}
              não complicação.
            </motion.h2>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} variants={stagger} className="grid md:grid-cols-3 gap-6">
            {personas.map((p, i) => (
              <motion.div key={i} variants={fadeUp} custom={i} className="rounded-2xl border border-gray-800 bg-gray-800/40 backdrop-blur-sm p-8">
                <h3 className="text-white font-bold text-lg mb-1">{p.title}</h3>
                <p className="text-gray-500 text-sm mb-5">{p.desc}</p>

                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-bold text-danger-500 uppercase tracking-wider mb-1">⚠ Dor principal</p>
                    <p className="text-gray-400 text-sm">{p.pain}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-primary uppercase tracking-wider mb-1">💡 Solução</p>
                    <p className="text-gray-400 text-sm">{p.solution}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1">✓ Resultado</p>
                    <p className="text-gray-300 text-sm">{p.result}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── TESTIMONIALS ─── */}
      <section className="relative py-24 lg:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-gray-800/20 via-gray-800/40 to-gray-800/20 pointer-events-none" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={stagger} className="text-center mb-16">
            <motion.div variants={fadeUp} custom={0} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/[0.06] text-primary text-sm font-medium mb-5">
              Quem já usa
            </motion.div>
            <motion.h2 variants={fadeUp} custom={1} className="font-display text-3xl sm:text-4xl font-bold text-white mb-4">
              Lideranças que{" "}
              <span className="bg-gradient-to-r from-primary to-primary-400 bg-clip-text text-transparent">transformaram</span>{" "}
              sua gestão política.
            </motion.h2>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} variants={stagger} className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <motion.div key={i} variants={fadeUp} custom={i} className="rounded-2xl border border-gray-800 bg-gray-800/40 backdrop-blur-sm p-8 flex flex-col">
                <Quote className="h-8 w-8 text-primary/30 mb-4" />
                <p className="text-gray-300 text-sm leading-relaxed mb-6 flex-1">"{t.text}"</p>
                <div className="flex items-center gap-3 pt-4 border-t border-gray-800">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">{t.avatar}</div>
                  <div>
                    <p className="text-white font-medium text-sm">{t.name}</p>
                    <p className="text-gray-500 text-xs">{t.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Stats below testimonials */}
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="grid grid-cols-2 lg:grid-cols-4 gap-6 mt-16 max-w-3xl mx-auto">
            {stats.map((s, i) => (
              <motion.div key={i} variants={fadeUp} custom={i} className="text-center">
                <p className="font-display text-2xl sm:text-3xl font-bold text-primary mb-1">{s.value}</p>
                <p className="text-xs text-gray-500 uppercase tracking-wider">{s.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── PLANS ─── */}
      <section id="planos" className="relative py-24 lg:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-gray-800/30 via-gray-900 to-gray-900 pointer-events-none" />
        <DotPattern className="inset-0 text-gray-700/15 opacity-20" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={stagger} className="text-center mb-16">
            <motion.div variants={fadeUp} custom={0} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/[0.06] text-primary text-sm font-medium mb-5">
              Planos do sistema
            </motion.div>
            <motion.h2 variants={fadeUp} custom={1} className="font-display text-3xl sm:text-4xl font-bold text-white mb-4">
              Investimento que se paga{" "}
              <span className="bg-gradient-to-r from-primary to-primary-400 bg-clip-text text-transparent">na primeira semana</span>
            </motion.h2>
            <motion.p variants={fadeUp} custom={2} className="text-gray-400 text-lg max-w-2xl mx-auto">
              Escolha o plano ideal para o tamanho da sua operação. Entre em contato para valores personalizados.
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
                <Button onClick={() => navigate("/contato")} className={plan.highlight ? "bg-primary hover:bg-primary-600 text-gray-900 font-semibold w-full" : "bg-gray-700 hover:bg-gray-600 text-gray-200 font-semibold w-full border border-gray-600"}>
                  Fale Conosco <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section id="faq" className="relative py-24 lg:py-32 overflow-hidden">
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={stagger} className="text-center mb-12">
            <motion.div variants={fadeUp} custom={0} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/[0.06] text-primary text-sm font-medium mb-5">
              Perguntas frequentes
            </motion.div>
            <motion.h2 variants={fadeUp} custom={1} className="font-display text-3xl sm:text-4xl font-bold text-white mb-4">
              Dúvidas?{" "}
              <span className="bg-gradient-to-r from-primary to-primary-400 bg-clip-text text-transparent">A gente responde.</span>
            </motion.h2>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} variants={stagger} className="space-y-3">
            {faqs.map((faq, i) => (
              <motion.div key={i} variants={fadeUp} custom={i}>
                <FaqItem q={faq.q} a={faq.a} />
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
            <motion.h2 variants={fadeUp} custom={0} className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6">
              Pronto para transformar{" "}
              <span className="bg-gradient-to-r from-primary to-primary-400 bg-clip-text text-transparent">custo em resultado?</span>
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-gray-400 text-lg mb-10 max-w-2xl mx-auto">
              Configure sua organização em minutos e veja o que o Eleitor 360.ai já identificaria na sua operação hoje.
            </motion.p>
            <motion.div variants={fadeUp} custom={2} className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
              <Button onClick={() => navigate("/login")} size="lg" className="bg-primary hover:bg-primary-600 text-gray-900 font-bold text-lg px-10 py-6 shadow-[0_0_50px_hsl(54_100%_50%/0.12)]">
                Acessar agora! <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button size="lg" onClick={() => navigate("/contato")} className="bg-gray-800 hover:bg-gray-700 text-gray-200 font-medium text-lg px-10 py-6 border border-gray-700">
                Falar com especialista
              </Button>
            </motion.div>
            <motion.div variants={fadeUp} custom={3} className="flex flex-wrap gap-x-6 gap-y-2 justify-center">
              {["Configurado em minutos", "Sem burocracia", "Suporte dedicado"].map((t) => (
                <span key={t} className="flex items-center gap-1.5 text-sm text-gray-500">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" />{t}
                </span>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-border/30 bg-[hsl(225,25%,8%)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Top section — Logo + Menus */}
          <div className="py-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
            {/* Brand */}
            <div className="lg:col-span-2 space-y-4">
              <img src={logo} alt="Eleitor 360.ai" className="h-8 w-auto" />
              <p className="text-muted-foreground text-sm leading-relaxed max-w-sm">
                A plataforma mais completa de gestão política com inteligência artificial. 
                Transforme dados em votos e relacionamentos em resultados.
              </p>
              <div className="flex items-center gap-3 pt-2">
                {["Instagram", "LinkedIn", "YouTube"].map((social) => (
                  <a key={social} href="#" className="w-9 h-9 rounded-lg bg-[hsl(225,20%,15%)] hover:bg-primary/20 flex items-center justify-center transition-colors group">
                    <span className="text-xs text-muted-foreground group-hover:text-primary font-medium">{social[0]}</span>
                  </a>
                ))}
              </div>
            </div>

            {/* Produto */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-white tracking-wide uppercase">Produto</h4>
              <ul className="space-y-3">
                {[
                  { label: "Recursos", href: "#features" },
                  { label: "Planos e Preços", href: "#planos" },
                  { label: "Inteligência Artificial", href: "#como-funciona" },
                  { label: "Mapa Político", href: "#features" },
                  { label: "Eventos", href: "#features" },
                ].map((item) => (
                  <li key={item.label}>
                    <a href={item.href} className="text-sm text-muted-foreground hover:text-primary transition-colors">{item.label}</a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Empresa */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-white tracking-wide uppercase">Empresa</h4>
              <ul className="space-y-3">
              {[
                  { label: "Sobre Nós", href: "/sobre" },
                  { label: "Blog", href: "#" },
                  { label: "Carreiras", href: "#" },
                  { label: "Contato", href: "/contato" },
                  { label: "Parceiros", href: "#" },
                ].map((item) => (
                  <li key={item.label}>
                    <a href={item.href} className="text-sm text-muted-foreground hover:text-primary transition-colors">{item.label}</a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Suporte */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-white tracking-wide uppercase">Suporte</h4>
              <ul className="space-y-3">
                {[
                  { label: "Central de Ajuda", href: "/ajuda" },
                  { label: "Status do Sistema", href: "/status" },
                  { label: "Fale Conosco", href: "/contato" },
                ].map((item) => (
                  <li key={item.label}>
                    <a href={item.href} className="text-sm text-muted-foreground hover:text-primary transition-colors">{item.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-border/20" />

          {/* Bottom section — Legal */}
          <div className="py-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} Eleitor 360.ai — Todos os direitos reservados. Desenvolvida por{" "}
              <span className="text-foreground/70 font-medium">MEGA GLOBAL DIGITAL</span>
            </p>
            <div className="flex items-center gap-6">
              {[
                { label: "Termos de Uso", href: "/termos-de-uso" },
                { label: "Política de Privacidade", href: "/politica-de-privacidade" },
                { label: "LGPD e Cookies", href: "/lgpd-cookies" },
              ].map((item) => (
                <a key={item.label} href={item.href} className="text-xs text-muted-foreground hover:text-primary transition-colors">
                  {item.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
