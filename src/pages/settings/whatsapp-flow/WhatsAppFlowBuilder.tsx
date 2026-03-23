import "@xyflow/react/dist/style.css";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  Panel,
  type Connection,
  type Edge,
  type Node,
  BackgroundVariant,
  MarkerType,
} from "@xyflow/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Bot, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { TooltipProvider } from "@/components/ui/tooltip";
import { toast } from "sonner";

import { nodeTypes } from "./FlowNodes";
import { FlowsSidebar } from "./FlowsSidebar";
import { FlowToolbar } from "./FlowToolbar";
import { NodeConfigPanel } from "./NodeConfigPanel";

import type { ChatbotFlow, FlowNodeType, FlowNodeData } from "@/hooks/useWhatsAppFlows";
import {
  useUpdateChatbotFlow,
  usePublishChatbotFlow,
} from "@/hooks/useWhatsAppFlows";

// ─── Edge style helper ─────────────────────────────────────────────────────────

const edgeOptions = {
  type: "smoothstep",
  animated: false,
  markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
  style: { strokeWidth: 2, stroke: "#94a3b8" },
};

// ─── Counter for unique node ids ───────────────────────────────────────────────
let nodeIdCounter = Date.now();
const newId = () => `n_${(nodeIdCounter++).toString(36)}`;

// ─── Inner component (needs ReactFlowProvider context) ─────────────────────────

