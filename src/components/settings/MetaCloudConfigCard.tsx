import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, MessageSquare, Eye, EyeOff, CheckCircle2, XCircle, AlertTriangle, Info, Plus, X } from "lucide-react";
import { useIntegrationsSettings, useUpdateIntegrationsSettings, useTestMetaCloudConnection } from "@/hooks/useIntegrationsSettings";

interface MetaCloudConfigCardProps {
  settings: {
    whatsapp_provider_active?: 'zapi' | 'meta_cloud';
    meta_cloud_enabled?: boolean;
    meta_cloud_test_mode?: boolean;
    meta_cloud_whitelist?: string[];
    meta_cloud_phone_number_id?: string | null;
    meta_cloud_waba_id?: string | null;
    meta_cloud_api_version?: string;
    meta_cloud_fallback_enabled?: boolean;
    meta_cloud_phone?: string | null;
    meta_cloud_phone_number_id_2?: string | null;
    meta_cloud_waba_id_2?: string | null;
    meta_cloud_phone_2?: string | null;
    meta_cloud_enabled_2?: boolean;
    zapi_enabled?: boolean;
  } | null;
  onProviderChange?: (provider: 'zapi' | 'meta_cloud') => void;
}

export const MetaCloudConfigCard = ({ settings, onProviderChange }: MetaCloudConfigCardProps) => {
  const updateSettings = useUpdateIntegrationsSettings();
  const testConnection = useTestMetaCloudConnection();

  // State - Número 1
  const [whatsappProvider, setWhatsappProvider] = useState<'zapi' | 'meta_cloud'>('zapi');
  const [metaCloudEnabled, setMetaCloudEnabled] = useState(false);
  const [testMode, setTestMode] = useState(true);
  const [whitelist, setWhitelist] = useState<string[]>([]);
  const [newWhitelistNumber, setNewWhitelistNumber] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [wabaId, setWabaId] = useState("");
  const [apiVersion, setApiVersion] = useState("v20.0");
  const [fallbackEnabled, setFallbackEnabled] = useState(false);
  const [metaCloudPhone, setMetaCloudPhone] = useState("");
  // State - Número 2
  const [phoneNumberId2, setPhoneNumberId2] = useState("");
  const [wabaId2, setWabaId2] = useState("");
  const [metaCloudPhone2, setMetaCloudPhone2] = useState("");
  const [metaCloudEnabled2, setMetaCloudEnabled2] = useState(false);

  useEffect(() => {
    if (settings) {
      setWhatsappProvider(settings.whatsapp_provider_active || 'zapi');
      setMetaCloudEnabled(settings.meta_cloud_enabled || false);
      setTestMode(settings.meta_cloud_test_mode ?? true);
      setWhitelist(settings.meta_cloud_whitelist || []);
      setPhoneNumberId(settings.meta_cloud_phone_number_id || "");
      setWabaId(settings.meta_cloud_waba_id || "");
      setApiVersion(settings.meta_cloud_api_version || "v20.0");
      setFallbackEnabled(settings.meta_cloud_fallback_enabled || false);
      setMetaCloudPhone(settings.meta_cloud_phone || "");
      // Número 2
      setPhoneNumberId2(settings.meta_cloud_phone_number_id_2 || "");
      setWabaId2(settings.meta_cloud_waba_id_2 || "");
      setMetaCloudPhone2(settings.meta_cloud_phone_2 || "");
      setMetaCloudEnabled2(settings.meta_cloud_enabled_2 || false);
    }
  }, [settings]);

  const handleProviderChange = (provider: 'zapi' | 'meta_cloud') => {
    setWhatsappProvider(provider);
    onProviderChange?.(provider);
  };

  const handleAddWhitelist = () => {
    if (newWhitelistNumber.trim()) {
      // Normalize to E.164 format
      let number = newWhitelistNumber.replace(/\D/g, "");
      if (!number.startsWith("55") && number.length <= 11) {
        number = "55" + number;
      }
      if (!whitelist.includes(number)) {
        setWhitelist([...whitelist, number]);
      }
      setNewWhitelistNumber("");
    }
  };

  const handleRemoveWhitelist = (number: string) => {
    setWhitelist(whitelist.filter(n => n !== number));
  };

  const handleSave = () => {
    updateSettings.mutate({
      whatsapp_provider_active: whatsappProvider,
      meta_cloud_enabled: metaCloudEnabled,
      meta_cloud_test_mode: testMode,
      meta_cloud_whitelist: whitelist,
      meta_cloud_phone_number_id: phoneNumberId || null,
      meta_cloud_waba_id: wabaId || null,
      meta_cloud_api_version: apiVersion,
      meta_cloud_fallback_enabled: fallbackEnabled,
      meta_cloud_phone: metaCloudPhone || null,
      // Número 2
      meta_cloud_phone_number_id_2: phoneNumberId2 || null,
      meta_cloud_waba_id_2: wabaId2 || null,
      meta_cloud_phone_2: metaCloudPhone2 || null,
      meta_cloud_enabled_2: metaCloudEnabled2,
    });
  };

  const handleTestConnection = () => {
    if (!phoneNumberId) return;
    testConnection.mutate({ phoneNumberId, apiVersion });
  };

  const isConfigured = !!phoneNumberId;

  return (
    <Card className="border-2 border-blue-200 bg-blue-50/30">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <MessageSquare className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                WhatsApp Cloud API
                <Badge variant="outline" className="text-blue-600 border-blue-300 text-xs">
                  Meta Oficial
                </Badge>
              </CardTitle>
              <CardDescription>
                API oficial do WhatsApp Business Platform
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isConfigured ? (
              metaCloudEnabled ? (
                <Badge variant="default" className="bg-green-500 hover:bg-green-600">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Ativo
                </Badge>
              ) : (
                <Badge variant="secondary">
                  Configurado
                </Badge>
              )
            ) : (
              <Badge variant="outline" className="text-muted-foreground">
                <XCircle className="h-3 w-3 mr-1" />
                Não configurado
              </Badge>
            )}
            <Switch
              checked={metaCloudEnabled}
              onCheckedChange={setMetaCloudEnabled}
              disabled={!isConfigured}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Provider Selector */}
        <div className="space-y-3">
          <Label className="text-base font-medium">Provedor WhatsApp Ativo</Label>
          <RadioGroup
            value={whatsappProvider}
            onValueChange={(value: 'zapi' | 'meta_cloud') => handleProviderChange(value)}
            className="grid grid-cols-2 gap-4"
          >
            <div className={`flex items-center space-x-3 border rounded-lg p-4 cursor-pointer transition-colors ${whatsappProvider === 'zapi' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}>
              <RadioGroupItem value="zapi" id="wa-zapi" disabled={!settings?.zapi_enabled} />
              <div className="flex-1">
                <Label htmlFor="wa-zapi" className="cursor-pointer flex items-center gap-2">
                  <span className="font-medium">Z-API</span>
                  {whatsappProvider === 'zapi' && (
                    <Badge variant="default" className="bg-green-500 text-xs">Em uso</Badge>
                  )}
                </Label>
                <p className="text-xs text-muted-foreground">Não-oficial</p>
              </div>
            </div>
            <div className={`flex items-center space-x-3 border rounded-lg p-4 cursor-pointer transition-colors ${whatsappProvider === 'meta_cloud' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}>
              <RadioGroupItem value="meta_cloud" id="wa-meta" disabled={!metaCloudEnabled} />
              <div className="flex-1">
                <Label htmlFor="wa-meta" className="cursor-pointer flex items-center gap-2">
                  <span className="font-medium">Cloud API</span>
                  {whatsappProvider === 'meta_cloud' && (
                    <Badge variant="default" className="bg-blue-500 text-xs">Em uso</Badge>
                  )}
                </Label>
                <p className="text-xs text-muted-foreground">Meta Oficial</p>
              </div>
            </div>
          </RadioGroup>
        </div>

        {/* Config Fields */}
        <div className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="phone-number-id">Phone Number ID *</Label>
              <Input
                id="phone-number-id"
                placeholder="Ex: 123456789012345"
                value={phoneNumberId}
                onChange={(e) => setPhoneNumberId(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Encontre no Meta Business Suite → WhatsApp → Configuração
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="waba-id">WABA ID (opcional)</Label>
              <Input
                id="waba-id"
                placeholder="Ex: 123456789012345"
                value={wabaId}
                onChange={(e) => setWabaId(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                WhatsApp Business Account ID
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="api-version">Versão da API</Label>
              <select
                id="api-version"
                value={apiVersion}
                onChange={(e) => setApiVersion(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="v20.0">v20.0 (Recomendada)</option>
                <option value="v19.0">v19.0</option>
                <option value="v21.0">v21.0</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="meta-phone">Número do WhatsApp *</Label>
              <Input
                id="meta-phone"
                placeholder="Ex: 5561999999999"
                value={metaCloudPhone}
                onChange={(e) => setMetaCloudPhone(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Número cadastrado na Cloud API (DDI + DDD + Número)
              </p>
            </div>
          </div>
        </div>

        {/* Segundo Número Cloud API */}
        <div className="space-y-4 bg-blue-50/50 rounded-lg p-4 border border-blue-200/50">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base font-medium">Segundo Número (Cloud API)</Label>
              <p className="text-xs text-muted-foreground">
                Configure um segundo número para envios via Cloud API
              </p>
            </div>
            <Switch
              checked={metaCloudEnabled2}
              onCheckedChange={setMetaCloudEnabled2}
            />
          </div>

          {metaCloudEnabled2 && (
            <div className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="phone-number-id-2">Phone Number ID *</Label>
                  <Input
                    id="phone-number-id-2"
                    placeholder="Ex: 123456789012345"
                    value={phoneNumberId2}
                    onChange={(e) => setPhoneNumberId2(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="waba-id-2">WABA ID (opcional)</Label>
                  <Input
                    id="waba-id-2"
                    placeholder="Ex: 123456789012345"
                    value={wabaId2}
                    onChange={(e) => setWabaId2(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="meta-phone-2">Número do WhatsApp 2 *</Label>
                <Input
                  id="meta-phone-2"
                  placeholder="Ex: 5596999999999"
                  value={metaCloudPhone2}
                  onChange={(e) => setMetaCloudPhone2(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Segundo número cadastrado na Cloud API (DDI + DDD + Número)
                </p>
              </div>
            </div>
          )}
        </div>

        <Alert className="border-amber-200 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            <strong>Importante:</strong> O Access Token deve ser configurado como secret no ambiente
            (<code className="bg-amber-100 px-1 rounded">META_WA_ACCESS_TOKEN</code>).
            Não será armazenado no banco de dados por segurança.
          </AlertDescription>
        </Alert>

        {/* Test Mode Section */}
        <div className="space-y-4 bg-muted/30 rounded-lg p-4 border border-border/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-blue-600" />
              <Label className="font-medium">Modo Teste</Label>
            </div>
            <Switch
              checked={testMode}
              onCheckedChange={setTestMode}
            />
          </div>

          {testMode && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                No modo teste, apenas números na whitelist abaixo receberão mensagens via Cloud API.
              </p>

              {/* Whitelist Management */}
              <div className="space-y-2">
                <Label className="text-sm">Whitelist (números E.164)</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Ex: 5561999999999"
                    value={newWhitelistNumber}
                    onChange={(e) => setNewWhitelistNumber(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddWhitelist()}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleAddWhitelist}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {whitelist.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {whitelist.map((number) => (
                      <Badge key={number} variant="secondary" className="flex items-center gap-1">
                        +{number}
                        <button
                          onClick={() => handleRemoveWhitelist(number)}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Fallback Option */}
        <div className="flex items-center justify-between py-3 border-t border-border/50">
          <div>
            <Label className="font-medium">Fallback para Z-API</Label>
            <p className="text-xs text-muted-foreground">
              Se a Cloud API falhar, tentar envio via Z-API
            </p>
          </div>
          <Switch
            checked={fallbackEnabled}
            onCheckedChange={setFallbackEnabled}
            disabled={!settings?.zapi_enabled}
          />
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3 pt-4">
          <Button
            variant="outline"
            onClick={handleTestConnection}
            disabled={!isConfigured || testConnection.isPending}
          >
            {testConnection.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : null}
            Testar Conexão
          </Button>
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
};
