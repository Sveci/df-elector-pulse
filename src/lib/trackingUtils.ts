// Extend Window interface for Facebook Pixel and GTM
declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
    dataLayer?: any[];
  }
}

/**
 * Track a Lead event in Facebook Pixel
 */
export function trackLead(params?: {
  content_name?: string;
  value?: number;
  currency?: string;
}) {
  if (typeof window !== 'undefined' && window.fbq) {
    window.fbq('track', 'Lead', params);
    console.log('Facebook Pixel: Lead event tracked', params);
  }
}

/**
 * Track a custom event in Facebook Pixel
 */
export function trackEvent(eventName: string, params?: Record<string, any>) {
  if (typeof window !== 'undefined' && window.fbq) {
    window.fbq('track', eventName, params);
    console.log(`Facebook Pixel: ${eventName} event tracked`, params);
  }
}

/**
 * Push an event to Google Tag Manager dataLayer
 */
export function pushToDataLayer(event: string, data?: Record<string, any>) {
  if (typeof window !== 'undefined') {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event, ...data });
    console.log(`GTM: ${event} pushed to dataLayer`, data);
  }
}

/**
 * Initialize Facebook Pixel
 */
export function initFacebookPixel(pixelId: string) {
  if (typeof window === 'undefined' || !pixelId) return;

  // Initialize fbq function with proper typing
  const fbq: any = function(...args: any[]) {
    if (fbq.callMethod) {
      fbq.callMethod.apply(fbq, args);
    } else {
      fbq.queue.push(args);
    }
  };

  if (!window.fbq) {
    window.fbq = fbq;
  }

  (window.fbq as any).push = window.fbq;
  (window.fbq as any).loaded = true;
  (window.fbq as any).version = '2.0';
  (window.fbq as any).queue = [];

  // Load the script
  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://connect.facebook.net/en_US/fbevents.js';
  document.head.appendChild(script);

  // Initialize pixel
  window.fbq('init', pixelId);
  window.fbq('track', 'PageView');

  console.log('Facebook Pixel initialized:', pixelId);
}

/**
 * Initialize Google Tag Manager
 */
export function initGTM(gtmId: string) {
  if (typeof window === 'undefined' || !gtmId) return;

  // Initialize dataLayer
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    'gtm.start': new Date().getTime(),
    event: 'gtm.js'
  });

  // Load GTM script
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtm.js?id=${gtmId}`;
  document.head.appendChild(script);

  // Add noscript iframe for GTM
  const noscript = document.createElement('noscript');
  const iframe = document.createElement('iframe');
  iframe.src = `https://www.googletagmanager.com/ns.html?id=${gtmId}`;
  iframe.height = '0';
  iframe.width = '0';
  iframe.style.display = 'none';
  iframe.style.visibility = 'hidden';
  noscript.appendChild(iframe);
  document.body.insertBefore(noscript, document.body.firstChild);

  console.log('Google Tag Manager initialized:', gtmId);
}
