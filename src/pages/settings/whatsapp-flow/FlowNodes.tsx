import { Handle, Position, NodeProps, useReactFlow } from "@xyflow/react";
import { cn } from "@/lib/utils";
import {
  Zap, MessageSquare, Brain, Settings2, GitBranch,
  Clock, XCircle, Hash, Play, X
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { FlowNodeData, FlowNodeType } from "@/hooks/useWhatsAppFlows";

// ─── Node Configs ──────────────────────────────────────────────────────────────

export const NODE_CONFIG: Record<FlowNodeType, {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bg: string;
  border: string;
  handleColor: string;
  description: string;
}> = {
  trigger: {
    label: "Gatilho",
    icon: Play,
    color: "text-emerald-600",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    border: "border-emerald-300 dark:border-emerald-700",
    handleColor: "#10b981",
    description: "Inicia o fluxo",
  },
  keyword: {
    label: "Palavra-Chave",
    icon: Hash,
    color: "text-blue-600",
    bg: "bg-blue-50 dark:bg-blue-950/40",
    border: "border-blue-300 dark:border-blue-700",
    handleColor: "#3b82f6",
    description: "Detecta palavra ou comando",
  },
  message: {
    label: "Mensagem",
    icon: MessageSquare,
    color: "text-sky-600",
    bg: "bg-sky-50 dark:bg-sky-950/40",
    border: "border-sky-300 dark:border-sky-700",
    handleColor: "#0ea5e9",
    description: "Envia mensagem ao usuário",
  },
  ai_response: {
    label: "Resposta IA",
    icon: Brain,
    color: "text-purple-600",
    bg: "bg-purple-50 dark:bg-purple-950/40",
    border: "border-purple-300 dark:border-purple-700",
    handleColor: "#8b5cf6",
    description: "Gera resposta via IA",
  },
  automation: {
    label: "Automação",
    icon: Zap,
    color: "text-amber-600",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    border: "border-amber-300 dark:border-amber-700",
    handleColor: "#f59e0b",
    description: "Executa função dinâmica",
  },
  condition: {
    label: "Condição",
    icon: GitBranch,
    color: "text-orange-600",
    bg: "bg-orange-50 dark:bg-orange-950/40",
    border: "border-orange-300 dark:border-orange-700",
    handleColor: "#f97316",
    description: "Bifurcação lógica",
  },
  delay: {
    label: "Espera",
    icon: Clock,
    color: "text-slate-600",
    bg: "bg-slate-50 dark:bg-slate-950/40",
    border: "border-slate-300 dark:border-slate-700",
    handleColor: "#64748b",
    description: "Pausa antes de continuar",
  },
  end: {
    label: "Fim",
    icon: XCircle,
    color: "text-rose-600",
    bg: "bg-rose-50 dark:bg-rose-950/40",
    border: "border-rose-300 dark:border-rose-700",
    handleColor: "#f43f5e",
    description: "Encerra o fluxo",
  },
};

// ─── Shared Node Shell ─────────────────────────────────────────────────────────

interface NodeShellProps {
  nodeId: string;
  type: FlowNodeType;
  data: FlowNodeData;
  selected?: boolean;
  showTargetHandle?: boolean;
  showSourceHandle?: boolean;
  showTrueHandle?: boolean;
  showFalseHandle?: boolean;
  children?: React.ReactNode;
}

export function NodeShell({
  nodeId,
  type,
  data,
  selected,
  showTargetHandle = true,
  showSourceHandle = true,
  showTrueHandle = false,
  showFalseHandle = false,
  children,
}: NodeShellProps) {
  const cfg = NODE_CONFIG[type];
  const Icon = cfg.icon;
  const { deleteElements } = useReactFlow();

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteElements({ nodes: [{ id: nodeId }] });
  };

  return (
    <div
      className={cn(
        "group relative rounded-xl border-2 shadow-md min-w-[220px] max-w-[280px] transition-all duration-150",
        cfg.bg,
        cfg.border,
        selected && "ring-2 ring-offset-1 ring-primary shadow-lg scale-[1.02]"
      )}
    >
      {/* Delete button - visible on hover */}
      <button
        onClick={handleDelete}
        className="absolute -top-2 -right-2 z-10 hidden group-hover:flex items-center justify-center h-5 w-5 rounded-full bg-destructive text-destructive-foreground shadow-md hover:scale-110 transition-transform"
        title="Remover nó"
      >
        <X className="h-3 w-3" />
      </button>

      {/* Target handle (input) */}
      {showTargetHandle && (
        <Handle
          type="target"
          position={Position.Left}
          style={{ background: cfg.handleColor, width: 12, height: 12, border: "2px solid white" }}
        />
      )}

      {/* Header */}
      <div className={cn("flex items-center gap-2 px-3 py-2 border-b", cfg.border)}>
        <Icon className={cn("h-4 w-4 flex-shrink-0", cfg.color)} />
        <span className={cn("text-xs font-semibold uppercase tracking-wide", cfg.color)}>
          {cfg.label}
        </span>
        {data.isActive === false && (
          <Badge variant="outline" className="ml-auto text-[9px] px-1 py-0 opacity-70">
            Inativo
          </Badge>
        )}
      </div>

      {/* Content */}
      <div className="px-3 py-2 space-y-1">
        <p className="text-sm font-medium text-foreground leading-tight truncate" title={data.label}>
          {data.label || cfg.description}
        </p>
        {children}
        {data.description && (
          <p className="text-[11px] text-muted-foreground truncate" title={data.description}>
            {data.description}
          </p>
        )}
      </div>

      {/* Source handles */}
      {showSourceHandle && !showTrueHandle && (
        <Handle
          type="source"
          position={Position.Right}
          style={{ background: cfg.handleColor, width: 12, height: 12, border: "2px solid white" }}
        />
      )}
      {showTrueHandle && (
        <Handle
          id="true"
          type="source"
          position={Position.Right}
          style={{ background: "#22c55e", width: 12, height: 12, border: "2px solid white", top: "35%" }}
        />
      )}
      {showFalseHandle && (
        <Handle
          id="false"
          type="source"
          position={Position.Right}
          style={{ background: "#ef4444", width: 12, height: 12, border: "2px solid white", top: "65%" }}
        />
      )}
    </div>
  );
}

