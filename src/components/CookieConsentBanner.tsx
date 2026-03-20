import { useState, useEffect } from "react";
import { X, Cookie, Shield, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

type ConsentLevel = "all" | "essential" | null;

const STORAGE_KEY = "eleitor360_cookie_consent";
const STORAGE_VERSION = "1";

interface ConsentData {
  level: ConsentLevel;
  timestamp: string;
  version: string;
}

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data: ConsentData = JSON.parse(stored);
        // Re-show if version changed or data is malformed
        if (data.version === STORAGE_VERSION && data.level) {
          return; // Already consented
        }
      }
    } catch {
      // Invalid stored data, show banner
    }
    // Delay slightly to avoid flash on first paint
    const timer = setTimeout(() => setVisible(true), 800);
    return () => clearTimeout(timer);
  }, []);

  const saveConsent = (level: ConsentLevel) => {
    const data: ConsentData = {
      level,
      timestamp: new Date().toISOString(),
      version: STORAGE_VERSION,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

    // Dispatch event so TrackingProvider can react to the decision
    window.dispatchEvent(new CustomEvent("cookie-consent-updated", { detail: data }));

    setVisible(false);
  };

  const handleAcceptAll = () => saveConsent("all");
  const handleEssentialOnly = () => {
    // When user refuses analytics, remove tracking scripts
    saveConsent("essential");
    // Signal to GTM/Pixel that consent was denied
    if (typeof window !== "undefined" && "dataLayer" in window) {
      // @ts-ignore
      window.dataLayer?.push({ event: "cookie_consent_denied" });
    }
  };

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[9999] p-3 sm:p-4"
      role="dialog"
      aria-modal="false"
      aria-label="Aviso de cookies e privacidade"
    >
      <div className="max-w-4xl mx-auto bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
        {/* Main banner row */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 sm:p-5">
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
              <Cookie className="h-5 w-5 text-primary" />
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground mb-0.5">
              🔒 Este site usa cookies
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Usamos cookies essenciais para o funcionamento da plataforma e, com seu consentimento,
              cookies analíticos para melhorar sua experiência. Conforme a{" "}
              <a href="/lgpd-cookies" className="text-primary underline hover:text-primary/80" target="_blank" rel="noopener noreferrer">
                LGPD (Lei 13.709/2018)
              </a>
              , você tem o direito de aceitar ou recusar.{" "}
              <button
                onClick={() => setShowDetails((v) => !v)}
                className="text-primary underline text-xs hover:text-primary/80"
              >
                {showDetails ? "Ocultar detalhes" : "Ver detalhes"}
              </button>
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handleEssentialOnly}
              className="text-xs h-8"
            >
              <Shield className="h-3.5 w-3.5 mr-1.5" />
              Apenas Essenciais
            </Button>
            <Button
              size="sm"
              onClick={handleAcceptAll}
              className="text-xs h-8 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Cookie className="h-3.5 w-3.5 mr-1.5" />
              Aceitar Todos
            </Button>
          </div>

          <button
            onClick={handleEssentialOnly}
            className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
            aria-label="Fechar - apenas cookies essenciais"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Details section */}
        {showDetails && (
          <div className="border-t border-border bg-muted/30 px-5 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-foreground">
                  <Shield className="h-3.5 w-3.5 text-green-500" />
                  Essenciais (sempre ativos)
                </div>
                <p className="text-muted-foreground pl-5">
                  Autenticação de sessão, segurança CSRF, preferências de tema.
                  Sem esses cookies a plataforma não funciona.
                </p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-foreground">
                  <Settings className="h-3.5 w-3.5 text-blue-500" />
                  Analytics e Marketing (opcional)
                </div>
                <p className="text-muted-foreground pl-5">
                  Google Tag Manager, Facebook Pixel (quando configurados).
                  Usados para medir alcance de campanhas. Requerem seu consentimento.
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Base legal:{" "}
              <strong>Consentimento (Art. 7º, I LGPD)</strong> para cookies analíticos;{" "}
              <strong>Execução de contrato (Art. 7º, V)</strong> para cookies essenciais.
              Você pode alterar suas preferências a qualquer momento em{" "}
              <a href="/lgpd-cookies" className="text-primary underline" target="_blank" rel="noopener noreferrer">
                Política de Cookies
              </a>.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/** Returns the stored consent data, or null if no consent yet. */
export function getCookieConsent(): ConsentData | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    return JSON.parse(stored) as ConsentData;
  } catch {
    return null;
  }
}

/** Returns true if analytics/marketing cookies were accepted. */
export function hasAnalyticsConsent(): boolean {
  const consent = getCookieConsent();
  return consent?.level === "all";
}
