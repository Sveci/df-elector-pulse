/**
 * Retorna a URL base da aplicação de forma dinâmica.
 * No navegador: usa window.location.origin (funciona automaticamente com qualquer domínio).
 * Em edge functions: usa a variável de ambiente APP_BASE_URL.
 * Fallback: domínio publicado do Lovable.
 */
function getAppBaseUrl(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  // Fallback para SSR ou testes
  return "https://df-elector-pulse.lovable.app";
}

/**
 * Retorna a URL base da aplicação.
 * Usa o domínio atual do navegador — funciona automaticamente com domínio customizado.
 */
export function getBaseUrl(): string {
  return getAppBaseUrl();
}

/**
 * Retorna a URL de produção para comunicações externas (SMS, Email, WhatsApp).
 * No frontend, usa o domínio atual.
 * Em edge functions, deve-se usar Deno.env.get("APP_BASE_URL").
 */
export function getProductionUrl(): string {
  return getAppBaseUrl();
}

/**
 * Valida e corrige URLs antes de enviar externamente.
 * Se detectar URL de preview ou localhost, corrige automaticamente.
 */
export function validateExternalUrl(url: string): string {
  if (url.includes('lovableproject.com') || url.includes('localhost')) {
    console.warn('[URL PROTECTION] Tentativa de usar URL de preview em comunicação externa! Corrigindo...');
    return url.replace(/https?:\/\/[^/]+/, getAppBaseUrl());
  }
  return url;
}

// =====================================================
// GERADORES DE LINKS — todos usam getAppBaseUrl()
// =====================================================

/** Link do formulário de visita */
export function generateVisitFormUrl(visitId: string): string {
  return `${getAppBaseUrl()}/visita-gabinete/${visitId}`;
}

/** Link de check-in da visita */
export function generateVisitCheckinUrl(qrCode: string): string {
  return `${getAppBaseUrl()}/office/checkin/${qrCode}`;
}

/** Link de campanha UTM */
export function generateCampaignUrl(utmSource: string, utmMedium: string, utmCampaign: string): string {
  const params = new URLSearchParams({ utm_source: utmSource, utm_medium: utmMedium, utm_campaign: utmCampaign });
  return `${getAppBaseUrl()}/lider/cadastro?${params.toString()}`;
}

/** Link de evento com UTMs de campanha */
export function generateEventCampaignUrl(eventSlug: string, utmSource: string, utmMedium: string, utmCampaign: string): string {
  const params = new URLSearchParams({ utm_source: utmSource, utm_medium: utmMedium, utm_campaign: utmCampaign });
  return `${getAppBaseUrl()}/eventos/${eventSlug}?${params.toString()}`;
}

/** Link de indicação de líder */
export function generateLeaderReferralUrl(affiliateToken: string): string {
  return `${getAppBaseUrl()}/cadastro/${affiliateToken}`;
}

/** Link de afiliado */
export function generateAffiliateUrl(affiliateToken: string): string {
  return `${getAppBaseUrl()}/affiliate/${affiliateToken}`;
}

/** Link de verificação de líder */
export function generateLeaderVerificationUrl(verificationCode: string): string {
  return `${getAppBaseUrl()}/verificar-lider/${verificationCode}`;
}

/** Link de cadastro para evento com tracking */
export function generateEventRegistrationUrl(eventSlug: string, eventId: string, trackingCode: string): string {
  const params = new URLSearchParams({
    utm_source: 'qr', utm_medium: 'offline',
    utm_campaign: `evento_${eventId.substring(0, 8)}`, utm_content: trackingCode
  });
  return `${getAppBaseUrl()}/eventos/${eventSlug}?${params.toString()}`;
}

/** Link de afiliado para evento */
export function generateEventAffiliateUrl(eventSlug: string, affiliateToken: string): string {
  return `${getAppBaseUrl()}/eventos/${eventSlug}?ref=${affiliateToken}`;
}

/** Link do formulário público de cadastro de líderes */
export function generateLeaderRegistrationUrl(): string {
  return `${getAppBaseUrl()}/lider/cadastro`;
}

/** Link de funil de captação com UTMs */
export function generateFunnelCampaignUrl(funnelSlug: string, utmSource: string, utmMedium: string, utmCampaign: string): string {
  const params = new URLSearchParams({ utm_source: utmSource, utm_medium: utmMedium, utm_campaign: utmCampaign });
  return `${getAppBaseUrl()}/captacao/${funnelSlug}?${params.toString()}`;
}

/** Link de descadastro */
export function generateUnsubscribeUrl(token: string): string {
  return `${getAppBaseUrl()}/descadastro?token=${token}`;
}

/** Link de pesquisa com afiliado */
export function generateSurveyAffiliateUrl(surveySlug: string, affiliateToken: string): string {
  return `${getAppBaseUrl()}/pesquisa/${surveySlug}?ref=${affiliateToken}`;
}

/** Link curto de verificação de contato */
export function generateVerificationUrl(verificationCode: string): string {
  return `${getAppBaseUrl()}/v/${verificationCode}`;
}
