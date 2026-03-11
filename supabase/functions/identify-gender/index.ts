import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { names } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY não configurada");
    }

    console.log(`Processing ${names.length} names for gender identification`);

    const prompt = `Analise os nomes brasileiros abaixo e retorne APENAS "Masculino", "Feminino" ou "Não identificado" para cada um.
    
Regras:
- Nomes claramente masculinos (João, Carlos, Pedro, Roberto) → "Masculino"
- Nomes claramente femininos (Maria, Ana, Júlia, Fernanda) → "Feminino"  
- Nomes ambíguos ou siglas (Alex, Pat, ELEIA, iniciais) → "Não identificado"
- Considere nomes compostos completos
- Para nomes muito curtos ou siglas, use "Não identificado"

Retorne em formato JSON array:
[
  {"id": "uuid1", "genero": "Masculino"},
  {"id": "uuid2", "genero": "Feminino"}
]

Nomes para analisar:
${names.map((n: any) => `{"id": "${n.id}", "nome": "${n.nome}"}`).join('\n')}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Você é um especialista em identificação de gênero por nomes brasileiros. Seja preciso e consistente." },
          { role: "user", content: prompt }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Erro Lovable AI:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit excedido. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes. Entre em contato com o suporte." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`Erro na API: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices[0].message.content;
    
    console.log("AI Response:", content);
    
    // Extrair JSON da resposta (pode vir com markdown ```json```)
    let jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error("Resposta sem JSON válido:", content);
      throw new Error("Resposta da IA não contém JSON válido");
    }
    
    let jsonStr = jsonMatch[0];
    
    // Tentar fazer parse, se falhar tentar reparar JSON truncado
    let genderResults;
    try {
      genderResults = JSON.parse(jsonStr);
    } catch (parseError) {
      console.log("JSON incompleto, tentando reparar...");
      // Tentar encontrar o último objeto completo
      const lastCompleteIndex = jsonStr.lastIndexOf('}');
      if (lastCompleteIndex > 0) {
        jsonStr = jsonStr.substring(0, lastCompleteIndex + 1) + ']';
        try {
          genderResults = JSON.parse(jsonStr);
          console.log(`Recuperados ${genderResults.length} resultados de JSON incompleto`);
        } catch {
          throw new Error("Não foi possível reparar JSON truncado");
        }
      } else {
        throw new Error("JSON irrecuperável");
      }
    }
    
    console.log(`Successfully identified ${genderResults.length} genders`);

    return new Response(
      JSON.stringify({ results: genderResults }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Erro na função identify-gender:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Erro desconhecido" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
