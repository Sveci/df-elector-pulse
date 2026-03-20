import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const demographicQuestions: Record<string, any> = {
  genero: {
    tipo: "multipla_escolha",
    pergunta: "Qual é o seu gênero?",
    opcoes: ["Masculino", "Feminino", "Prefiro não informar"],
    obrigatoria: true,
  },
  faixa_etaria: {
    tipo: "multipla_escolha",
    pergunta: "Qual é a sua faixa etária?",
    opcoes: ["16 a 24 anos", "25 a 34 anos", "35 a 44 anos", "45 a 59 anos", "60 anos ou mais"],
    obrigatoria: true,
  },
  escolaridade: {
    tipo: "multipla_escolha",
    pergunta: "Qual é o seu nível de escolaridade?",
    opcoes: ["Ensino Fundamental", "Ensino Médio", "Ensino Superior incompleto", "Ensino Superior completo", "Pós-graduação"],
    obrigatoria: true,
  },
  renda: {
    tipo: "multipla_escolha",
    pergunta: "Qual é a renda mensal da sua família?",
    opcoes: ["Até 2 salários mínimos", "De 2 a 5 salários mínimos", "De 5 a 10 salários mínimos", "Acima de 10 salários mínimos", "Prefiro não informar"],
    obrigatoria: true,
  },
  regiao: {
    tipo: "texto_curto",
    pergunta: "Em qual região/cidade você mora?",
    opcoes: [],
    obrigatoria: true,
  },
  religiao: {
    tipo: "multipla_escolha",
    pergunta: "Qual é a sua religião?",
    opcoes: ["Católica", "Evangélica", "Espírita", "Outras", "Sem religião", "Prefiro não informar"],
    obrigatoria: false,
  },
  ocupacao: {
    tipo: "multipla_escolha",
    pergunta: "Qual é a sua situação profissional atual?",
    opcoes: ["Empregado(a) com carteira", "Autônomo/Empreendedor", "Servidor público", "Desempregado(a)", "Aposentado(a)", "Estudante", "Outro"],
    obrigatoria: false,
  },
};

