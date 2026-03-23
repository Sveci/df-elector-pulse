import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Plus, Search, ChevronRight, Copy, Trash2, Pencil,
  CheckCircle2, Circle, Clock, Zap, GitBranch, Layers
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ChatbotFlow } from "@/hooks/useWhatsAppFlows";
import {
  useChatbotFlows,
  useCreateChatbotFlow,
  useDeleteChatbotFlow,
  useDuplicateChatbotFlow,
  useUpdateChatbotFlow,
  DEFAULT_FLOW_TEMPLATES,
} from "@/hooks/useWhatsAppFlows";
import { cn } from "@/lib/utils";

interface FlowsSidebarProps {
  activeFlowId: string | null;
  onSelectFlow: (flow: ChatbotFlow) => void;
}

const ICON_MAP: Record<string, string> = {
  "👋": "👋",
  "🤖": "🤖",
  "⚡": "⚡",
  "🔑": "🔑",
  "📋": "📋",
  "🎯": "🎯",
};

const COLOR_OPTIONS = [
  "#22c55e", "#3b82f6", "#8b5cf6", "#f59e0b",
  "#ef4444", "#06b6d4", "#ec4899", "#6b7280",
];

export function FlowsSidebar({ activeFlowId, onSelectFlow }: FlowsSidebarProps) {
  const [search, setSearch] = useState("");
  const [newFlowOpen, setNewFlowOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editFlow, setEditFlow] = useState<ChatbotFlow | null>(null);
  const [newForm, setNewForm] = useState({
    name: "",
    description: "",
    color: "#3b82f6",
    icon: "📋",
  });

  const { data: flows = [], isLoading } = useChatbotFlows();
  const create = useCreateChatbotFlow();
  const del = useDeleteChatbotFlow();
  const duplicate = useDuplicateChatbotFlow();
  const update = useUpdateChatbotFlow();

  const filtered = flows.filter(
    (f) =>
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      (f.description || "").toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = () => {
    create.mutate(
      {
        name: newForm.name || "Novo Fluxo",
        description: newForm.description || null,
        is_active: true,
        is_published: false,
        nodes: [],
        edges: [],
        version: 1,
        tags: [],
        color: newForm.color,
        icon: newForm.icon,
      },
      {
        onSuccess: (flow) => {
          setNewFlowOpen(false);
          setNewForm({ name: "", description: "", color: "#3b82f6", icon: "📋" });
          onSelectFlow(flow);
        },
      }
    );
  };

  const handleFromTemplate = (tpl: typeof DEFAULT_FLOW_TEMPLATES[0]) => {
    const { templateName: _t, ...rest } = tpl;
    create.mutate(
      {
        ...rest,
        name: rest.name || "Fluxo",
        description: rest.description || null,
        is_active: rest.is_active ?? true,
        is_published: false,
        nodes: rest.nodes || [],
        edges: rest.edges || [],
        version: 1,
        tags: rest.tags || [],
        color: rest.color || "#3b82f6",
        icon: rest.icon || "📋",
      } as any,
      {
        onSuccess: (flow) => {
          setNewFlowOpen(false);
          onSelectFlow(flow);
        },
      }
    );
  };

  const handleSaveEdit = () => {
    if (!editFlow) return;
    update.mutate(
      { id: editFlow.id, name: editFlow.name, description: editFlow.description, color: editFlow.color, icon: editFlow.icon },
      { onSuccess: () => setEditFlow(null) }
    );
  };

  return (
    <div className="h-full flex flex-col w-[320px] flex-shrink-0 border-r bg-background overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-sm">Fluxos Salvos</h2>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {flows.length}
            </Badge>
          </div>
          <Button size="sm" onClick={() => setNewFlowOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Novo
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar fluxo..."
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      {/* List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {isLoading && (
            <div className="space-y-2 p-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          )}

          {!isLoading && filtered.length === 0 && (
            <div className="py-10 text-center text-muted-foreground">
              <GitBranch className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhum fluxo encontrado</p>
              <p className="text-xs mt-1">Crie um novo fluxo para começar</p>
            </div>
          )}

          {filtered.map((flow) => (
            <FlowCard
              key={flow.id}
              flow={flow}
              active={flow.id === activeFlowId}
              onSelect={() => onSelectFlow(flow)}
              onDuplicate={() => duplicate.mutate(flow, { onSuccess: onSelectFlow })}
              onDelete={() => setDeleteId(flow.id)}
              onEdit={() => setEditFlow(flow)}
              onToggleActive={() =>
                update.mutate({ id: flow.id, is_active: !flow.is_active })
              }
            />
          ))}
        </div>
      </ScrollArea>

      {/* ─── New Flow Dialog ─── */}
      <Dialog open={newFlowOpen} onOpenChange={setNewFlowOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Criar Novo Fluxo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Templates */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                Começar com modelo
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {DEFAULT_FLOW_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.templateName}
                    onClick={() => handleFromTemplate(tpl)}
                    className="p-3 rounded-lg border text-left hover:bg-accent transition-colors"
                    style={{ borderColor: tpl.color + "60" }}
                  >
                    <div className="text-lg mb-1">{tpl.icon}</div>
                    <p className="text-xs font-semibold">{tpl.templateName}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{tpl.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                Ou criar em branco
              </Label>
              <div className="space-y-1.5">
                <Label>Nome</Label>
                <Input
                  value={newForm.name}
                  onChange={(e) => setNewForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Fluxo de Cadastro"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Descrição</Label>
                <Textarea
                  value={newForm.description}
                  onChange={(e) => setNewForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Descreva o objetivo deste fluxo..."
                  rows={2}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Cor</Label>
                <div className="flex gap-2">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c}
                      className={cn(
                        "w-6 h-6 rounded-full border-2 transition-transform",
                        newForm.color === c ? "border-foreground scale-125" : "border-transparent"
                      )}
                      style={{ background: c }}
                      onClick={() => setNewForm((f) => ({ ...f, color: c }))}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewFlowOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={create.isPending}>
              {create.isPending ? "Criando…" : "Criar Fluxo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Edit Dialog ─── */}
      {editFlow && (
        <Dialog open onOpenChange={() => setEditFlow(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Editar Fluxo</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label>Nome</Label>
                <Input
                  value={editFlow.name}
                  onChange={(e) => setEditFlow((f) => f ? { ...f, name: e.target.value } : f)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Descrição</Label>
                <Textarea
                  value={editFlow.description || ""}
                  onChange={(e) => setEditFlow((f) => f ? { ...f, description: e.target.value } : f)}
                  rows={2}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Cor</Label>
                <div className="flex gap-2">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c}
                      className={cn(
                        "w-6 h-6 rounded-full border-2 transition-transform",
                        editFlow.color === c ? "border-foreground scale-125" : "border-transparent"
                      )}
                      style={{ background: c }}
                      onClick={() => setEditFlow((f) => f ? { ...f, color: c } : f)}
                    />
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditFlow(null)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveEdit} disabled={update.isPending}>
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ─── Delete Alert ─── */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir fluxo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O fluxo e todas as configurações serão removidos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/80"
              onClick={() => {
                if (deleteId) del.mutate(deleteId);
                setDeleteId(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Flow Card ────────────────────────────────────────────────────────────────

interface FlowCardProps {
  flow: ChatbotFlow;
  active: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onToggleActive: () => void;
}

function FlowCard({ flow, active, onSelect, onDuplicate, onDelete, onEdit, onToggleActive }: FlowCardProps) {
  const nodeCount = flow.nodes?.length || 0;
  const edgeCount = flow.edges?.length || 0;

  return (
    <div
      className={cn(
        "group relative rounded-lg border p-3 cursor-pointer transition-all",
        active
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-border hover:border-primary/40 hover:bg-accent/50"
      )}
      onClick={onSelect}
      style={active ? { borderColor: flow.color || undefined } : undefined}
    >
      {/* Color dot + icon + name */}
      <div className="flex items-start gap-2">
        <div
          className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
          style={{ background: flow.color || "#6b7280" }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm">{flow.icon || "📋"}</span>
            <p className="font-medium text-sm truncate">{flow.name}</p>
          </div>
          {flow.description && (
            <p className="text-[11px] text-muted-foreground truncate mt-0.5">
              {flow.description}
            </p>
          )}
          {/* Stats */}
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[10px] text-muted-foreground">
              {nodeCount} nós · {edgeCount} conexões
            </span>
          </div>
          {/* Badges */}
          <div className="flex flex-wrap gap-1 mt-1.5">
            {flow.is_published ? (
              <Badge className="bg-green-100 text-green-700 text-[10px] px-1.5 py-0 border-0">
                <CheckCircle2 className="h-2.5 w-2.5 mr-1" /> Publicado
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                <Circle className="h-2.5 w-2.5 mr-1" /> Rascunho
              </Badge>
            )}
            {!flow.is_active && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 opacity-60">
                Inativo
              </Badge>
            )}
          </div>
          {/* Updated at */}
          <p className="text-[10px] text-muted-foreground/60 mt-1.5 flex items-center gap-1">
            <Clock className="h-2.5 w-2.5" />
            {format(new Date(flow.updated_at), "dd/MM/yy HH:mm", { locale: ptBR })}
          </p>
        </div>

        {/* Actions dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <ChevronRight className="h-3.5 w-3.5 rotate-90" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }}>
              <Pencil className="h-3.5 w-3.5 mr-2" /> Renomear
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onToggleActive(); }}>
              <Zap className="h-3.5 w-3.5 mr-2" />
              {flow.is_active ? "Desativar" : "Ativar"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDuplicate(); }}>
              <Copy className="h-3.5 w-3.5 mr-2" /> Duplicar
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
            >
              <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Active indicator */}
      {active && (
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full"
          style={{ background: flow.color || "hsl(var(--primary))" }}
        />
      )}
    </div>
  );
}
