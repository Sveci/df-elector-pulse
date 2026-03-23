import { useState } from "react";
import {
  Save, Upload, Play, Undo2, Redo2, ZoomIn, ZoomOut, Maximize2,
  Plus, Download, Settings2, Info, ChevronDown, LayoutGrid
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { FlowNodeType } from "@/hooks/useWhatsAppFlows";
import { NODE_CONFIG } from "./FlowNodes";
import type { ChatbotFlow } from "@/hooks/useWhatsAppFlows";
import { cn } from "@/lib/utils";

interface FlowToolbarProps {
  flow: ChatbotFlow | null;
  isDirty: boolean;
  onSave: () => void;
  onPublish: () => void;
  onAddNode: (type: FlowNodeType) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
  onAutoLayout?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  isSaving?: boolean;
}

const NODE_CATEGORIES: Array<{
  label: string;
  types: FlowNodeType[];
}> = [
  { label: "Entrada", types: ["trigger", "keyword"] },
  { label: "Ação", types: ["message", "ai_response", "automation"] },
  { label: "Lógica", types: ["condition", "delay"] },
  { label: "Saída", types: ["end"] },
];

export function FlowToolbar({
  flow,
  isDirty,
  onSave,
  onPublish,
  onAddNode,
  onZoomIn,
  onZoomOut,
  onFitView,
  onAutoLayout,
  onUndo,
  onRedo,
  isSaving,
}: FlowToolbarProps) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-2 border-b bg-background/95 backdrop-blur z-10">
      {/* Flow name + status */}
      {flow && (
        <div className="flex items-center gap-2 min-w-0 flex-shrink-0">
          <span className="text-base">{flow.icon || "📋"}</span>
          <span className="font-semibold text-sm truncate max-w-[160px]">{flow.name}</span>
          {isDirty ? (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-amber-600 border-amber-300">
              ● Não salvo
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-green-600 border-green-300">
              ✓ Salvo
            </Badge>
          )}
          {flow.is_published && (
            <Badge className="bg-green-100 text-green-700 text-[10px] px-1.5 py-0 border-0">
              Publicado
            </Badge>
          )}
        </div>
      )}

      {flow && <Separator orientation="vertical" className="h-6 mx-1" />}

      {/* Add node dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-1">
            <Plus className="h-3.5 w-3.5" />
            Adicionar nó
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-52">
          {NODE_CATEGORIES.map((cat, ci) => (
            <div key={cat.label}>
              {ci > 0 && <DropdownMenuSeparator />}
              <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                {cat.label}
              </div>
              {cat.types.map((t) => {
                const cfg = NODE_CONFIG[t];
                const Icon = cfg.icon;
                return (
                  <DropdownMenuItem key={t} onClick={() => onAddNode(t)}>
                    <Icon className={cn("h-4 w-4 mr-2", cfg.color)} />
                    <div className="flex flex-col">
                      <span className="text-sm">{cfg.label}</span>
                      <span className="text-[10px] text-muted-foreground">{cfg.description}</span>
                    </div>
                  </DropdownMenuItem>
                );
              })}
            </div>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Separator orientation="vertical" className="h-6 mx-0.5" />

      {/* Undo/Redo */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onUndo} disabled={!onUndo}>
            <Undo2 className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Desfazer</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onRedo} disabled={!onRedo}>
            <Redo2 className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Refazer</TooltipContent>
      </Tooltip>

      <Separator orientation="vertical" className="h-6 mx-0.5" />

      {/* Zoom */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onZoomOut}>
            <ZoomOut className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Zoom out</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onZoomIn}>
            <ZoomIn className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Zoom in</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onFitView}>
            <Maximize2 className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Ajustar à tela</TooltipContent>
      </Tooltip>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right actions */}
      {flow && (
        <>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1"
                onClick={onSave}
                disabled={isSaving || !isDirty}
              >
                <Save className="h-3.5 w-3.5" />
                {isSaving ? "Salvando…" : "Salvar"}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Salvar alterações (Ctrl+S)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                className="h-8 gap-1 bg-green-600 hover:bg-green-700 text-white"
                onClick={onPublish}
                disabled={isSaving}
              >
                <Upload className="h-3.5 w-3.5" />
                Publicar
              </Button>
            </TooltipTrigger>
            <TooltipContent>Publicar fluxo (tornar ativo no chatbot)</TooltipContent>
          </Tooltip>
        </>
      )}
    </div>
  );
}
