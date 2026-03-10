import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

const PoliticaPrivacidade = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-8">
          <ArrowLeft className="w-4 h-4" />
          Voltar ao início
        </Link>

        <h1 className="text-3xl font-bold mb-2">Política de Privacidade</h1>
        <p className="text-sm text-muted-foreground mb-10">Última atualização: 10 de março de 2026</p>

        <div className="prose prose-invert max-w-none space-y-8 text-muted-foreground">
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">1. Introdução</h2>
            <p>A MEGA GLOBAL DIGITAL, operadora da plataforma Eleitor 360.ai, compromete-se a proteger a privacidade dos dados pessoais dos seus usuários e dos dados processados através da Plataforma, em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 – LGPD).</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">2. Dados Coletados</h2>
            <p>Coletamos os seguintes tipos de dados:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li><strong className="text-foreground">Dados de cadastro:</strong> nome, e-mail, telefone, cargo e organização;</li>
              <li><strong className="text-foreground">Dados de uso:</strong> logs de acesso, páginas visitadas, ações realizadas na Plataforma;</li>
              <li><strong className="text-foreground">Dados de contatos gerenciados:</strong> informações inseridas pelo usuário sobre seus contatos, lideranças e cidadãos;</li>
              <li><strong className="text-foreground">Dados de comunicação:</strong> registros de mensagens enviadas via WhatsApp, SMS e e-mail;</li>
              <li><strong className="text-foreground">Dados técnicos:</strong> endereço IP, tipo de navegador, dispositivo e sistema operacional.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">3. Finalidade do Tratamento</h2>
            <p>Os dados são tratados para:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>Fornecimento e melhoria dos serviços da Plataforma;</li>
              <li>Comunicação com os usuários sobre atualizações e suporte;</li>
              <li>Análise estatística e geração de insights (anonimizados quando possível);</li>
              <li>Cumprimento de obrigações legais e regulatórias;</li>
              <li>Segurança e prevenção de fraudes.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">4. Compartilhamento de Dados</h2>
            <p>Não comercializamos dados pessoais. O compartilhamento ocorre apenas com:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>Provedores de infraestrutura tecnológica (hospedagem, banco de dados);</li>
              <li>Provedores de serviços de comunicação (WhatsApp Business API, SMS, e-mail);</li>
              <li>Autoridades competentes, quando exigido por lei.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">5. Segurança dos Dados</h2>
            <p>Empregamos medidas técnicas e organizacionais robustas, incluindo criptografia em trânsito e em repouso, controle de acesso por funções (RLS), autenticação multifator e monitoramento contínuo de segurança.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">6. Retenção de Dados</h2>
            <p>Os dados são armazenados pelo tempo necessário para cumprir as finalidades descritas ou conforme exigido por lei. Após o término da relação contratual, os dados poderão ser mantidos por até 5 anos para fins legais.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">7. Direitos do Titular</h2>
            <p>Conforme a LGPD, você tem direito a:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>Confirmar a existência de tratamento de seus dados;</li>
              <li>Acessar, corrigir ou atualizar seus dados;</li>
              <li>Solicitar a anonimização, bloqueio ou eliminação de dados desnecessários;</li>
              <li>Revogar o consentimento a qualquer momento;</li>
              <li>Solicitar a portabilidade dos dados.</li>
            </ul>
            <p className="mt-3">Para exercer seus direitos, entre em contato pelo e-mail: <span className="text-primary">privacidade@eleitor360.ai</span></p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">8. Contato do Encarregado (DPO)</h2>
            <p>O Encarregado de Proteção de Dados pode ser contatado através do e-mail: <span className="text-primary">dpo@eleitor360.ai</span></p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PoliticaPrivacidade;
