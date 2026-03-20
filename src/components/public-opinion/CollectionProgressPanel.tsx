import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2, CheckCircle2, XCircle, Search,
  Globe, MessageSquare, Radio, Brain, Sparkles
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const SOURCE_LABELS: Record<string, string> = {
  news: "Notícias (Bing/Yahoo)",
  google_news: "Google News",
  google_search: "Google Search",
  twitter: "Twitter/X",
  twitter_comments: "Twitter Respostas",
  instagram: "Instagram",
  instagram_comments: "Instagram Comentários",
  facebook: "Facebook",
  facebook_comments: "Facebook Comentários",
  tiktok: "TikTok",
  tiktok_comments: "TikTok Comentários",
  youtube_comments: "YouTube Comentários",
  youtube_search: "YouTube Busca",
  threads: "Threads",
  reddit: "Reddit",
  telegram: "Telegram",
  portais_df: "Portais DF",
  portais_br: "Portais BR",
  fontes_oficiais: "Fontes Oficiais",
  influencer_comments: "Influenciadores",
  sites_custom: "Sites Customizados",
  perplexity_web: "Perplexity Web",
};

const SOURCE_ICONS: Record<string, string> = {
  twitter: "🐦", instagram: "📸", facebook: "📘", tiktok: "🎵",
  youtube_comments: "▶️", youtube_search: "▶️", threads: "🧵",
  reddit: "🤖", telegram: "✈️", news: "📰", google_news: "📰",
  google_search: "🔍", portais_df: "🏛️", portais_br: "🌐",
  fontes_oficiais: "🏛️", influencer_comments: "⭐", sites_custom: "🌍",
  twitter_comments: "🐦", instagram_comments: "📸",
  facebook_comments: "📘", tiktok_comments: "🎵",
  perplexity_web: "🔮",
};

interface CollectionJob {
  id: string;
  status: string;
  sources_requested: string[];
  sources_completed: string[];
  source_current: string | null;
  mentions_found: number;
  mentions_inserted: number;
  mentions_analyzed: number;
  analysis_total: number;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  progress_log: { source: string; found: number; ts: string; provider?: string }[];
}

interface CollectionProgressPanelProps {
  jobId?: string | null;
  entityId?: string | null;
  onComplete?: () => void;
}

