import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    // Buscar chunks que NÃO têm embedding
    const { data: chunks, error } = await supabase
      .from("kb_chunks")
      .select("id, content, tenant_id")
      .is("embedding", null)
      .limit(50);

    if (error) throw error;
    if (!chunks || chunks.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: "All chunks already indexed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[brain-kb-reindex] Processing ${chunks.length} chunks`);

    let processed = 0;
    let errors = 0;

    // Processar em batches de 10
    for (let i = 0; i < chunks.length; i += 10) {
      const batch = chunks.slice(i, i + 10);
      const texts = batch.map((c: any) => c.content.substring(0, 2000));

      try {
        const embResp = await fetch(`${supabaseUrl}/functions/v1/brain-embed`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({ texts }),
        });

        const embData = await embResp.json();
        if (!embData.success) {
          console.error("[brain-kb-reindex] Embedding failed:", embData.error);
          errors += batch.length;
          continue;
        }

        for (let j = 0; j < batch.length; j++) {
          const { error: updateError } = await supabase
            .from("kb_chunks")
            .update({ embedding: JSON.stringify(embData.embeddings[j]) })
            .eq("id", batch[j].id);

          if (updateError) {
            console.error(`[brain-kb-reindex] Update error for chunk ${batch[j].id}:`, updateError.message);
            errors++;
          } else {
            processed++;
          }
        }

        if (i + 10 < chunks.length) {
          await new Promise(r => setTimeout(r, 500));
        }
      } catch (batchErr) {
        console.error("[brain-kb-reindex] Batch error:", batchErr);
        errors += batch.length;
      }
    }

    const remaining = await supabase
      .from("kb_chunks")
      .select("id", { count: "exact", head: true })
      .is("embedding", null);

    console.log(`[brain-kb-reindex] Done: processed=${processed}, errors=${errors}, remaining=${remaining.count || 0}`);

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        errors,
        remaining: remaining.count || 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[brain-kb-reindex] Fatal:", err);
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
