/**
 * ============================================================
 * CLOUDFLARE WORKER — Proxy Reverso para Domínios de Tenants
 * ============================================================
 * 
 * Este Worker deve ser deployado no Cloudflare Workers e configurado
 * como rota customizada para os domínios dos tenants.
 * 
 * COMO FUNCIONA:
 * 1. Tenant configura CNAME do domínio dele → {worker-subdomain}.workers.dev
 *    OU usa Cloudflare for SaaS (recomendado para produção)
 * 2. Worker recebe request no domínio do tenant
 * 3. Faz proxy para o app Lovable (app.eleitor360.ai)
 * 4. O app detecta o hostname e resolve o tenant via get_tenant_by_domain
 * 
 * CONFIGURAÇÃO NO CLOUDFLARE:
 * 
 * Opção A - Routes (simples):
 * 1. Deploy este Worker
 * 2. Para cada tenant, adicione uma Custom Domain no Worker:
 *    Workers & Pages → seu worker → Settings → Domains & Routes → Add Custom Domain
 *    Ex: app.acaciofavacho.com.br
 * 3. O tenant aponta CNAME para o domínio configurado
 * 
 * Opção B - Cloudflare for SaaS (escalável):
 * 1. Configure o fallback origin como app.eleitor360.ai
 * 2. Cada domínio de tenant é adicionado como Custom Hostname
 * 3. SSL é provisionado automaticamente
 * 
 * VARIÁVEIS DE AMBIENTE (wrangler.toml):
 * - ORIGIN_HOST: domínio do app Lovable (ex: app.eleitor360.ai)
 * 
 * ============================================================
 */

// wrangler.toml example:
// name = "eleitor360-tenant-proxy"
// main = "src/index.ts"
// compatibility_date = "2024-01-01"
// 
// [vars]
// ORIGIN_HOST = "app.eleitor360.ai"

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const incomingHostname = url.hostname;

    // Domínio de origem do app Lovable
    const originHost = env.ORIGIN_HOST || "app.eleitor360.ai";

    // Se for o domínio principal, não faz proxy
    if (incomingHostname === originHost) {
      return fetch(request);
    }

    // Reescreve a URL para apontar ao app Lovable
    const originUrl = new URL(request.url);
    originUrl.hostname = originHost;

    // Cria novo request preservando método, body e headers
    const newRequest = new Request(originUrl.toString(), {
      method: request.method,
      headers: new Headers(request.headers),
      body: request.body,
      redirect: "follow",
    });

    // Passa o hostname original para o app poder resolver o tenant
    newRequest.headers.set("X-Forwarded-Host", incomingHostname);
    newRequest.headers.set("X-Custom-Domain", incomingHostname);
    // Host header deve ser do origin para SSL funcionar
    newRequest.headers.set("Host", originHost);

    try {
      const response = await fetch(newRequest);

      // Clona response para poder modificar headers
      const modifiedResponse = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: new Headers(response.headers),
      });

      // Remove headers que podem causar problemas
      modifiedResponse.headers.delete("x-frame-options");
      
      // Adiciona CORS permissivo
      modifiedResponse.headers.set("Access-Control-Allow-Origin", "*");

      return modifiedResponse;
    } catch (err) {
      return new Response(`Proxy Error: ${err.message}`, { status: 502 });
    }
  },
};
