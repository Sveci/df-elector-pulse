import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const funnelId = url.searchParams.get('funnel_id');
    const contactId = url.searchParams.get('contact_id');

    if (!funnelId) {
      return new Response(JSON.stringify({ error: "funnel_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Processing download for funnel: ${funnelId}, contact: ${contactId || 'anonymous'}`);

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get funnel to retrieve the file URL and name
    const { data: funnel, error: funnelError } = await supabase
      .from('lead_funnels')
      .select('lead_magnet_url, nome, lead_magnet_nome')
      .eq('id', funnelId)
      .single();

    if (funnelError || !funnel) {
      console.error("Error fetching funnel:", funnelError);
      return new Response(JSON.stringify({ error: "Funnel not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Increment download count
    const { error: rpcError } = await supabase.rpc('increment_funnel_metric', {
      _funnel_id: funnelId,
      _metric: 'downloads'
    });

    if (rpcError) {
      console.error("Error incrementing metric:", rpcError);
    }

    // Record download for contact if contact_id provided (only first download counts for points)
    if (contactId) {
      // Use upsert with ON CONFLICT to handle duplicates - only first download triggers points
      const { error: downloadError } = await supabase
        .from('contact_downloads')
        .upsert({
          contact_id: contactId,
          funnel_id: funnelId,
          funnel_name: funnel.nome,
          lead_magnet_nome: funnel.lead_magnet_nome,
        }, {
          onConflict: 'contact_id,funnel_id',
          ignoreDuplicates: true // Ignore if already exists (no points for repeat downloads)
        });

      if (downloadError) {
        console.error("Error recording download:", downloadError);
      } else {
        console.log(`Download recorded for contact: ${contactId}`);
      }
    }

    // Fetch the file from storage and return it directly
    const fileUrl = funnel.lead_magnet_url.trim();
    console.log(`Fetching file from: ${fileUrl}`);

    const fileResponse = await fetch(fileUrl);

    if (!fileResponse.ok) {
      console.error(`Failed to fetch file: ${fileResponse.status} ${fileResponse.statusText}`);
      return new Response(JSON.stringify({ error: "Failed to fetch file" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get file content and content type
    const fileBuffer = await fileResponse.arrayBuffer();
    const contentType = fileResponse.headers.get('content-type') || 'application/octet-stream';

    // Extract filename from URL or use lead magnet name
    const urlParts = fileUrl.split('/');
    let fileName = decodeURIComponent(urlParts[urlParts.length - 1]);

    // Clean up filename - use lead_magnet_nome if available
    if (funnel.lead_magnet_nome) {
      const extension = fileName.split('.').pop() || 'pdf';
      fileName = `${funnel.lead_magnet_nome}.${extension}`;
    }

    console.log(`Serving file: ${fileName}, size: ${fileBuffer.byteLength} bytes`);

    // Return the file directly with download headers
    return new Response(fileBuffer, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': fileBuffer.byteLength.toString(),
      },
    });

  } catch (error) {
    console.error("Error in download-material:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Erro desconhecido"
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});