import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Flame, Heart, ExternalLink, Loader2 } from "lucide-react";
import { useTopHeavyComments, useTopPraiseComments, type TopComment } from "@/hooks/public-opinion/useTopComments";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Entity {
  id: string;
  name: string;
  is_principal?: boolean;
}

interface TopCommentsSectionProps {
  entities: Entity[];
}

const sentimentBadge = (sentiment: string) => {
  if (sentiment === "positivo") return <Badge className="bg-green-500/15 text-green-600 border-green-500/30 text-xs">Positivo</Badge>;
  if (sentiment === "negativo") return <Badge className="bg-red-500/15 text-red-600 border-red-500/30 text-xs">Negativo</Badge>;
  return <Badge variant="secondary" className="text-xs">Neutro</Badge>;
};

function CommentCard({ comment, rank }: { comment: TopComment; rank: number }) {
  const dateStr = comment.date
    ? format(new Date(comment.date), "dd MMM yyyy", { locale: ptBR })
    : "";

  return (
    <div className="flex gap-3 p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors">
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
        {rank}
      </div>
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm text-foreground">{comment.author}</span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{comment.source}</Badge>
          {sentimentBadge(comment.sentiment)}
          <span className="text-[10px] text-muted-foreground ml-auto">{dateStr}</span>
        </div>
        <p className="text-sm text-muted-foreground line-clamp-3">{comment.content}</p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>Score: <strong className="text-foreground">{comment.sentiment_score.toFixed(2)}</strong></span>
          <Badge variant="secondary" className="text-[10px]">{comment.category}</Badge>
          {comment.url !== "#" && (
            <a href={comment.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline ml-auto">
              <ExternalLink className="h-3 w-3" /> Ver original
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function EntityComments({ entityId, isPrincipal }: { entityId: string; isPrincipal: boolean }) {
  const { data: heavy, isLoading: loadingH } = useTopHeavyComments(entityId, isPrincipal);
  const { data: praise, isLoading: loadingP } = useTopPraiseComments(entityId, isPrincipal);
  const [innerTab, setInnerTab] = useState("heavy");

  const isLoading = loadingH || loadingP;

  return (
    <Tabs value={innerTab} onValueChange={setInnerTab}>
      <TabsList className="mb-4">
        <TabsTrigger value="heavy" className="gap-1.5">
          <Flame className="h-3.5 w-3.5 text-red-500" /> Mais Pesados ({heavy?.length || 0})
        </TabsTrigger>
        <TabsTrigger value="praise" className="gap-1.5">
          <Heart className="h-3.5 w-3.5 text-green-500" /> Melhores Elogios ({praise?.length || 0})
        </TabsTrigger>
      </TabsList>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <TabsContent value="heavy" className="space-y-2 mt-0">
            {(!heavy || heavy.length === 0) ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum comentário negativo encontrado.</p>
            ) : (
              heavy.map((c, i) => <CommentCard key={c.id} comment={c} rank={i + 1} />)
            )}
          </TabsContent>
          <TabsContent value="praise" className="space-y-2 mt-0">
            {(!praise || praise.length === 0) ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum elogio encontrado.</p>
            ) : (
              praise.map((c, i) => <CommentCard key={c.id} comment={c} rank={i + 1} />)
            )}
          </TabsContent>
        </>
      )}
    </Tabs>
  );
}

export function TopCommentsSection({ entities }: TopCommentsSectionProps) {
  const [selectedEntity, setSelectedEntity] = useState(
    entities.find((e) => e.is_principal)?.id || entities[0]?.id || ""
  );

  if (!entities || entities.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-primary" />
          Top 15 Comentários — Críticas e Elogios
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={selectedEntity} onValueChange={setSelectedEntity}>
          <TabsList className="mb-4 flex-wrap h-auto gap-1">
            {entities.map((e) => (
              <TabsTrigger key={e.id} value={e.id} className="text-xs">
                {e.name}
                {e.is_principal && <Badge variant="secondary" className="ml-1.5 text-[9px] px-1 py-0">Principal</Badge>}
              </TabsTrigger>
            ))}
          </TabsList>
          {entities.map((e) => (
            <TabsContent key={e.id} value={e.id} className="mt-0">
              <EntityComments entityId={e.id} isPrincipal={!!e.is_principal} />
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
