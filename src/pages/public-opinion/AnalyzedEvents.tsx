import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { ANALYZED_EVENTS } from "@/data/public-opinion/demoPublicOpinionData";
import { useMonitoredEntities, usePoEvents, useCreatePoEvent } from "@/hooks/public-opinion/usePublicOpinion";
import { EntitySelector } from "@/components/public-opinion/EntitySelector";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Calendar, TrendingUp, TrendingDown, Eye, MessageSquare, Award, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

const EVENT_TYPES = [
  { value: "acao", label: "Ação Política" },
  { value: "fala", label: "Fala/Declaração" },
  { value: "legislacao", label: "Legislação" },
  { value: "campanha", label: "Campanha" },
  { value: "crise", label: "Crise" },
  { value: "inauguracao", label: "Inauguração" },
  { value: "entrevista", label: "Entrevista" },
  { value: "evento_publico", label: "Evento Público" },
];

const AnalyzedEvents = () => {
  const { data: entities } = useMonitoredEntities();
  const principalEntity = entities?.find(e => e.is_principal) || entities?.[0];
  const [selectedEntityId, setSelectedEntityId] = useState<string | undefined>(undefined);
  const resolvedEntityId = selectedEntityId || principalEntity?.id;

  const { data: poEvents } = usePoEvents(resolvedEntityId);
  const createEvent = useCreatePoEvent();

  const hasRealData = poEvents && poEvents.length > 0;

  // Create event dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    titulo: "",
    descricao: "",
    data_evento: new Date().toISOString().split("T")[0],
    tipo: "acao",
    tags: "",
    impacto_score: "",
  });

  const handleCreateEvent = async () => {
    if (!resolvedEntityId) return;
    if (!form.titulo.trim()) {
      toast.error("Título é obrigatório");
      return;
    }
    if (!form.data_evento) {
      toast.error("Data do evento é obrigatória");
      return;
    }
    await createEvent.mutateAsync({
      entity_id: resolvedEntityId,
      titulo: form.titulo.trim(),
      descricao: form.descricao.trim() || null,
      data_evento: new Date(form.data_evento).toISOString(),
      tipo: form.tipo,
      tags: form.tags.split(",").map(t => t.trim()).filter(Boolean),
      impacto_score: form.impacto_score ? parseFloat(form.impacto_score) : null,
      is_active: true,
    });
    setDialogOpen(false);
    setForm({ titulo: "", descricao: "", data_evento: new Date().toISOString().split("T")[0], tipo: "acao", tags: "", impacto_score: "" });
  };

  const eventsData = hasRealData
    ? poEvents.map(e => ({
        id: e.id,
        title: e.titulo,
        date: e.data_evento,
        type: e.tipo,
        mentions_before: 0,
        mentions_after: e.total_mentions,
        sentiment_before: 0.5,
        sentiment_after: e.sentiment_positivo_pct / 100,
        reach: e.total_mentions * 150,
        top_reaction: e.sentiment_positivo_pct > 60 ? 'Aprovação' : e.sentiment_negativo_pct > 40 ? 'Crítica' : 'Divisão',
        impact_score: e.impacto_score || 5,
        summary: e.descricao || e.ai_analysis || 'Sem descrição disponível.',
      }))
    : ANALYZED_EVENTS;

  const impactData = eventsData.map(e => ({
    name: e.title.substring(0, 20) + (e.title.length > 20 ? '...' : ''),
    impact: e.impact_score,
    mentions: e.mentions_after,
  }));

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <PageHeader icon={Calendar} title="Eventos Analisados" subtitle="Análise do impacto de eventos públicos na opinião popular">
          {!hasRealData && <Badge variant="outline">Demo</Badge>}
        </PageHeader>
        <div className="flex items-center gap-2">
          <EntitySelector value={resolvedEntityId} onChange={setSelectedEntityId} className="w-[200px]" />
          {resolvedEntityId && (
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Registrar Evento
            </Button>
          )}
        </div>
      </div>

      {/* Impact Chart */}
      {impactData.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Score de Impacto por Evento</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={impactData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" domain={[0, 10]} />
                  <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="impact" name="Score de Impacto" radius={[0, 4, 4, 0]}>
                    {impactData.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={
                          eventsData[i]?.impact_score >= 8 ? '#22c55e' :
                          eventsData[i]?.impact_score >= 6 ? '#f59e0b' : '#ef4444'
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Event Cards */}
      {eventsData.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p className="font-medium">Nenhum evento registrado</p>
            <p className="text-sm mt-1">Clique em "Registrar Evento" para adicionar eventos para análise de impacto.</p>
            {resolvedEntityId && (
              <Button className="mt-4" onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> Registrar Primeiro Evento
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {eventsData.map((event) => {
            const sentDiff = event.sentiment_after - event.sentiment_before;
            const mentionIncrease = event.mentions_before > 0
              ? ((event.mentions_after - event.mentions_before) / event.mentions_before * 100).toFixed(0)
              : event.mentions_after > 0 ? '∞' : '0';
            return (
              <Card key={event.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="capitalize">{event.type}</Badge>
                    <div className="flex items-center gap-1">
                      <Award className="h-4 w-4 text-primary" />
                      <span className="font-bold text-lg">{event.impact_score}/10</span>
                    </div>
                  </div>
                  <CardTitle className="text-lg">{event.title}</CardTitle>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {new Date(event.date).toLocaleDateString('pt-BR')}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 mb-4">{event.summary}</p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="flex items-center gap-1 text-muted-foreground mb-1">
                        <MessageSquare className="h-3 w-3" /> Menções
                      </div>
                      <p className="font-semibold">{event.mentions_before} → {event.mentions_after.toLocaleString()}</p>
                      <p className="text-xs text-green-600">+{mentionIncrease}%</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="flex items-center gap-1 text-muted-foreground mb-1">
                        {sentDiff >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        Sentimento
                      </div>
                      <p className="font-semibold">
                        {(event.sentiment_before * 100).toFixed(0)}% → {(event.sentiment_after * 100).toFixed(0)}%
                      </p>
                      <p className={`text-xs ${sentDiff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {sentDiff >= 0 ? '+' : ''}{(sentDiff * 100).toFixed(0)}pp
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="flex items-center gap-1 text-muted-foreground mb-1">
                        <Eye className="h-3 w-3" /> Alcance
                      </div>
                      <p className="font-semibold">{(event.reach / 1000).toFixed(0)}K</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="text-muted-foreground mb-1 text-xs">Reação Principal</div>
                      <Badge
                        variant={
                          event.top_reaction === 'Aprovação' ? 'default' :
                          event.top_reaction === 'Divisão' ? 'secondary' : 'outline'
                        }
                      >
                        {event.top_reaction}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Event Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Novo Evento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input
                value={form.titulo}
                onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                placeholder="Ex: Inauguração do hospital em Ceilândia"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Data do Evento *</Label>
                <Input
                  type="date"
                  value={form.data_evento}
                  onChange={e => setForm(f => ({ ...f, data_evento: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EVENT_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={form.descricao}
                onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                placeholder="Descreva o evento e seu contexto político..."
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tags (separadas por vírgula)</Label>
                <Input
                  value={form.tags}
                  onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
                  placeholder="saúde, inauguração"
                />
              </div>
              <div className="space-y-2">
                <Label>Score de Impacto (0-10)</Label>
                <Input
                  type="number"
                  min="0"
                  max="10"
                  step="0.1"
                  value={form.impacto_score}
                  onChange={e => setForm(f => ({ ...f, impacto_score: e.target.value }))}
                  placeholder="Ex: 7.5"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button onClick={handleCreateEvent} disabled={createEvent.isPending}>
              {createEvent.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AnalyzedEvents;
