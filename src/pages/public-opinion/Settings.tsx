import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMonitoredEntities, useCreateEntity } from "@/hooks/public-opinion/usePublicOpinion";
import { useUpdateEntity, useDeleteEntity, useCollectionConfigs, useUpsertCollectionConfig } from "@/hooks/public-opinion/usePublicOpinionSettings";
import { toast } from "sonner";
import { Plus, Trash2, Edit, Globe, Star, Users, Settings2, Loader2, RefreshCw } from "lucide-react";

const PublicOpinionSettings = () => {
  const { data: entities, isLoading } = useMonitoredEntities();
  const createEntity = useCreateEntity();
  const updateEntity = useUpdateEntity();
  const deleteEntity = useDeleteEntity();

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editEntity, setEditEntity] = useState<any | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    nome: "",
    tipo: "politico",
    partido: "",
    cargo: "",
    hashtags: "",
    palavras_chave: "",
    is_principal: false,
    redes_sociais: { twitter: "", instagram: "", facebook: "", youtube: "", tiktok: "", telegram: "" },
    influenciadores_ig: "",
    sites_customizados: "",
  });

  const resetForm = () => {
    setFormData({
      nome: "", tipo: "politico", partido: "", cargo: "", hashtags: "", palavras_chave: "",
      is_principal: false, redes_sociais: { twitter: "", instagram: "", facebook: "", youtube: "", tiktok: "", telegram: "" },
      influenciadores_ig: "", sites_customizados: "",
    });
  };

  const openEditDialog = (entity: any) => {
    setEditEntity(entity);
    setFormData({
      nome: entity.nome,
      tipo: entity.tipo,
      partido: entity.partido || "",
      cargo: entity.cargo || "",
      hashtags: (entity.hashtags || []).join(", "),
      palavras_chave: (entity.palavras_chave || []).join(", "),
      is_principal: entity.is_principal,
      redes_sociais: {
        twitter: entity.redes_sociais?.twitter || "",
        instagram: entity.redes_sociais?.instagram || "",
        facebook: entity.redes_sociais?.facebook || "",
        youtube: entity.redes_sociais?.youtube || "",
        tiktok: entity.redes_sociais?.tiktok || "",
        telegram: entity.redes_sociais?.telegram || "",
      },
      influenciadores_ig: entity.redes_sociais?.influenciadores_ig || "",
      sites_customizados: entity.redes_sociais?.sites_customizados || "",
    });
  };

  const handleSave = async () => {
    if (!formData.nome.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    const payload = {
      nome: formData.nome.trim(),
      tipo: formData.tipo,
      partido: formData.partido.trim() || null,
      cargo: formData.cargo.trim() || null,
      hashtags: formData.hashtags.split(",").map(h => h.trim()).filter(Boolean),
      palavras_chave: formData.palavras_chave.split(",").map(k => k.trim()).filter(Boolean),
      is_principal: formData.is_principal,
      redes_sociais: {
        ...Object.fromEntries(
          Object.entries(formData.redes_sociais).filter(([, v]) => v.trim())
        ),
        ...(formData.influenciadores_ig.trim() ? { influenciadores_ig: formData.influenciadores_ig.trim() } : {}),
        ...(formData.sites_customizados.trim() ? { sites_customizados: formData.sites_customizados.trim() } : {}),
      },
    };

    if (editEntity) {
      await updateEntity.mutateAsync({ id: editEntity.id, ...payload });
      setEditEntity(null);
    } else {
      await createEntity.mutateAsync(payload);
      setAddDialogOpen(false);
    }
    resetForm();
  };

  const handleDelete = async (id: string) => {
    if (confirm("Tem certeza que deseja desativar esta entidade?")) {
      await deleteEntity.mutateAsync(id);
    }
  };

  const principalEntity = entities?.find(e => e.is_principal);

  const entityFormContent = (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Nome *</Label>
          <Input value={formData.nome} onChange={e => setFormData(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Rafael Prudente" />
        </div>
        <div className="space-y-2">
          <Label>Tipo</Label>
          <Select value={formData.tipo} onValueChange={v => setFormData(f => ({ ...f, tipo: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="politico">Político</SelectItem>
              <SelectItem value="adversario">Adversário</SelectItem>
              <SelectItem value="partido">Partido</SelectItem>
              <SelectItem value="tema">Tema/Pauta</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Partido</Label>
          <Input value={formData.partido} onChange={e => setFormData(f => ({ ...f, partido: e.target.value }))} placeholder="Ex: MDB" />
        </div>
        <div className="space-y-2">
          <Label>Cargo</Label>
          <Input value={formData.cargo} onChange={e => setFormData(f => ({ ...f, cargo: e.target.value }))} placeholder="Ex: Deputado Distrital" />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Hashtags (separadas por vírgula)</Label>
        <Input value={formData.hashtags} onChange={e => setFormData(f => ({ ...f, hashtags: e.target.value }))} placeholder="#RafaelPrudente, #BrasíliaAvança" />
      </div>

      <div className="space-y-2">
        <Label>Palavras-chave (separadas por vírgula)</Label>
        <Input value={formData.palavras_chave} onChange={e => setFormData(f => ({ ...f, palavras_chave: e.target.value }))} placeholder="Rafael Prudente, Prudente, deputado" />
      </div>

      <Separator />
      <h4 className="font-medium text-sm">Redes Sociais (perfis)</h4>
      <div className="grid grid-cols-2 gap-3">
        {(['twitter', 'instagram', 'facebook', 'youtube', 'tiktok', 'telegram'] as const).map(rede => (
          <div key={rede} className="space-y-1">
            <Label className="text-xs capitalize">{rede === 'twitter' ? 'X (Twitter)' : rede === 'telegram' ? 'Telegram (canais)' : rede}</Label>
            <Input
              value={formData.redes_sociais[rede]}
              onChange={e => setFormData(f => ({ ...f, redes_sociais: { ...f.redes_sociais, [rede]: e.target.value } }))}
              placeholder={`@usuario_${rede}`}
              className="text-sm"
            />
          </div>
        ))}
      </div>

      <Separator />
      <h4 className="font-medium text-sm">Influenciadores Instagram (perfis de terceiros)</h4>
      <div className="space-y-2">
        <Label className="text-xs">Perfis separados por vírgula (ex: @radiocorredordf, @vicenzodf)</Label>
        <Input
          value={formData.influenciadores_ig}
          onChange={e => setFormData(f => ({ ...f, influenciadores_ig: e.target.value }))}
          placeholder="@radiocorredordf, @vicenzodf, @diariodeceilandia"
          className="text-sm"
        />
        <p className="text-xs text-muted-foreground">O sistema buscará posts que citem ou marquem as entidades monitoradas e coletará os comentários.</p>
      </div>

      <Separator />
      <h4 className="font-medium text-sm">Sites Personalizados (URLs para monitorar)</h4>
      <div className="space-y-2">
        <Label className="text-xs">URLs separadas por vírgula</Label>
        <Input
          value={formData.sites_customizados}
          onChange={e => setFormData(f => ({ ...f, sites_customizados: e.target.value }))}
          placeholder="https://radiocorredor.com.br/, https://veronoticias.com/politica/"
          className="text-sm"
        />
        <p className="text-xs text-muted-foreground">O sistema raspará esses sites buscando menções às entidades monitoradas.</p>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <Switch checked={formData.is_principal} onCheckedChange={v => setFormData(f => ({ ...f, is_principal: v }))} />
        <Label>Entidade principal (seu candidato/político)</Label>
      </div>
    </div>
  );

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings2 className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Configurações — Opinião Pública</h1>
            <p className="text-gray-500 mt-1">Gerencie as entidades monitoradas e configurações de coleta</p>
          </div>
        </div>
      </div>

      {/* Principal Entity highlight */}
      {principalEntity && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center text-white text-xl font-bold">
                {principalEntity.nome.charAt(0)}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-lg">{principalEntity.nome}</h3>
                  <Badge className="bg-primary/20 text-primary border-0"><Star className="h-3 w-3 mr-1" /> Principal</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {principalEntity.partido && `${principalEntity.partido} • `}
                  {principalEntity.cargo && `${principalEntity.cargo} • `}
                  {(principalEntity.palavras_chave || []).length} palavras-chave • {(principalEntity.hashtags || []).length} hashtags
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => openEditDialog(principalEntity)}>
                <Edit className="h-4 w-4 mr-1" /> Editar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Entities List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Entidades Monitoradas</CardTitle>
              <CardDescription>Políticos, adversários e temas que o sistema monitora na mídia</CardDescription>
            </div>
            <Dialog open={addDialogOpen} onOpenChange={v => { setAddDialogOpen(v); if (!v) resetForm(); }}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Adicionar</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Nova Entidade Monitorada</DialogTitle></DialogHeader>
                {entityFormContent}
                <DialogFooter>
                  <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
                  <Button onClick={handleSave} disabled={createEntity.isPending}>
                    {createEntity.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Cadastrar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !entities || entities.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Globe className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">Nenhuma entidade cadastrada</p>
              <p className="text-sm mt-1">Adicione a primeira entidade para começar o monitoramento</p>
            </div>
          ) : (
            <div className="space-y-3">
              {entities.map(entity => (
                <div key={entity.id} className="flex items-center gap-4 border rounded-lg p-4">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center font-bold text-sm">
                    {entity.nome.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{entity.nome}</span>
                      {entity.is_principal && <Badge variant="default" className="text-xs">Principal</Badge>}
                      <Badge variant="outline" className="text-xs capitalize">{entity.tipo}</Badge>
                      {entity.partido && <Badge variant="secondary" className="text-xs">{entity.partido}</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {(entity.palavras_chave || []).slice(0, 3).join(", ")}
                      {(entity.hashtags || []).length > 0 && ` • ${(entity.hashtags || []).slice(0, 2).join(", ")}`}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(entity)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(entity.id)} className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Collection Configs */}
      {principalEntity && <CollectionConfigCard entityId={principalEntity.id} />}

      {/* Edit Dialog */}
      <Dialog open={!!editEntity} onOpenChange={v => { if (!v) { setEditEntity(null); resetForm(); } }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Editar Entidade</DialogTitle></DialogHeader>
          {entityFormContent}
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={handleSave} disabled={updateEntity.isPending}>
              {updateEntity.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Collection configuration sub-component
const INTERVAL_OPTIONS = [
  { value: 30, label: '30 min' },
  { value: 60, label: '1 hora' },
  { value: 120, label: '2 horas' },
  { value: 360, label: '6 horas' },
  { value: 720, label: '12 horas' },
  { value: 1440, label: '24 horas' },
];

function CollectionConfigCard({ entityId }: { entityId: string }) {
  const { data: configs, isLoading } = useCollectionConfigs(entityId);
  const upsertConfig = useUpsertCollectionConfig();

  const providers = [
    { key: 'zenscrape', label: 'Zenscrape (Notícias)', description: 'Coleta menções em portais de notícias via Bing/Yahoo News' },
    { key: 'datastream', label: 'Datastream (Redes Sociais)', description: 'Coleta menções em Twitter, Instagram, Facebook, etc.' },
  ];

  const getConfig = (provider: string) => configs?.find(c => c.provider === provider);

  const toggleProvider = async (provider: string, enabled: boolean) => {
    const existing = getConfig(provider);
    await upsertConfig.mutateAsync({
      id: existing?.id,
      entity_id: entityId,
      provider,
      is_active: enabled,
      run_interval_minutes: existing?.run_interval_minutes || 60,
    });
  };

  const updateInterval = async (provider: string, interval: number) => {
    const existing = getConfig(provider);
    await upsertConfig.mutateAsync({
      id: existing?.id,
      entity_id: entityId,
      provider,
      is_active: existing?.is_active ?? false,
      run_interval_minutes: interval,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><RefreshCw className="h-5 w-5" /> Configuração de Coleta</CardTitle>
        <CardDescription>Configure os provedores de dados e a frequência de coleta automática</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin mx-auto" />
        ) : (
          <div className="space-y-4">
            {providers.map(p => {
              const config = getConfig(p.key);
              const isActive = config?.is_active ?? false;
              const currentInterval = config?.run_interval_minutes || 60;
              return (
                <div key={p.key} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">{p.label}</h4>
                      <p className="text-sm text-muted-foreground">{p.description}</p>
                      {config?.last_run_at && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Última coleta: {new Date(config.last_run_at).toLocaleString('pt-BR')}
                          {config.last_error && <span className="text-destructive ml-2">Erro: {config.last_error}</span>}
                        </p>
                      )}
                    </div>
                    <Switch checked={isActive} onCheckedChange={v => toggleProvider(p.key, v)} />
                  </div>
                  {isActive && (
                    <div className="flex items-center gap-3">
                      <Label className="text-xs text-muted-foreground whitespace-nowrap">Frequência:</Label>
                      <div className="flex gap-1 flex-wrap">
                        {INTERVAL_OPTIONS.map(opt => (
                          <Button
                            key={opt.value}
                            variant={currentInterval === opt.value ? "default" : "outline"}
                            size="sm"
                            className="h-7 text-xs px-2"
                            onClick={() => updateInterval(p.key, opt.value)}
                            disabled={upsertConfig.isPending}
                          >
                            {opt.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            <Card className="border-dashed">
              <CardContent className="pt-4 text-center text-sm text-muted-foreground">
                <p>As API keys dos provedores (Zenscrape, Datastream) são configuradas como secrets do projeto.</p>
                <p className="mt-1">A coleta pode ser acionada manualmente pelo botão "Coletar Menções" na Visão Geral.</p>
              </CardContent>
            </Card>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default PublicOpinionSettings;
