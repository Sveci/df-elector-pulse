import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ContactImport {
  nome_completo: string;
  whatsapp: string;
  data_nascimento: string;
  endereco: string;
  observacao?: string;
  cidade?: string;
}

interface ImportResult {
  success: boolean;
  total: number;
  inserted: number;
  updated: number;
  errors: Array<{ line: number; error: string }>;
}

function normalizePhone(phone: string | number): string {
  // Converter para string e limpar caracteres não-numéricos
  const cleaned = String(phone).replace(/\D/g, '');

  // 13 dígitos com 55 (internacional completo)
  if (cleaned.length === 13 && cleaned.startsWith('55')) {
    return `+${cleaned}`;
  }

  // 12 dígitos com 55 no início (sem 0)
  if (cleaned.length === 12 && cleaned.startsWith('55')) {
    return `+${cleaned}`;
  }

  // 12 dígitos com 0 na frente (055...)
  if (cleaned.length === 12 && cleaned.startsWith('0')) {
    const withoutZero = cleaned.substring(1); // Remove 0
    return `+55${withoutZero}`;
  }

  // 11 dígitos (DDDNÚMERO com 9)
  if (cleaned.length === 11) {
    return `+55${cleaned}`;
  }

  // 10 dígitos (DDDNÚMERO sem 9 - números antigos)
  if (cleaned.length === 10) {
    // Adiciona 9 após o DDD (2 primeiros dígitos)
    const ddd = cleaned.substring(0, 2);
    const numero = cleaned.substring(2);
    return `+55${ddd}9${numero}`;
  }

  // 9 dígitos (número sem DDD - usar DDD padrão 61 - Brasília)
  if (cleaned.length === 9) {
    return `+5561${cleaned}`;
  }

  // 8 dígitos (número sem DDD e sem 9 - adicionar ambos)
  if (cleaned.length === 8) {
    return `+55619${cleaned}`;
  }

  // 14 dígitos com erro comum: 5506XXXXXXXXXXX
  // Exemplo: 55061993218831 -> deve ser 5561993218831
  if (cleaned.length === 14 && cleaned.startsWith('5506')) {
    const fixedNumber = '55' + cleaned.substring(4); // Remove o "06" extra
    console.log(`⚠️ Corrigindo número com 14 dígitos: ${cleaned} -> ${fixedNumber}`);
    return normalizePhone(fixedNumber); // Recursão com número corrigido
  }

  throw new Error(`Telefone inválido: ${phone}. Formato esperado: (DD)9XXXX-XXXX ou variações`);
}

