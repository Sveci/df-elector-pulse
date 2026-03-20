import { memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface RankingData {
  name: string;
  value: number;
}

interface RankingChartProps {
  title: string;
  data: RankingData[];
  icon?: React.ReactNode;
}

const COLORS = [
  "hsl(15, 89%, 54%)",   // primary-500
  "hsl(15, 85%, 63%)",   // primary-400
  "hsl(221, 83%, 53%)",  // info-500
  "hsl(158, 64%, 52%)",  // success-500
  "hsl(43, 96%, 56%)",   // warning-500
  "hsl(220, 9%, 46%)",   // gray-600
  "hsl(220, 13%, 91%)",  // gray-200
  "hsl(220, 14%, 96%)",  // gray-100
];

export const RankingChart = memo(({ title, data, icon }: RankingChartProps) => {
  return (
    <Card className="card-default">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 100, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
            <XAxis type="number" />
            <YAxis dataKey="name" type="category" width={90} style={{ fontSize: '12px' }} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid hsl(220, 13%, 91%)',
                borderRadius: '8px'
              }}
              labelFormatter={(value) => value}
              formatter={(value) => [`${value}`, 'Total']}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
});

RankingChart.displayName = "RankingChart";
