import { getBaseUrl } from "./urlHelper";

/**
 * Gera a URL pública de cadastro do evento
 * Usa a URL base dinâmica do sistema
 */
export function generateEventUrl(slug: string): string {
  return `${getBaseUrl()}/eventos/${slug}`;
}

/**
 * Gera a URL de cadastro do evento com parâmetros UTM
 */
export function generateEventUrlWithTracking(
  slug: string,
  trackingCode: string
): string {
  const params = new URLSearchParams({
    utm_source: 'qr',
    utm_medium: 'offline',
    utm_campaign: `evento_${slug}`,
    utm_content: trackingCode
  });
  return `${generateEventUrl(slug)}?${params.toString()}`;
}