function parseDate(dateInput?: string | number): string | null {
  if (!dateInput) return null;

  try {
    let date: Date;

    // Se for número (timestamp Excel)
    if (typeof dateInput === 'number') {
      const excelEpoch = new Date(1899, 11, 30);
      date = new Date(excelEpoch.getTime() + dateInput * 86400000);
    } else {
      const dateStr = String(dateInput).trim();

      // DD/MM/YYYY ou DD-MM-YYYY
      const ddmmyyyyMatch = dateStr.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
      if (ddmmyyyyMatch) {
        const [, day, month, year] = ddmmyyyyMatch;
        date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      }
      // YYYY-MM-DD ou YYYY/MM/DD
      else if (dateStr.match(/^\d{4}[\/-]\d{1,2}[\/-]\d{1,2}$/)) {
        date = new Date(dateStr);
      } else {
        date = new Date(dateStr);
      }
    }

    if (isNaN(date.getTime())) {
      throw new Error('Data inválida');
    }

    // Formatar YYYY-MM-DD
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  } catch (error) {
    throw new Error(`Erro ao processar data: ${error}`);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verificar Authorization header
    const authHeader = req.headers.get('Authorization');
    console.log('Auth header presente:', !!authHeader);

    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Token de autenticação não fornecido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extrair o token JWT do header "Bearer <token>"
    const token = authHeader.replace('Bearer ', '');
    console.log('Token extraído, comprimento:', token.length);

    // Cliente para autenticação (ANON_KEY)
    const authClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Verificar autenticação passando o token explicitamente
    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser(token);

    if (authError || !user) {
      console.error('Erro de autenticação:', authError);
      return new Response(
        JSON.stringify({ error: 'Não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User ID autenticado:', user.id);

    // Cliente para operações no banco (SERVICE_ROLE_KEY)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Verificar se usuário tem role admin ou atendente
    const { data: userRoles } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    console.log('Role do usuário:', userRoles?.role);

    if (!userRoles || !['admin', 'atendente'].includes(userRoles.role)) {
      return new Response(
        JSON.stringify({ error: 'Usuário não autorizado' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { contacts } = await req.json();

    if (!Array.isArray(contacts) || contacts.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Nenhum contato fornecido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (contacts.length > 1000) {
      return new Response(
        JSON.stringify({ error: 'Máximo de 1000 contatos por importação' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Iniciando importação de ${contacts.length} contatos`);

    // Processar e validar todos os contatos primeiro
    const validContacts: any[] = [];
    const errors: Array<{ line: number; error: string }> = [];
    const phonesSeen = new Map<string, number>(); // telefone -> primeira linha

    for (let i = 0; i < contacts.length; i++) {
      const contact: ContactImport = contacts[i];
      const lineNumber = i + 2; // +2 porque linha 1 é cabeçalho

      try {
        // Validações básicas
        if (!contact.nome_completo || contact.nome_completo.trim().length === 0) {
          throw new Error('Nome completo é obrigatório');
        }
        if (!contact.whatsapp) {
          throw new Error('WhatsApp é obrigatório');
        }
        if (!contact.data_nascimento) {
          throw new Error('Data de nascimento é obrigatória');
        }
        if (!contact.endereco || contact.endereco.trim().length === 0) {
          throw new Error('Endereço é obrigatório');
        }

        // Normalizar telefone
        const telefone_norm = normalizePhone(contact.whatsapp);

        // Verificar duplicados NO MESMO ARQUIVO
        if (phonesSeen.has(telefone_norm)) {
          const firstLine = phonesSeen.get(telefone_norm);
          errors.push({
            line: lineNumber,
            error: `Telefone duplicado (já apareceu na linha ${firstLine}). Ignorado.`
          });
          console.log(`⚠️ Linha ${lineNumber}: Telefone duplicado ${telefone_norm} (primeira ocorrência na linha ${firstLine})`);
          continue; // Pular para próximo contato
        }

        phonesSeen.set(telefone_norm, lineNumber);

        // Buscar cidade_id (opcional - usar padrão se não fornecido)
        let cidade_id: string | null = null;

        if (contact.cidade) {
          const { data: cidade } = await supabaseClient
            .from('office_cities')
            .select('id')
            .ilike('nome', contact.cidade)
            .single();

          if (cidade) {
            cidade_id = cidade.id;
          }
        }

        // Se não encontrou cidade, usar primeira cidade ativa como fallback
        if (!cidade_id) {
          const { data: cidadePadrao } = await supabaseClient
            .from('office_cities')
            .select('id')
            .eq('status', 'active')
            .limit(1)
            .single();

          cidade_id = cidadePadrao?.id || null;
        }

        if (!cidade_id) {
          throw new Error('Nenhuma cidade disponível no sistema');
        }

        // Adicionar à lista de contatos válidos
        validContacts.push({
          nome: contact.nome_completo.trim(),
          telefone_norm,
          cidade_id,
          endereco: contact.endereco.trim(),
          data_nascimento: parseDate(contact.data_nascimento),
          observacao: contact.observacao?.trim() || null,
          source_type: 'manual',
          source_id: null,
          utm_source: null,
          utm_medium: null,
          utm_campaign: null,
          utm_content: null,
        });

        console.log(`✅ Contato ${lineNumber} validado: ${contact.nome_completo}`);

      } catch (error) {
        console.error(`❌ Erro na linha ${lineNumber}:`, error);
        errors.push({
          line: lineNumber,
          error: error instanceof Error ? error.message : 'Erro desconhecido',
        });

        // Log detalhado do contato problemático
        console.error(`Dados do contato problemático (linha ${lineNumber}):`, {
          nome: contact.nome_completo,
          whatsapp: contact.whatsapp,
          data_nascimento: contact.data_nascimento,
          endereco: contact.endereco,
          observacao: contact.observacao,
        });
      }
    }

    console.log(`Validação concluída: ${validContacts.length} válidos, ${errors.length} erros`);

    // Fazer UPSERT em lote (batch) para todos os contatos válidos
    let inserted = 0;
    let updated = 0;

    if (validContacts.length > 0) {
      console.log('Iniciando upsert em lote...');

      const { data: upsertData, error: upsertError } = await supabaseClient
        .from('office_contacts')
        .upsert(validContacts, {
          onConflict: 'telefone_norm',
          ignoreDuplicates: false // Atualiza se já existe
        })
        .select('id, created_at');

      if (upsertError) {
        console.error('Erro no upsert em lote:', upsertError);
        throw new Error(`Erro no upsert em lote: ${upsertError.message}`);
      }

      console.log(`Upsert concluído: ${upsertData?.length || 0} registros processados`);

      // Calcular inseridos vs atualizados comparando created_at com now()
      const now = new Date();
      const recentlyCreated = upsertData?.filter(c => {
        const created = new Date(c.created_at);
        return (now.getTime() - created.getTime()) < 10000; // Criado nos últimos 10 segundos
      }) || [];

      inserted = recentlyCreated.length;
      updated = validContacts.length - inserted;

      console.log(`Inseridos: ${inserted}, Atualizados: ${updated}`);
    }

    const result: ImportResult = {
      success: errors.length === 0,
      total: contacts.length,
      inserted,
      updated,
      errors,
    };

    console.log('Importação concluída:', {
      inserted: result.inserted,
      updated: result.updated,
      errors: result.errors.length,
    });

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro geral:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
