import { useState, useMemo } from "react";
import { Search, Crown, User, AlertTriangle, ArrowRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  useSearchLeaders,
  useMoveLeaderBranch,
} from "@/hooks/leaders/useLeaderTree";

interface MoveLeaderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leaderId: string;
  leaderName: string;
  currentLevel: number;
  currentParentId: string | null;
  subordinatesCount: number;
  maxSubtreeDepth?: number;
}

export function MoveLeaderDialog({
  open,
  onOpenChange,
  leaderId,
  leaderName,
  currentLevel,
  currentParentId,
  subordinatesCount,
  maxSubtreeDepth = 0,
}: MoveLeaderDialogProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);

  const { data: searchResults, isLoading: loadingSearch } = useSearchLeaders(searchTerm);
  const moveLeaderBranch = useMoveLeaderBranch();

  // Filter out the leader itself, its current parent (already there), and candidates that would exceed depth
  const possibleParents = useMemo(() => {
    if (!searchResults) return [];

    return searchResults.filter((leader) => {
      // Cannot move under itself
      if (leader.id === leaderId) return false;
      // Must have a valid level and not exceed limit
      const level = leader.hierarchy_level ?? (leader.is_coordinator ? 1 : 2);
      if (level >= 6) return false;
      return true;
    });
  }, [searchResults, leaderId]);

  // Calculate new level based on selection
  const selectedParent = useMemo(() => {
    if (!selectedParentId) return null;
    return possibleParents.find(p => p.id === selectedParentId) ?? null;
  }, [selectedParentId, possibleParents]);

  const newLevel = useMemo(() => {
    if (!selectedParent) return null;
    const parentLevel = selectedParent.hierarchy_level ?? (selectedParent.is_coordinator ? 1 : 2);
    return parentLevel + 1;
  }, [selectedParent]);

  // Check if move would exceed depth limit
  const wouldExceedLimit = useMemo(() => {
    if (!newLevel) return false;
    // maxSubtreeDepth = how many levels below the leader being moved (0 if no subordinates)
    return (newLevel + maxSubtreeDepth) > 6;
  }, [newLevel, maxSubtreeDepth]);

  const handleConfirm = async () => {
    if (!selectedParentId) return;

    try {
      await moveLeaderBranch.mutateAsync({
        leaderId,
        newParentId: selectedParentId,
      });
      onOpenChange(false);
      resetState();
    } catch (error) {
      // Error handled by mutation
    }
  };

  const resetState = () => {
    setSearchTerm("");
    setSelectedParentId(null);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) resetState();
    onOpenChange(open);
  };

  const getLevelLabel = (level: number) => {
    switch (level) {
      case 1: return "Coordenador";
      case 2: return "Nível 2";
      case 3: return "Nível 3";
      case 4: return "Nível 4";
      case 5: return "Nível 5";
      case 6: return "Nível 6";
      default: return `Nível ${level}`;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl w-[95vw]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRight className="h-5 w-5" />
            Mover Líder para Outra Árvore
          </DialogTitle>
          <DialogDescription>
            Mover <strong>{leaderName}</strong> (Nível {currentLevel})
            {subordinatesCount > 0 && ` e ${subordinatesCount} subordinado(s)`}
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar líder ou coordenador por nome, telefone..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setSelectedParentId(null);
            }}
            className="pl-9"
          />
        </div>

        <ScrollArea className="h-[300px] pr-4">
          {searchTerm.trim().length < 2 ? (
            <div className="text-center py-8 text-muted-foreground">
              Digite pelo menos 2 caracteres para buscar
            </div>
          ) : loadingSearch ? (
            <div className="text-center py-8 text-muted-foreground">
              Buscando...
            </div>
          ) : possibleParents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum líder encontrado
            </div>
          ) : (
            <RadioGroup
              value={selectedParentId || ""}
              onValueChange={setSelectedParentId}
              className="space-y-2"
            >
              {possibleParents.map((leader) => {
                const level = leader.hierarchy_level ?? (leader.is_coordinator ? 1 : 2);
                const isCurrentParent = leader.id === currentParentId;
                const wouldExceed = (level + 1 + maxSubtreeDepth) > 6;

                return (
                    <div
                    key={leader.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border ${
                      isCurrentParent || wouldExceed ? "opacity-50" : "hover:bg-accent"
                    } transition-colors`}
                  >
                    <RadioGroupItem
                      value={leader.id}
                      id={leader.id}
                      disabled={isCurrentParent || wouldExceed}
                      className="shrink-0"
                    />
                    <Label
                      htmlFor={leader.id}
                      className="flex-1 flex items-center gap-2 cursor-pointer min-w-0"
                    >
                      <div className="shrink-0">
                        {leader.is_coordinator ? (
                          <Crown className="h-4 w-4 text-amber-600" />
                        ) : (
                          <User className="h-4 w-4 text-blue-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="block truncate">{leader.nome_completo}</span>
                        {leader.cidade_nome && (
                          <span className="text-xs text-muted-foreground">{leader.cidade_nome}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Badge variant="outline" className="text-xs">
                          {getLevelLabel(level)}
                        </Badge>
                        {isCurrentParent && (
                          <Badge variant="secondary" className="text-xs">
                            Atual
                          </Badge>
                        )}
                      </div>
                    </Label>
                  </div>
                );
              })}
            </RadioGroup>
          )}
        </ScrollArea>

        {selectedParentId && newLevel && (
          <div className="space-y-2">
            {wouldExceedLimit ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Este movimento excederia o limite de 6 níveis de hierarquia.
                </AlertDescription>
              </Alert>
            ) : (
              <Alert>
                <AlertDescription>
                  <strong>{leaderName}</strong> passará para o <strong>Nível {newLevel}</strong>
                  {subordinatesCount > 0 && (
                    <span> e os {subordinatesCount} subordinados terão seus níveis recalculados.</span>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedParentId || wouldExceedLimit || moveLeaderBranch.isPending}
          >
            {moveLeaderBranch.isPending ? "Movendo..." : "Confirmar Movimento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
