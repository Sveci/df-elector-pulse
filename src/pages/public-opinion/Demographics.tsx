import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DEMOGRAPHIC_DATA } from "@/data/public-opinion/demoPublicOpinionData";
import { useMonitoredEntities } from "@/hooks/public-opinion/usePublicOpinion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { BarChart2 } from "lucide-react";
import { useMemo } from "react";
import { TopCommentsSection } from "@/components/public-opinion/TopCommentsSection";
const categoryColors = ['#3b82f6', '#22c55e', '#ef4444', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#6b7280', '#84cc16', '#f97316'];
const sourceColors = ['#E4405F', '#1DA1F2', '#1877F2', '#000000', '#FF0000', '#0088CC', '#8B5CF6', '#059669', '#FF4500', '#6b7280'];
const topicColors = ['#06b6d4', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#22c55e', '#ec4899', '#6b7280'];
const wordCloudColors = ['#3b82f6', '#8b5cf6', '#06b6d4', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#0ea5e9', '#6366f1', '#14b8a6'];

const demoWordCloud = [
  { word: 'Saúde', count: 42 }, { word: 'Educação', count: 38 }, { word: 'Segurança', count: 35 },
  { word: 'Infraestrutura', count: 28 }, { word: 'Transporte', count: 25 }, { word: 'Emprego', count: 22 },
  { word: 'Meio Ambiente', count: 20 }, { word: 'Moradia', count: 18 }, { word: 'Cultura', count: 15 },
  { word: 'Esporte', count: 14 }, { word: 'Tecnologia', count: 12 }, { word: 'Saneamento', count: 11 },
  { word: 'Mobilidade', count: 10 }, { word: 'Lazer', count: 9 }, { word: 'Assistência Social', count: 8 },
  { word: 'Iluminação', count: 7 }, { word: 'Acessibilidade', count: 6 }, { word: 'Pavimentação', count: 5 },
];

// Stop words em português para filtrar da nuvem de palavras
const STOP_WORDS = new Set([
  'a', 'o', 'e', 'é', 'de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na', 'nos', 'nas',
  'um', 'uma', 'uns', 'umas', 'por', 'para', 'com', 'sem', 'sob', 'sobre', 'entre',
  'que', 'se', 'não', 'nao', 'mais', 'muito', 'como', 'mas', 'ou', 'ao', 'aos', 'à', 'às',
  'seu', 'sua', 'seus', 'suas', 'meu', 'minha', 'ele', 'ela', 'eles', 'elas', 'isso',
  'este', 'esta', 'esse', 'essa', 'aquele', 'aquela', 'isto', 'aquilo', 'já', 'ainda',
  'também', 'tambem', 'foi', 'ser', 'ter', 'está', 'são', 'tem', 'vai', 'vou', 'era',
  'pode', 'só', 'so', 'nem', 'até', 'ate', 'todo', 'toda', 'todos', 'todas', 'eu', 'tu',
  'nós', 'vós', 'você', 'voce', 'vocês', 'voces', 'me', 'te', 'lhe', 'nos', 'vos', 'lhes',
  'os', 'as', 'lo', 'la', 'los', 'las', 'onde', 'quando', 'porque', 'pois', 'então', 'entao',
  'assim', 'depois', 'antes', 'aqui', 'ali', 'lá', 'la', 'cá', 'ca', 'bem', 'mal', 'sim',
  'dia', 'ano', 'vez', 'coisa', 'gente', 'tudo', 'nada', 'algo', 'cada', 'outro', 'outra',
  'outros', 'outras', 'mesmo', 'mesma', 'próprio', 'própria', 'novo', 'nova', 'grande',
  'bom', 'boa', 'melhor', 'pior', 'maior', 'menor', 'muito', 'muita', 'muitos', 'muitas',
  'pouco', 'poucos', 'há', 'ha', 'aí', 'ai', 'dessa', 'desse', 'nessa', 'nesse', 'pela',
  'pelo', 'pelas', 'pelos', 'numa', 'num', 'dela', 'dele', 'delas', 'deles', 'essa', 'esse',
  'estas', 'estes', 'aquelas', 'aqueles', 'quem', 'qual', 'quais', 'quanto', 'quanta',
  'pro', 'pra', 'www', 'http', 'https', 'com', 'the', 'and', 'for', 'are', 'but', 'not',
  'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'will', 'has', 'his',
  'how', 'its', 'may', 'new', 'now', 'old', 'see', 'way', 'who', 'did', 'get', 'let',
  'say', 'she', 'too', 'use', 'from', 'have', 'been', 'than', 'then', 'that', 'this',
  'what', 'with', 'they', 'just', 'like', 'sobre', 'contra', 'após', 'durante',
  'seria', 'sendo', 'sido', 'tendo', 'fazer', 'feito', 'fez', 'disse', 'diz',
  'vai', 'vem', 'ver', 'dar', 'deu', 'deve', 'quer', 'saber', 'ficar', 'ficou',
]);

function useDemographicsData(entityId?: string) {
  return useQuery({
    queryKey: ["po_demographics", entityId],
    enabled: !!entityId,
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 30);

      // Fetch all analyses with pagination
      let allAnalyses: any[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data } = await supabase
          .from("po_sentiment_analyses")
          .select("category, topics, sentiment")
          .eq("entity_id", entityId!)
          .gte("analyzed_at", since.toISOString())
          .range(from, from + pageSize - 1);
        if (!data || data.length === 0) break;
        allAnalyses = allAnalyses.concat(data);
        if (data.length < pageSize) break;
        from += pageSize;
      }

      // Fetch all mentions for source breakdown AND word cloud
      let allMentions: any[] = [];
      from = 0;
      while (true) {
        const { data } = await supabase
          .from("po_mentions")
          .select("source, content")
          .eq("entity_id", entityId!)
          .gte("collected_at", since.toISOString())
          .range(from, from + pageSize - 1);
        if (!data || data.length === 0) break;
        allMentions = allMentions.concat(data);
        if (data.length < pageSize) break;
        from += pageSize;
      }

      // Categories breakdown
      const catCounts: Record<string, number> = {};
      allAnalyses.forEach(a => {
        if (a.category) catCounts[a.category] = (catCounts[a.category] || 0) + 1;
      });
      const totalCat = Object.values(catCounts).reduce((s, v) => s + v, 0) || 1;
      const categories = Object.entries(catCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([label, count]) => ({ label: capitalize(label), value: Math.round(count / totalCat * 100), count }));

      // Topics breakdown
      const topicCounts: Record<string, number> = {};
      allAnalyses.forEach(a => {
        (a.topics || []).forEach((t: string) => {
          topicCounts[t] = (topicCounts[t] || 0) + 1;
        });
      });
      const totalTopics = Object.values(topicCounts).reduce((s, v) => s + v, 0) || 1;
      const topics = Object.entries(topicCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([label, count]) => ({ label: capitalize(label), value: Math.round(count / totalTopics * 100), count }));

      // Source breakdown
      const sourceCounts: Record<string, number> = {};
      allMentions.forEach(m => {
        const normalizedSource = normalizeSource(m.source);
        sourceCounts[normalizedSource] = (sourceCounts[normalizedSource] || 0) + 1;
      });
      const totalSources = allMentions.length || 1;
      const sources = Object.entries(sourceCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([label, count]) => ({ label, value: Math.round(count / totalSources * 100), count }));

      // Sentiment breakdown
      const sentCounts: Record<string, number> = { positivo: 0, negativo: 0, neutro: 0 };
      allAnalyses.forEach(a => {
        if (sentCounts[a.sentiment] !== undefined) sentCounts[a.sentiment]++;
      });
      const totalSent = allAnalyses.length || 1;
      const sentiment = Object.entries(sentCounts).map(([label, count]) => ({
        label: capitalize(label),
        value: Math.round(count / totalSent * 100),
        count,
      }));

      // Word cloud: extract words from mention content
      const wordCounts: Record<string, number> = {};
      allMentions.forEach(m => {
        if (!m.content) return;
        const words = m.content
          .toLowerCase()
          .replace(/[^a-záàâãéèêíïóôõúüç\s-]/gi, ' ')
          .split(/\s+/)
          .filter((w: string) => w.length >= 4 && !STOP_WORDS.has(w));
        words.forEach((w: string) => {
          wordCounts[w] = (wordCounts[w] || 0) + 1;
        });
      });
      const wordCloud = Object.entries(wordCounts)
        .filter(([_, count]) => count >= 2)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 60)
        .map(([word, count]) => ({ word: capitalize(word), count }));

      return { categories, topics, sources, sentiment, wordCloud, total: allAnalyses.length };
    },
  });
}

