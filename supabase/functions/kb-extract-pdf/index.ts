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