// ─── Individual Node Components ────────────────────────────────────────────────

export function TriggerNode({ data, selected }: NodeProps) {
  const d = data as FlowNodeData;
  const triggerLabels: Record<string, string> = {
    any_message: "Qualquer mensagem",
    first_contact: "Primeiro contato",
    keyword: "Palavra-chave específica",
    schedule: "Agendado",
  };
  return (
    <NodeShell type="trigger" data={d} selected={selected} showTargetHandle={false}>
      <span className="text-[11px] text-muted-foreground">
        {triggerLabels[d.triggerType || "any_message"]}
      </span>
    </NodeShell>
  );
}

export function KeywordNode({ data, selected }: NodeProps) {
  const d = data as FlowNodeData;
  return (
    <NodeShell type="keyword" data={d} selected={selected}>
      <div className="flex flex-wrap gap-1 mt-0.5">
        <Badge variant="secondary" className="text-[10px] font-mono px-1.5 py-0">
          {d.keyword || "..."}
        </Badge>
        {(d.aliases || []).slice(0, 2).map((a) => (
          <Badge key={a} variant="outline" className="text-[10px] font-mono px-1 py-0 opacity-70">
            {a}
          </Badge>
        ))}
        {(d.aliases || []).length > 2 && (
          <Badge variant="outline" className="text-[10px] px-1 py-0 opacity-70">
            +{(d.aliases || []).length - 2}
          </Badge>
        )}
      </div>
    </NodeShell>
  );
}

export function MessageNode({ data, selected }: NodeProps) {
  const d = data as FlowNodeData;
  const preview = (d.messageText || "").slice(0, 80);
  return (
    <NodeShell type="message" data={d} selected={selected}>
      <p className="text-[11px] text-muted-foreground line-clamp-2 whitespace-pre-wrap">
        {preview || "Sem mensagem definida"}
        {(d.messageText || "").length > 80 ? "…" : ""}
      </p>
      {d.mediaType && (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 mt-0.5">
          📎 {d.mediaType}
        </Badge>
      )}
    </NodeShell>
  );
}

