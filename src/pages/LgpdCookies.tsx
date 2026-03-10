import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

const LgpdCookies = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-8">
          <ArrowLeft className="w-4 h-4" />
          Voltar ao início
        </Link>

        <h1 className="text-3xl font-bold mb-2">LGPD e Cookies</h1>
        <p className="text-sm text-muted-foreground mb-10">Última atualização: 10 de março de 2026</p>

        <div className="prose prose-invert max-w-none space-y-8 text-muted-foreground">
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">1. O que são Cookies?</h2>
            <p>Cookies são pequenos arquivos de texto armazenados no seu navegador quando você visita nosso site. Eles permitem que a Plataforma reconheça seu dispositivo e ofereça uma experiência personalizada e segura.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">2. Tipos de Cookies Utilizados</h2>
            <div className="space-y-4 mt-3">
              <div className="border border-border/30 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-foreground mb-1">Cookies Essenciais</h3>
                <p className="text-sm">Necessários para o funcionamento básico da Plataforma, como autenticação de sessão, segurança e preferências de idioma. Não podem ser desativados.</p>
              </div>
              <div className="border border-border/30 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-foreground mb-1">Cookies de Desempenho</h3>
                <p className="text-sm">Coletam informações sobre como você usa a Plataforma (páginas mais visitadas, erros encontrados) para melhorar a performance e a experiência do usuário.</p>
              </div>
              <div className="border border-border/30 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-foreground mb-1">Cookies de Funcionalidade</h3>
                <p className="text-sm">Permitem que a Plataforma lembre suas preferências (como tema escuro/claro, filtros aplicados) para oferecer uma experiência mais personalizada.</p>
              </div>
              <div className="border border-border/30 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-foreground mb-1">Cookies de Marketing/Analytics</h3>
                <p className="text-sm">Utilizados para medir a eficácia de campanhas e anúncios, através de ferramentas como Google Tag Manager e Facebook Pixel, quando configurados pelo administrador.</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">3. Base Legal (LGPD)</h2>
            <p>O tratamento de dados realizado pela Plataforma está fundamentado nas seguintes bases legais previstas na Lei nº 13.709/2018:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li><strong className="text-foreground">Consentimento (Art. 7º, I):</strong> para cookies de marketing e analytics;</li>
              <li><strong className="text-foreground">Execução de contrato (Art. 7º, V):</strong> para cookies essenciais ao funcionamento do serviço contratado;</li>
              <li><strong className="text-foreground">Legítimo interesse (Art. 7º, IX):</strong> para cookies de desempenho e melhoria do serviço;</li>
              <li><strong className="text-foreground">Cumprimento de obrigação legal (Art. 7º, II):</strong> quando necessário para atender exigências regulatórias.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">4. Gerenciamento de Cookies</h2>
            <p>Você pode gerenciar suas preferências de cookies através das configurações do seu navegador. A desativação de cookies essenciais pode comprometer o funcionamento da Plataforma.</p>
            <p className="mt-2">Principais navegadores:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>Google Chrome: Configurações → Privacidade e segurança → Cookies</li>
              <li>Mozilla Firefox: Configurações → Privacidade e Segurança</li>
              <li>Safari: Preferências → Privacidade</li>
              <li>Microsoft Edge: Configurações → Cookies e permissões de site</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">5. Seus Direitos</h2>
            <p>Como titular dos dados, você tem os seguintes direitos garantidos pela LGPD:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>Solicitar informações sobre quais dados são coletados e como são utilizados;</li>
              <li>Revogar o consentimento para cookies não essenciais a qualquer momento;</li>
              <li>Solicitar a exclusão de dados pessoais armazenados via cookies;</li>
              <li>Apresentar reclamação à Autoridade Nacional de Proteção de Dados (ANPD).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">6. Contato</h2>
            <p>Para dúvidas sobre cookies e proteção de dados, entre em contato:</p>
            <p className="mt-2">E-mail: <span className="text-primary">privacidade@eleitor360.ai</span></p>
            <p>Encarregado (DPO): <span className="text-primary">dpo@eleitor360.ai</span></p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default LgpdCookies;
