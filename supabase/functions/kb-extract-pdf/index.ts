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
    const rawText = extractTextFromPDF(bytes);
    const rawQuality = analyzeTextQuality(rawText);
    console.log(
      `[kb-extract-pdf] Raw extraction: ${rawText.length} chars, readable ratio: ${rawQuality.readableRatio.toFixed(2)}, word count: ${rawQuality.wordCount}, stopword ratio: ${rawQuality.stopwordRatio.toFixed(2)}, vowel ratio: ${rawQuality.vowelWordRatio.toFixed(2)}, avg word length: ${rawQuality.averageWordLength.toFixed(2)}, usable: ${rawQuality.usable}`
    );

    const base64Content = uint8ArrayToBase64(bytes);

    let extractionMethod: "raw_cleanup" | "pdf_vision" = rawQuality.usable ? "raw_cleanup" : "pdf_vision";
    let extractedText = "";

    if (rawQuality.usable) {
      console.log(`[kb-extract-pdf] Trying raw text cleanup first`);
      extractedText = await extractWithAI(
        lovableApiKey,
        buildRawCleanupMessages(file.name, rawText)
      );

      const cleanedQuality = analyzeTextQuality(extractedText);
      console.log(
        `[kb-extract-pdf] Raw cleanup result: ${extractedText.length} chars, readable ratio: ${cleanedQuality.readableRatio.toFixed(2)}, word count: ${cleanedQuality.wordCount}, stopword ratio: ${cleanedQuality.stopwordRatio.toFixed(2)}, usable: ${cleanedQuality.usable}`
      );

      if (!cleanedQuality.usable) {
        console.log(`[kb-extract-pdf] Raw cleanup still looks corrupted, retrying with PDF vision`);
        extractionMethod = "pdf_vision";
        extractedText = await extractWithAI(
          lovableApiKey,
          buildPdfVisionMessages(file.name, base64Content)
        );
      }
    } else {
      console.log(`[kb-extract-pdf] Raw text looks corrupted, using PDF vision directly`);
      extractedText = await extractWithAI(
        lovableApiKey,
        buildPdfVisionMessages(file.name, base64Content)
      );
    }

    const finalQuality = analyzeTextQuality(extractedText);

    if (!extractedText || extractedText.length < 50 || !finalQuality.usable) {
      // Last resort fallback only if raw text is genuinely readable
      if (rawQuality.usable && rawText.length > 50) {
        return new Response(
          JSON.stringify({ text: rawText, method: "raw_fallback" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error("Não foi possível extrair conteúdo legível do PDF");
    }

    console.log(`[kb-extract-pdf] Extracted ${extractedText.length} chars via ${extractionMethod}`);

    return new Response(
      JSON.stringify({ text: extractedText, method: extractionMethod, chars: extractedText.length }),
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

function analyzeTextQuality(text: string) {
  if (!text || text.trim().length === 0) {
    return {
      readableRatio: 0,
      wordCount: 0,
      stopwordRatio: 0,
      vowelWordRatio: 0,
      averageWordLength: 0,
      usable: false,
    };
  }

  const readableRatio = getReadableRatio(text);
  const words = (text.match(/[A-Za-zÀ-ÿ]{2,}/g) || []).map((word) => word.toLowerCase());
  const wordCount = words.length;
  const stopwords = new Set([
    "a", "o", "e", "de", "da", "do", "das", "dos", "em", "para", "por", "com", "sem", "na", "no", "nas", "nos",
    "um", "uma", "uns", "umas", "que", "se", "ao", "aos", "à", "às", "como", "mais", "mas", "foi", "ser", "sua",
    "seu", "ou", "também", "já", "não", "sim", "the", "and", "for", "with", "from", "this", "that", "are", "was", "you"
  ]);

  const stopwordCount = words.filter((word) => stopwords.has(word)).length;
  const vowelWordCount = words.filter((word) => /[aeiouáàâãéêíóôõú]/i.test(word)).length;
  const totalWordLength = words.reduce((sum, word) => sum + word.length, 0);
  const averageWordLength = wordCount > 0 ? totalWordLength / wordCount : 0;
  const stopwordRatio = wordCount > 0 ? stopwordCount / wordCount : 0;
  const vowelWordRatio = wordCount > 0 ? vowelWordCount / wordCount : 0;
  const longRunsOfSymbols = /(.)\1{7,}|[\x00-\x08\x0E-\x1F]/.test(text);

  const usable =
    text.length > 300 &&
    readableRatio > 0.75 &&
    wordCount > 80 &&
    stopwordRatio > 0.02 &&
    vowelWordRatio > 0.7 &&
    averageWordLength >= 2.5 &&
    averageWordLength <= 12 &&
    !longRunsOfSymbols;

  return {
    readableRatio,
    wordCount,
    stopwordRatio,
    vowelWordRatio,
    averageWordLength,
    usable,
  };
}

async function extractWithAI(lovableApiKey: string, messages: any[]) {
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
    throw new Error("Não foi possível extrair o texto do PDF");
  }

  const aiData = await aiResponse.json();
  return aiData.choices?.[0]?.message?.content || "";
}

function buildSystemPrompt() {
  return {
    role: "system",
    content: `Você é um extrator de texto profissional. Sua tarefa é extrair TODO o conteúdo textual de um documento PDF.

REGRAS:
- Extraia absolutamente todo o texto legível do documento
- Mantenha a estrutura original (títulos, parágrafos, listas, tabelas)
- Preserve a ordem do conteúdo
- Se houver tabelas, converta para formato texto estruturado
- NÃO resuma nem omita nada - queremos o conteúdo COMPLETO
- NÃO adicione comentários ou explicações suas
- Se o conteúdo fornecido parecer corrompido, ignore-o e reconstrua a partir do PDF
- Retorne APENAS o texto extraído do documento`
  };
}

function buildRawCleanupMessages(fileName: string, rawText: string) {
  return [
    buildSystemPrompt(),
    {
      role: "user",
      content: `Aqui está o texto bruto extraído de um PDF chamado "${fileName}".
Se esse texto parecer corrompido, truncado, comprimido ou ilegível, responda exatamente com: [[CORRUPTED_TEXT]].
Caso esteja legível, limpe, organize e estruture mantendo TODO o conteúdo original:

${rawText.substring(0, 80000)}`
    }
  ];
}

function buildPdfVisionMessages(fileName: string, base64Content: string) {
  return [
    buildSystemPrompt(),
    {
      role: "user",
      content: [
        {
          type: "text",
          text: `Extraia todo o conteúdo textual deste documento PDF chamado "${fileName}". Retorne o texto completo, estruturado e organizado.`
        },
        {
          type: "image_url",
          image_url: {
            url: `data:application/pdf;base64,${base64Content}`
          }
        }
      ]
    }
  ];
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
