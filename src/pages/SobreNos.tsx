import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Target, Users, Brain, Shield, Globe, Zap, Heart, Award, Rocket } from "lucide-react";
import logo from "@/assets/logo-eleitor360.png";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.6, delay: i * 0.1, ease: "easeOut" as const },
  }),
};

const SobreNos = () => {
  return (
    <div className="min-h-screen bg-[hsl(225,25%,6%)] text-gray-50 dark">
      {/* Header */}
      <header className="border-b border-border/20 bg-[hsl(225,25%,6%)]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/">
            <img src={logo} alt="Eleitor 360.ai" className="h-8 w-auto" />
          </Link>
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Voltar ao início
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <motion.span
            initial="hidden" whileInView="visible" viewport={{ once: true }}
            variants={fadeUp} custom={0}
            className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold tracking-wide uppercase mb-6"
          >
            Sobre nós
          </motion.span>
          <motion.h1
            initial="hidden" whileInView="visible" viewport={{ once: true }}
            variants={fadeUp} custom={1}
            className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight tracking-tight mb-6"
          >
            Transformando a{" "}
            <span className="text-primary">gestão política</span>{" "}
            com tecnologia
          </motion.h1>
          <motion.p
            initial="hidden" whileInView="visible" viewport={{ once: true }}
            variants={fadeUp} custom={2}
            className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed"
          >
            Somos a plataforma que une inteligência artificial, dados e estratégia
            para aproximar mandatários de seus eleitores de forma organizada,
            eficiente e transparente.
          </motion.p>
        </div>
      </section>

      {/* Missão, Visão, Valores */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: Target,
                title: "Missão",
                text: "Empoderar mandatários e equipes políticas com ferramentas inteligentes que potencializam o relacionamento com a base de apoio, gerando resultados mensuráveis e fortalecendo a democracia participativa.",
              },
              {
                icon: Globe,
                title: "Visão",
                text: "Ser a plataforma de referência em gestão política no Brasil, reconhecida pela inovação tecnológica, excelência no atendimento e pelo impacto positivo na relação entre representantes e cidadãos.",
              },
              {
                icon: Heart,
                title: "Valores",
                text: "Proximidade, transparência, eficiência e inovação. Acreditamos que a tecnologia deve servir para aproximar pessoas e transformar dados em ações concretas que beneficiam a sociedade.",
              },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                initial="hidden" whileInView="visible" viewport={{ once: true }}
                variants={fadeUp} custom={i}
                className="relative p-8 rounded-2xl border border-border/20 bg-[hsl(225,20%,10%)] hover:border-primary/30 transition-all duration-300 group"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary/20 transition-colors">
                  <item.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3 text-white">{item.title}</h3>
                <p className="text-muted-foreground leading-relaxed text-sm">{item.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Nossa história */}
      <section className="py-20 bg-[hsl(225,20%,8%)]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true }}
            variants={fadeUp}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Nossa História</h2>
            <div className="w-16 h-1 bg-primary mx-auto rounded-full" />
          </motion.div>

          <div className="space-y-12">
            {[
              {
                year: "2023",
                title: "O início",
                text: "Nascemos da identificação de uma lacuna no mercado político brasileiro: a falta de ferramentas tecnológicas integradas e acessíveis para gestão de mandatos. Nossa equipe de desenvolvedores e estrategistas políticos uniu forças para criar a solução definitiva.",
              },
              {
                year: "2024",
                title: "Crescimento acelerado",
                text: "Com o amadurecimento da plataforma, incorporamos módulos de WhatsApp integrado, gestão de eventos com check-in por QR Code, funis de captação inteligentes e um sistema robusto de gestão de lideranças com hierarquia multinível.",
              },
              {
                year: "2025",
                title: "Inteligência Artificial",
                text: "Lançamos o agente de IA integrado, capaz de analisar dados, gerar insights estratégicos, monitorar opinião pública em tempo real e automatizar processos que antes demandavam horas da equipe de gabinete.",
              },
              {
                year: "2026",
                title: "Referência nacional",
                text: "Consolidamos nossa posição como a plataforma mais completa de gestão política no Brasil, atendendo gabinetes de todas as esferas com tecnologia de ponta, suporte dedicado e inovação contínua.",
              },
            ].map((item, i) => (
              <motion.div
                key={item.year}
                initial="hidden" whileInView="visible" viewport={{ once: true }}
                variants={fadeUp} custom={i}
                className="flex gap-6 md:gap-10"
              >
                <div className="flex flex-col items-center">
                  <span className="text-primary font-bold text-lg">{item.year}</span>
                  <div className="w-px flex-1 bg-primary/20 mt-2" />
                </div>
                <div className="pb-4">
                  <h3 className="text-xl font-semibold text-white mb-2">{item.title}</h3>
                  <p className="text-muted-foreground leading-relaxed text-sm">{item.text}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* O que nos diferencia */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true }}
            variants={fadeUp}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">O que nos diferencia</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Combinamos tecnologia avançada com profundo conhecimento do ecossistema político brasileiro
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Brain, title: "IA Integrada", desc: "Agente inteligente que analisa dados, gera relatórios e sugere estratégias em tempo real" },
              { icon: Shield, title: "Segurança Total", desc: "Dados criptografados, LGPD compliance e infraestrutura enterprise para proteção completa" },
              { icon: Users, title: "Multi-tenant", desc: "Gerencie múltiplos gabinetes com isolamento total de dados e permissões granulares" },
              { icon: Zap, title: "Automação", desc: "Fluxos automatizados de WhatsApp, SMS, email e verificação que economizam horas de trabalho" },
              { icon: Award, title: "Gamificação", desc: "Sistema de pontuação e ranking para engajar lideranças e medir resultados de forma objetiva" },
              { icon: Globe, title: "Opinião Pública", desc: "Monitoramento de notícias, redes sociais e sentimento popular com análise por IA" },
              { icon: Rocket, title: "Setup em Minutos", desc: "Plataforma pronta para uso imediato, sem necessidade de infraestrutura ou equipe técnica" },
              { icon: Heart, title: "Suporte Dedicado", desc: "Time especialista em gestão política pronto para ajudar via WhatsApp, email e chamadas" },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                initial="hidden" whileInView="visible" viewport={{ once: true }}
                variants={fadeUp} custom={i}
                className="p-6 rounded-xl border border-border/20 bg-[hsl(225,20%,10%)] hover:border-primary/30 transition-all duration-300 group text-center"
              >
                <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 transition-colors">
                  <item.icon className="w-5 h-5 text-primary" />
                </div>
                <h4 className="font-semibold text-white mb-2 text-sm">{item.title}</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Números */}
      <section className="py-20 bg-[hsl(225,20%,8%)]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true }}
            variants={fadeUp}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Nossos Números</h2>
            <p className="text-muted-foreground">Resultados que comprovam nossa entrega</p>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { value: "500+", label: "Gabinetes atendidos" },
              { value: "2M+", label: "Contatos gerenciados" },
              { value: "50K+", label: "Eventos realizados" },
              { value: "99.9%", label: "Uptime garantido" },
            ].map((item, i) => (
              <motion.div
                key={item.label}
                initial="hidden" whileInView="visible" viewport={{ once: true }}
                variants={fadeUp} custom={i}
                className="text-center"
              >
                <span className="text-4xl md:text-5xl font-bold text-primary">{item.value}</span>
                <p className="text-sm text-muted-foreground mt-2">{item.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true }}
            variants={fadeUp}
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Pronto para transformar seu mandato?
            </h2>
            <p className="text-muted-foreground text-lg mb-8 max-w-2xl mx-auto">
              Junte-se a centenas de gabinetes que já utilizam a plataforma mais completa
              de gestão política com inteligência artificial do Brasil.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/login"
                className="px-8 py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors"
              >
                Começar Agora
              </Link>
              <a
                href="https://wa.me/5561999999999"
                target="_blank"
                rel="noopener noreferrer"
                className="px-8 py-3.5 rounded-xl border border-border/40 text-foreground font-semibold hover:border-primary/50 hover:text-primary transition-colors"
              >
                Falar com Consultor
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer mini */}
      <footer className="border-t border-border/20 bg-[hsl(225,25%,8%)] py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Eleitor 360.ai — Todos os direitos reservados.
          </p>
          <div className="flex items-center gap-6">
            {[
              { label: "Termos de Uso", href: "/termos-de-uso" },
              { label: "Política de Privacidade", href: "/politica-de-privacidade" },
              { label: "LGPD e Cookies", href: "/lgpd-cookies" },
            ].map((item) => (
              <Link key={item.label} to={item.href} className="text-xs text-muted-foreground hover:text-primary transition-colors">
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
};

export default SobreNos;