export function CollectionProgressPanel({ jobId: externalJobId, entityId, onComplete }: CollectionProgressPanelProps) {
  const [job, setJob] = useState<CollectionJob | null>(null);
  const [resolvedJobId, setResolvedJobId] = useState<string | null>(externalJobId || null);

  // Auto-detect running jobs when no explicit jobId is provided
  useEffect(() => {
    if (externalJobId) {
      setResolvedJobId(externalJobId);
      return;
    }
    if (!entityId) return;

    const findActiveJob = async () => {
      const { data } = await (supabase as any)
        .from("po_collection_jobs")
        .select("id, status")
        .eq("entity_id", entityId)
        .in("status", ["pending", "running", "processing"])
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        setResolvedJobId(data.id);
      }
    };
    findActiveJob();
  }, [externalJobId, entityId]);

  useEffect(() => {
    if (!resolvedJobId) return;

    const fetchJob = async () => {
      const { data } = await (supabase as any)
        .from("po_collection_jobs")
        .select("*")
        .eq("id", resolvedJobId)
        .single();
      if (data) {
        const j = data as CollectionJob;
        setJob(j);
        // If already completed/error on first fetch, auto-dismiss
        if (j.status === "completed" || j.status === "error") {
          onComplete?.();
          setTimeout(() => { setResolvedJobId(null); setJob(null); }, 5000);
        }
      }
    };
    fetchJob();

    // Poll every 15s as fallback in case realtime misses updates
    const pollInterval = setInterval(fetchJob, 15000);

    // Auto-recovery: if job is stuck in processing/running for too long (5 min), dismiss
    const staleTimeout = setTimeout(() => {
      setJob((prev) => {
        if (prev && (prev.status === "running" || prev.status === "processing")) {
          console.warn("CollectionProgressPanel: dismissing stale job", resolvedJobId);
          onComplete?.();
          setResolvedJobId(null);
          return null;
        }
        return prev;
      });
    }, 5 * 60 * 1000);

    const channel = supabase
      .channel(`job-${resolvedJobId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "po_collection_jobs",
          filter: `id=eq.${resolvedJobId}`,
        },
        (payload) => {
          const updated = payload.new as unknown as CollectionJob;
          setJob(updated);
          if (updated.status === "completed" || updated.status === "error") {
            onComplete?.();
            setTimeout(() => {
              setResolvedJobId(null);
              setJob(null);
            }, 8000);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
      clearTimeout(staleTimeout);
    };
  }, [resolvedJobId, onComplete]);

  if (!resolvedJobId || !job) return null;

  const totalSources = job.sources_requested.length;
  const completedSources = job.sources_completed.length;
  const isRunning = job.status === "running";
  const isProcessing = job.status === "processing";
  const isCompleted = job.status === "completed";
  const isError = job.status === "error";
  const elapsed = Math.round((Date.now() - new Date(job.started_at).getTime()) / 1000);

  const collectionPct = totalSources > 0 ? Math.round((completedSources / totalSources) * 100) : 0;
  const analysisPct = (job.analysis_total || 0) > 0
    ? Math.round(((job.mentions_analyzed || 0) / job.analysis_total) * 100)
    : 0;

  // Overall progress: collection is 50%, analysis is 50%
  const overallPct = isProcessing || isCompleted
    ? Math.round(50 + (analysisPct / 2))
    : Math.round(collectionPct / 2);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10, height: 0 }}
        animate={{ opacity: 1, y: 0, height: "auto" }}
        exit={{ opacity: 0, y: -10, height: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card className={`border-2 ${
          isRunning ? "border-primary/40 bg-primary/5" :
          isProcessing ? "border-amber-500/40 bg-amber-50" :
          isCompleted ? "border-green-500/30 bg-green-50" :
          "border-destructive/30 bg-destructive/5"
        }`}>
          <CardContent className="pt-4 pb-4 space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isRunning ? (
                  <div className="relative">
                    <Radio className="h-5 w-5 text-primary animate-pulse" />
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-primary rounded-full animate-ping" />
                  </div>
                ) : isProcessing ? (
                  <div className="relative">
                    <Brain className="h-5 w-5 text-amber-600 animate-pulse" />
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-amber-500 rounded-full animate-ping" />
                  </div>
                ) : isCompleted ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-destructive" />
                )}
                <span className="font-semibold text-sm">
                  {isRunning ? "Coletando menções em tempo real..." :
                   isProcessing ? "Processando menções com IA..." :
                   isCompleted ? "Coleta e processamento concluídos!" :
                   "Erro na coleta"}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>{completedSources}/{totalSources} fontes</span>
                <span>{elapsed}s</span>
              </div>
            </div>

            {/* Progress bar */}
            <Progress value={overallPct} className="h-2" />

            {/* Two-phase indicator */}
            <div className="flex items-center gap-6">
              {/* Collection phase */}
              <div className="flex items-center gap-1.5">
                <Search className={`h-4 w-4 ${isRunning ? "text-primary" : "text-muted-foreground"}`} />
                <span className="text-sm font-medium">
                  <motion.span
                    key={job.mentions_found}
                    initial={{ scale: 1.3, color: "hsl(var(--primary))" }}
                    animate={{ scale: 1, color: "inherit" }}
                    transition={{ duration: 0.3 }}
                  >
                    {job.mentions_found}
                  </motion.span>
                  {" "}menções encontradas
                </span>
                {!isRunning && job.mentions_inserted > 0 && (
                  <Badge variant="secondary" className="text-xs ml-1">
                    {job.mentions_inserted} novas
                  </Badge>
                )}
              </div>

              {/* Processing phase */}
              {(isProcessing || isCompleted) && (job.analysis_total || 0) > 0 && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-1.5"
                >
                  <Sparkles className={`h-4 w-4 ${isProcessing ? "text-amber-600 animate-pulse" : "text-green-600"}`} />
                  <span className="text-sm font-medium">
                    <motion.span
                      key={job.mentions_analyzed}
                      initial={{ scale: 1.3, color: "#d97706" }}
                      animate={{ scale: 1, color: "inherit" }}
                      transition={{ duration: 0.3 }}
                    >
                      {job.mentions_analyzed || 0}
                    </motion.span>
                    /{job.analysis_total} analisadas
                  </span>
                  {isProcessing && <Loader2 className="h-3 w-3 animate-spin text-amber-600" />}
                  {isCompleted && <CheckCircle2 className="h-3 w-3 text-green-600" />}
                </motion.div>
              )}
            </div>

            {/* Processing detail when in processing phase */}
            {isProcessing && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="flex items-center gap-2 text-xs text-amber-700 bg-amber-100/50 rounded-md px-3 py-2"
              >
                <Brain className="h-4 w-4 flex-shrink-0" />
                <span>
                  Analisando sentimento, categorias e temas com IA...
                  {analysisPct > 0 && <strong className="ml-1">{analysisPct}%</strong>}
                </span>
              </motion.div>
            )}

            {/* Source progress grid */}
            <div className="flex flex-wrap gap-1.5">
              {job.sources_requested.map((source) => {
                const isCurrentSource = job.source_current === source;
                const isDone = job.sources_completed.includes(source);
                const logEntry = job.progress_log.find(l => l.source === source);
                const hasError = logEntry?.provider?.startsWith("error:");
                const found = logEntry?.found ?? 0;

                return (
                  <motion.div
                    key={source}
                    layout
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Badge
                      variant={isDone ? (hasError ? "destructive" : "default") : isCurrentSource ? "secondary" : "outline"}
                      className={`text-xs gap-1 transition-all ${isCurrentSource ? "animate-pulse border-primary ring-1 ring-primary/30" : ""}`}
                    >
                      <span>{SOURCE_ICONS[source] || "📄"}</span>
                      <span>{SOURCE_LABELS[source] || source}</span>
                      {isCurrentSource && <Loader2 className="h-3 w-3 animate-spin" />}
                      {isDone && !hasError && <span className="font-bold">({found})</span>}
                      {isDone && hasError && <XCircle className="h-3 w-3" />}
                    </Badge>
                  </motion.div>
                );
              })}
            </div>

            {isError && job.error_message && (
              <p className="text-xs text-destructive">{job.error_message}</p>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}