import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Mail,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Download,
  TrendingUp,
  TrendingDown,
  Loader2,
  FileSpreadsheet,
  User,
  Users
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useEmailTemplates } from "@/hooks/useEmailTemplates";
import { useEmailReport, useEmailReportStats } from "@/hooks/useEmailReport";
import { exportEmailReportToExcel } from "@/utils/emailReportExport";

const ITEMS_PER_PAGE = 20;

export function EmailReportTab() {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);

  const { data: templates, isLoading: templatesLoading } = useEmailTemplates();

  const { data: reportData, isLoading: reportLoading } = useEmailReport({
    templateId: selectedTemplateId || undefined,
    status: statusFilter,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    search: searchTerm || undefined,
  });

  const { data: stats, isLoading: statsLoading } = useEmailReportStats(
    selectedTemplateId || undefined
  );

  const selectedTemplate = useMemo(() =>
    templates?.find(t => t.id === selectedTemplateId),
    [templates, selectedTemplateId]
  );

  const paginatedData = useMemo(() => {
    if (!reportData) return [];
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return reportData.slice(start, start + ITEMS_PER_PAGE);
  }, [reportData, currentPage]);

  const totalPages = useMemo(() =>
    Math.ceil((reportData?.length || 0) / ITEMS_PER_PAGE),
    [reportData]
  );

  const handleExport = () => {
    if (reportData && selectedTemplate) {
      exportEmailReportToExcel(reportData, selectedTemplate.nome);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "sent":
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100"><CheckCircle2 className="h-3 w-3 mr-1" />Enviado</Badge>;
      case "pending":
        return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
      case "failed":
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100"><XCircle className="h-3 w-3 mr-1" />Falha</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Relatório de Efetividade
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Template *</Label>
              <Select
                value={selectedTemplateId}
                onValueChange={(v) => {
                  setSelectedTemplateId(v);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um template" />
                </SelectTrigger>
                <SelectContent>
                  {templatesLoading ? (
                    <div className="p-2 text-center text-sm text-muted-foreground">Carregando...</div>
                  ) : (
                    templates?.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.nome}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="sent">Enviado</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="failed">Falha</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Data Início</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); }}
              />
            </div>

            <div className="space-y-2">
              <Label>Data Fim</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); }}
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou email..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="pl-9"
              />
            </div>
            <Button
              onClick={handleExport}
              disabled={!reportData?.length}
              variant="outline"
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Exportar Excel
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      {selectedTemplateId && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold">
                    {statsLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : stats?.total || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Enviados</p>
                  <p className="text-2xl font-bold text-green-600">
                    {statsLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : stats?.sent || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Falhas</p>
                  <p className="text-2xl font-bold text-red-600">
                    {statsLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : stats?.failed || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-amber-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Pendentes</p>
                  <p className="text-2xl font-bold text-amber-600">
                    {statsLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : stats?.pending || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Taxa Sucesso</p>
                  <p className="text-2xl font-bold">
                    {statsLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : `${stats?.successRate || 0}%`}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Results Table */}
      {selectedTemplateId ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Destinatários ({reportData?.length || 0})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {reportLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : paginatedData.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum registro encontrado</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead>Cidade/RA</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedData.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">
                            {item.leader_nome || item.contact_nome || item.to_name || "-"}
                          </TableCell>
                          <TableCell className="text-sm">{item.to_email}</TableCell>
                          <TableCell className="text-sm">
                            {item.leader_telefone || item.contact_telefone || "-"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {item.leader_cidade || item.contact_cidade || "-"}
                          </TableCell>
                          <TableCell>
                            {item.leader_id ? (
                              <Badge variant="outline" className="gap-1">
                                <User className="h-3 w-3" />Líder
                              </Badge>
                            ) : item.contact_id ? (
                              <Badge variant="outline" className="gap-1">
                                <Users className="h-3 w-3" />Contato
                              </Badge>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {getStatusBadge(item.status)}
                              {item.error_message && (
                                <p className="text-xs text-red-500 max-w-[200px] truncate" title={item.error_message}>
                                  {item.error_message}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {item.sent_at
                              ? format(new Date(item.sent_at), "dd/MM/yy HH:mm", { locale: ptBR })
                              : format(new Date(item.created_at), "dd/MM/yy HH:mm", { locale: ptBR })
                            }
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-muted-foreground">
                      Página {currentPage} de {totalPages}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                      >
                        Anterior
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                      >
                        Próximo
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Selecione um template para visualizar o relatório</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
