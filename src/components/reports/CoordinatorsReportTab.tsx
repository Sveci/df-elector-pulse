import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, Users, UserCheck, Clock, Percent } from "lucide-react";
import { useCoordinatorsCadastrosStats } from "@/hooks/reports/useCoordinatorsCadastrosStats";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import * as XLSX from '@/lib/xlsx-compat';

const COLORS = ["hsl(var(--primary))", "hsl(var(--muted-foreground))", "hsl(var(--destructive))", "hsl(var(--secondary))"];

export function CoordinatorsReportTab() {
  const { data: coordinators, isLoading } = useCoordinatorsCadastrosStats();

  const totals = coordinators?.reduce(
    (acc, coord) => ({
      totalCadastros: acc.totalCadastros + coord.total_cadastros,
      verificados: acc.verificados + coord.verificados,
      pendentes: acc.pendentes + coord.pendentes,
    }),
    { totalCadastros: 0, verificados: 0, pendentes: 0 }
  ) || { totalCadastros: 0, verificados: 0, pendentes: 0 };

  const taxaGeralVerificacao = totals.totalCadastros > 0
    ? (totals.verificados / totals.totalCadastros) * 100
    : 0;

  const top10Coordinators = coordinators?.slice(0, 10).map(coord => ({
    name: coord.nome_completo.split(' ').slice(0, 2).join(' '),
    verificados: coord.verificados,
    pendentes: coord.pendentes,
  })) || [];

  const pieData = [
    { name: "Verificados", value: totals.verificados },
    { name: "Pendentes", value: totals.pendentes },
  ];

  const handleExportExcel = () => {
    if (!coordinators) return;

    const exportData = coordinators.map(coord => ({
      "Coordenador": coord.nome_completo,
      "Cidade": coord.cidade_nome || "-",
      "Total Cadastros": coord.total_cadastros,
      "Verificados": coord.verificados,
      "Pendentes": coord.pendentes,
      "Taxa de Verificação (%)": coord.taxa_verificacao.toFixed(1),
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Coordenadores");
    XLSX.writeFile(wb, `relatorio-coordenadores-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Coordenadores</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{coordinators?.length || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cadastros</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.totalCadastros.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Verificados</CardTitle>
            <UserCheck className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{totals.verificados.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Verificação</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{taxaGeralVerificacao.toFixed(1)}%</div>
            <Progress value={taxaGeralVerificacao} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top 10 Coordenadores</CardTitle>
            <CardDescription>Por total de cadastros (verificados vs pendentes)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={top10Coordinators} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={100} fontSize={12} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="verificados" stackId="a" fill="hsl(var(--primary))" name="Verificados" />
                  <Bar dataKey="pendentes" stackId="a" fill="hsl(var(--muted-foreground))" name="Pendentes" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Status Geral de Verificação</CardTitle>
            <CardDescription>Distribuição de cadastros verificados vs pendentes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Detalhamento por Coordenador</CardTitle>
            <CardDescription>Lista completa de coordenadores e seus cadastros</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={handleExportExcel}>
            <Download className="h-4 w-4 mr-2" />
            Exportar Excel
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Coordenador</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead className="text-center">Total</TableHead>
                <TableHead className="text-center">Verificados</TableHead>
                <TableHead className="text-center">Pendentes</TableHead>
                <TableHead className="w-[200px]">Taxa de Verificação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coordinators?.map((coord) => (
                <TableRow key={coord.id}>
                  <TableCell className="font-medium">{coord.nome_completo}</TableCell>
                  <TableCell>{coord.cidade_nome || "-"}</TableCell>
                  <TableCell className="text-center">{coord.total_cadastros}</TableCell>
                  <TableCell className="text-center text-primary">{coord.verificados}</TableCell>
                  <TableCell className="text-center text-muted-foreground">{coord.pendentes}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={coord.taxa_verificacao} className="flex-1" />
                      <span className="text-sm text-muted-foreground w-12 text-right">
                        {coord.taxa_verificacao.toFixed(1)}%
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {(!coordinators || coordinators.length === 0) && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Nenhum coordenador encontrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
