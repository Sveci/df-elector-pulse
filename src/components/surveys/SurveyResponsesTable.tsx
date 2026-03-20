import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, User, UserCheck, Users } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { SurveyQuestion } from "@/hooks/surveys/useSurveys";

interface SurveyResponsesTableProps {
  responses: any[];
  questions: SurveyQuestion[];
}

export function SurveyResponsesTable({ responses, questions }: SurveyResponsesTableProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredResponses = responses.filter(r => {
    const contactName = r.contact?.nome || "";
    const leaderName = r.leader?.nome_completo || "";
    const referredByName = r.referred_by?.nome_completo || "";

    return (
      contactName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      leaderName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      referredByName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const getResponsePreview = (respostas: Record<string, any>) => {
    const entries = Object.entries(respostas);
    if (entries.length === 0) return "-";

    const firstResponses = entries.slice(0, 2).map(([, value]) => {
      if (typeof value === "string") {
        return value.length > 30 ? value.substring(0, 30) + "..." : value;
      }
      return String(value);
    });

    return firstResponses.join(", ");
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Respostas ({responses.length})</CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filteredResponses.length === 0 ? (
          <div className="text-center py-8">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Nenhuma resposta encontrada</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Respondente</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Indicado por</TableHead>
                  <TableHead>Preview Respostas</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredResponses.map((response) => (
                  <TableRow key={response.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {response.is_leader ? (
                          <UserCheck className="h-4 w-4 text-amber-500" />
                        ) : (
                          <User className="h-4 w-4 text-muted-foreground" />
                        )}
                        <div>
                          <p className="font-medium">
                            {response.is_leader
                              ? response.leader?.nome_completo
                              : response.contact?.nome || "Anônimo"}
                          </p>
                          {response.contact?.telefone_norm && (
                            <p className="text-sm text-muted-foreground">
                              {response.contact.telefone_norm}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {response.is_leader ? (
                        <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                          Líder
                        </Badge>
                      ) : (
                        <Badge variant="outline">Contato</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {response.referred_by ? (
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4 text-green-500" />
                          <span className="text-sm">{response.referred_by.nome_completo}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {getResponsePreview(response.respostas)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(response.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
