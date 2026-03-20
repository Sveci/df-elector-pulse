/**
 * useLgpdConsent
 *
 * Hook for logging LGPD consent events to the database.
 * Works for both authenticated and anonymous users (public forms).
 *
 * LGPD Art. 8 §5: the burden of proof for consent rests on the controller.
 * Every consent action must be stored with timestamp and IP.
 */

import { supabase } from "@/integrations/supabase/client";

export type ConsentType =
  | "cookie_all"
  | "cookie_essential"
  | "form_submission"
  | "leader_registration"
  | "event_registration"
  | "lead_capture"
  | "unsubscribe";

export type ConsentAction = "granted" | "revoked" | "essential_only";

export type LegalBasis =
  | "consent"        // Art. 7 I
  | "contract"       // Art. 7 V
  | "legal_obligation" // Art. 7 II
  | "legitimate_interest"; // Art. 7 IX

interface LogConsentParams {
  tenantId?: string | null;
  contactId?: string | null;
  consentType: ConsentType;
  action: ConsentAction;
  legalBasis?: LegalBasis;
  pageUrl?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Logs a LGPD consent event.
 * Fails silently — consent logging must never block the main flow.
 */
export async function logLgpdConsent(params: LogConsentParams): Promise<void> {
  try {
    const {
      tenantId,
      contactId,
      consentType,
      action,
      legalBasis = "consent",
      pageUrl = typeof window !== "undefined" ? window.location.href : "",
      metadata = {},
    } = params;

    // We use the RPC function so it works even without auth (anon key)
    const { error } = await supabase.rpc("log_lgpd_consent", {
      p_tenant_id: tenantId ?? null,
      p_contact_id: contactId ?? null,
      p_consent_type: consentType,
      p_action: action,
      p_legal_basis: legalBasis,
      // IP is resolved server-side in the DB function via request headers.
      // We pass an empty string; the edge function / RLS policy can populate it.
      p_ip_address: "",
      p_user_agent:
        typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 200) : "",
      p_page_url: pageUrl.slice(0, 500),
      p_metadata: metadata,
    });

    if (error) {
      // Non-blocking: just warn in dev
      if (process.env.NODE_ENV === "development") {
        // eslint-disable-next-line no-console
        console.warn("[LGPD] Failed to log consent:", error.message);
      }
    }
  } catch {
    // Never throw — consent logging must not break the app
  }
}

/**
 * React hook that logs cookie-banner decisions to the DB.
 * Call this after the user clicks "Accept All" or "Essential Only".
 */
export function useLgpdConsentLogger(tenantId?: string | null) {
  const logCookieConsent = async (action: ConsentAction) => {
    await logLgpdConsent({
      tenantId,
      consentType: action === "granted" ? "cookie_all" : "cookie_essential",
      action,
      legalBasis: "consent",
      metadata: {
        banner_version: "1",
        source: "cookie_banner",
      },
    });
  };

  return { logCookieConsent };
}
