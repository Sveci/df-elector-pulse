import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface IBGECity {
  id: number;
  nome: string;
}

interface IBGEDistrito {
  id: number;
  nome: string;
  municipio: { id: number; nome: string };
}

async function fetchWithRetry(url: string, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return res;
      if (i < retries - 1) {
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, i)));
      } else {
        return res;
      }
    } catch (e) {
      if (i === retries - 1) throw e;
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, i)));
    }
  }
  throw new Error("Max retries reached");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { uf, include_districts, cidade_nome } = await req.json();

    if (!uf) {
      return new Response(JSON.stringify({ error: "UF is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const upperUf = uf.toUpperCase();

    // Check if we already have cities cached for this UF
    const { data: existing } = await supabase
      .from("ibge_cidades")
      .select("id")
      .eq("uf", upperUf)
      .limit(1);

    if (!existing || existing.length === 0) {
      // Fetch cities from IBGE with retry
      const res = await fetchWithRetry(
        `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${upperUf}/municipios?orderBy=nome`
      );
      if (!res.ok) {
        return new Response(
          JSON.stringify({
            error: `IBGE API temporarily unavailable (${res.status}). Cities must be seeded manually.`,
            suggestion: "Try again later or seed data via admin panel.",
          }),
          {
            status: 200, // Return 200 so frontend gets the message
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      const cities: IBGECity[] = await res.json();

      // Batch insert cities in chunks of 500
      const cityRows = cities.map((c) => ({
        ibge_id: c.id,
        nome: c.nome,
        uf: upperUf,
      }));

      for (let i = 0; i < cityRows.length; i += 500) {
        const chunk = cityRows.slice(i, i + 500);
        const { error } = await supabase
          .from("ibge_cidades")
          .upsert(chunk, { onConflict: "ibge_id" });
        if (error) throw error;
      }
    }

    // If districts requested for a specific city
    if (include_districts && cidade_nome) {
      const { data: cityData } = await supabase
        .from("ibge_cidades")
        .select("ibge_id")
        .eq("uf", upperUf)
        .ilike("nome", cidade_nome)
        .limit(1)
        .single();

      if (cityData) {
        const { data: existingDistricts } = await supabase
          .from("ibge_distritos")
          .select("id")
          .eq("cidade_ibge_id", cityData.ibge_id)
          .limit(1);

        if (!existingDistricts || existingDistricts.length === 0) {
          const dRes = await fetchWithRetry(
            `https://servicodados.ibge.gov.br/api/v1/localidades/municipios/${cityData.ibge_id}/distritos?orderBy=nome`
          );
          if (dRes.ok) {
            const districts: IBGEDistrito[] = await dRes.json();
            const districtRows = districts.map((d) => ({
              ibge_id: d.id,
              nome: d.nome,
              cidade_ibge_id: cityData.ibge_id,
              cidade_nome: cidade_nome,
              uf: upperUf,
            }));

            if (districtRows.length > 0) {
              const { error } = await supabase
                .from("ibge_distritos")
                .upsert(districtRows, { onConflict: "ibge_id" });
              if (error) throw error;
            }
          }
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      status: 200, // Return 200 to avoid SDK throwing
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