const getSystemPrompt = (surveyType: string, config: any) => {
  const basePrompt = `Você é um especialista em pesquisas eleitorais e de opinião pública no Brasil, com ampla experiência em metodologias utilizadas por institutos renomados como Datafolha, IBOPE, Quaest e Real Time Big Data.

Sua tarefa é gerar perguntas de pesquisa profissionais e metodologicamente corretas.

REGRAS IMPORTANTES:
1. Todas as perguntas devem ser claras, objetivas e imparciais
2. Evite termos que induzam respostas
3. Use a linguagem formal brasileira
4. Siga as melhores práticas de pesquisas eleitorais

FORMATO DE RESPOSTA (JSON):
Retorne APENAS um array JSON de perguntas, sem texto adicional. Cada pergunta deve ter:
{
  "ordem": número,
  "tipo": "multipla_escolha" | "escala" | "nps" | "texto_curto" | "texto_longo" | "sim_nao",
  "pergunta": "texto da pergunta",
  "opcoes": ["opção 1", "opção 2", ...] // apenas para multipla_escolha
  "obrigatoria": true | false
}`;

  switch (surveyType) {
    case "intencao_voto":
      return `${basePrompt}

TIPO: PESQUISA DE INTENÇÃO DE VOTO
Cargo: ${config.cargo || "não especificado"}
Candidatos: ${config.candidatos || "não especificados"}
Incluir espontânea: ${config.incluirEspontanea ? "sim" : "não"}
Incluir estimulada: ${config.incluirEstimulada ? "sim" : "não"}
Incluir 2º turno: ${config.incluirSegundoTurno ? "sim" : "não"}

ESTRUTURA OBRIGATÓRIA:
1. Se espontânea: pergunta aberta "Em quem você votaria para [cargo]?" (texto_curto)
2. Se estimulada: pergunta com lista de candidatos + "Branco/Nulo" + "Indeciso/Não sabe"
3. Pergunta sobre certeza do voto (escala 1-5)
4. Pergunta sobre principal motivação da escolha
5. Se 2º turno: cenários de confronto entre principais candidatos

Gere entre 5 e 10 perguntas profissionais.`;

    case "rejeicao":
      return `${basePrompt}

TIPO: PESQUISA DE REJEIÇÃO POLÍTICA
Candidatos: ${config.candidatosRejeicao || "não especificados"}
Partidos: ${config.partidosRejeicao || "não especificados"}
Nível: ${config.nivelDetalhamento}

ESTRUTURA:
1. Pergunta sobre rejeição a candidatos: "Em qual destes candidatos você NÃO votaria de jeito nenhum?"
2. Se houver partidos: pergunta sobre rejeição partidária
3. Se avançado: pergunta sobre intensidade da rejeição (escala)
4. Se avançado: pergunta sobre motivos da rejeição

Gere entre 4 e 8 perguntas.`;

    case "avaliacao_governo":
      return `${basePrompt}

TIPO: PESQUISA DE AVALIAÇÃO DE GOVERNO
Esfera: ${config.esfera}
Áreas: ${config.areasAvaliar?.join(", ") || "não especificadas"}
Comparativo: ${config.incluirComparativo ? "sim" : "não"}

ESTRUTURA:
1. Avaliação geral do governo (escala: Ótimo, Bom, Regular, Ruim, Péssimo)
2. Para cada área selecionada: avaliação específica com mesma escala
3. Pergunta sobre principal problema/prioridade
4. Se comparativo: pergunta comparando com gestão anterior
5. Pergunta sobre expectativa futura

Use sempre a escala padrão: Ótimo, Bom, Regular, Ruim, Péssimo.
Gere entre 6 e 12 perguntas.`;

    case "recall":
      return `${basePrompt}

TIPO: PESQUISA DE RECALL E CONHECIMENTO
Políticos: ${config.politicosRecall || "não especificados"}
Tipo identificação: ${config.tipoRecall}

ESTRUTURA:
1. Pergunta de recall espontâneo: "Quais políticos você consegue lembrar?"
2. Para cada político listado:
   - Conhecimento (conhece/não conhece)
   - Avaliação (positiva/neutra/negativa)
   - Se conhece: de onde conhece (TV, redes sociais, indicação, etc)

Gere entre 5 e 15 perguntas dependendo do número de políticos.`;

    case "clima_opiniao":
      return `${basePrompt}

TIPO: PESQUISA DE CLIMA DE OPINIÃO
Temas: ${config.temasClima?.join(", ") || "não especificados"}
Formato: ${config.formatoClima}

ESTRUTURA:
1. Pergunta sobre direção do país/estado/cidade (certo/errado caminho)
2. Pergunta sobre otimismo/pessimismo para o futuro
3. Para cada tema selecionado:
   - Importância do tema (escala ou ranking)
   - Satisfação com situação atual
4. Pergunta sobre principal problema (${config.formatoClima === "aberta" ? "texto aberto" : "lista de opções"})
5. Pergunta sobre prioridades para o governo

Gere entre 8 e 15 perguntas.`;

    case "diagnostico_territorial":
      return `${basePrompt}

TIPO: PESQUISA DE DIAGNÓSTICO TERRITORIAL
Regiões: ${config.regioesFoco || "não especificadas"}
Foco: ${config.focoTerritorial}

ESTRUTURA:
1. Identificação da região de moradia
2. Tempo de residência na região
3. Se foco em presença política:
   - Conhecimento de políticos atuantes na região
   - Visibilidade de ações políticas locais
4. Se foco em demandas:
   - Principal problema da região
   - Avaliação de serviços públicos locais (saúde, segurança, infraestrutura)
   - Prioridades para melhoria
5. Pergunta sobre participação em eventos/reuniões comunitárias

Gere entre 8 e 12 perguntas.`;

    case "personalizada":
      return `${basePrompt}

TIPO: PESQUISA PERSONALIZADA
Objetivo descrito pelo usuário:
"${config.objetivoPersonalizado}"

Com base no objetivo acima, crie perguntas profissionais que:
1. Atendam diretamente ao objetivo descrito
2. Sigam metodologia de pesquisa de opinião
3. Incluam variedade de tipos de perguntas
4. Mantenham neutralidade e clareza

Gere entre 6 e 12 perguntas relevantes.`;

    default:
      return basePrompt;
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ── Authentication ────────────────────────────────────────────────────────
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: "Não autenticado" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  const token = authHeader.replace("Bearer ", "");
  const supabaseAuth = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!
  );
  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
  if (authError || !user) {
    return new Response(
      JSON.stringify({ error: "Token inválido ou expirado" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  // ─────────────────────────────────────────────────────────────────────────

  try {
    const { surveyType, config, demographics } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = getSystemPrompt(surveyType, config);
    
    const userPrompt = `Gere as perguntas da pesquisa conforme as especificações. 
    
Retorne APENAS o array JSON de perguntas, sem explicações ou texto adicional.
Comece a numeração (ordem) a partir de ${(demographics?.length || 0) + 1}, pois as perguntas demográficas serão adicionadas antes.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Taxa de requisições excedida. Tente novamente em alguns segundos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos no workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("Erro ao comunicar com o serviço de IA");
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("generate-survey-questions error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
