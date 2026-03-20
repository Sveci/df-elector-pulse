/**
 * Retorna a URL base da aplicação de forma dinâmica.
 * No navegador: usa window.location.origin (funciona automaticamente com qualquer domínio).
 * Em edge functions: usa a variável de ambiente APP_BASE_URL.
 * Fallback: domínio publicado da aplicação.
 */
function getAppBaseUrl(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    const origin = window.location.origin;
    // Proteger contra URLs de preview em comunicações externas
    if (origin.includes('lovableproject.com') || origin.includes('lovable.app') || origin.includes('localhost')) {
      return "https://app.eleitor360.ai";
    }
    return origin;
  }
  // Fallback para SSR ou testes
  return "https://app.eleitor360.ai";
}

/**
 * Retorna a URL base da aplicação.
 * Usa o domínio atual do navegador — funciona automaticamente com domínio customizado.
 */
export function getBaseUrl(): string {
  return getAppBaseUrl();
}

/**
 * Retorna a URL base para o tenant, usando custom_domain se disponível.
 * Se o tenant tiver domínio customizado, usa esse. Senão, fallback para URL dinâmica.
 */
export function getTenantBaseUrl(customDomain?: string | null): string {
  if (customDomain) {
    // Garantir que não tenha barra no final
    return customDomain.replace(/\/+$/, "");
  }
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
// GERADORES DE LINKS — todos aceitam customDomain opcional
// =====================================================

/** Link do formulário de visita */
export function generateVisitFormUrl(visitId: string, customDomain?: string | null): string {
  return `${getTenantBaseUrl(customDomain)}/visita-gabinete/${visitId}`;
}

/** Link de check-in da visita */
export function generateVisitCheckinUrl(qrCode: string, customDomain?: string | null): string {
  return `${getTenantBaseUrl(customDomain)}/office/checkin/${qrCode}`;
}

/** Link de campanha UTM */
export function generateCampaignUrl(utmSource: string, utmMedium: string, utmCampaign: string, customDomain?: string | null): string {
  const params = new URLSearchParams({ utm_source: utmSource, utm_medium: utmMedium, utm_campaign: utmCampaign });
  return `${getTenantBaseUrl(customDomain)}/lider/cadastro?${params.toString()}`;
}

/** Link de evento com UTMs de campanha */
export function generateEventCampaignUrl(eventSlug: string, utmSource: string, utmMedium: string, utmCampaign: string, customDomain?: string | null): string {
  const params = new URLSearchParams({ utm_source: utmSource, utm_medium: utmMedium, utm_campaign: utmCampaign });
  return `${getTenantBaseUrl(customDomain)}/eventos/${eventSlug}?${params.toString()}`;
}

/** Link de indicação de líder (com nome e cargo opcionais para identificação) */
export function generateLeaderReferralUrl(
  affiliateToken: string,
  customDomain?: string | null,
  options?: { politico?: string; cargo?: string }
): string {
  const base = `${getTenantBaseUrl(customDomain)}/cadastro/${affiliateToken}`;
  const params = new URLSearchParams();
  if (options?.politico) params.set("ref_nome", options.politico);
  if (options?.cargo) params.set("ref_cargo", options.cargo);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

/** Link de afiliado */
export function generateAffiliateUrl(affiliateToken: string, customDomain?: string | null): string {
  return `${getTenantBaseUrl(customDomain)}/affiliate/${affiliateToken}`;
}

/** Link de verificação de líder */
export function generateLeaderVerificationUrl(verificationCode: string, customDomain?: string | null): string {
  return `${getTenantBaseUrl(customDomain)}/verificar-lider/${verificationCode}`;
}

/** Link de cadastro para evento com tracking */
export function generateEventRegistrationUrl(eventSlug: string, eventId: string, trackingCode: string, customDomain?: string | null): string {
  const params = new URLSearchParams({
    utm_source: 'qr', utm_medium: 'offline',
    utm_campaign: `evento_${eventId.substring(0, 8)}`, utm_content: trackingCode
  });
  return `${getTenantBaseUrl(customDomain)}/eventos/${eventSlug}?${params.toString()}`;
}

/** Link de afiliado para evento */
export function generateEventAffiliateUrl(eventSlug: string, affiliateToken: string, customDomain?: string | null): string {
  return `${getTenantBaseUrl(customDomain)}/eventos/${eventSlug}?ref=${affiliateToken}`;
}

/** Link do formulário público de cadastro de líderes */
export function generateLeaderRegistrationUrl(customDomain?: string | null): string {
  return `${getTenantBaseUrl(customDomain)}/lider/cadastro`;
}

/** Link de funil de captação com UTMs */
export function generateFunnelCampaignUrl(funnelSlug: string, utmSource: string, utmMedium: string, utmCampaign: string, customDomain?: string | null): string {
  const params = new URLSearchParams({ utm_source: utmSource, utm_medium: utmMedium, utm_campaign: utmCampaign });
  return `${getTenantBaseUrl(customDomain)}/captacao/${funnelSlug}?${params.toString()}`;
}

/** Link de descadastro */
export function generateUnsubscribeUrl(token: string, customDomain?: string | null): string {
  return `${getTenantBaseUrl(customDomain)}/descadastro?token=${token}`;
}

/** Link de pesquisa com afiliado */
export function generateSurveyAffiliateUrl(surveySlug: string, affiliateToken: string, customDomain?: string | null): string {
  return `${getTenantBaseUrl(customDomain)}/pesquisa/${surveySlug}?ref=${affiliateToken}`;
}

/** Link curto de verificação de contato */
export function generateVerificationUrl(verificationCode: string, customDomain?: string | null): string {
  return `${getTenantBaseUrl(customDomain)}/v/${verificationCode}`;
}
