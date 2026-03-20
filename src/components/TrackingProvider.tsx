import { useEffect } from "react";
import { useAppSettings } from "@/hooks/useAppSettings";
import { initFacebookPixel, initGTM } from "@/lib/trackingUtils";

interface TrackingProviderProps {
  children: React.ReactNode;
}

export function TrackingProvider({ children }: TrackingProviderProps) {
  const { data: settings } = useAppSettings();

  // Suppress unhandled errors from external tracking scripts (e.g. AdPilot CORS 403)
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      if (
        event.message?.includes('Origin not allowed') ||
        event.filename?.includes('capi-ingest') ||
        event.filename?.includes('capi-pixel-loader')
      ) {
        event.preventDefault();
        console.warn('[Tracking] External tracking script error suppressed:', event.message);
        return true;
      }
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = String(event.reason || '');
      if (reason.includes('Origin not allowed') || reason.includes('capi-ingest')) {
        event.preventDefault();
        console.warn('[Tracking] External tracking promise rejection suppressed:', reason);
      }
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  useEffect(() => {
    if (!settings) return;

    // Initialize custom pixel code (takes priority)
    if (settings.facebook_pixel_code) {
      try {
        const container = document.createElement('div');
        container.innerHTML = settings.facebook_pixel_code;

        const scripts = container.querySelectorAll('script');
        scripts.forEach((script) => {
          const newScript = document.createElement('script');
          if (script.src) {
            newScript.src = script.src;
            newScript.async = true;
          } else {
            newScript.innerHTML = script.innerHTML;
          }
          document.head.appendChild(newScript);
        });

        if (scripts.length === 0) {
          const scriptElement = document.createElement('script');
          scriptElement.innerHTML = settings.facebook_pixel_code;
          document.head.appendChild(scriptElement);
        }

        console.log('Custom Facebook Pixel code loaded');
      } catch (error) {
        console.error('Error loading custom Facebook Pixel code:', error);
      }
    } else if (settings.facebook_pixel_id) {
      initFacebookPixel(settings.facebook_pixel_id);
    }

    if (settings.gtm_id) {
      initGTM(settings.gtm_id);
    }
  }, [settings]);

  return <>{children}</>;
}
