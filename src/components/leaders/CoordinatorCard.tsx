import { Crown, Users, Award, ChevronRight, MoreVertical, UserMinus } from "lucide-react";
import { useDemoMask } from "@/contexts/DemoModeContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Coordinator } from "@/hooks/leaders/useLeaderTree";

interface CoordinatorCardProps {
  coordinator: Coordinator;
  isSelected: boolean;
  onSelect: () => void;
  onDemote: () => void;
}

export function CoordinatorCard({
  coordinator,
  isSelected,
  onSelect,
  onDemote
}: CoordinatorCardProps) {
  const { m } = useDemoMask();
  return (
    <Card
      className={`cursor-pointer transition-all ${
        isSelected
          ? "ring-2 ring-primary border-primary bg-primary/5"
          : "hover:border-primary/50 hover:shadow-sm"
      }`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0 flex-1" onClick={onSelect}>
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
              <Crown className="h-5 w-5 text-amber-600" />
            </div>
            <div className="min-w-0 overflow-hidden">
              <h3 className="font-semibold truncate max-w-[200px]">{m.name(coordinator.nome_completo)}</h3>
              <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                {m.city(coordinator.cidade_nome) || "Sem região"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onDemote} className="text-destructive">
                  <UserMinus className="h-4 w-4 mr-2" />
                  Rebaixar Coordenador
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onSelect}
            >
              <ChevronRight className={`h-4 w-4 transition-transform ${isSelected ? "rotate-90" : ""}`} />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <Badge variant="secondary" className="gap-1">
            <Users className="h-3 w-3" />
            {coordinator.total_leaders} {coordinator.total_leaders === 1 ? 'indicação' : 'indicações'}
          </Badge>
          <Badge variant="secondary" className="gap-1">
            <Award className="h-3 w-3" />
            {coordinator.total_pontos} pts
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
