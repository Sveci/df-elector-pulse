import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Send, Mail, MessageSquare, Users, UserCheck, Loader2, CheckCircle, AlertTriangle, ArrowLeft, Play, Pause } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRegionMaterials } from "@/hooks/useRegionMaterials";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface RecipientWithMaterial {
  id: string;
  nome: string;
  phone: string | null;
  email: string | null;
  type: "contact" | "leader";
  cidade_id: string;
  material_name: string;
  material_url: string;
  shortened_url?: string;
}

interface RegionSummary {
  cidade_id: string;
  cidade_nome: string;
  material_name: string;
  contacts_sms: number;
  contacts_email: number;
  leaders_sms: number;
  leaders_email: number;
}

const BATCH_SIZE_OPTIONS = [
  { value: "10", label: "10 por lote" },
  { value: "20", label: "20 por lote" },
  { value: "50", label: "50 por lote" },
  { value: "100", label: "100 por lote" },
  { value: "all", label: "Todos de uma vez" },
];

export default function DispatchRegionMaterials() {
  const navigate = useNavigate();
  const { data: regionMaterials, isLoading: loadingMaterials } = useRegionMaterials();

  const [sendSMS, setSendSMS] = useState(true);
  const [sendEmail, setSendEmail] = useState(true);
  const [includeContacts, setIncludeContacts] = useState(true);
  const [includeLeaders, setIncludeLeaders] = useState(true);
  const [batchSize, setBatchSize] = useState("20");
  const [isSending, setIsSending] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, smsOk: 0, emailOk: 0, smsFail: 0, emailFail: 0 });
  const [isComplete, setIsComplete] = useState(false);

  const activeMaterials = useMemo(() =>
    regionMaterials?.filter(m => m.is_active) || [],
    [regionMaterials]
  );
  const materialCityIds = useMemo(() =>
    activeMaterials.map(m => m.city_id),
    [activeMaterials]
  );

  // Fetch contacts with cidade_id matching materials
  const { data: contacts, isLoading: loadingContacts } = useQuery({
    queryKey: ["dispatch-region-contacts", materialCityIds],
    queryFn: async () => {
      if (materialCityIds.length === 0) return [];
      const allData: { id: string; nome: string; telefone_norm: string; email: string | null; cidade_id: string }[] = [];
      const pageSize = 1000;

      for (const cityId of materialCityIds) {
        let page = 0;
        let hasMore = true;
        while (hasMore) {
          const { data, error } = await supabase
            .from("office_contacts")
            .select("id, nome, telefone_norm, email, cidade_id")
            .eq("is_active", true)
            .eq("cidade_id", cityId)
            .range(page * pageSize, (page + 1) * pageSize - 1);
          if (error) throw error;
          if (data && data.length > 0) { allData.push(...data); hasMore = data.length === pageSize; page++; } else { hasMore = false; }
        }
      }
      return allData;
    },
    enabled: materialCityIds.length > 0,
  });

  // Fetch leaders with cidade_id matching materials
  const { data: leaders, isLoading: loadingLeaders } = useQuery({
    queryKey: ["dispatch-region-leaders", materialCityIds],
    queryFn: async () => {
      if (materialCityIds.length === 0) return [];
      const allData: { id: string; nome_completo: string; telefone: string | null; email: string | null; cidade_id: string }[] = [];
      const pageSize = 1000;

      for (const cityId of materialCityIds) {
        let page = 0;
        let hasMore = true;
        while (hasMore) {
          const { data, error } = await supabase
            .from("lideres")
            .select("id, nome_completo, telefone, email, cidade_id")
            .eq("is_active", true)
            .eq("cidade_id", cityId)
            .range(page * pageSize, (page + 1) * pageSize - 1);
          if (error) throw error;
          if (data && data.length > 0) { allData.push(...data); hasMore = data.length === pageSize; page++; } else { hasMore = false; }
        }
      }
      return allData;
    },
    enabled: materialCityIds.length > 0,
  });

  // Build material map
  const materialMap = useMemo(() => {
    const map = new Map<string, { material_name: string; material_url: string }>();
    activeMaterials.forEach(m => {
      map.set(m.city_id, { material_name: m.material_name, material_url: m.material_url });
    });
    return map;
  }, [activeMaterials]);

  // Build summary by region
  const regionSummary: RegionSummary[] = useMemo(() => {
    if (!contacts || !leaders) return [];
    return activeMaterials.map(m => {
      const cityContacts = contacts.filter(c => c.cidade_id === m.city_id);
      const cityLeaders = leaders.filter(l => l.cidade_id === m.city_id);
      return {
        cidade_id: m.city_id,
        cidade_nome: m.office_cities?.nome || "Desconhecida",
        material_name: m.material_name,
        contacts_sms: cityContacts.filter(c => c.telefone_norm).length,
        contacts_email: cityContacts.filter(c => c.email && c.email !== "").length,
        leaders_sms: cityLeaders.filter(l => l.telefone).length,
        leaders_email: cityLeaders.filter(l => l.email && l.email !== "").length,
      };
    });
  }, [activeMaterials, contacts, leaders]);

  // Build recipients list
  const recipients: RecipientWithMaterial[] = useMemo(() => {
    const list: RecipientWithMaterial[] = [];
    if (!contacts || !leaders) return list;

    if (includeContacts) {
      contacts.forEach(c => {
        const mat = materialMap.get(c.cidade_id);
        if (!mat) return;
        const hasChannel = (sendSMS && c.telefone_norm) || (sendEmail && c.email && c.email !== "");
        if (hasChannel) {
          list.push({
            id: c.id,
            nome: c.nome,
            phone: c.telefone_norm || null,
            email: c.email,
            type: "contact",
            cidade_id: c.cidade_id,
            material_name: mat.material_name,
            material_url: mat.material_url,
          });
        }
      });
    }

    if (includeLeaders) {
      leaders.forEach(l => {
        const mat = materialMap.get(l.cidade_id);
        if (!mat) return;
        const hasChannel = (sendSMS && l.telefone) || (sendEmail && l.email && l.email !== "");
        if (hasChannel) {
          list.push({
            id: l.id,
            nome: l.nome_completo,
            phone: l.telefone || null,
            email: l.email,
            type: "leader",
            cidade_id: l.cidade_id,
            material_name: mat.material_name,
            material_url: mat.material_url,
          });
        }
      });
    }

    return list;
  }, [contacts, leaders, includeContacts, includeLeaders, sendSMS, sendEmail, materialMap]);

  // Calculate totals
  const totals = useMemo(() => {
    let sms = 0, email = 0;
    recipients.forEach(r => {
      if (sendSMS && r.phone) sms++;
      if (sendEmail && r.email && r.email !== "") email++;
    });
    return { sms, email, total: recipients.length };
  }, [recipients, sendSMS, sendEmail]);

  // Shorten URL helper
  const shortenUrl = async (url: string): Promise<string> => {
    try {
      const { data, error } = await supabase.functions.invoke("shorten-url", { body: { url } });
      if (error) throw error;
      return data.shortUrl;
    } catch {
      return url;
    }
  };

  // Dispatch handler
  const handleDispatch = async () => {
    if (recipients.length === 0) {
      toast.error("Nenhum destinatário para enviar");
      return;
    }
    if (!sendSMS && !sendEmail) {
      toast.error("Selecione pelo menos um canal de envio");
      return;
    }

    setIsSending(true);
    setIsComplete(false);
    setProgress({ current: 0, total: recipients.length, smsOk: 0, emailOk: 0, smsFail: 0, emailFail: 0 });

    // Shorten URLs for SMS (one per material)
    const shortenedUrls = new Map<string, string>();
    if (sendSMS) {
      toast.info("Encurtando links dos materiais para SMS...");
      for (const mat of activeMaterials) {
        const short = await shortenUrl(mat.material_url);
        shortenedUrls.set(mat.city_id, short);
      }
    }

    const batchSizeNum = batchSize === "all" ? recipients.length : parseInt(batchSize);
    let smsOk = 0, emailOk = 0, smsFail = 0, emailFail = 0;

    for (let i = 0; i < recipients.length; i++) {
      const r = recipients[i];

      // SMS dispatch
      if (sendSMS && r.phone) {
        try {
          const shortUrl = shortenedUrls.get(r.cidade_id) || r.material_url;
          const { error } = await supabase.functions.invoke("send-sms", {
            body: {
              phone: r.phone,
              templateSlug: "material-regiao-sms",
              variables: {
                nome: r.nome,
                material_nome: r.material_name,
                link_material: shortUrl,
              },
              ...(r.type === "contact" ? { contactId: r.id } : { leaderId: r.id }),
            },
          });
          if (error) { smsFail++; } else { smsOk++; }
        } catch { smsFail++; }
      }

      // Email dispatch
      if (sendEmail && r.email && r.email !== "") {
        try {
          const { error } = await supabase.functions.invoke("send-email", {
            body: {
              templateSlug: "material-regiao-email",
              to: r.email,
              toName: r.nome,
              variables: {
                nome: r.nome,
                material_nome: r.material_name,
                link_material: r.material_url,
              },
              ...(r.type === "contact" ? { contactId: r.id } : { leaderId: r.id }),
            },
          });
          if (error) { emailFail++; } else { emailOk++; }
        } catch { emailFail++; }
      }

      setProgress({ current: i + 1, total: recipients.length, smsOk, emailOk, smsFail, emailFail });

      // Delay between messages
      if (i < recipients.length - 1) {
        const delay = sendSMS ? Math.floor(Math.random() * 3000) + 2000 : 200;
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      // Pause between batches
      if ((i + 1) % batchSizeNum === 0 && i < recipients.length - 1 && batchSize !== "all") {
        setIsPaused(true);
        toast.success(`Lote ${Math.ceil((i + 1) / batchSizeNum)} concluído! Clique em Continuar.`);
        await new Promise<void>(resolve => {
          const check = setInterval(() => {
            // We'll use a ref-like approach via closure
          }, 100);
          (window as any).__resumeDispatch = () => {
            clearInterval(check);
            resolve();
          };
        });
        setIsPaused(false);
      }
    }

    setIsComplete(true);
    setIsSending(false);
    toast.success(`Disparo concluído! SMS: ${smsOk} ✓ ${smsFail} ✗ | Email: ${emailOk} ✓ ${emailFail} ✗`);
  };

  const handleContinueBatch = () => {
    if ((window as any).__resumeDispatch) {
      (window as any).__resumeDispatch();
    }
  };

  const isLoading = loadingMaterials || loadingContacts || loadingLeaders;
  const progressPercent = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;
  const estimatedMinutes = Math.ceil(recipients.length * (sendSMS ? 4 : 0.3) / 60);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Voltar
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Disparar Material por Região</h1>
          <p className="text-muted-foreground">Envio automático de materiais regionais via SMS e Email</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Carregando dados...</span>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Summary Table */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">Resumo por Região</CardTitle>
              <CardDescription>Destinatários com material cadastrado na sua região</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Região</TableHead>
                    <TableHead>Material</TableHead>
                    <TableHead className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Users className="h-3 w-3" /> SMS
                      </div>
                    </TableHead>
                    <TableHead className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Users className="h-3 w-3" /> Email
                      </div>
                    </TableHead>
                    <TableHead className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <UserCheck className="h-3 w-3" /> SMS
                      </div>
                    </TableHead>
                    <TableHead className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <UserCheck className="h-3 w-3" /> Email
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {regionSummary.map(r => (
                    <TableRow key={r.cidade_id}>
                      <TableCell className="font-medium">{r.cidade_nome}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">{r.material_name}</Badge>
                      </TableCell>
                      <TableCell className="text-center">{r.contacts_sms}</TableCell>
                      <TableCell className="text-center">{r.contacts_email}</TableCell>
                      <TableCell className="text-center">{r.leaders_sms}</TableCell>
                      <TableCell className="text-center">{r.leaders_email}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-bold border-t-2">
                    <TableCell>Total</TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-center">{regionSummary.reduce((s, r) => s + r.contacts_sms, 0)}</TableCell>
                    <TableCell className="text-center">{regionSummary.reduce((s, r) => s + r.contacts_email, 0)}</TableCell>
                    <TableCell className="text-center">{regionSummary.reduce((s, r) => s + r.leaders_sms, 0)}</TableCell>
                    <TableCell className="text-center">{regionSummary.reduce((s, r) => s + r.leaders_email, 0)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Controls */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Configuração</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Channels */}
                <div className="space-y-3">
                  <Label className="font-semibold">Canais de Envio</Label>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="send-sms"
                      checked={sendSMS}
                      onCheckedChange={(v) => setSendSMS(!!v)}
                      disabled={isSending}
                    />
                    <Label htmlFor="send-sms" className="flex items-center gap-1 cursor-pointer">
                      <MessageSquare className="h-4 w-4" /> SMS
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="send-email"
                      checked={sendEmail}
                      onCheckedChange={(v) => setSendEmail(!!v)}
                      disabled={isSending}
                    />
                    <Label htmlFor="send-email" className="flex items-center gap-1 cursor-pointer">
                      <Mail className="h-4 w-4" /> Email
                    </Label>
                  </div>
                </div>

                {/* Recipients */}
                <div className="space-y-3">
                  <Label className="font-semibold">Destinatários</Label>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="include-contacts"
                      checked={includeContacts}
                      onCheckedChange={(v) => setIncludeContacts(!!v)}
                      disabled={isSending}
                    />
                    <Label htmlFor="include-contacts" className="flex items-center gap-1 cursor-pointer">
                      <Users className="h-4 w-4" /> Contatos
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="include-leaders"
                      checked={includeLeaders}
                      onCheckedChange={(v) => setIncludeLeaders(!!v)}
                      disabled={isSending}
                    />
                    <Label htmlFor="include-leaders" className="flex items-center gap-1 cursor-pointer">
                      <UserCheck className="h-4 w-4" /> Líderes
                    </Label>
                  </div>
                </div>

                {/* Batch size */}
                <div className="space-y-2">
                  <Label className="font-semibold">Tamanho do Lote</Label>
                  <Select value={batchSize} onValueChange={setBatchSize} disabled={isSending}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BATCH_SIZE_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Summary */}
                <div className="rounded-lg border p-3 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Destinatários:</span>
                    <span className="font-medium">{totals.total}</span>
                  </div>
                  {sendSMS && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">SMS a enviar:</span>
                      <span className="font-medium">{totals.sms}</span>
                    </div>
                  )}
                  {sendEmail && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Emails a enviar:</span>
                      <span className="font-medium">{totals.email}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tempo estimado:</span>
                    <span className="font-medium">~{estimatedMinutes} min</span>
                  </div>
                </div>

                {/* Action buttons */}
                {!isSending && !isComplete && (
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={handleDispatch}
                    disabled={recipients.length === 0 || (!sendSMS && !sendEmail)}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Iniciar Disparo
                  </Button>
                )}

                {isPaused && (
                  <Button className="w-full" size="lg" onClick={handleContinueBatch}>
                    <Play className="h-4 w-4 mr-2" />
                    Continuar Próximo Lote
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Progress */}
            {(isSending || isComplete) && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    {isComplete ? (
                      <CheckCircle className="h-5 w-5 text-primary" />
                    ) : (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    )}
                    {isComplete ? "Concluído" : isPaused ? "Pausado" : "Enviando..."}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Progress value={progressPercent} className="h-3" />
                  <p className="text-sm text-center text-muted-foreground">
                    {progress.current} / {progress.total}
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {sendSMS && (
                      <>
                        <div className="flex items-center gap-1 text-primary">
                          <MessageSquare className="h-3 w-3" /> SMS OK: {progress.smsOk}
                        </div>
                        <div className="flex items-center gap-1 text-destructive">
                          <AlertTriangle className="h-3 w-3" /> SMS Falha: {progress.smsFail}
                        </div>
                      </>
                    )}
                    {sendEmail && (
                      <>
                        <div className="flex items-center gap-1 text-primary">
                          <Mail className="h-3 w-3" /> Email OK: {progress.emailOk}
                        </div>
                        <div className="flex items-center gap-1 text-destructive">
                          <AlertTriangle className="h-3 w-3" /> Email Falha: {progress.emailFail}
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {!isLoading && activeMaterials.length === 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Nenhum material de região ativo encontrado. Configure os materiais em <strong>Configurações → Materiais por Região</strong>.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
