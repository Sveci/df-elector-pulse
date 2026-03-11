import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Search, Users, BarChart3, Calendar, MessageSquare, Map, Brain, Mail, QrCode, Smartphone, Shield, FileText, Globe, ChevronDown, ChevronUp, Eye, Megaphone, ClipboardList, Building2, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.5 } }),
};

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.06 } } };

interface HelpSection {
  icon: React.ElementType;
  title: string;
  description: string;
  articles: { title: string; content: string }[];
}

const helpSections: HelpSection[] = [
  {
    icon: Users,
    title: "Captação e Gestão de Contatos",
    description: "Tudo sobre como captar, organizar e gerenciar sua base de contatos.",
    articles: [
      { title: "Como cadastrar contatos manualmente?", content: "Acesse o módulo 'Contatos' no menu lateral, clique em 'Novo Contato' e preencha as informações. É possível cadastrar nome, telefone, e-mail, endereço, região administrativa e observações. Todos os contatos são automaticamente vinculados ao seu tenant." },
      { title: "Como importar contatos em massa?", content: "No módulo de Contatos, utilize a opção de importação por planilha (Excel/CSV). O sistema faz o mapeamento automático das colunas e valida telefones duplicados antes da importação. Contatos com telefone já existente são atualizados, não duplicados." },
      { title: "Como funciona a captação por formulário?", content: "Os Funis de Captação permitem criar landing pages personalizadas com lead magnets (e-books, materiais). O visitante preenche o formulário, recebe o material automaticamente e é registrado como contato na plataforma com rastreamento UTM completo." },
      { title: "Como verificar contatos?", content: "A verificação pode ser feita por WhatsApp ou SMS. O sistema envia um código de verificação que o contato confirma, garantindo opt-in responsável e conformidade com a LGPD. Contatos verificados recebem um selo de validação." },
      { title: "Como gerenciar contatos duplicados?", content: "Acesse Configurações > Contatos Duplicados. O sistema identifica automaticamente registros com o mesmo telefone normalizado e permite mesclar ou remover duplicatas mantendo o histórico completo." },
    ],
  },
  {
    icon: BarChart3,
    title: "Ranking e Gamificação de Lideranças",
    description: "Entenda o sistema de pontuação e ranking das lideranças.",
    articles: [
      { title: "Como funciona o ranking de lideranças?", content: "O ranking é calculado automaticamente com base em ações das lideranças: cadastros de contatos, participação em eventos, check-ins realizados e engajamento geral. O pódio visual mostra as top 3 lideranças e o ranking completo com filtros por período e região." },
      { title: "Como a pontuação é calculada?", content: "Cada ação tem um peso configurável: cadastro de contato (pontos base), participação em evento (pontos por check-in), indicações que se convertem em contatos verificados (pontos bônus). A pontuação é acumulativa e pode ser filtrada por período." },
      { title: "Como cadastrar lideranças?", content: "Lideranças podem ser cadastradas pelo admin no módulo 'Lideranças' ou através do formulário público de afiliação. Cada liderança recebe um token único para rastrear suas indicações e um QR code personalizado." },
      { title: "O que são coordenadores?", content: "Coordenadores são lideranças com permissões especiais. Eles têm acesso a um painel próprio (/coordenador) onde podem gerenciar eventos, visualizar suas lideranças subordinadas, controlar materiais e acompanhar métricas da sua rede." },
    ],
  },
  {
    icon: Calendar,
    title: "Gestão de Eventos",
    description: "Crie, gerencie e acompanhe eventos com check-in por QR code.",
    articles: [
      { title: "Como criar um evento?", content: "No módulo 'Eventos', clique em 'Novo Evento' e preencha nome, data, horário, local, endereço, região e capacidade. Você pode adicionar uma imagem de capa, categorias e definir um prazo limite para inscrições." },
      { title: "Como funciona a inscrição online?", content: "Cada evento gera uma página pública de inscrição com slug personalizado. Os participantes preenchem nome, e-mail e WhatsApp. Após a inscrição, recebem um QR code único por e-mail para check-in no dia do evento." },
      { title: "Como fazer check-in no evento?", content: "No dia do evento, acesse a tela de check-in pelo painel ou pelo app. Escaneie o QR code do participante ou busque pelo nome. O sistema registra horário e atualiza automaticamente os contadores de presença." },
      { title: "Como enviar fotos pós-evento?", content: "Após o evento, acesse a aba 'Fotos' do evento. Faça upload das imagens e o sistema pode enviar automaticamente por e-mail e/ou SMS para todos os participantes que fizeram check-in." },
    ],
  },
  {
    icon: MessageSquare,
    title: "WhatsApp Automatizado",
    description: "Configure fluxos conversacionais e comunicação automatizada.",
    articles: [
      { title: "Quais provedores de WhatsApp são suportados?", content: "A plataforma suporta três provedores: Z-API (instância própria), 360dialog (API oficial do WhatsApp Business) e Meta Cloud API (API direta da Meta). Cada provedor pode ser configurado em Configurações > Integrações." },
      { title: "Como funciona o chatbot de WhatsApp?", content: "O chatbot responde automaticamente a mensagens recebidas com um menu interativo. Ele pode direcionar para cadastro, eventos, comunidades regionais e atendimento humano. As respostas são configuráveis no módulo de Chatbot." },
      { title: "Como enviar mensagens em massa?", content: "No módulo 'WhatsApp Marketing', selecione os destinatários por segmento, região ou lista. Compose a mensagem (texto, imagem ou template) e agende ou envie imediatamente. O sistema respeita horários silenciosos e limites de envio." },
      { title: "O que são horários silenciosos?", content: "Para evitar spam e respeitar os contatos, você pode configurar horários em que nenhuma mensagem automática é enviada (ex: 22h às 7h). Mensagens agendadas para esse período são enfileiradas e enviadas no próximo horário permitido." },
    ],
  },
  {
    icon: Map,
    title: "Mapa de Influência",
    description: "Visualize sua rede política geograficamente com análise por IA.",
    articles: [
      { title: "O que é o Mapa de Influência?", content: "É uma visualização geográfica interativa que mostra a distribuição de contatos e lideranças por região administrativa. Utiliza heatmaps para identificar áreas de maior concentração e permite análise comparativa entre regiões." },
      { title: "Como funciona a análise por IA?", content: "A IA analisa a distribuição geográfica, identifica vazios de cobertura, sugere regiões prioritárias para expansão e gera relatórios com recomendações estratégicas. As análises são salvas e podem ser consultadas posteriormente." },
      { title: "Como configurar as regiões?", content: "As regiões administrativas são cadastradas em Configurações > Regiões. Cada região pode ter coordenadas geográficas (latitude/longitude) para posicionamento no mapa e é vinculada a contatos e lideranças." },
    ],
  },
  {
    icon: Brain,
    title: "Inteligência Artificial",
    description: "Use o assistente IA para análises e tomada de decisão.",
    articles: [
      { title: "O que o assistente IA pode fazer?", content: "O assistente IA analisa seus dados em tempo real: identifica tendências de crescimento, sugere ações estratégicas, classifica intenções de contatos, gera relatórios narrativos e responde perguntas sobre a sua operação política." },
      { title: "Como usar o chat com IA?", content: "Acesse o módulo 'IA' no menu lateral. Você pode iniciar conversas sobre qualquer aspecto da sua operação. O assistente tem acesso aos seus dados (contatos, lideranças, eventos, métricas) e responde com base em informações reais." },
      { title: "A IA tem acesso aos meus dados?", content: "Sim, mas apenas dentro do seu tenant. A IA acessa dados como quantidade de contatos, distribuição por região, ranking de lideranças e métricas de eventos para fornecer análises precisas. Nenhum dado é compartilhado entre organizações." },
    ],
  },
  {
    icon: Mail,
    title: "E-mail Marketing",
    description: "Envie campanhas de e-mail segmentadas com templates profissionais.",
    articles: [
      { title: "Como criar um template de e-mail?", content: "Acesse o módulo de E-mail Marketing e clique em 'Templates'. Crie templates com HTML personalizado usando variáveis dinâmicas como {{nome}}, {{evento}}, {{website}}. Os templates são categorizados e podem ser ativados/desativados." },
      { title: "Como segmentar envios?", content: "Você pode segmentar por região administrativa, status de verificação, origem do cadastro, participação em eventos e tags personalizadas. Combine múltiplos filtros para criar segmentos precisos." },
      { title: "Como configurar o Resend?", content: "O Resend é o provedor de e-mail da plataforma. Configure sua API key, e-mail e nome do remetente em Configurações > Integrações. É necessário ter um domínio verificado no Resend para envios em produção." },
    ],
  },
  {
    icon: QrCode,
    title: "Funis de Captação",
    description: "Crie landing pages com lead magnets para captar contatos.",
    articles: [
      { title: "Como criar um funil de captação?", content: "No módulo 'Funis', clique em 'Novo Funil'. Defina título, descrição, arquivo do lead magnet (PDF, e-book), campos do formulário e textos da página de obrigado. Cada funil gera uma URL pública única." },
      { title: "O que é um lead magnet?", content: "É um material gratuito (e-book, relatório, guia) oferecido em troca do cadastro do visitante. O download é liberado automaticamente após o preenchimento do formulário, e o contato é registrado na plataforma." },
      { title: "Como rastrear conversões?", content: "Cada funil registra visualizações da página, leads captados e downloads realizados. O rastreamento UTM permite identificar de qual campanha ou canal cada lead veio. Métricas são exibidas no painel do funil." },
    ],
  },
  {
    icon: Smartphone,
    title: "Cartão Digital (Wallet)",
    description: "Cartões digitais para Apple Wallet e Google Wallet.",
    articles: [
      { title: "Como funciona o cartão digital?", content: "Lideranças podem receber um cartão digital que é instalado no Apple Wallet ou Google Wallet. O cartão funciona como identificação e fidelidade, exibindo nome, foto e informações da organização." },
      { title: "Como configurar o PassKit?", content: "A integração com PassKit é configurada em Configurações > Integrações. É necessário ter uma conta PassKit com programa e tier configurados. O sistema gera e distribui os cartões automaticamente." },
    ],
  },
  {
    icon: Shield,
    title: "Verificação e LGPD",
    description: "Conformidade legal e verificação de contatos.",
    articles: [
      { title: "Como o sistema garante conformidade LGPD?", content: "Todos os contatos passam por processo de opt-in verificado. O sistema registra consentimento com data, canal e versão do texto. Contatos podem se descadastrar a qualquer momento via link de unsubscribe presente em todas as comunicações." },
      { title: "Como funciona o opt-out?", content: "Cada contato recebe um token único de unsubscribe. Ao clicar no link, é direcionado a uma página de confirmação. O sistema registra data, canal e motivo do opt-out, cessando imediatamente todas as comunicações." },
    ],
  },
  {
    icon: FileText,
    title: "Materiais de Campanha",
    description: "Controle de estoque e distribuição de materiais.",
    articles: [
      { title: "Como cadastrar materiais?", content: "No módulo 'Materiais', cadastre itens com nome, tipo (adesivo, santinho, banner, etc.), unidade, quantidade produzida e foto. O estoque é atualizado automaticamente conforme retiradas e devoluções são registradas." },
      { title: "Como funciona a reserva de materiais?", content: "Lideranças podem reservar materiais pelo painel do coordenador ou diretamente. Cada reserva gera um código de confirmação, tem prazo de validade e pode ser confirmada, retirada ou cancelada. O estoque é bloqueado durante a reserva." },
      { title: "Como rastrear retiradas?", content: "Cada retirada é registrada com data, quantidade, liderança responsável e observações. O sistema mantém histórico completo e permite filtrar por material, liderança ou período." },
    ],
  },
  {
    icon: Eye,
    title: "Opinião Pública",
    description: "Monitore o que falam sobre você na web e redes sociais.",
    articles: [
      { title: "O que o módulo de Opinião Pública monitora?", content: "O módulo varre portais de notícias, redes sociais (Instagram, Facebook, X, TikTok), blogs e comunidades online para identificar menções sobre você, sua gestão e temas relevantes na sua região." },
      { title: "Como funciona a análise de sentimento?", content: "A IA classifica cada menção como positiva, negativa ou neutra, gerando um índice de sentimento geral. Você pode acompanhar a evolução do sentimento ao longo do tempo e identificar crises rapidamente." },
    ],
  },
  {
    icon: ClipboardList,
    title: "Pesquisas e Enquetes",
    description: "Crie pesquisas de opinião e colete dados da sua base.",
    articles: [
      { title: "Como criar uma pesquisa?", content: "No módulo 'Pesquisas', crie formulários com perguntas de múltipla escolha, texto livre, escala e sim/não. Cada pesquisa gera uma URL pública para compartilhamento e os resultados são consolidados em gráficos em tempo real." },
      { title: "Como distribuir pesquisas?", content: "Compartilhe o link da pesquisa por WhatsApp, e-mail ou redes sociais. O sistema rastreia respostas por contato (se identificado) e permite filtrar resultados por região, período e segmento." },
    ],
  },
  {
    icon: Building2,
    title: "Gabinete Digital",
    description: "Gerencie atendimentos, visitas e demandas do gabinete.",
    articles: [
      { title: "Como funciona o módulo de Gabinete?", content: "O Gabinete Digital permite agendar visitas, gerenciar filas de atendimento, registrar atas de reunião e acompanhar demandas. Cada atendimento é vinculado a um contato e mantém histórico completo." },
      { title: "Como agendar uma visita?", content: "Visitantes podem agendar pelo link público ou o atendente pode criar agendamentos internamente. O sistema envia confirmações automáticas e gerencia a fila de espera no dia do atendimento." },
    ],
  },
];

