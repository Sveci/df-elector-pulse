import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      throw new Error("No file provided");
    }

    console.log(`[kb-extract-pdf] File: ${file.name}, size: ${file.size}, type: ${file.type}`);

    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_SIZE) {
      return new Response(
        JSON.stringify({ error: "Arquivo muito grande. Máximo: 10MB" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    // Step 1: Try basic text extraction from PDF
    let rawText = extractTextFromPDF(bytes);
    const readableRatio = getReadableRatio(rawText);
    console.log(`[kb-extract-pdf] Raw extraction: ${rawText.length} chars, readable ratio: ${readableRatio.toFixed(2)}`);

    // Only consider raw text useful if it has a high ratio of readable characters
    const hasUsableRawText = rawText.length > 500 && readableRatio > 0.7;

    const base64Content = uint8ArrayToBase64(bytes);

    const messages: any[] = [
      {
        role: "system",
        content: `Você é um extrator de texto profissional. Sua tarefa é extrair TODO o conteúdo textual de um documento PDF.

REGRAS:
- Extraia absolutamente todo o texto legível do documento
- Mantenha a estrutura original (títulos, parágrafos, listas, tabelas)
- Preserve a ordem do conteúdo
- Se houver tabelas, converta para formato texto estruturado
- NÃO resuma nem omita nada - queremos o conteúdo COMPLETO
- NÃO adicione comentários ou explicações suas
- Retorne APENAS o texto extraído do documento`
      }
    ];

    if (hasUsableRawText) {
      console.log(`[kb-extract-pdf] Using raw text for AI cleanup`);
      messages.push({
        role: "user",
        content: `Aqui está o texto bruto extraído de um PDF chamado "${file.name}". 
Limpe, organize e estruture este texto, mantendo TODO o conteúdo original:

${rawText.substring(0, 80000)}`
      });
    } else {
      console.log(`[kb-extract-pdf] Raw text is garbage/insufficient, using base64 vision`);
      messages.push({
        role: "user",
        content: [
          {
            type: "text",
            text: `Extraia todo o conteúdo textual deste documento PDF chamado "${file.name}". Retorne o texto completo, estruturado e organizado.`
          },
          {
            type: "image_url",
            image_url: {
              url: `data:application/pdf;base64,${base64Content}`
            }
          }
        ]
      });
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        max_tokens: 16000,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("[kb-extract-pdf] AI error:", aiResponse.status, errText);

      // Fallback: return raw extraction if we have it
      if (rawText.length > 100) {
        return new Response(
          JSON.stringify({ text: rawText, method: "raw_fallback" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw new Error("Não foi possível extrair o texto do PDF");
    }

    const aiData = await aiResponse.json();
    const extractedText = aiData.choices?.[0]?.message?.content || "";

    if (!extractedText || extractedText.length < 50) {
      // Last resort fallback
      if (rawText.length > 50) {
        return new Response(
          JSON.stringify({ text: rawText, method: "raw_fallback" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error("Não foi possível extrair conteúdo significativo do PDF");
    }

    console.log(`[kb-extract-pdf] Extracted ${extractedText.length} chars via AI`);

    return new Response(
      JSON.stringify({ text: extractedText, method: "ai", chars: extractedText.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[kb-extract-pdf] Error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function extractTextFromPDF(bytes: Uint8Array): string {
  const decoder = new TextDecoder("latin1");
  const rawText = decoder.decode(bytes);

  // Extract text between stream/endstream markers
  const streamMatches = rawText.match(/stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g);
  if (!streamMatches) return "";

  const texts = streamMatches
    .map((s) => s.replace(/stream[\r\n]+/, "").replace(/[\r\n]+endstream/, ""))
    .filter((s) => /[a-zA-ZÀ-ú]{3,}/.test(s))
    .map((s) =>
      s
        .replace(/[^\x20-\x7E\xA0-\xFF\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter((s) => s.length > 10);

  return texts.join("\n\n").substring(0, 100000);
}

function getReadableRatio(text: string): number {
  if (!text || text.length === 0) return 0;
  // Count characters that are normal readable text (letters, digits, punctuation, whitespace)
  const readable = text.match(/[a-zA-ZÀ-ÿ0-9\s.,;:!?()[\]{}'"\-\/\\@#$%&*+=<>]/g);
  return (readable?.length || 0) / text.length;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}
