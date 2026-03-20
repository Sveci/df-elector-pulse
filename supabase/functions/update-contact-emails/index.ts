import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ContactUpdate {
  nome: string;
  email: string;
  whatsapp: string;
}

interface UpdateResult {
  success: boolean;
  updated: number;
  notFound: Array<{ line: number; reason: string; nome: string; whatsapp: string }>;
}

function normalizePhone(phone: string): string {
  const clean = phone.replace(/\D/g, '');

  if (clean.startsWith('55')) {
    const withoutCountry = clean.substring(2);

    if (withoutCountry.startsWith('5506')) {
      return '+5561' + withoutCountry.substring(4);
    }

    if (withoutCountry.length === 10 && withoutCountry.startsWith('61')) {
      return '+5561' + '9' + withoutCountry.substring(2);
    }

    if (withoutCountry.length === 11) {
      return '+55' + withoutCountry;
    }

    return '+55' + withoutCountry;
  }

  if (clean.length === 12 && clean.startsWith('5506')) {
    return '+5561' + clean.substring(4);
  }

  if (clean.length === 10 && clean.startsWith('61')) {
    return '+5561' + '9' + clean.substring(2);
  }

  if (clean.length === 9) {
    return '+5561' + clean;
  }

  if (clean.length === 8) {
    return '+5561' + '9' + clean;
  }

  if (clean.length === 11) {
    return '+55' + clean;
  }

  return '+55' + clean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { contacts } = await req.json() as { contacts: ContactUpdate[] };

    console.log(`Processando ${contacts.length} contatos para atualização de email`);

    const updated: Array<{ nome: string; email: string; telefone: string }> = [];
    const notFound: Array<{ line: number; reason: string; nome: string; whatsapp: string }> = [];

    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];
      const line = i + 2; // +2 porque começa na linha 2 do CSV (após header)

      try {
        // Normalizar telefone
        const telefone_norm = normalizePhone(contact.whatsapp);

        // Buscar contato pelo telefone
        const { data: existing, error: selectError } = await supabaseClient
          .from('office_contacts')
          .select('id, nome, email')
          .eq('telefone_norm', telefone_norm)
          .maybeSingle();

        if (selectError) {
          console.error(`Erro ao buscar contato linha ${line}:`, selectError);
          notFound.push({
            line,
            reason: 'Erro na busca: ' + selectError.message,
            nome: contact.nome,
            whatsapp: contact.whatsapp
          });
          continue;
        }

        if (!existing) {
          notFound.push({
            line,
            reason: 'Telefone não encontrado no banco de dados',
            nome: contact.nome,
            whatsapp: contact.whatsapp
          });
          continue;
        }

        // Comparar nomes (case-insensitive, trimmed)
        const normalizedExistingName = existing.nome.trim().toLowerCase();
        const normalizedContactName = contact.nome.trim().toLowerCase();

        if (normalizedExistingName !== normalizedContactName) {
          notFound.push({
            line,
            reason: `Nome diferente. Banco: "${existing.nome}", CSV: "${contact.nome}"`,
            nome: contact.nome,
            whatsapp: contact.whatsapp
          });
          continue;
        }

        // Match perfeito! Atualizar email
        const { error: updateError } = await supabaseClient
          .from('office_contacts')
          .update({ email: contact.email })
          .eq('id', existing.id);

        if (updateError) {
          console.error(`Erro ao atualizar contato linha ${line}:`, updateError);
          notFound.push({
            line,
            reason: 'Erro ao atualizar: ' + updateError.message,
            nome: contact.nome,
            whatsapp: contact.whatsapp
          });
          continue;
        }

        updated.push({
          nome: existing.nome,
          email: contact.email,
          telefone: contact.whatsapp
        });

        console.log(`✓ Linha ${line}: Email atualizado para ${existing.nome}`);

      } catch (error) {
        console.error(`Erro ao processar linha ${line}:`, error);
        notFound.push({
          line,
          reason: 'Erro inesperado: ' + (error as Error).message,
          nome: contact.nome,
          whatsapp: contact.whatsapp
        });
      }
    }

    const result: UpdateResult = {
      success: true,
      updated: updated.length,
      notFound
    };

    console.log(`Resultado: ${updated.length} atualizados, ${notFound.length} não encontrados`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Erro geral:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: (error as Error).message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