function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, ' ');
}

function normalizeSource(source: string): string {
  if (source.includes('instagram')) return 'Instagram';
  if (source.includes('twitter')) return 'Twitter/X';
  if (source.includes('facebook')) return 'Facebook';
  if (source.includes('tiktok')) return 'TikTok';
  if (source.includes('youtube')) return 'YouTube';
  if (source.includes('telegram')) return 'Telegram';
  if (source.includes('reddit')) return 'Reddit';
  if (source.includes('news') || source.includes('portais') || source.includes('fontes')) return 'Notícias';
  if (source.includes('influencer')) return 'Influenciadores';
  if (source.includes('sites_custom')) return 'Sites';
  return capitalize(source);
}

const sentimentColors = ['#22c55e', '#ef4444', '#94a3b8'];

const Demographics = () => {
  const { data: entities } = useMonitoredEntities();
  const principalEntity = entities?.find(e => e.is_principal) || entities?.[0];
  const { data: demoData } = useDemographicsData(principalEntity?.id);

  const hasRealData = demoData && demoData.total > 0;

  const categories = hasRealData ? demoData.categories : DEMOGRAPHIC_DATA.gender.map(g => ({ ...g, count: 0 }));
  const topics = hasRealData ? demoData.topics : DEMOGRAPHIC_DATA.topics_interest.map(t => ({ ...t, count: 0 }));
  const sources = hasRealData ? demoData.sources : DEMOGRAPHIC_DATA.regions.map(r => ({ label: r.label, value: r.value, count: 0 }));
  const sentiment = hasRealData ? demoData.sentiment : [
    { label: 'Positivo', value: 60, count: 0 },
    { label: 'Negativo', value: 25, count: 0 },
    { label: 'Neutro', value: 15, count: 0 },
  ];

  const wordCloud = hasRealData && demoData.wordCloud?.length > 0 ? demoData.wordCloud : demoWordCloud;
  const maxCount = Math.max(...wordCloud.map(w => w.count), 1);

  const shuffledWords = useMemo(() => {
    const arr = [...wordCloud];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(wordCloud)]);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader icon={BarChart2} title="Análise de Conteúdo" subtitle="Categorias, temas e fontes das menções sobre você">
        {!hasRealData && <Badge variant="outline">Demo</Badge>}
      </PageHeader>

      {/* Word Cloud - full width */}
      <Card>
        <CardHeader><CardTitle>Nuvem de Palavras</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 py-6 min-h-[200px]">
            {shuffledWords.map((w, i) => {
              const ratio = w.count / maxCount;
              const fontSize = Math.max(0.75, ratio * 2.5);
              const opacity = Math.max(0.5, ratio);
              return (
                <span
                  key={w.word}
                  className="inline-block cursor-default transition-transform hover:scale-110"
                  title={`${w.word}: ${w.count} menções`}
                  style={{
                    fontSize: `${fontSize}rem`,
                    fontWeight: ratio > 0.6 ? 700 : ratio > 0.3 ? 500 : 400,
                    color: wordCloudColors[i % wordCloudColors.length],
                    opacity,
                    lineHeight: 1.3,
                  }}
                >
                  {w.word}
                </span>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Categories */}
        <Card>
          <CardHeader><CardTitle>Categorias de Sentimento</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="h-[250px] w-[250px] flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={categories} cx="50%" cy="50%" outerRadius={100} innerRadius={45} dataKey="value" paddingAngle={2} strokeWidth={2}>
                      {categories.map((_, i) => <Cell key={i} fill={categoryColors[i % categoryColors.length]} />)}
                    </Pie>
                    <Tooltip formatter={(value: number, name: string, entry: any) => [`${value}% (${entry.payload.count || 0})`, name]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-col gap-1.5 text-sm w-full">
                {categories.map((cat, i) => (
                  <div key={cat.label} className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: categoryColors[i % categoryColors.length] }} />
                    <span className="truncate flex-1 text-muted-foreground">{cat.label}</span>
                    <span className="font-semibold tabular-nums text-foreground">{cat.value}%</span>
                    <span className="text-xs text-muted-foreground tabular-nums">({cat.count})</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sentiment */}
        <Card>
          <CardHeader><CardTitle>Distribuição de Sentimento</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={sentiment} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="value" label={({ label, value }) => `${label}: ${value}%`}>
                    {sentiment.map((_, i) => <Cell key={i} fill={sentimentColors[i]} />)}
                  </Pie>
                  <Legend />
                  <Tooltip formatter={(value: number, name: string, entry: any) => [`${value}% (${entry.payload.count || 0})`, name]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Sources */}
        <Card>
          <CardHeader><CardTitle>Distribuição por Fonte</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sources} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" domain={[0, 'auto']} unit="%" />
                  <YAxis type="category" dataKey="label" width={100} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value: number, name: string, entry: any) => [`${value}% (${entry.payload.count || 0})`, 'Menções']} />
                  <Bar dataKey="value" name="%" radius={[0, 4, 4, 0]}>
                    {sources.map((_, i) => <Cell key={i} fill={sourceColors[i % sourceColors.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Topics of Interest */}
        <Card>
          <CardHeader><CardTitle>Temas de Maior Interesse</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topics}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis unit="%" />
                  <Tooltip formatter={(value: number, name: string, entry: any) => [`${value}% (${entry.payload.count || 0})`, 'Ocorrências']} />
                  <Bar dataKey="value" name="%" radius={[4, 4, 0, 0]}>
                    {topics.map((_, i) => <Cell key={i} fill={topicColors[i % topicColors.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Demographics;
