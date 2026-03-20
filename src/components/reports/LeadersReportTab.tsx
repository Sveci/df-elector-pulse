import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Users, TrendingUp, Trophy, Star } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useLeadersRanking } from "@/hooks/leaders/useLeadersRanking";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from '@/lib/xlsx-compat';

const COLORS = ['#FFD700', '#C0C0C0', '#CD7F32', '#3B82F6', '#10B981'];

export function LeadersReportTab() {
  const [region, setRegion] = useState("all");
  const [page, setPage] = useState(1);

  const { data: rankingData, isLoading } = useLeadersRanking({ region, page, pageSize: 10 });

  // Buscar regiões disponíveis
  const { data: regions } = useQuery({
    queryKey: ['leader_regions'],
    queryFn: async () => {
      const { data } = await supabase
        .from('office_cities')
        .select('id, nome')
        .eq('status', 'active')
        .order('nome');
      return data || [];
    }
  });

  // Estatísticas gerais de líderes
  const { data: leaderStats } = useQuery({
    queryKey: ['leader_stats_report'],
    queryFn: async () => {
      const { count: total } = await supabase
        .from('lideres')
        .select('*', { count: 'exact', head: true });

      const { count: active } = await supabase
        .from('lideres')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      const { count: verified } = await supabase
        .from('lideres')
        .select('*', { count: 'exact', head: true })
        .eq('is_verified', true);

      const { data: indicationsData } = await supabase
        .from('lideres')
        .select('cadastros');

      const totalIndications = indicationsData?.reduce((sum, l) => sum + (l.cadastros || 0), 0) || 0;

      // Distribuição por nível
      const { data: levelsData } = await supabase
        .from('lideres')
        .select('pontuacao_total');

      const levels = { bronze: 0, prata: 0, ouro: 0, diamante: 0 };
      levelsData?.forEach(l => {
        const points = l.pontuacao_total || 0;
        if (points >= 1000) levels.diamante++;
        else if (points >= 500) levels.ouro++;
        else if (points >= 200) levels.prata++;
        else levels.bronze++;
      });

      return {
        total: total || 0,
        active: active || 0,
        verified: verified || 0,
        totalIndications,
        levels
      };
    }
  });

  const levelDistributionData = [
    { name: 'Diamante', value: leaderStats?.levels?.diamante || 0, color: '#6366F1' },
    { name: 'Ouro', value: leaderStats?.levels?.ouro || 0, color: '#FFD700' },
    { name: 'Prata', value: leaderStats?.levels?.prata || 0, color: '#C0C0C0' },
    { name: 'Bronze', value: leaderStats?.levels?.bronze || 0, color: '#CD7F32' },
  ].filter(item => item.value > 0);

  const handleExport = () => {
    const data = [
      ['Posição', 'Nome', 'Região', 'Pontuação', 'Indicações'],
      ...(rankingData?.data?.map((leader, index) => [
        index + 1,
        leader.name,
        leader.region,
        leader.points,
        leader.indicacoes
      ]) || [])
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Líderes');
    XLSX.writeFile(wb, `relatorio-lideres-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const totalPages = Math.ceil((rankingData?.totalCount || 0) / 10);

  return (
    <div className="space-y-6">
      {/* Filtros e Exportação */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <Select value={region} onValueChange={setRegion}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Todas as regiões" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as regiões</SelectItem>
            {regions?.map((r) => (
              <SelectItem key={r.id} value={r.nome}>{r.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button onClick={handleExport} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Exportar Excel
        </Button>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total de Líderes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{leaderStats?.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              {leaderStats?.active || 0} ativos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Verificados</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{leaderStats?.verified || 0}</div>
            <p className="text-xs text-muted-foreground">
              {leaderStats?.total ? ((leaderStats.verified / leaderStats.total) * 100).toFixed(1) : 0}% do total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total de Indicações</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{leaderStats?.totalIndications?.toLocaleString('pt-BR') || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Média por Líder</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {leaderStats?.total ? (leaderStats.totalIndications / leaderStats.total).toFixed(1) : 0}
            </div>
            <p className="text-xs text-muted-foreground">indicações/líder</p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Distribuição por Nível</CardTitle>
            <CardDescription>Líderes por categoria de gamificação</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={levelDistributionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {levelDistributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top 10 Líderes</CardTitle>
            <CardDescription>Ranking por pontuação</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rankingData?.data?.slice(0, 10) || []} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={100}
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => value.length > 12 ? value.substring(0, 12) + '...' : value}
                  />
                  <Tooltip />
                  <Bar dataKey="points" name="Pontos" fill="hsl(15 89% 54%)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Ranking */}
      <Card>
        <CardHeader>
          <CardTitle>Ranking Completo</CardTitle>
          <CardDescription>Lista paginada de todos os líderes</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">#</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Região</TableHead>
                <TableHead className="text-right">Pontuação</TableHead>
                <TableHead className="text-right">Indicações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : rankingData?.data?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhum líder encontrado
                  </TableCell>
                </TableRow>
              ) : (
                rankingData?.data?.map((leader, index) => (
                  <TableRow key={leader.id}>
                    <TableCell className="font-medium">
                      {(page - 1) * 10 + index + 1}
                    </TableCell>
                    <TableCell className="font-medium">{leader.name}</TableCell>
                    <TableCell>{leader.region}</TableCell>
                    <TableCell className="text-right">{leader.points}</TableCell>
                    <TableCell className="text-right">{leader.indicacoes}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Página {page} de {totalPages} ({rankingData?.totalCount || 0} líderes)
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
