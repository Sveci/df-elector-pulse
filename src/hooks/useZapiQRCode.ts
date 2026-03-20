import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface UseZapiQRCodeProps {
  instanceId: string;
  token: string;
  clientToken?: string;
  isOpen: boolean;
  onConnected?: () => void;
}

interface QRCodeState {
  isLoading: boolean;
  qrcode: string | null;
  connected: boolean;
  error: string | null;
  countdown: number;
  attempts: number;
}

const MAX_ATTEMPTS = 10;
const REFRESH_INTERVAL = 15;

export function useZapiQRCode({
  instanceId,
  token,
  clientToken,
  isOpen,
  onConnected
}: UseZapiQRCodeProps) {
  const [state, setState] = useState<QRCodeState>({
    isLoading: false,
    qrcode: null,
    connected: false,
    error: null,
    countdown: REFRESH_INTERVAL,
    attempts: 0,
  });

  const fetchQRCode = useCallback(async () => {
    if (!instanceId || !token) {
      setState(prev => ({ ...prev, error: "Credenciais Z-API não configuradas" }));
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const { data, error } = await supabase.functions.invoke("get-zapi-qrcode", {
        body: { instanceId, token, clientToken },
      });

      if (error) {
        console.error("[useZapiQRCode] Edge function error:", error);
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: "Erro ao conectar com o servidor",
          attempts: prev.attempts + 1,
        }));
        return;
      }

      if (data.connected) {
        console.log("[useZapiQRCode] WhatsApp connected!");
        setState(prev => ({ ...prev, isLoading: false, connected: true, qrcode: null }));
        toast.success("WhatsApp conectado com sucesso!");
        onConnected?.();
        return;
      }

      if (data.success && data.qrcode) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          qrcode: data.qrcode,
          countdown: REFRESH_INTERVAL,
          attempts: prev.attempts + 1,
        }));
      } else {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: data.error || "Não foi possível obter o QR Code",
          attempts: prev.attempts + 1,
        }));
      }
    } catch (err) {
      console.error("[useZapiQRCode] Error:", err);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: "Erro inesperado ao obter QR Code",
        attempts: prev.attempts + 1,
      }));
    }
  }, [instanceId, token, clientToken, onConnected]);

  // Fetch QR Code when dialog opens
  useEffect(() => {
    if (isOpen && !state.connected) {
      setState(prev => ({ ...prev, attempts: 0, countdown: REFRESH_INTERVAL }));
      fetchQRCode();
    }
  }, [isOpen]);

  // Countdown and auto-refresh
  useEffect(() => {
    if (!isOpen || state.connected || state.attempts >= MAX_ATTEMPTS) return;

    const timer = setInterval(() => {
      setState(prev => {
        if (prev.countdown <= 1) {
          // Time to refresh
          fetchQRCode();
          return { ...prev, countdown: REFRESH_INTERVAL };
        }
        return { ...prev, countdown: prev.countdown - 1 };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, state.connected, state.attempts, fetchQRCode]);

  const reset = useCallback(() => {
    setState({
      isLoading: false,
      qrcode: null,
      connected: false,
      error: null,
      countdown: REFRESH_INTERVAL,
      attempts: 0,
    });
  }, []);

  const retry = useCallback(() => {
    setState(prev => ({ ...prev, attempts: 0, countdown: REFRESH_INTERVAL }));
    fetchQRCode();
  }, [fetchQRCode]);

  return {
    ...state,
    maxAttempts: MAX_ATTEMPTS,
    refresh: fetchQRCode,
    reset,
    retry,
  };
}
