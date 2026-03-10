import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantId } from "@/hooks/useTenantId";
import { toast } from "sonner";
import { 
  Send, 
  User, 
  Users, 
  MessageSquare, 
  ShieldCheck,
  Loader2,
  AlertCircle,
  CheckCircle2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type TemplateType = 'bemvindo1' | 'confirmar1';
type RecipientType = 'individual' | 'tree';

interface Leader {
  id: string;
  nome_completo: string;
  telefone: string;
  affiliate_token?: string;
  verification_code?: string;
}

interface LeaderWithTreeCount {
  id: string;
  nome_completo: string;
  telefone: string;
  total_in_tree: number;
  unverified_in_tree: number;
}

interface MetaTemplateComponent {
  type: 'header' | 'body' | 'button';
  parameters?: Array<{
    type: 'text';
    text: string;
  }>;
}

interface MetaTemplatePayload {
  name: string;
  language: { code: string };
  components?: MetaTemplateComponent[];
}

export function WhatsAppOfficialApiTab() {
  const tenantId = useTenantId();
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType>('bemvindo1');
  const [recipientType, setRecipientType] = useState<RecipientType>('individual');
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLeader, setSelectedLeader] = useState<Leader | LeaderWithTreeCount | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [sendProgress, setSendProgress] = useState(0);
  const [sentCount, setSentCount] = useState(0);
  const [totalToSend, setTotalToSend] = useState(0);

  // Check if Meta Cloud API is configured
  const { data: settings, isLoading: isLoadingSettings } = useQuery({
    queryKey: ["integrations_settings_meta_cloud_official"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integrations_settings")
        .select("meta_cloud_enabled, meta_cloud_phone_number_id, meta_cloud_test_mode, meta_cloud_whitelist")
        .limit(1)
        .single();
      if (error) throw error;
      return data;
    }
  });

  // Search leaders for individual selection
  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ["leaders_search_official", searchTerm, selectedTemplate, recipientType],
    queryFn: async () => {
      if (recipientType !== 'individual' || !searchTerm || searchTerm.length < 2) return [];

      let query = supabase
        .from("lideres")
        .select("id, nome_completo, telefone, affiliate_token, verification_code, is_verified")
        .eq("is_active", true)
        .not("telefone", "is", null)
        .ilike("nome_completo", `%${searchTerm}%`)
        .limit(20);

      // Filter based on template
      if (selectedTemplate === 'confirmar1') {
        // Only show unverified leaders
        query = query.or("is_verified.eq.false,is_verified.is.null")
          .not("verification_code", "is", null);
      } else {
        // bemvindo1 - show all with affiliate_token
        query = query.not("affiliate_token", "is", null);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Leader[];
    },
    enabled: recipientType === 'individual' && searchTerm.length >= 2
  });

  // Fetch leaders with tree counts for tree selection
  const { data: leadersWithTrees, isLoading: isLoadingTrees } = useQuery({
    queryKey: ["leaders_with_tree_count_whatsapp"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_leaders_with_tree_count_whatsapp");
      if (error) throw error;
      return data as LeaderWithTreeCount[];
    },
    enabled: recipientType === 'tree'
  });

  // Filter leaders for tree based on template
  const filteredTreeLeaders = useMemo(() => {
    if (!leadersWithTrees) return [];
    
    if (selectedTemplate === 'confirmar1') {
      // Only show leaders with unverified subordinates
      return leadersWithTrees.filter(l => l.unverified_in_tree > 0);
    }
    // bemvindo1 - show all with subordinates
    return leadersWithTrees.filter(l => l.total_in_tree > 0);
  }, [leadersWithTrees, selectedTemplate]);

  // Get recipients count for preview
  const recipientsCount = useMemo(() => {
    if (recipientType === 'individual' && selectedLeader) {
      return 1;
    }
    if (recipientType === 'tree' && selectedLeader) {
      const leader = selectedLeader as LeaderWithTreeCount;
      return selectedTemplate === 'confirmar1' 
        ? leader.unverified_in_tree 
        : leader.total_in_tree;
    }
    return 0;
  }, [recipientType, selectedLeader, selectedTemplate]);

  // Estimate sending time (4.5 seconds average per message)
  const estimatedTime = useMemo(() => {
    const seconds = recipientsCount * 4.5;
    if (seconds < 60) return `~${Math.ceil(seconds)} segundos`;
    const minutes = Math.ceil(seconds / 60);
    return `~${minutes} minuto${minutes > 1 ? 's' : ''}`;
  }, [recipientsCount]);

  const getRandomDelay = () => Math.floor(Math.random() * 3000) + 3000; // 3-6 seconds

  // Build Meta template payload based on template type
  const buildMetaTemplate = (
    templateType: TemplateType,
    recipient: Leader
  ): MetaTemplatePayload => {
    if (templateType === 'bemvindo1') {
      return {
        name: 'bemvindo1',
        language: { code: 'pt_BR' },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: recipient.nome_completo.split(' ')[0] },
              { type: 'text', text: recipient.affiliate_token || '' },
            ],
          },
        ],
      };
    } else {
      // confirmar1
      return {
        name: 'confirmar1',
        language: { code: 'pt_BR' },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: recipient.nome_completo.split(' ')[0] },
              { type: 'text', text: 'sua conta' },
              { type: 'text', text: recipient.verification_code || '' },
            ],
          },
        ],
      };
    }
  };

  const handleSend = async () => {
    if (!selectedLeader) {
      toast.error("Selecione um líder");
      return;
    }

    setIsSending(true);
    setSendProgress(0);
    setSentCount(0);

    try {
      let recipients: Leader[] = [];

      if (recipientType === 'individual') {
        recipients = [selectedLeader as Leader];
      } else {
        // Fetch tree recipients
        const rpcName = selectedTemplate === 'confirmar1' 
          ? 'get_unverified_leaders_in_tree_whatsapp'
          : 'get_leaders_in_tree_whatsapp';
        
        const { data, error } = await supabase.rpc(rpcName, { leader_id: selectedLeader.id });
        if (error) throw error;
        recipients = data as Leader[];
      }

      setTotalToSend(recipients.length);

      if (recipients.length === 0) {
        toast.warning("Nenhum destinatário encontrado com os critérios selecionados");
        setIsSending(false);
        return;
      }

      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < recipients.length; i++) {
        const recipient = recipients[i];

        try {
          // Build Meta template payload
          const metaTemplate = buildMetaTemplate(selectedTemplate, recipient);

          const { data, error } = await supabase.functions.invoke('send-whatsapp', {
            body: {
              phone: recipient.telefone,
              message: `[Template: ${selectedTemplate}]`, // Fallback for logging
              metaTemplate,
              providerOverride: 'meta_cloud', // Force Meta Cloud API
              tenantId,
            }
          });

          if (error || !data?.success) {
            console.error(`Failed to send to ${recipient.nome_completo}:`, error || data?.error);
            errorCount++;
          } else {
            successCount++;
          }
        } catch (err) {
          console.error(`Error sending to ${recipient.nome_completo}:`, err);
          errorCount++;
        }

        setSentCount(i + 1);
        setSendProgress(((i + 1) / recipients.length) * 100);

        // Add delay between messages (except for the last one)
        if (i < recipients.length - 1) {
          await new Promise(resolve => setTimeout(resolve, getRandomDelay()));
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount} mensagem(ns) enviada(s) com sucesso!`);
      }
      if (errorCount > 0) {
        toast.error(`${errorCount} mensagem(ns) falharam`);
      }

      // Reset form
      setSelectedLeader(null);
      setSearchTerm("");

    } catch (error) {
      console.error("Error in bulk send:", error);
      toast.error("Erro ao enviar mensagens");
    } finally {
      setIsSending(false);
      setSendProgress(0);
      setSentCount(0);
      setTotalToSend(0);
    }
  };

  const isConfigured = settings?.meta_cloud_enabled && settings?.meta_cloud_phone_number_id;
  const canSend = isConfigured && selectedLeader && !isSending;

  if (isLoadingSettings) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isConfigured) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          A integração WhatsApp Cloud API (Meta) não está configurada. Acesse Configurações &gt; Integrações para configurar o Phone Number ID.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Info Alert */}
      <Alert>
        <MessageSquare className="h-4 w-4" />
        <AlertDescription>
          Envie mensagens via API Oficial do WhatsApp (Meta) usando templates pré-aprovados. 
          Esta opção é mais confiável e tem menor risco de bloqueio.
          {settings?.meta_cloud_test_mode && (
            <span className="block mt-1 text-amber-600 dark:text-amber-400 font-medium">
              ⚠️ Modo Teste ativo: apenas números na whitelist receberão mensagens.
            </span>
          )}
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Template Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Selecione a Mensagem
            </CardTitle>
            <CardDescription>
              Escolha o template pré-aprovado pelo Meta
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={selectedTemplate}
              onValueChange={(value) => {
                setSelectedTemplate(value as TemplateType);
                setSelectedLeader(null);
                setSearchTerm("");
              }}
              className="space-y-4"
            >
              <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="bemvindo1" id="bemvindo1" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="bemvindo1" className="text-base font-medium cursor-pointer">
                    Boas-Vindas (Link de Afiliado)
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Envia o link de afiliado para o líder compartilhar e indicar novos apoiadores.
                  </p>
                </div>
                <User className="h-5 w-5 text-green-500" />
              </div>

              <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="confirmar1" id="confirmar1" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="confirmar1" className="text-base font-medium cursor-pointer">
                    Verificação de Celular
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Envia o código de verificação para líderes que ainda não confirmaram o cadastro.
                  </p>
                </div>
                <ShieldCheck className="h-5 w-5 text-blue-500" />
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Recipient Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Selecione os Destinatários
            </CardTitle>
            <CardDescription>
              Escolha entre enviar para um líder específico ou toda a árvore
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Recipient Type */}
            <div className="space-y-2">
              <Label>Tipo de Destinatário</Label>
              <Select
                value={recipientType}
                onValueChange={(value) => {
                  setRecipientType(value as RecipientType);
                  setSelectedLeader(null);
                  setSearchTerm("");
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Líder Individual
                    </div>
                  </SelectItem>
                  <SelectItem value="tree">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Árvore de Líder
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Leader Selection - Individual */}
            {recipientType === 'individual' && (
              <div className="space-y-2">
                <Label>Buscar Líder</Label>
                <Input
                  placeholder="Digite o nome do líder..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setSelectedLeader(null);
                  }}
                />
                
                {isSearching && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Buscando...
                  </div>
                )}

                {searchResults && searchResults.length > 0 && !selectedLeader && (
                  <div className="border rounded-lg max-h-48 overflow-y-auto">
                    {searchResults.map((leader) => (
                      <button
                        key={leader.id}
                        onClick={() => {
                          setSelectedLeader(leader);
                          setSearchTerm(leader.nome_completo);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors border-b last:border-0"
                      >
                        <p className="font-medium">{leader.nome_completo}</p>
                        <p className="text-sm text-muted-foreground">{leader.telefone}</p>
                      </button>
                    ))}
                  </div>
                )}

                {selectedLeader && (
                  <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-medium text-green-800 dark:text-green-200">
                        {(selectedLeader as Leader).nome_completo}
                      </p>
                      <p className="text-sm text-green-600 dark:text-green-400">
                        {(selectedLeader as Leader).telefone}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Leader Selection - Tree */}
            {recipientType === 'tree' && (
              <div className="space-y-2">
                <Label>Selecionar Líder da Árvore</Label>
                {isLoadingTrees ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando líderes...
                  </div>
                ) : (
                  <Select
                    value={selectedLeader?.id || ""}
                    onValueChange={(value) => {
                      const leader = filteredTreeLeaders.find(l => l.id === value);
                      setSelectedLeader(leader || null);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um líder..." />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredTreeLeaders.map((leader) => (
                        <SelectItem key={leader.id} value={leader.id}>
                          <div className="flex items-center justify-between gap-4 w-full">
                            <span>{leader.nome_completo}</span>
                            <span className="text-xs text-muted-foreground">
                              {selectedTemplate === 'confirmar1' 
                                ? `${leader.unverified_in_tree} não verificados`
                                : `${leader.total_in_tree} liderados`
                              }
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {filteredTreeLeaders.length === 0 && !isLoadingTrees && (
                  <p className="text-sm text-muted-foreground">
                    {selectedTemplate === 'confirmar1' 
                      ? "Nenhum líder com subordinados não verificados encontrado."
                      : "Nenhum líder com subordinados encontrado."
                    }
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Summary and Send */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="font-semibold">Resumo do Envio</h3>
              {selectedLeader ? (
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>
                    <strong>Destinatários:</strong> {recipientsCount} líder{recipientsCount !== 1 ? 'es' : ''}
                  </p>
                  <p>
                    <strong>Tempo estimado:</strong> {estimatedTime}
                  </p>
                  <p>
                    <strong>Template:</strong> {selectedTemplate === 'bemvindo1' ? 'Boas-Vindas' : 'Verificação'}
                  </p>
                  <p>
                    <strong>Provedor:</strong> Meta Cloud API (Oficial)
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Selecione um líder para ver o resumo
                </p>
              )}
            </div>

            <Button 
              onClick={handleSend} 
              disabled={!canSend}
              size="lg"
              className="w-full sm:w-auto"
            >
              {isSending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando {sentCount}/{totalToSend}...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Enviar via API Oficial
                </>
              )}
            </Button>
          </div>

          {isSending && (
            <div className="mt-4 space-y-2">
              <Progress value={sendProgress} className="h-2" />
              <p className="text-sm text-center text-muted-foreground">
                Enviando {sentCount} de {totalToSend} mensagens...
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
