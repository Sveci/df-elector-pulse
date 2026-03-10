import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

const TermosDeUso = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-8">
          <ArrowLeft className="w-4 h-4" />
          Voltar ao início
        </Link>

        <h1 className="text-3xl font-bold mb-2">Termos de Uso</h1>
        <p className="text-sm text-muted-foreground mb-10">Última atualização: 10 de março de 2026</p>

        <div className="prose prose-invert max-w-none space-y-8 text-muted-foreground">
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">1. Aceitação dos Termos</h2>
            <p>Ao acessar e utilizar a plataforma Eleitor 360.ai ("Plataforma"), operada pela MEGA GLOBAL DIGITAL ("Empresa"), você concorda integralmente com estes Termos de Uso. Caso não concorde com qualquer disposição, recomendamos que não utilize a Plataforma.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">2. Descrição do Serviço</h2>
            <p>A Plataforma oferece soluções tecnológicas para gestão de gabinetes políticos, incluindo, mas não se limitando a: gerenciamento de contatos, lideranças, eventos, comunicação integrada via WhatsApp, SMS e e-mail, inteligência artificial, funis de captação e monitoramento de opinião pública.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">3. Cadastro e Conta</h2>
            <p>Para utilizar a Plataforma, é necessário realizar cadastro fornecendo informações verdadeiras e completas. Você é responsável por manter a confidencialidade de suas credenciais de acesso e por todas as atividades realizadas em sua conta.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">4. Uso Adequado</h2>
            <p>O usuário compromete-se a utilizar a Plataforma de forma ética e legal, sendo vedado:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>Utilizar a Plataforma para fins ilícitos ou que violem a legislação vigente;</li>
              <li>Compartilhar dados de terceiros sem o devido consentimento;</li>
              <li>Tentar acessar dados de outros tenants ou usuários;</li>
              <li>Realizar engenharia reversa ou tentar comprometer a segurança da Plataforma;</li>
              <li>Enviar comunicações não solicitadas (spam) através dos canais integrados.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">5. Propriedade Intelectual</h2>
            <p>Todo o conteúdo, design, código-fonte, funcionalidades e marca da Plataforma são de propriedade exclusiva da MEGA GLOBAL DIGITAL, protegidos pela legislação brasileira de propriedade intelectual. Os dados inseridos pelo usuário permanecem de sua propriedade.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">6. Planos e Pagamentos</h2>
            <p>A Plataforma oferece diferentes planos de assinatura. O valor, periodicidade e funcionalidades de cada plano estão descritos na página de preços. O não pagamento poderá resultar na suspensão ou cancelamento do acesso.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">7. Limitação de Responsabilidade</h2>
            <p>A Empresa não se responsabiliza por danos indiretos, incidentais ou consequenciais decorrentes do uso da Plataforma. A Empresa envidará esforços para manter a disponibilidade do serviço, mas não garante operação ininterrupta.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">8. Modificações</h2>
            <p>A Empresa reserva-se o direito de modificar estes Termos a qualquer momento, notificando os usuários através da Plataforma. O uso continuado após as alterações constitui aceitação dos novos termos.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">9. Foro</h2>
            <p>Fica eleito o foro da comarca de Brasília/DF para dirimir quaisquer controvérsias decorrentes destes Termos de Uso, com renúncia a qualquer outro, por mais privilegiado que seja.</p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default TermosDeUso;
