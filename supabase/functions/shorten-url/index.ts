import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PRODUCTION_URL = Deno.env.get("APP_BASE_URL") || "https://app.eleitor360.ai";

interface ShortenUrlRequest {
  url: string;
  customCode?: string;
}

// Generate a random short code
function generateShortCode(length: number = 6): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("shorten-url: Starting request processing");

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { url, customCode }: ShortenUrlRequest = await req.json();

    if (!url) {
      console.error("shorten-url: Missing URL");
      return new Response(
        JSON.stringify({ error: "URL é obrigatória" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("shorten-url: Shortening URL:", url);

    // Check if URL already exists
    const { data: existingUrl } = await supabase
      .from("short_urls")
      .select("code")
      .eq("original_url", url)
      .maybeSingle();

    if (existingUrl) {
      console.log("shorten-url: URL already exists with code:", existingUrl.code);
      return new Response(
        JSON.stringify({
          code: existingUrl.code,
          shortUrl: `${PRODUCTION_URL}/s/${existingUrl.code}`,
          isNew: false
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Generate or use custom code
    let code = customCode || generateShortCode();
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      const { data, error } = await supabase
        .from("short_urls")
        .insert({ code, original_url: url })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") { // Unique constraint violation
          console.log("shorten-url: Code collision, generating new code");
          code = generateShortCode();
          attempts++;
          continue;
        }
        throw error;
      }

      console.log("shorten-url: Successfully created short URL with code:", code);

      // Build the short URL usando constante de produção
      const shortUrl = `${PRODUCTION_URL}/s/${code}`;

      return new Response(
        JSON.stringify({
          code,
          shortUrl,
          isNew: true
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    throw new Error("Não foi possível gerar um código único após várias tentativas");

  } catch (error: any) {
    console.error("shorten-url: Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
