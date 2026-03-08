import { getTenantBaseUrl } from "./urlHelper";

/**
 * Gera a URL pública de cadastro do evento
 * Usa o domínio customizado do tenant quando disponível
 */
export function generateEventUrl(slug: string, customDomain?: string | null): string {
  return `${getTenantBaseUrl(customDomain)}/eventos/${slug}`;
}

/**
 * Gera a URL de cadastro do evento com parâmetros UTM
 */
export function generateEventUrlWithTracking(
  slug: string,
  trackingCode: string,
  customDomain?: string | null
): string {
  const params = new URLSearchParams({
    utm_source: 'qr',
    utm_medium: 'offline',
    utm_campaign: `evento_${slug}`,
    utm_content: trackingCode
  });
  return `${generateEventUrl(slug, customDomain)}?${params.toString()}`;
}
