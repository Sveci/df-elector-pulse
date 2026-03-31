import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Shield, ChevronDown, MessageSquare, CheckCircle2, AlertTriangle, Wifi, WifiOff, Cloud } from "lucide-react";
import { useIntegrationsSettings, useUpdateIntegrationsSettings } from "@/hooks/useIntegrationsSettings";
import { useZapiConnectionStatus } from "@/hooks/useZapiConnectionStatus";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

type VerificationMethod = 'link' | 'whatsapp_consent' | 'whatsapp_meta_cloud';

export function VerificationSettingsCard() {
  const { data: settings, isLoading } = useIntegrationsSettings();
  const updateSettings = useUpdateIntegrationsSettings();

  const { data: zapiStatus, isLoading: isCheckingZapi } = useZapiConnectionStatus(
    settings?.zapi_instance_id ?? null,
    settings?.zapi_token ?? null,
    settings?.zapi_client_token ?? null,
    settings?.zapi_enabled ?? false
  );

  const [verificationMethod, setVerificationMethod] = useState<VerificationMethod>('link');
  const [verificationWaEnabled, setVerificationWaEnabled] = useState(false);
  const [verificationWaTestMode, setVerificationWaTestMode] = useState(true);
  const [verificationWaWhitelist, setVerificationWaWhitelist] = useState("");
  const [verificationWaKeyword, setVerificationWaKeyword] = useState("CONFIRMAR");
  const [verificationWaZapiPhone, setVerificationWaZapiPhone] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [isFetchingMetaPhone, setIsFetchingMetaPhone] = useState(false);

  const isFallbackActive = settings?.verification_fallback_active ?? false;
  const isZapiConnected = zapiStatus?.connected ?? false;
  const isMetaCloudMethod = verificationMethod === 'whatsapp_meta_cloud';
  const isWhatsAppConsentMethod = verificationMethod === 'whatsapp_consent';
  const isAnyWhatsAppMethod = isMetaCloudMethod || isWhatsAppConsentMethod;

  useEffect(() => {
    if (settings) {
      setVerificationMethod((settings.verification_method as VerificationMethod) || 'link');
      setVerificationWaEnabled(settings.verification_wa_enabled || false);
      setVerificationWaTestMode(settings.verification_wa_test_mode ?? true);
      setVerificationWaWhitelist((settings.verification_wa_whitelist || []).join('\n'));
      setVerificationWaKeyword(settings.verification_wa_keyword || 'CONFIRMAR');
      setVerificationWaZapiPhone(settings.verification_wa_zapi_phone || '');
    }
  }, [settings]);

  // Auto-fetch phone number from Meta Cloud API or Z-API
  useEffect(() => {
    if (isMetaCloudMethod && settings?.meta_cloud_phone_number_id && settings?.meta_cloud_enabled) {
      const fetchMetaPhone = async () => {
        setIsFetchingMetaPhone(true);
        try {
          const { data, error } = await supabase.functions.invoke('test-meta-cloud-connection', {
            body: {
              phoneNumberId: settings.meta_cloud_phone_number_id,
              apiVersion: settings.meta_cloud_api_version || 'v21.0'
            }
          });
          if (!error && data?.success && data?.data?.displayPhoneNumber) {
            const phone = data.data.displayPhoneNumber.replace(/[\s\-\+\(\)]/g, '');
            setVerificationWaZapiPhone(phone);
          }
        } catch (err) {
          console.error("Error fetching Meta Cloud phone:", err);
        } finally {
          setIsFetchingMetaPhone(false);
        }
      };
      fetchMetaPhone();
    } else if (isWhatsAppConsentMethod && zapiStatus?.phone) {
      // Auto-populate from Z-API connected phone
      const phone = zapiStatus.phone.replace(/[\s\-\+\(\)]/g, '');
      setVerificationWaZapiPhone(phone);
    }
  }, [settings?.meta_cloud_phone_number_id, settings?.meta_cloud_enabled, isMetaCloudMethod, isWhatsAppConsentMethod, zapiStatus?.phone]);

  const handleSave = () => {
    const whitelist = verificationWaWhitelist
      .split('\n')
      .map(phone => phone.trim())
      .filter(phone => phone.length > 0);

    updateSettings.mutate({
      verification_method: verificationMethod,
      verification_wa_enabled: verificationWaEnabled,
      verification_wa_test_mode: verificationWaTestMode,
      verification_wa_whitelist: whitelist,
      verification_wa_keyword: verificationWaKeyword,
      verification_wa_zapi_phone: verificationWaZapiPhone || null,
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-32">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const getActiveBadge = () => {
    if (!verificationWaEnabled || !isAnyWhatsAppMethod) {
      return (
        <Badge variant="secondary">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Link SMS
        </Badge>
      );
    }
    if (isFallbackActive) {
      return (
        <Badge variant="default" className="bg-amber-500 hover:bg-amber-600">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Fallback Ativo
        </Badge>
      );
    }
    if (isMetaCloudMethod) {
      return (
        <Badge variant="default" className="bg-blue-500 hover:bg-blue-600">
          <Cloud className="h-3 w-3 mr-1" />
          Cloud API
        </Badge>
      );
    }
    return (
      <Badge variant="default" className="bg-green-500 hover:bg-green-600">
        <MessageSquare className="h-3 w-3 mr-1" />
        WhatsApp Z-API
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
              <Shield className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <CardTitle className="text-lg">Verificação de Cadastro</CardTitle>
              <CardDescription>
                Configure como novos apoiadores confirmam o cadastro
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {getActiveBadge()}

            {settings?.zapi_enabled && (
              <div className="flex items-center gap-1.5 text-xs">
                {isCheckingZapi ? (
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                ) : isZapiConnected ? (
                  <Wifi className="h-3 w-3 text-green-500" />
                ) : (
                  <WifiOff className="h-3 w-3 text-destructive" />
                )}
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Fallback Alert */}
        {isFallbackActive && verificationWaEnabled && isAnyWhatsAppMethod && (
          <Alert className="border-amber-200 bg-amber-50">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              <strong>Fallback ativo:</strong> O provedor principal está desconectado
              {settings?.zapi_disconnected_at && (
                <span className="text-amber-600">
                  {" "}(há {formatDistanceToNow(new Date(settings.zapi_disconnected_at), { locale: ptBR })})
                </span>
              )}. As verificações estão usando o canal de fallback automaticamente.
            </AlertDescription>
          </Alert>
        )}

        {/* Toggle Master */}
        <div className="flex items-center justify-between py-3 border-b">
          <div>
            <p className="font-medium">Verificação via WhatsApp</p>
            <p className="text-sm text-muted-foreground">
              Permite confirmar cadastro respondendo "SIM" no WhatsApp
            </p>
          </div>
          <Switch
            checked={verificationWaEnabled}
            onCheckedChange={setVerificationWaEnabled}
          />
        </div>

        {verificationWaEnabled && (
          <>
            {/* Método de Verificação */}
            <div className="space-y-3">
              <Label>Método de Verificação Ativo</Label>
              <RadioGroup
                value={verificationMethod}
                onValueChange={(v) => setVerificationMethod(v as VerificationMethod)}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="link" id="link" />
                  <Label htmlFor="link" className="font-normal cursor-pointer">
                    Link via SMS - Enviar link de verificação por SMS
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="whatsapp_consent" id="whatsapp" />
                  <Label htmlFor="whatsapp" className="font-normal cursor-pointer">
                    WhatsApp Z-API - Usuário envia mensagem e confirma com "SIM"
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="whatsapp_meta_cloud" id="whatsapp_meta" />
                  <Label htmlFor="whatsapp_meta" className="font-normal cursor-pointer">
                    WhatsApp Cloud API (Meta) - Verificação via API oficial da Meta
                  </Label>
                </div>
              </RadioGroup>

              {/* Fallback chain info */}
              {isAnyWhatsAppMethod && (
                <div className="text-xs text-muted-foreground bg-muted/50 rounded px-3 py-2 border border-border/50">
                  <strong>Fallback automático:</strong>{" "}
                  {isMetaCloudMethod
                    ? "Cloud API → Z-API → SMS"
                    : "Z-API → SMS"
                  }
                </div>
              )}
            </div>

            {isAnyWhatsAppMethod && (
              <>
                {/* Modo Teste */}
                <div className="flex items-center justify-between py-3 border-t">
                  <div>
                    <p className="font-medium">Modo Teste</p>
                    <p className="text-sm text-muted-foreground">
                      Apenas admins e telefones na whitelist podem usar verificação WhatsApp
                    </p>
                  </div>
                  <Switch
                    checked={verificationWaTestMode}
                    onCheckedChange={setVerificationWaTestMode}
                  />
                </div>

                {/* Whitelist (se modo teste) */}
                {verificationWaTestMode && (
                  <div className="space-y-2">
                    <Label>Telefones para Teste (Whitelist)</Label>
                    <Textarea
                      placeholder={"+5561999999999\n+5511988887777\n(um telefone por linha)"}
                      value={verificationWaWhitelist}
                      onChange={(e) => setVerificationWaWhitelist(e.target.value)}
                      rows={3}
                    />
                    <p className="text-xs text-muted-foreground">
                      Telefones que podem usar a verificação WhatsApp no modo teste
                    </p>
                  </div>
                )}

                {/* Número do WhatsApp */}
                <div className="space-y-2">
                  <Label>
                    Número do WhatsApp {isMetaCloudMethod ? "(Cloud API)" : "(Z-API)"}
                  </Label>
                  {isMetaCloudMethod && settings?.meta_cloud_enabled_2 && settings?.meta_cloud_phone_number_id_2 && (
                    <div className="space-y-2 mb-2">
                      <Label className="text-xs text-muted-foreground">Selecione o número Cloud API:</Label>
                      <RadioGroup
                        value={verificationWaZapiPhone === (settings?.meta_cloud_phone_2 || '') ? '2' : '1'}
                        onValueChange={(v) => {
                          if (v === '2') {
                            setVerificationWaZapiPhone(settings?.meta_cloud_phone_2?.replace(/[\s\-\+\(\)]/g, '') || '');
                          } else {
                            setVerificationWaZapiPhone(settings?.meta_cloud_phone?.replace(/[\s\-\+\(\)]/g, '') || '');
                          }
                        }}
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="1" id="cloud-num-1" />
                          <Label htmlFor="cloud-num-1" className="font-normal cursor-pointer text-sm">
                            Número 1 — {settings?.meta_cloud_phone || settings?.meta_cloud_phone_number_id || "Principal"}
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="2" id="cloud-num-2" />
                          <Label htmlFor="cloud-num-2" className="font-normal cursor-pointer text-sm">
                            Número 2 — {settings?.meta_cloud_phone_2 || settings?.meta_cloud_phone_number_id_2 || "Secundário"}
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>
                  )}
                  <div className="relative">
                  <Input
                      placeholder="5561999999999"
                      value={verificationWaZapiPhone}
                      onChange={(e) => setVerificationWaZapiPhone(e.target.value)}
                      readOnly={(isMetaCloudMethod && !!settings?.meta_cloud_enabled) || (isWhatsAppConsentMethod && isZapiConnected)}
                      className={(isMetaCloudMethod && settings?.meta_cloud_enabled) || (isWhatsAppConsentMethod && isZapiConnected) ? "bg-muted" : ""}
                    />
                    {isFetchingMetaPhone && (
                      <Loader2 className="h-4 w-4 animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {isMetaCloudMethod && settings?.meta_cloud_enabled
                      ? "Obtido automaticamente da configuração do WhatsApp Cloud API (Meta)"
                      : isWhatsAppConsentMethod && isZapiConnected
                        ? "Obtido automaticamente da instância Z-API conectada"
                        : "Este número será usado no link wa.me para o usuário enviar a mensagem"
                    }
                  </p>
                </div>

                {/* Configurações Avançadas */}
                <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
                  <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
                    <ChevronDown className={`h-4 w-4 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
                    Configurações Avançadas
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-4 space-y-4">
                    <div className="space-y-2">
                      <Label>Palavra-chave</Label>
                      <Input
                        placeholder="CONFIRMAR"
                        value={verificationWaKeyword}
                        onChange={(e) => setVerificationWaKeyword(e.target.value.toUpperCase())}
                      />
                      <p className="text-xs text-muted-foreground">
                        Palavra que o usuário deve enviar seguida do código (ex: CONFIRMAR ABC123)
                      </p>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {/* Instruções */}
                <div className="bg-muted/50 rounded-lg p-4 space-y-3 border border-border/50">
                  <h4 className="font-medium text-sm">Como funciona:</h4>
                  <ol className="list-decimal list-inside space-y-1.5 text-sm text-muted-foreground">
                    <li>Usuário se cadastra e vê botão "Verificar pelo WhatsApp"</li>
                    <li>Ao clicar, abre WhatsApp com mensagem pré-preenchida: <code className="bg-muted px-1 rounded">{verificationWaKeyword} ABC123</code></li>
                    <li>Sistema recebe a mensagem e pergunta: "Você autoriza? Responda SIM"</li>
                    <li>Usuário responde "SIM" e cadastro é verificado automaticamente</li>
                  </ol>
                  {isMetaCloudMethod && (
                    <p className="text-xs text-muted-foreground mt-2 border-t pt-2">
                      <strong>Cloud API:</strong> Se a Meta Cloud API falhar, o sistema tentará via Z-API. Se o Z-API também falhar, será enviado link via SMS.
                    </p>
                  )}
                  {isWhatsAppConsentMethod && (
                    <p className="text-xs text-muted-foreground mt-2 border-t pt-2">
                      <strong>Z-API:</strong> Se o Z-API desconectar, o sistema enviará link de verificação via SMS automaticamente.
                    </p>
                  )}
                </div>
              </>
            )}
          </>
        )}

        <div className="flex gap-3 pt-4">
          <Button
            onClick={handleSave}
            disabled={updateSettings.isPending}
          >
            {updateSettings.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : null}
            Salvar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
