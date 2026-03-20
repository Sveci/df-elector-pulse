import { useState, useRef, useEffect, useCallback, memo } from "react";
import { Crown, User, UserPlus, UserMinus, ChevronDown, ChevronRight, MoreVertical, ArrowRightLeft } from "lucide-react";
import { useDemoMask } from "@/contexts/DemoModeContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { LeaderTreeNode, useRemoveFromTree, usePromoteToCoordinatorWithSubordinates, countSubordinates, maxSubtreeDepth } from "@/hooks/leaders/useLeaderTree";
import { AddSubordinateDialog } from "./AddSubordinateDialog";
import { MoveLeaderDialog } from "./MoveLeaderDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface LeaderTreeViewProps {
  tree: LeaderTreeNode;
  highlightLeaderId?: string | null;
}

// Pre-compute the path to the highlighted node so only that branch is expanded
function findPathToNode(node: LeaderTreeNode, targetId: string): Set<string> | null {
  if (node.id === targetId) return new Set([node.id]);
  if (node.children) {
    for (const child of node.children) {
      const path = findPathToNode(child, targetId);
      if (path) {
        path.add(node.id);
        return path;
      }
    }
  }
  return null;
}

export function LeaderTreeView({ tree, highlightLeaderId }: LeaderTreeViewProps) {
  // Compute which nodes should be initially expanded (only path to highlighted node, or just root)
  const initialExpanded = useCallback(() => {
    const set = new Set<string>();
    set.add(tree.id); // Always expand root
    if (highlightLeaderId) {
      const path = findPathToNode(tree, highlightLeaderId);
      if (path) {
        path.forEach(id => set.add(id));
      }
    }
    return set;
  }, [tree, highlightLeaderId]);

  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(initialExpanded);

  // Reset expanded nodes when tree or highlight changes
  useEffect(() => {
    setExpandedNodes(initialExpanded());
  }, [tree.id, highlightLeaderId]);

  const toggleExpand = useCallback((nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  const handleHighlightedRef = useCallback((element: HTMLDivElement | null) => {
    if (element) {
      setTimeout(() => {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
    }
  }, []);

  return (
    <div className="p-4">
      <TreeNode
        node={tree}
        isRoot
        highlightLeaderId={highlightLeaderId}
        onHighlightedNodeRef={handleHighlightedRef}
        expandedNodes={expandedNodes}
        toggleExpand={toggleExpand}
      />
    </div>
  );
}

interface TreeNodeProps {
  node: LeaderTreeNode;
  isRoot?: boolean;
  highlightLeaderId?: string | null;
  onHighlightedNodeRef?: (element: HTMLDivElement | null) => void;
  expandedNodes: Set<string>;
  toggleExpand: (nodeId: string) => void;
}

const TreeNode = memo(function TreeNode({
  node, isRoot = false, highlightLeaderId, onHighlightedNodeRef, expandedNodes, toggleExpand
}: TreeNodeProps) {
  const { m } = useDemoMask();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [showPromoteDialog, setShowPromoteDialog] = useState(false);
  const nodeRef = useRef<HTMLDivElement>(null);

  const removeFromTree = useRemoveFromTree();
  const promoteToCoordinator = usePromoteToCoordinatorWithSubordinates();

  const hasChildren = node.children && node.children.length > 0;
  const level = node.hierarchy_level || 1;
  const isHighlighted = highlightLeaderId === node.id;
  const isExpanded = expandedNodes.has(node.id);

  // Quando este nó for o destacado, reportar a ref para scroll
  useEffect(() => {
    if (isHighlighted && nodeRef.current && onHighlightedNodeRef) {
      onHighlightedNodeRef(nodeRef.current);
    }
  }, [isHighlighted, onHighlightedNodeRef]);

  const getLevelColor = (level: number) => {
    switch (level) {
      case 1: return "bg-amber-100 text-amber-700 border-amber-300";
      case 2: return "bg-blue-100 text-blue-700 border-blue-300";
      case 3: return "bg-green-100 text-green-700 border-green-300";
      case 4: return "bg-purple-100 text-purple-700 border-purple-300";
      case 5: return "bg-orange-100 text-orange-700 border-orange-300";
      case 6: return "bg-rose-100 text-rose-700 border-rose-300";
      default: return "bg-gray-100 text-gray-700 border-gray-300";
    }
  };

  const getLevelLabel = (level: number) => {
    switch (level) {
      case 1: return "Coordenador";
      case 2: return "Nível 1";
      case 3: return "Nível 2";
      case 4: return "Nível 3";
      case 5: return "Nível 4";
      case 6: return "Nível 5";
      default: return "Líder";
    }
  };

  const getLevelIcon = (level: number) => {
    if (level === 1) return <Crown className="h-4 w-4" />;
    return <User className="h-4 w-4" />;
  };

  const handleRemove = async () => {
    await removeFromTree.mutateAsync(node.id);
    setShowRemoveDialog(false);
  };

  const handlePromoteToCoordinator = async () => {
    await promoteToCoordinator.mutateAsync(node.id);
    setShowPromoteDialog(false);
  };

  // Lazy count: only compute when expanded or for display
  const directChildrenCount = node.children?.length || 0;

  return (
    <div className="relative">
      {/* Connection line to parent */}
      {!isRoot && (
        <div className="absolute left-[-20px] top-0 h-6 w-5 border-l-2 border-b-2 border-muted-foreground/30 rounded-bl-lg" />
      )}

      {/* Node */}
      <div
        ref={nodeRef}
        className={`flex items-center gap-2 p-3 rounded-lg border ${getLevelColor(level)} mb-2 ${isHighlighted ? 'ring-2 ring-primary ring-offset-2 animate-pulse' : ''}`}
      >
        {hasChildren && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={() => toggleExpand(node.id)}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        )}

        <div className="flex items-center gap-2 flex-1 min-w-0">
          {getLevelIcon(level)}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium truncate">{m.name(node.nome_completo)}</span>
              <Badge variant="outline" className="text-xs shrink-0">
                {getLevelLabel(level)}
              </Badge>
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span>
                {directChildrenCount} {directChildrenCount === 1 ? 'indicação' : 'indicações'}
              </span>
              <span>{node.pontuacao_total} pts</span>
            </div>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {level < 6 && (
              <DropdownMenuItem onClick={() => setShowAddDialog(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Adicionar Subordinado
              </DropdownMenuItem>
            )}
            {!isRoot && (
              <>
                <DropdownMenuItem onClick={() => setShowMoveDialog(true)}>
                  <ArrowRightLeft className="h-4 w-4 mr-2" />
                  Mover para Outra Árvore
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowPromoteDialog(true)}>
                  <Crown className="h-4 w-4 mr-2" />
                  Promover a Coordenador
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setShowRemoveDialog(true)}
                  className="text-destructive"
                >
                  <UserMinus className="h-4 w-4 mr-2" />
                  Remover da Hierarquia
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Children - only rendered when expanded */}
      {hasChildren && isExpanded && (
        <div className="ml-8 border-l-2 border-muted-foreground/20 pl-4">
          {node.children!.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              highlightLeaderId={highlightLeaderId}
              onHighlightedNodeRef={onHighlightedNodeRef}
              expandedNodes={expandedNodes}
              toggleExpand={toggleExpand}
            />
          ))}
        </div>
      )}

      {/* Add Subordinate Dialog */}
      {showAddDialog && (
        <AddSubordinateDialog
          open={showAddDialog}
          onOpenChange={setShowAddDialog}
          parentId={node.id}
          parentName={node.nome_completo}
          parentLevel={level}
        />
      )}

      {/* Move Leader Dialog */}
      {showMoveDialog && (
        <MoveLeaderDialog
          open={showMoveDialog}
          onOpenChange={setShowMoveDialog}
          leaderId={node.id}
          leaderName={node.nome_completo}
          currentLevel={level}
          currentParentId={node.parent_leader_id}
          subordinatesCount={countSubordinates(node)}
          maxSubtreeDepth={maxSubtreeDepth(node)}
        />
      )}

      {/* Remove Confirmation Dialog */}
      <AlertDialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover da Hierarquia</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover <strong>{m.name(node.nome_completo)}</strong> da hierarquia?
              {hasChildren && (
                <span className="block mt-2 text-amber-600">
                  Os subordinados diretos serão reassociados ao líder superior.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Promote to Coordinator Dialog */}
      {showPromoteDialog && (
        <AlertDialog open={showPromoteDialog} onOpenChange={setShowPromoteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Promover a Coordenador</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja promover <strong>{m.name(node.nome_completo)}</strong> a Coordenador?
                {countSubordinates(node) > 0 && (
                  <span className="block mt-2 text-blue-600">
                    {countSubordinates(node)} subordinado(s) serão mantidos e terão seus níveis ajustados automaticamente.
                  </span>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handlePromoteToCoordinator}
                disabled={promoteToCoordinator.isPending}
              >
                {promoteToCoordinator.isPending ? "Promovendo..." : "Promover"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
});
