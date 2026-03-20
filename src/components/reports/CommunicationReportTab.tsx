import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Mail, MessageSquare, Phone } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { useSMSMetrics } from "@/hooks/useSMSMessages";
import { useWhatsAppMetrics } from "@/hooks/useWhatsAppMessages";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import * as XLSX from '@/lib/xlsx-compat';

const COLORS = ['#10B981', '#F59E0B', '#3B82F6', '#EF4444', '#6366F1'];

export function CommunicationReportTab() {
  const [period, setPeriod] = useState("30");

  const { data: smsMetrics } = useSMSMetrics();
  const { data: waMetrics } = useWhatsAppMetrics();

  // Buscar métricas de email
  const { data: emailMetrics } = useQuery({
    queryKey: ['email_metrics'],
    queryFn: async () => {
      const { count: total } = await supabase
        .from('email_logs')
        .select('*', { count: 'exact', head: true });

      const { count: sent } = await supabase
        .from('email_logs')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'sent');

      const { count: pending } = await supabase
        .from('email_logs')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      const { count: failed } = await supabase
        .from('email_logs')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'failed');

      return {
        total: total || 0,
        sent: sent || 0,
        pending: pending || 0,
        failed: failed || 0,
        successRate: total ? ((sent || 0) / total) * 100 : 0
      };
    }
  });

  const statusData = [
    { name: 'Entregue', value: (smsMetrics?.delivered || 0) + (waMetrics?.delivered || 0) + (emailMetrics?.sent || 0), color: '#10B981' },
    { name: 'Enviado', value: (smsMetrics?.sent || 0) + (waMetrics?.sent || 0), color: '#3B82F6' },
    { name: 'Pendente', value: (smsMetrics?.queued || 0) + (emailMetrics?.pending || 0), color: '#F59E0B' },
    { name: 'Falhou', value: (smsMetrics?.failed || 0) + (waMetrics?.failed || 0) + (emailMetrics?.failed || 0), color: '#EF4444' },
  ].filter(item => item.value > 0);

  const channelData = [
    { name: 'SMS', total: smsMetrics?.total || 0, delivered: smsMetrics?.delivered || 0, failed: smsMetrics?.failed || 0 },
    { name: 'WhatsApp', total: waMetrics?.total || 0, delivered: waMetrics?.delivered || 0, failed: waMetrics?.failed || 0 },
    { name: 'Email', total: emailMetrics?.total || 0, delivered: emailMetrics?.sent || 0, failed: emailMetrics?.failed || 0 },
  ];

  const handleExport = () => {
    const data = [
      ['Canal', 'Total', 'Entregues', 'Falhas', 'Taxa de Sucesso'],
      ['SMS', smsMetrics?.total || 0, smsMetrics?.delivered || 0, smsMetrics?.failed || 0, `${smsMetrics?.deliveryRate?.toFixed(1) || 0}%`],
      ['WhatsApp', waMetrics?.total || 0, waMetrics?.delivered || 0, waMetrics?.failed || 0, `${waMetrics?.deliveryRate?.toFixed(1) || 0}%`],
      ['Email', emailMetrics?.total || 0, emailMetrics?.sent || 0, emailMetrics?.failed || 0, `${emailMetrics?.successRate?.toFixed(1) || 0}%`],
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Comunicação');
    XLSX.writeFile(wb, `relatorio-comunicacao-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Filtros e Exportação */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
            <SelectItem value="365">Último ano</SelectItem>
          </SelectContent>
        </Select>

        <Button onClick={handleExport} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Exportar Excel
        </Button>
      </div>

      {/* Cards de Métricas por Canal */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">SMS</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{smsMetrics?.total?.toLocaleString('pt-BR') || 0}</div>
            <p className="text-xs text-muted-foreground">
              Taxa de entrega: <span className="text-green-600 font-medium">{smsMetrics?.deliveryRate?.toFixed(1) || 0}%</span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">WhatsApp</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{waMetrics?.total?.toLocaleString('pt-BR') || 0}</div>
            <p className="text-xs text-muted-foreground">
              Taxa de entrega: <span className="text-green-600 font-medium">{waMetrics?.deliveryRate?.toFixed(1) || 0}%</span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Email</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{emailMetrics?.total?.toLocaleString('pt-BR') || 0}</div>
            <p className="text-xs text-muted-foreground">
              Taxa de sucesso: <span className="text-green-600 font-medium">{emailMetrics?.successRate?.toFixed(1) || 0}%</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Status das Mensagens</CardTitle>
            <CardDescription>Distribuição por status consolidado</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {statusData.map((entry, index) => (
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
            <CardTitle>Comparativo por Canal</CardTitle>
            <CardDescription>Total de mensagens por canal de comunicação</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={channelData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="total" name="Total" fill="#3B82F6" />
                  <Bar dataKey="delivered" name="Entregues" fill="#10B981" />
                  <Bar dataKey="failed" name="Falhas" fill="#EF4444" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