function FlowBuilderInner() {
  const reactFlowInstance = useReactFlow();

  const [activeFlow, setActiveFlow] = useState<ChatbotFlow | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const isDirtyRef = useRef(false);

  const updateFlow = useUpdateChatbotFlow();
  const publishFlow = usePublishChatbotFlow();

  // ── Load flow into canvas ────────────────────────────────────────────────────
  const loadFlow = useCallback(
    (flow: ChatbotFlow) => {
      setActiveFlow(flow);
      setNodes((flow.nodes as Node[]) || []);
      setEdges((flow.edges as Edge[]) || []);
      setSelectedNode(null);
      isDirtyRef.current = false;
      setIsDirty(false);
      setTimeout(() => reactFlowInstance.fitView({ padding: 0.2, duration: 300 }), 100);
    },
    [reactFlowInstance, setNodes, setEdges]
  );

  // Mark dirty on changes
  const handleNodesChange = useCallback(
    (changes: Parameters<typeof onNodesChange>[0]) => {
      onNodesChange(changes);
      if (!isDirtyRef.current && changes.some((c) => c.type !== "select")) {
        isDirtyRef.current = true;
        setIsDirty(true);
      }
    },
    [onNodesChange]
  );

  const handleEdgesChange = useCallback(
    (changes: Parameters<typeof onEdgesChange>[0]) => {
      onEdgesChange(changes);
      if (!isDirtyRef.current) {
        isDirtyRef.current = true;
        setIsDirty(true);
      }
    },
    [onEdgesChange]
  );

  // ── Connect nodes ────────────────────────────────────────────────────────────
  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            ...edgeOptions,
            id: `e_${Date.now()}`,
          },
          eds
        )
      );
      isDirtyRef.current = true;
      setIsDirty(true);
    },
    [setEdges]
  );

  // ── Node selection ───────────────────────────────────────────────────────────
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setSelectedNode(node);
    },
    []
  );

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  // ── Node data update from config panel ──────────────────────────────────────
  const handleNodeDataChange = useCallback(
    (nodeId: string, data: Partial<FlowNodeData>) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n
        )
      );
      // Update selected node reference too
      setSelectedNode((prev) =>
        prev?.id === nodeId ? { ...prev, data: { ...prev.data, ...data } } : prev
      );
      isDirtyRef.current = true;
      setIsDirty(true);
    },
    [setNodes]
  );

  // ── Add node ─────────────────────────────────────────────────────────────────
  const handleAddNode = useCallback(
    (type: FlowNodeType) => {
      const defaultLabels: Record<FlowNodeType, string> = {
        trigger: "Gatilho",
        keyword: "Nova Palavra-Chave",
        message: "Nova Mensagem",
        ai_response: "Resposta IA",
        automation: "Automação",
        condition: "Condição",
        delay: "Espera",
        end: "Fim",
      };

      const viewport = reactFlowInstance.getViewport();
      const container = document.querySelector(".react-flow") as HTMLElement;
      const w = container?.clientWidth || 800;
      const h = container?.clientHeight || 600;
      // Place roughly in the center of the current viewport
      const x = (w / 2 - viewport.x) / viewport.zoom;
      const y = (h / 2 - viewport.y) / viewport.zoom;

      const newNode: Node = {
        id: newId(),
        type,
        position: { x, y },
        data: { label: defaultLabels[type], isActive: true } as FlowNodeData,
      };

      setNodes((nds) => [...nds, newNode]);
      setSelectedNode(newNode);
      isDirtyRef.current = true;
      setIsDirty(true);
    },
    [reactFlowInstance, setNodes]
  );

  // ── Delete node ──────────────────────────────────────────────────────────────
  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) =>
        eds.filter((e) => e.source !== nodeId && e.target !== nodeId)
      );
      setSelectedNode(null);
      isDirtyRef.current = true;
      setIsDirty(true);
    },
    [setNodes, setEdges]
  );

  // ── Save ─────────────────────────────────────────────────────────────────────
  const handleSave = useCallback(() => {
    if (!activeFlow) return;
    updateFlow.mutate(
      {
        id: activeFlow.id,
        nodes: nodes as any,
        edges: edges as any,
        version: (activeFlow.version || 1) + 1,
      },
      {
        onSuccess: () => {
          isDirtyRef.current = false;
          setIsDirty(false);
          toast.success("Fluxo salvo!");
        },
      }
    );
  }, [activeFlow, nodes, edges, updateFlow]);

  // ── Publish ──────────────────────────────────────────────────────────────────
  const handlePublish = useCallback(() => {
    if (!activeFlow) return;
    // Save first, then publish
    updateFlow.mutate(
      {
        id: activeFlow.id,
        nodes: nodes as any,
        edges: edges as any,
        version: (activeFlow.version || 1) + 1,
      },
      {
        onSuccess: () => {
          publishFlow.mutate(activeFlow.id, {
            onSuccess: (updated) => {
              isDirtyRef.current = false;
              setIsDirty(false);
              setActiveFlow(updated);
              toast.success("Fluxo publicado com sucesso!");
            },
          });
        },
      }
    );
  }, [activeFlow, nodes, edges, updateFlow, publishFlow]);

  // ── Keyboard shortcut: Ctrl+S ─────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (isDirtyRef.current) handleSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleSave]);

  // ── Zoom helpers ─────────────────────────────────────────────────────────────
  const handleZoomIn = () => reactFlowInstance.zoomIn({ duration: 200 });
  const handleZoomOut = () => reactFlowInstance.zoomOut({ duration: 200 });
  const handleFitView = () => reactFlowInstance.fitView({ padding: 0.2, duration: 300 });

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {/* Top navigation bar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b bg-background z-20">
        <Link to="/settings/whatsapp-chatbot">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <PageHeader
          icon={Bot}
          title="Construtor de Fluxos WhatsApp"
          subtitle="Visual whiteboard para configurar o assistente virtual"
          className="flex-1"
        />
      </div>

      <TooltipProvider>
        <div className="flex flex-1 overflow-hidden">
          {/* Left sidebar: flows list */}
          <FlowsSidebar
            activeFlowId={activeFlow?.id ?? null}
            onSelectFlow={loadFlow}
          />

          {/* Main canvas area */}
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Toolbar */}
            <FlowToolbar
              flow={activeFlow}
              isDirty={isDirty}
              onSave={handleSave}
              onPublish={handlePublish}
              onAddNode={handleAddNode}
              onZoomIn={handleZoomIn}
              onZoomOut={handleZoomOut}
              onFitView={handleFitView}
              isSaving={updateFlow.isPending || publishFlow.isPending}
            />

            {/* Canvas */}
            <div className="flex flex-1 overflow-hidden">
              {activeFlow ? (
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={handleNodesChange}
                  onEdgesChange={handleEdgesChange}
                  onConnect={onConnect}
                  onNodeClick={onNodeClick}
                  onPaneClick={onPaneClick}
                  nodeTypes={nodeTypes}
                  defaultEdgeOptions={edgeOptions}
                  fitView
                  fitViewOptions={{ padding: 0.2 }}
                  deleteKeyCode="Delete"
                  snapToGrid
                  snapGrid={[16, 16]}
                  minZoom={0.2}
                  maxZoom={2}
                  className="flex-1"
                >
                  <Background
                    variant={BackgroundVariant.Dots}
                    gap={20}
                    size={1.5}
                    color="#e2e8f0"
                  />
                  <MiniMap
                    nodeColor={(n) => {
                      const colors: Record<string, string> = {
                        trigger: "#10b981", keyword: "#3b82f6", message: "#0ea5e9",
                        ai_response: "#8b5cf6", automation: "#f59e0b",
                        condition: "#f97316", delay: "#64748b", end: "#f43f5e",
                      };
                      return colors[n.type || ""] || "#94a3b8";
                    }}
                    style={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }}
                    zoomable
                    pannable
                  />

                  {/* Keyboard hint */}
                  <Panel position="bottom-left">
                    <div className="text-[10px] text-muted-foreground bg-background/80 backdrop-blur px-2 py-1 rounded border flex items-center gap-1">
                      <Info className="h-3 w-3" />
                      Clique em um nó para configurar · Delete para remover · Ctrl+S para salvar
                    </div>
                  </Panel>
                </ReactFlow>
              ) : (
                /* Empty state */
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center space-y-4 max-w-sm p-8">
                    <div className="text-5xl">📋</div>
                    <h3 className="font-semibold text-xl">Nenhum fluxo selecionado</h3>
                    <p className="text-muted-foreground text-sm">
                      Selecione um fluxo existente no painel à esquerda, ou crie um novo para começar a construir o seu assistente virtual no WhatsApp.
                    </p>
                    <div className="flex flex-col gap-2 pt-2">
                      <div className="flex items-start gap-2 text-left p-3 rounded-lg bg-muted/40">
                        <span className="text-lg">🎯</span>
                        <div>
                          <p className="text-sm font-medium">Gatilhos</p>
                          <p className="text-xs text-muted-foreground">Defina quando o fluxo é iniciado</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2 text-left p-3 rounded-lg bg-muted/40">
                        <span className="text-lg">🔑</span>
                        <div>
                          <p className="text-sm font-medium">Palavras-chave</p>
                          <p className="text-xs text-muted-foreground">Reconheça comandos como AJUDA, MENU, etc.</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2 text-left p-3 rounded-lg bg-muted/40">
                        <span className="text-lg">🤖</span>
                        <div>
                          <p className="text-sm font-medium">Respostas IA + Automações</p>
                          <p className="text-xs text-muted-foreground">IA generativa e funções dinâmicas de dados</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Right panel: node config */}
              {activeFlow && selectedNode && (
                <NodeConfigPanel
                  node={selectedNode}
                  onClose={() => setSelectedNode(null)}
                  onChange={handleNodeDataChange}
                  onDelete={handleDeleteNode}
                />
              )}
            </div>
          </div>
        </div>
      </TooltipProvider>
    </div>
  );
}

// ─── Exported page with ReactFlowProvider ─────────────────────────────────────

export default function WhatsAppFlowBuilder() {
  return (
    <ReactFlowProvider>
      <FlowBuilderInner />
    </ReactFlowProvider>
  );
}
