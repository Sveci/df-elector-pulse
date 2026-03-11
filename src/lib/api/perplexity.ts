import { supabase } from "@/integrations/supabase/client";

export type SearchType =
  | "general"
  | "news_clipping"
  | "legislation"
  | "public_opinion"
  | "whatsapp_fallback";

interface SearchOptions {
  lang?: string;
  country?: string;
  recency?: "day" | "week" | "month" | "year";
  max_tokens?: number;
}

interface PerplexityResponse {
  success: boolean;
  answer?: string;
  citations?: string[];
  model?: string;
  type?: string;
  error?: string;
}

export const perplexityApi = {
  async search(
    query: string,
    type: SearchType = "general",
    entityName?: string,
    options?: SearchOptions
  ): Promise<PerplexityResponse> {
    const { data, error } = await supabase.functions.invoke("perplexity-search", {
      body: { type, query, entity_name: entityName, options },
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return data;
  },

  async newsClipping(entityName: string, additionalContext?: string): Promise<PerplexityResponse> {
    const query = additionalContext
      ? `Notícias recentes sobre ${entityName}: ${additionalContext}`
      : `Últimas notícias e matérias jornalísticas sobre ${entityName} na política brasileira`;
    return this.search(query, "news_clipping", entityName, { recency: "week" });
  },

  async legislationMonitor(topic: string): Promise<PerplexityResponse> {
    return this.search(topic, "legislation", undefined, { recency: "month" });
  },

  async publicOpinionContext(entityName: string, topic?: string): Promise<PerplexityResponse> {
    const query = topic
      ? `Análise de opinião pública sobre ${entityName} em relação a: ${topic}`
      : `Percepção pública e análises sobre ${entityName} na política brasileira`;
    return this.search(query, "public_opinion", entityName, { recency: "month" });
  },
};
