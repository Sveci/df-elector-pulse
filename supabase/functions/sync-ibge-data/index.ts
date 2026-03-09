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

    // Check if we already have cities cached for this UF
    const { data: existing } = await supabase
      .from("ibge_cidades")
      .select("id")
      .eq("uf", uf)
      .limit(1);

    if (!existing || existing.length === 0) {
      // Fetch cities from IBGE
      const res = await fetch(
        `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`
      );
      if (!res.ok) throw new Error(`IBGE API error: ${res.status}`);
      const cities: IBGECity[] = await res.json();

      // Batch insert cities
      const cityRows = cities.map((c) => ({
        ibge_id: c.id,
        nome: c.nome,
        uf: uf.toUpperCase(),
      }));

      // Insert in chunks of 500
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
      // Find the city's IBGE ID
      const { data: cityData } = await supabase
        .from("ibge_cidades")
        .select("ibge_id")
        .eq("uf", uf.toUpperCase())
        .ilike("nome", cidade_nome)
        .limit(1)
        .single();

      if (cityData) {
        // Check if districts are already cached
        const { data: existingDistricts } = await supabase
          .from("ibge_distritos")
          .select("id")
          .eq("cidade_ibge_id", cityData.ibge_id)
          .limit(1);

        if (!existingDistricts || existingDistricts.length === 0) {
          const dRes = await fetch(
            `https://servicodados.ibge.gov.br/api/v1/localidades/municipios/${cityData.ibge_id}/distritos?orderBy=nome`
          );
          if (dRes.ok) {
            const districts: IBGEDistrito[] = await dRes.json();
            const districtRows = districts.map((d) => ({
              ibge_id: d.id,
              nome: d.nome,
              cidade_ibge_id: cityData.ibge_id,
              cidade_nome: cidade_nome,
              uf: uf.toUpperCase(),
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
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
