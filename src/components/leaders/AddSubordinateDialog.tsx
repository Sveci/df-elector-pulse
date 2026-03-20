import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSearchLeaders, useSetParentLeader } from "@/hooks/leaders/useLeaderTree";
import { Search, UserPlus, User, Loader2 } from "lucide-react";

interface AddSubordinateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentId: string;
  parentName: string;
  parentLevel: number;
}

export function AddSubordinateDialog({
  open,
  onOpenChange,
  parentId,
  parentName,
  parentLevel
}: AddSubordinateDialogProps) {
  const [search, setSearch] = useState("");
  const [selectedLeaderId, setSelectedLeaderId] = useState<string | null>(null);

  const { data: searchResults, isLoading } = useSearchLeaders(open ? search : "");
  const setParentLeader = useSetParentLeader();

  // Only show non-coordinators
  const filteredLeaders = searchResults?.filter(l => !l.is_coordinator) || [];

  const handleAdd = async () => {
    if (!selectedLeaderId) return;

    await setParentLeader.mutateAsync({
      leaderId: selectedLeaderId,
      parentId
    });
    setSelectedLeaderId(null);
    setSearch("");
    onOpenChange(false);
  };

  const handleClose = () => {
    setSelectedLeaderId(null);
    setSearch("");
    onOpenChange(false);
  };

  const getLevelLabel = (level: number) => {
    switch (level) {
      case 1: return "Coordenador";
      case 2: return "Líder Nível 1";
      case 3: return "Líder Nível 2";
      case 4: return "Líder Nível 3";
      case 5: return "Líder Nível 4";
      case 6: return "Líder Nível 5";
      default: return "Líder";
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Adicionar Subordinado
          </DialogTitle>
          <DialogDescription>
            Adicionar um líder subordinado a <strong>{parentName}</strong> ({getLevelLabel(parentLevel)}).
            O novo líder será nível {parentLevel + 1}.
          </DialogDescription>
        </DialogHeader>

        {parentLevel >= 6 ? (
          <div className="py-8 text-center text-muted-foreground">
            <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Este nível já atingiu o limite máximo de hierarquia (6 níveis).</p>
            <p className="text-sm mt-2">Não é possível adicionar mais subordinados diretos.</p>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, email ou telefone..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                  autoFocus
                />
              </div>

              <ScrollArea className="h-[300px] rounded-md border">
                {search.trim().length < 2 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
                    <Search className="h-8 w-8 mb-2 opacity-50" />
                    <p className="text-sm text-center">Digite ao menos 2 caracteres para buscar</p>
                  </div>
                ) : isLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredLeaders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
                    <User className="h-8 w-8 mb-2" />
                    <p className="text-sm text-center">Nenhum líder encontrado</p>
                  </div>
                ) : (
                  <div className="p-2 space-y-1">
                    {filteredLeaders.map((leader) => (
                      <button
                        key={leader.id}
                        onClick={() => setSelectedLeaderId(leader.id)}
                        className={`w-full text-left p-3 rounded-lg transition-colors ${
                          selectedLeaderId === leader.id
                            ? "bg-primary/10 border-2 border-primary"
                            : "hover:bg-muted border-2 border-transparent"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{leader.nome_completo}</p>
                            <p className="text-sm text-muted-foreground">
                              {leader.cidade_nome || "Sem região"}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button
                onClick={handleAdd}
                disabled={!selectedLeaderId || setParentLeader.isPending}
                className="gap-2"
              >
                {setParentLeader.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                <UserPlus className="h-4 w-4" />
                Adicionar Subordinado
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
