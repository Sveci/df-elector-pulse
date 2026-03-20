import { memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { Users, Calendar } from "lucide-react";
import { useDemoMask } from "@/contexts/DemoModeContext";

interface ProfileData {
  genero: Array<{ label: string; valor: number }>;
  idade_media: number;
  participacao_eventos_pct: number;
}

interface ProfileStatsProps {
  data: ProfileData;
}

const GENDER_COLORS = {
  Feminino: "hsl(340, 82%, 52%)",
  Masculino: "hsl(221, 83%, 53%)",
};

export const ProfileStats = memo(({ data }: ProfileStatsProps) => {
  const { m } = useDemoMask();
  const genderData = data.genero.map((item) => ({
    name: item.label,
    value: m.number(item.valor, "gender_" + item.label),
  }));

  return (
    <Card className="card-default">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-5 w-5 text-primary-500" />
          Perfil dos Cadastrados
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Gráfico de Pizza */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Distribuição por Gênero</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={genderData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}%`}
                outerRadius={70}
                fill="#8884d8"
                dataKey="value"
              >
                {genderData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={GENDER_COLORS[entry.name as keyof typeof GENDER_COLORS]}
                  />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Métricas adicionais */}
        <div className="space-y-3 pt-3 border-t">
          <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-gray-700">Idade Média</span>
            </div>
            <span className="text-lg font-bold text-blue-600">{m.number(data.idade_media, "idade_media")} anos</span>
          </div>

          <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-gray-700">Presença em Eventos</span>
            </div>
            <span className="text-lg font-bold text-green-600">{m.percentage(data.participacao_eventos_pct, "part_eventos")}%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

ProfileStats.displayName = "ProfileStats";