export function AiResponseNode({ data, selected }: NodeProps) {
  const d = data as FlowNodeData;
  return (
    <NodeShell type="ai_response" data={d} selected={selected}>
      <div className="flex gap-1 flex-wrap mt-0.5">
        {d.useKnowledgeBase && (
          <Badge className="bg-purple-100 text-purple-700 text-[10px] px-1.5 py-0 border-0">
            Base de Conhecimento
          </Badge>
        )}
        {d.aiModel && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {d.aiModel}
          </Badge>
        )}
      </div>
      {d.aiPrompt && (
        <p className="text-[11px] text-muted-foreground truncate mt-0.5" title={d.aiPrompt}>
          {d.aiPrompt.slice(0, 60)}…
        </p>
      )}
    </NodeShell>
  );
}

export function AutomationNode({ data, selected }: NodeProps) {
  const d = data as FlowNodeData;
  const fnLabels: Record<string, string> = {
    minha_arvore: "Minha Árvore",
    meus_cadastros: "Meus Cadastros",
    minha_pontuacao: "Minha Pontuação",
    minha_posicao: "Minha Posição",
    meus_subordinados: "Meus Subordinados",
    pendentes: "Pendentes",
    ajuda: "Ajuda",
  };
  return (
    <NodeShell type="automation" data={d} selected={selected}>
      <Badge className="bg-amber-100 text-amber-700 text-[10px] px-1.5 py-0 border-0 mt-0.5">
        ⚡ {fnLabels[d.automationFunction || ""] || d.automationFunction || "Selecione a função"}
      </Badge>
    </NodeShell>
  );
}

export function ConditionNode({ data, selected }: NodeProps) {
  const d = data as FlowNodeData;
  const opLabels: Record<string, string> = {
    equals: "=",
    contains: "contém",
    starts_with: "começa com",
    regex: "regex",
    is_empty: "vazio",
    is_not_empty: "não vazio",
  };
  return (
    <NodeShell type="condition" data={d} selected={selected} showTrueHandle showFalseHandle showSourceHandle={false}>
      <p className="text-[11px] text-muted-foreground mt-0.5">
        <span className="font-mono text-orange-600">{d.conditionField || "campo"}</span>
        {" "}{opLabels[d.conditionOperator || "equals"] || "="}{" "}
        <span className="font-mono">{d.conditionValue || "valor"}</span>
      </p>
      <div className="flex gap-2 mt-1">
        <Badge className="bg-green-100 text-green-700 text-[10px] px-1.5 py-0 border-0">✓ Sim</Badge>
        <Badge className="bg-red-100 text-red-700 text-[10px] px-1.5 py-0 border-0">✗ Não</Badge>
      </div>
    </NodeShell>
  );
}

export function DelayNode({ data, selected }: NodeProps) {
  const d = data as FlowNodeData;
  const secs = d.delaySeconds || 0;
  const display = secs >= 60 ? `${Math.round(secs / 60)}min` : `${secs}s`;
  return (
    <NodeShell type="delay" data={d} selected={selected}>
      <p className="text-[11px] text-muted-foreground mt-0.5">
        ⏱ Aguardar <span className="font-semibold text-foreground">{display}</span>
      </p>
    </NodeShell>
  );
}

export function EndNode({ data, selected }: NodeProps) {
  const d = data as FlowNodeData;
  const endLabels: Record<string, string> = {
    close: "Encerrar conversa",
    transfer_human: "Transferir para humano",
    restart: "Reiniciar fluxo",
    nothing: "Aguardar próxima mensagem",
  };
  return (
    <NodeShell type="end" data={d} selected={selected} showSourceHandle={false}>
      <p className="text-[11px] text-muted-foreground mt-0.5">
        {endLabels[d.endAction || "nothing"]}
      </p>
      {d.endMessage && (
        <p className="text-[10px] text-muted-foreground/70 truncate">{d.endMessage}</p>
      )}
    </NodeShell>
  );
}

// ─── nodeTypes map (stable reference — defined outside component) ─────────────

export const nodeTypes = {
  trigger: TriggerNode,
  keyword: KeywordNode,
  message: MessageNode,
  ai_response: AiResponseNode,
  automation: AutomationNode,
  condition: ConditionNode,
  delay: DelayNode,
  end: EndNode,
};