const CentralAjuda = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [expandedSection, setExpandedSection] = useState<number | null>(null);
  const [expandedArticle, setExpandedArticle] = useState<string | null>(null);

  const filteredSections = search.trim()
    ? helpSections
        .map((section) => ({
          ...section,
          articles: section.articles.filter(
            (a) =>
              a.title.toLowerCase().includes(search.toLowerCase()) ||
              a.content.toLowerCase().includes(search.toLowerCase())
          ),
        }))
        .filter((s) => s.articles.length > 0)
    : helpSections;

  const totalArticles = helpSections.reduce((sum, s) => sum + s.articles.length, 0);

  return (
    <div className="min-h-screen bg-[hsl(225,25%,6%)] text-gray-50 dark">
      {/* Header */}
      <header className="border-b border-white/10 bg-[hsl(225,25%,6%)]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate("/")} className="text-gray-300 hover:text-white hover:bg-white/10 gap-2">
            <ArrowLeft className="h-4 w-4" />
            Voltar ao início
          </Button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#F0E500]/30 bg-[#F0E500]/[0.06] text-[#F0E500] text-sm font-medium mb-5">
            <HelpCircle className="h-4 w-4" />
            Central de Ajuda
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-[#F0E500] via-[#f5ed4e] to-[#d4c900] bg-clip-text text-transparent mb-4">
            Como podemos ajudar?
          </h1>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-8">
            Encontre respostas sobre todos os módulos da plataforma Eleitor360.ai. São {totalArticles} artigos cobrindo cada funcionalidade.
          </p>

          {/* Search */}
          <div className="relative max-w-xl mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
            <Input
              placeholder="Buscar artigos, módulos ou funcionalidades..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-12 h-14 text-base bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus-visible:ring-[#F0E500] rounded-xl"
            />
          </div>
        </motion.div>

        {/* Sections */}
        <motion.div initial="hidden" animate="visible" variants={stagger} className="space-y-4">
          {filteredSections.map((section, sIdx) => {
            const isExpanded = expandedSection === sIdx;
            const Icon = section.icon;

            return (
              <motion.div key={section.title} variants={fadeUp} custom={sIdx} className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
                <button
                  onClick={() => setExpandedSection(isExpanded ? null : sIdx)}
                  className="w-full flex items-center gap-4 p-6 text-left hover:bg-white/[0.02] transition-colors"
                >
                  <div className="p-3 rounded-xl bg-[#F0E500]/10 shrink-0">
                    <Icon className="h-6 w-6 text-[#F0E500]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-white font-semibold text-lg">{section.title}</h2>
                    <p className="text-gray-500 text-sm mt-0.5">{section.description} · {section.articles.length} artigos</p>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="h-5 w-5 text-gray-500 shrink-0" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-gray-500 shrink-0" />
                  )}
                </button>

                {isExpanded && (
                  <div className="border-t border-white/5 px-6 pb-4">
                    {section.articles.map((article) => {
                      const articleKey = `${sIdx}-${article.title}`;
                      const isArticleOpen = expandedArticle === articleKey;

                      return (
                        <div key={article.title} className="border-b border-white/5 last:border-b-0">
                          <button
                            onClick={() => setExpandedArticle(isArticleOpen ? null : articleKey)}
                            className="w-full flex items-center justify-between py-4 text-left hover:text-[#F0E500] transition-colors group"
                          >
                            <span className="text-sm text-gray-300 group-hover:text-[#F0E500] font-medium pr-4">{article.title}</span>
                            {isArticleOpen ? (
                              <ChevronUp className="h-4 w-4 text-gray-500 shrink-0" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-gray-500 shrink-0" />
                            )}
                          </button>
                          {isArticleOpen && (
                            <p className="text-sm text-gray-400 leading-relaxed pb-4 pl-0">{article.content}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            );
          })}
        </motion.div>

        {filteredSections.length === 0 && (
          <div className="text-center py-16">
            <Search className="h-12 w-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">Nenhum artigo encontrado para "{search}"</p>
            <p className="text-gray-500 text-sm mt-2">Tente termos diferentes ou entre em contato conosco.</p>
          </div>
        )}

        {/* CTA */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }} className="mt-16 text-center p-8 rounded-2xl border border-white/10 bg-white/[0.03]">
          <h3 className="text-xl font-bold text-white mb-2">Não encontrou o que procura?</h3>
          <p className="text-gray-400 mb-6">Entre em contato com nossa equipe e responderemos o mais rápido possível.</p>
          <Button onClick={() => navigate("/contato")} className="bg-[#F0E500] hover:bg-[#d4c900] text-gray-900 font-semibold px-8">
            Fale Conosco
          </Button>
        </motion.div>
      </div>
    </div>
  );
};

export default CentralAjuda;
