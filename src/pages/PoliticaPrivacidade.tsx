import { ArrowLeft, Shield, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";

const PoliticaPrivacidade = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-8">
          <ArrowLeft className="w-4 h-4" />
          Voltar ao início
        </Link>

        <div className="flex items-center gap-3 mb-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Política de Privacidade</h1>
            <p className="text-sm text-muted-foreground">Última atualização: 20 de março de 2026</p>
          </div>
        </div>

        <div className="prose prose-invert max-w-none space-y-8 text-muted-foreground mt-10">

          {/* 1. Introdução */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">1. Introdução</h2>
            <p>
              A <strong className="text-foreground">MEGA GLOBAL DIGITAL LTDA</strong>, operadora da
              plataforma <strong className="text-foreground">Eleitor 360.ai</strong> (CNPJ:
              XX.XXX.XXX/0001-XX), compromete-se a proteger a privacidade dos dados pessoais dos seus
              usuários e dos dados processados através da Plataforma, em conformidade com a{" "}
              <strong className="text-foreground">Lei Geral de Proteção de Dados (Lei nº 13.709/2018 – LGPD)</strong>.
            </p>
            <p className="mt-2">
              Esta política descreve quais dados coletamos, por que coletamos, com quem
              compartilhamos, por quanto tempo retemos e quais são os seus direitos como titular.
            </p>
          </section>

          {/* 2. Dados Coletados */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">2. Dados Coletados</h2>
            <p>Coletamos os seguintes tipos de dados:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li><strong className="text-foreground">Dados de cadastro:</strong> nome, e-mail, telefone, cargo, organização e estado;</li>
              <li><strong className="text-foreground">Dados de uso:</strong> logs de acesso, páginas visitadas, ações realizadas na Plataforma;</li>
              <li><strong className="text-foreground">Dados de contatos gerenciados:</strong> informações inseridas pelo usuário sobre seus contatos, lideranças e cidadãos (nome, telefone, e-mail, endereço, bairro);</li>
              <li><strong className="text-foreground">Dados de comunicação:</strong> registros de mensagens enviadas via WhatsApp, SMS e e-mail;</li>
              <li><strong className="text-foreground">Dados de consentimento:</strong> data, hora, IP anonimizado e tipo de consentimento dado pelo titular (LGPD Art. 8 §5);</li>
              <li><strong className="text-foreground">Dados técnicos:</strong> endereço IP (anonimizado), tipo de navegador, dispositivo e sistema operacional.</li>
            </ul>
          </section>

          {/* 3. Finalidade e Base Legal */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">3. Finalidade e Base Legal do Tratamento</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-foreground font-semibold py-2 pr-4">Finalidade</th>
                    <th className="text-left text-foreground font-semibold py-2 pr-4">Base Legal (LGPD Art. 7)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {[
                    ["Prestação dos serviços da Plataforma", "Execução de contrato (V)"],
                    ["Comunicação com usuários sobre atualizações e suporte", "Execução de contrato (V) / Interesse legítimo (IX)"],
                    ["Análise estatística e geração de relatórios (anonimizados)", "Interesse legítimo (IX)"],
                    ["Cookies analíticos e marketing (GTM, Facebook Pixel)", "Consentimento (I)"],
                    ["Cumprimento de obrigações legais e fiscais", "Obrigação legal (II)"],
                    ["Segurança, prevenção de fraudes e integridade da plataforma", "Interesse legítimo (IX)"],
                    ["Exercício regular de direitos em processo judicial ou administrativo", "Exercício regular de direitos (VI)"],
                  ].map(([fin, base]) => (
                    <tr key={fin}>
                      <td className="py-2 pr-4">{fin}</td>
                      <td className="py-2 text-foreground/80">{base}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* 4. Compartilhamento – Sub-processadores */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">4. Compartilhamento de Dados e Sub-processadores</h2>
            <p>
              Não comercializamos dados pessoais. O compartilhamento ocorre apenas com os
              sub-processadores abaixo, todos sujeitos a acordos de tratamento de dados compatíveis
              com a LGPD:
            </p>
            <div className="overflow-x-auto mt-3">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-foreground font-semibold py-2 pr-4">Fornecedor</th>
                    <th className="text-left text-foreground font-semibold py-2 pr-4">Finalidade</th>
                    <th className="text-left text-foreground font-semibold py-2 pr-4">País / Base</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {[
                    ["Supabase, Inc.", "Banco de dados, autenticação e storage", "EUA (cláusulas-padrão ANPD)"],
                    ["Amazon Web Services (AWS)", "Infraestrutura de hospedagem", "Brasil / EUA"],
                    ["Meta Platforms (WhatsApp Business API)", "Envio de mensagens WhatsApp", "EUA (cláusulas-padrão)"],
                    ["Z-API / SMSDev / EvolutionAPI", "Gateway de WhatsApp e SMS", "Brasil"],
                    ["Google LLC (GTM, Analytics)", "Analytics e tag management", "EUA (cláusulas-padrão)"],
                    ["PassKit, Inc.", "Passes digitais (carteirinha)", "EUA (cláusulas-padrão)"],
                    ["OpenAI, Groq, Google AI", "Funcionalidades de IA e insights", "EUA (cláusulas-padrão)"],
                    ["Autoridades competentes", "Quando exigido por lei ou ordem judicial", "Brasil"],
                  ].map(([fornecedor, fin, pais]) => (
                    <tr key={fornecedor}>
                      <td className="py-2 pr-4 font-medium text-foreground/90">{fornecedor}</td>
                      <td className="py-2 pr-4">{fin}</td>
                      <td className="py-2 text-foreground/70">{pais}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* 5. Retenção por Categoria */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">5. Retenção de Dados</h2>
            <p>Retemos os dados pelo período mínimo necessário para cumprir cada finalidade:</p>
            <div className="overflow-x-auto mt-3">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-foreground font-semibold py-2 pr-4">Categoria de Dado</th>
                    <th className="text-left text-foreground font-semibold py-2 pr-4">Período de Retenção</th>
                    <th className="text-left text-foreground font-semibold py-2 pr-4">Critério</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {[
                    ["Dados de conta (e-mail, nome)", "Enquanto a conta estiver ativa + 90 dias após encerramento", "Execução do contrato"],
                    ["Logs de acesso e segurança", "6 meses", "Obrigação legal / segurança (Marco Civil Art. 15)"],
                    ["Registros de consentimento LGPD", "5 anos após a revogação do consentimento", "Ônus da prova (LGPD Art. 8 §5)"],
                    ["Dados de contatos gerenciados", "Enquanto o tenant estiver ativo + 30 dias", "Execução do contrato"],
                    ["Registros de mensagens (WhatsApp/SMS)", "12 meses", "Suporte e auditoria"],
                    ["Dados fiscais e financeiros", "5 anos", "Obrigação legal (Código Tributário)"],
                    ["Solicitações de direitos LGPD", "5 anos após a resolução", "Obrigação legal / defesa em processo"],
                  ].map(([cat, periodo, criterio]) => (
                    <tr key={cat}>
                      <td className="py-2 pr-4 font-medium text-foreground/90">{cat}</td>
                      <td className="py-2 pr-4">{periodo}</td>
                      <td className="py-2 text-foreground/70">{criterio}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* 6. Segurança */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">6. Segurança dos Dados</h2>
            <p>Empregamos medidas técnicas e organizacionais robustas, incluindo:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Criptografia em trânsito (TLS 1.2+) e em repouso (AES-256);</li>
              <li>Controle de acesso granular por funções e Row-Level Security (RLS);</li>
              <li>Autenticação com JWT e opção de 2FA;</li>
              <li>Registro de auditoria para ações sensíveis;</li>
              <li>Monitoramento contínuo de segurança;</li>
              <li>Políticas de Content Security Policy (CSP) e HTTP Security Headers;</li>
              <li>Validação de secrets em webhooks (HMAC-SHA256).</li>
            </ul>
            <p className="mt-2">
              Em caso de incidente de segurança com dados pessoais, notificaremos os titulares
              afetados e a ANPD conforme os prazos previstos na LGPD (Art. 48).
            </p>
          </section>

          {/* 7. Transferência Internacional */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">7. Transferência Internacional de Dados</h2>
            <p>
              Alguns sub-processadores listados na Seção 4 estão localizados fora do Brasil. Nestes
              casos, asseguramos que a transferência se baseia em mecanismos adequados previstos na
              LGPD (Art. 33), como cláusulas-padrão contratuais aprovadas pela ANPD ou adesão a
              programas de conformidade reconhecidos.
            </p>
          </section>

          {/* 8. Direitos do Titular */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">8. Direitos do Titular (LGPD Art. 18)</h2>
            <p>Você tem direito a:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>Confirmar a existência de tratamento de seus dados <span className="text-sm">(I)</span>;</li>
              <li>Acessar seus dados <span className="text-sm">(II)</span>;</li>
              <li>Corrigir dados incompletos, inexatos ou desatualizados <span className="text-sm">(III)</span>;</li>
              <li>Solicitar anonimização, bloqueio ou eliminação de dados desnecessários ou excessivos <span className="text-sm">(IV)</span>;</li>
              <li>Portabilidade dos dados para outro fornecedor de serviço <span className="text-sm">(V)</span>;</li>
              <li>Eliminação dos dados tratados com base no consentimento <span className="text-sm">(VI)</span>;</li>
              <li>Informações sobre o compartilhamento com entidades públicas e privadas <span className="text-sm">(VII)</span>;</li>
              <li>Informação sobre a possibilidade de não fornecer consentimento e suas consequências <span className="text-sm">(VIII)</span>;</li>
              <li>Revogar o consentimento a qualquer momento <span className="text-sm">(IX)</span>.</li>
            </ul>
            <p className="mt-3">
              Para exercer seus direitos, utilize nosso{" "}
              <Link to="/lgpd-direitos" className="text-primary underline hover:text-primary/80">
                formulário de solicitação LGPD
              </Link>{" "}
              ou entre em contato por e-mail:{" "}
              <a href="mailto:privacidade@eleitor360.ai" className="text-primary underline">
                privacidade@eleitor360.ai
              </a>
            </p>
            <p className="mt-2 text-sm">
              Prazo de resposta: até <strong className="text-foreground">15 dias úteis</strong> conforme
              o Art. 18 §4 da LGPD.
            </p>
          </section>

          {/* 9. Cookies */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">9. Cookies e Tecnologias de Rastreamento</h2>
            <p>
              Utilizamos cookies essenciais (necessários para o funcionamento da plataforma) e, com
              seu consentimento, cookies analíticos e de marketing. Você pode gerenciar suas
              preferências a qualquer momento através da nossa{" "}
              <Link to="/lgpd-cookies" className="text-primary underline hover:text-primary/80">
                Política de Cookies
              </Link>.
            </p>
          </section>

          {/* 10. Contato do DPO */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">10. Encarregado de Proteção de Dados (DPO)</h2>
            <div className="rounded-lg border border-border/50 p-4 bg-muted/20 space-y-2">
              <p className="font-medium text-foreground">Encarregado (DPO) – MEGA GLOBAL DIGITAL LTDA</p>
              <p>
                <strong className="text-foreground">E-mail:</strong>{" "}
                <a href="mailto:dpo@eleitor360.ai" className="text-primary underline">
                  dpo@eleitor360.ai
                </a>
              </p>
              <p>
                <strong className="text-foreground">Privacidade geral:</strong>{" "}
                <a href="mailto:privacidade@eleitor360.ai" className="text-primary underline">
                  privacidade@eleitor360.ai
                </a>
              </p>
              <p>
                <strong className="text-foreground">Formulário online:</strong>{" "}
                <Link to="/lgpd-direitos" className="text-primary underline inline-flex items-center gap-1">
                  Solicitar exercício de direitos
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </p>
              <p className="text-sm">
                O DPO é responsável por garantir a conformidade com a LGPD, responder às solicitações
                dos titulares e manter contato com a ANPD (Autoridade Nacional de Proteção de Dados).
              </p>
            </div>
          </section>

          {/* 11. Alterações */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">11. Alterações nesta Política</h2>
            <p>
              Podemos atualizar esta política periodicamente. Alterações significativas serão
              notificadas por e-mail e/ou por aviso destacado na plataforma com antecedência mínima
              de 15 dias, salvo quando exigido de forma diversa por lei.
            </p>
          </section>

        </div>
      </div>
    </div>
  );
};

export default PoliticaPrivacidade;
