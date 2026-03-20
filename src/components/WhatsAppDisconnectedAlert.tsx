import { Link } from "react-router-dom";
import { useIntegrationsSettings } from "@/hooks/useIntegrationsSettings";
import { useZapiConnectionStatus } from "@/hooks/useZapiConnectionStatus";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

function StatusDot({ connected, label, tooltip }: { connected: boolean; label: string; tooltip?: string }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            to="/settings/integrations"
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium
                       hover:opacity-80 transition-opacity"
          >
            <span className="relative flex h-2 w-2 shrink-0">
              {!connected && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
              )}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${connected ? 'bg-green-500' : 'bg-destructive'}`} />
            </span>
            <span className={`hidden sm:inline whitespace-nowrap ${connected ? 'text-green-600' : 'text-destructive'}`}>
              {label}
            </span>
          </Link>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          {tooltip || label} – {connected ? "Conectado" : "Desconectado"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function WhatsAppDisconnectedAlert() {
  const { data: settings } = useIntegrationsSettings();

  // === Z-API status ===
  const isZapiConfigured = settings?.zapi_instance_id &&
    settings?.zapi_token &&
    settings?.zapi_enabled;

  const { data: zapiStatus, isLoading: zapiLoading } = useZapiConnectionStatus(
    settings?.zapi_instance_id || null,
    settings?.zapi_token || null,
    settings?.zapi_client_token || null,
    !!isZapiConfigured
  );

  // === Meta Cloud API status ===
  const isMetaConfigured = settings?.meta_cloud_enabled && settings?.meta_cloud_phone_number_id;
  const [metaConnected, setMetaConnected] = useState<boolean | null>(null);
  const [metaLoading, setMetaLoading] = useState(false);

  useEffect(() => {
    if (!isMetaConfigured || !settings?.meta_cloud_phone_number_id) {
      setMetaConnected(null);
      return;
    }
    const checkMeta = async () => {
      setMetaLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('test-meta-cloud-connection', {
          body: {
            phoneNumberId: settings.meta_cloud_phone_number_id,
            apiVersion: settings.meta_cloud_api_version || 'v21.0'
          }
        });
        setMetaConnected(!error && data?.success);
      } catch {
        setMetaConnected(false);
      } finally {
        setMetaLoading(false);
      }
    };
    checkMeta();
  }, [isMetaConfigured, settings?.meta_cloud_phone_number_id]);

  // === Email (Resend) status ===
  const isResendConfigured = settings?.resend_enabled && settings?.resend_api_key;
  const [resendConnected, setResendConnected] = useState<boolean | null>(null);
  const [resendLoading, setResendLoading] = useState(false);

  useEffect(() => {
    if (!isResendConfigured || !settings?.resend_api_key) {
      setResendConnected(null);
      return;
    }
    const checkResend = async () => {
      setResendLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('test-resend-connection', {
          body: { apiKey: settings.resend_api_key }
        });
        setResendConnected(!error && data?.success);
      } catch {
        setResendConnected(false);
      } finally {
        setResendLoading(false);
      }
    };
    checkResend();
  }, [isResendConfigured, settings?.resend_api_key]);

  // === SMS status (active provider) ===
  const smsProvider = settings?.sms_active_provider || 'smsdev';
  const isSmsConfigured =
    (smsProvider === 'smsdev' && settings?.smsdev_enabled && settings?.smsdev_api_key) ||
    (smsProvider === 'smsbarato' && settings?.smsbarato_enabled && settings?.smsbarato_api_key) ||
    (smsProvider === 'disparopro' && settings?.disparopro_enabled && settings?.disparopro_token);

  const [smsConnected, setSmsConnected] = useState<boolean | null>(null);
  const [smsLoading, setSmsLoading] = useState(false);

  useEffect(() => {
    if (!isSmsConfigured) {
      setSmsConnected(null);
      return;
    }
    const checkSms = async () => {
      setSmsLoading(true);
      try {
        let funcName = '';
        let body: Record<string, string> = {};

        if (smsProvider === 'smsdev' && settings?.smsdev_api_key) {
          funcName = 'test-smsdev-connection';
          body = { apiKey: settings.smsdev_api_key };
        } else if (smsProvider === 'smsbarato' && settings?.smsbarato_api_key) {
          funcName = 'test-smsbarato-connection';
          body = { apiKey: settings.smsbarato_api_key };
        } else if (smsProvider === 'disparopro' && settings?.disparopro_token) {
          funcName = 'test-disparopro-connection';
          body = { token: settings.disparopro_token };
        }

        if (!funcName) {
          setSmsConnected(false);
          return;
        }

        const { data, error } = await supabase.functions.invoke(funcName, { body });
        setSmsConnected(!error && data?.success);
      } catch {
        setSmsConnected(false);
      } finally {
        setSmsLoading(false);
      }
    };
    checkSms();
  }, [isSmsConfigured, smsProvider, settings?.smsdev_api_key, settings?.smsbarato_api_key, settings?.disparopro_token]);

  // Determine what to show
  const showZapi = !!isZapiConfigured && !zapiLoading;
  const showMeta = !!isMetaConfigured && !metaLoading && metaConnected !== null;
  const showResend = !!isResendConfigured && !resendLoading && resendConnected !== null;
  const showSms = !!isSmsConfigured && !smsLoading && smsConnected !== null;

  const hasAny = showZapi || showMeta || showResend || showSms;
  if (!hasAny) return null;

  // Determine overall status for container styling
  const allConnected = [
    showZapi ? zapiStatus?.connected : undefined,
    showMeta ? metaConnected : undefined,
    showResend ? resendConnected : undefined,
    showSms ? smsConnected : undefined,
  ].filter(v => v !== undefined);

  const hasDisconnected = allConnected.some(v => v === false);

  const smsLabel = 'SMS';

  return (
    <div
      className={`flex items-center gap-0.5 mr-2 px-1.5 py-1 rounded-md border animate-fade-in ${
        hasDisconnected
          ? 'border-destructive/30 bg-destructive/5'
          : 'border-green-300 bg-green-50'
      }`}
    >
      {showZapi && (
        <StatusDot connected={zapiStatus?.connected ?? false} label="Z-API" tooltip="WhatsApp Z-API" />
      )}
      {showMeta && (
        <StatusDot connected={metaConnected ?? false} label="Meta" tooltip="WhatsApp Cloud API (Meta)" />
      )}
      {showResend && (
        <StatusDot connected={resendConnected ?? false} label="Email" tooltip="E-mail (Resend)" />
      )}
      {showSms && (
        <StatusDot connected={smsConnected ?? false} label={smsLabel} tooltip={`SMS (${smsLabel})`} />
      )}
    </div>
  );
}
