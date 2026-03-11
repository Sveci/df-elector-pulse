import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Inicializar cliente Supabase
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

// ═══════════════════════════════════════════════════════════
// FUNÇÕES DISPONÍVEIS PARA O AGENTE IA
// ═══════════════════════════════════════════════════════════

const availableFunctions: Record<string, (params: any) => Promise<any>> = {
  
  // ──────────────────────────────────────────────────────────
  // LÍDERES E GAMIFICAÇÃO
  // ──────────────────────────────────────────────────────────
  consultar_lideres: async (params: { limit?: number, cidade_id?: string, ordenar_por?: string }) => {
    console.log('Executando consultar_lideres com params:', params);
    
    const orderColumn = params.ordenar_por === 'cadastros' ? 'cadastros' : 'pontuacao_total';
    
    let query = supabase
      .from('lideres')
      .select(`
        id, nome_completo, cadastros, pontuacao_total, status, is_active,
        cidade:office_cities(nome)
      `)
      .eq('is_active', true)
      .order(orderColumn, { ascending: false });
    
    if (params.cidade_id) {
      query = query.eq('cidade_id', params.cidade_id);
    }
    
    if (params.limit) query.limit(params.limit);
    
    const { data, error } = await query;
    if (error) {
      console.error('Erro ao consultar líderes:', error);
      throw error;
    }
    
    // Calcular nível de gamificação
    const lideresComNivel = (data || []).map((lider: any) => {
      const pontos = lider.pontuacao_total || 0;
      let nivel = 'Bronze';
      if (pontos >= 51) nivel = 'Diamante';
      else if (pontos >= 31) nivel = 'Ouro';
      else if (pontos >= 11) nivel = 'Prata';
      
      const cidadeObj = Array.isArray(lider.cidade) ? lider.cidade[0] : lider.cidade;
      
      return {
        nome: lider.nome_completo,
        cadastros: lider.cadastros,
        pontos: pontos,
        nivel,
        regiao: cidadeObj?.nome || 'Não informada'
      };
    });
    
    console.log('Resultado consultar_lideres:', lideresComNivel.length, 'líderes');
    return lideresComNivel;
  },
  
  // ──────────────────────────────────────────────────────────
  // TEMAS/PAUTAS POPULARES
  // ──────────────────────────────────────────────────────────
  consultar_temas: async (params: { limit?: number }) => {
    console.log('Executando consultar_temas com params:', params);
    const query = supabase
      .from('temas')
      .select('id, tema, cadastros')
      .order('cadastros', { ascending: false });
    
    if (params.limit) query.limit(params.limit);
    
    const { data, error } = await query;
    if (error) {
      console.error('Erro ao consultar temas:', error);
      throw error;
    }
    
    const resultado = (data || []).map(t => ({
      pauta: t.tema,
      interessados: t.cadastros
    }));
    
    console.log('Resultado consultar_temas:', resultado);
    return resultado;
  },
  
  // ──────────────────────────────────────────────────────────
  // PERFIL DEMOGRÁFICO
  // ──────────────────────────────────────────────────────────
  consultar_perfil_demografico: async () => {
    console.log('Executando consultar_perfil_demografico');
    const { data, error } = await supabase
      .from('perfil_demografico')
      .select('genero, valor');
    
    if (error) {
      console.error('Erro ao consultar perfil:', error);
      throw error;
    }
    
    const resultado = (data || []).map(p => ({
      genero: p.genero,
      percentual: p.valor
    }));
    
    console.log('Resultado consultar_perfil_demografico:', resultado);
    return resultado;
  },

  // ──────────────────────────────────────────────────────────
  // REGIÕES ADMINISTRATIVAS (Cidades/RAs)
  // ──────────────────────────────────────────────────────────
  consultar_regioes: async (params: { status?: string }) => {
    console.log('Executando consultar_regioes com params:', params);
    let query = supabase
      .from('office_cities')
      .select('id, nome, codigo_ra, status')
      .order('nome', { ascending: true });
    
    if (params.status) {
      query = query.eq('status', params.status);
    }
    
    const { data, error } = await query;
    if (error) {
      console.error('Erro ao consultar regiões:', error);
      throw error;
    }
    
    const resultado = (data || []).map(c => ({
      nome: c.nome,
      codigo: c.codigo_ra,
      ativa: c.status === 'active'
    }));
    
    console.log('Resultado consultar_regioes:', resultado.length, 'regiões');
    return resultado;
  },
  
  // ──────────────────────────────────────────────────────────
  // BASE DE CONTATOS
  // ──────────────────────────────────────────────────────────
  consultar_contatos: async (params: { 
    cidade_id?: string, 
    source_type?: string,
    genero?: string,
    is_verified?: boolean,
    periodo?: string
  }) => {
    console.log('Executando consultar_contatos com params:', params);
    
    // Total de contatos
    let totalQuery = supabase.from('office_contacts').select('id', { count: 'exact', head: true });
    
    // Contatos por região
    const { data: porRegiao } = await supabase
      .from('office_contacts')
      .select('cidade_id, cidade:office_cities(nome)')
      .not('cidade_id', 'is', null);
    
    // Contatos por origem
    const { data: porOrigem } = await supabase
      .from('office_contacts')
      .select('source_type');
    
    // Contatos por gênero  
    const { data: porGenero } = await supabase
      .from('office_contacts')
      .select('genero');
    
    // Verificados vs não verificados
    const { data: verificacao } = await supabase
      .from('office_contacts')
      .select('is_verified');
    
    const { count: total } = await totalQuery;
    
    // Agregar por região
    const regioesMap = new Map();
    (porRegiao || []).forEach((c: any) => {
      const cidadeObj = Array.isArray(c.cidade) ? c.cidade[0] : c.cidade;
      const nome = cidadeObj?.nome || 'Não informada';
      regioesMap.set(nome, (regioesMap.get(nome) || 0) + 1);
    });
    const distribuicaoRegioes = Array.from(regioesMap.entries())
      .map(([regiao, quantidade]) => ({ regiao, quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 10);
    
    // Agregar por origem
    const origensMap = new Map();
    (porOrigem || []).forEach(c => {
      const tipo = c.source_type || 'manual';
      const label = tipo === 'lider' ? 'Indicação de Líder' : 
                    tipo === 'evento' ? 'Evento' :
                    tipo === 'captacao' ? 'Funil de Captação' : 'Importação/Manual';
      origensMap.set(label, (origensMap.get(label) || 0) + 1);
    });
    const distribuicaoOrigens = Array.from(origensMap.entries())
      .map(([origem, quantidade]) => ({ origem, quantidade }));
    
    // Agregar por gênero
    const generoMap = new Map();
    (porGenero || []).forEach(c => {
      const g = c.genero || 'Não identificado';
      generoMap.set(g, (generoMap.get(g) || 0) + 1);
    });
    const distribuicaoGenero = Array.from(generoMap.entries())
      .map(([genero, quantidade]) => ({ genero, quantidade }));
    
    // Taxa de verificação
    const verificados = (verificacao || []).filter(c => c.is_verified).length;
    const taxaVerificacao = total ? Math.round((verificados / total) * 100) : 0;
    
    const resultado = {
      total_contatos: total || 0,
      verificados,
      taxa_verificacao: `${taxaVerificacao}%`,
      top_regioes: distribuicaoRegioes,
      por_origem: distribuicaoOrigens,
      por_genero: distribuicaoGenero
    };
    
    console.log('Resultado consultar_contatos:', resultado);
    return resultado;
  },
  
  // ──────────────────────────────────────────────────────────
  // VISITAS DE GABINETE
  // ──────────────────────────────────────────────────────────
  consultar_visitas: async (params: { 
    status?: string,
    cidade_id?: string,
    periodo?: string,
    limit?: number 
  }) => {
    console.log('Executando consultar_visitas com params:', params);
    
    // Total de visitas
    const { count: total } = await supabase
      .from('office_visits')
      .select('id', { count: 'exact', head: true });
    
    // Por status
    const { data: porStatus } = await supabase
      .from('office_visits')
      .select('status');
    
    // Check-ins realizados
    const { data: checkIns } = await supabase
      .from('office_visits')
      .select('checked_in')
      .eq('checked_in', true);
    
    // Visitas por região
    const { data: porRegiao } = await supabase
      .from('office_visits')
      .select('city_id, cidade:office_cities(nome)')
      .not('city_id', 'is', null);
    
    // Visitas hoje
    const hoje = new Date().toISOString().split('T')[0];
    const { count: visitasHoje } = await supabase
      .from('office_visits')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', hoje);
    
    // Agregar por status
    const statusMap = new Map();
    const statusLabels: Record<string, string> = {
      'REGISTERED': 'Cadastradas',
      'LINK_SENT': 'Link Enviado',
      'FORM_OPENED': 'Formulário Aberto',
      'FORM_SUBMITTED': 'Formulário Enviado',
      'CHECKED_IN': 'Check-in Realizado',
      'MEETING_COMPLETED': 'Reunião Concluída',
      'CANCELLED': 'Canceladas',
      'RESCHEDULED': 'Reagendadas'
    };
    (porStatus || []).forEach(v => {
      const label = statusLabels[v.status] || v.status;
      statusMap.set(label, (statusMap.get(label) || 0) + 1);
    });
    const distribuicaoStatus = Array.from(statusMap.entries())
      .map(([status, quantidade]) => ({ status, quantidade }));
    
    // Agregar por região
    const regioesMap = new Map();
    (porRegiao || []).forEach((v: any) => {
      const cidadeObj = Array.isArray(v.cidade) ? v.cidade[0] : v.cidade;
      const nome = cidadeObj?.nome || 'Não informada';
      regioesMap.set(nome, (regioesMap.get(nome) || 0) + 1);
    });
    const distribuicaoRegioes = Array.from(regioesMap.entries())
      .map(([regiao, quantidade]) => ({ regiao, quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 10);
    
    const taxaComparecimento = total ? Math.round(((checkIns?.length || 0) / total) * 100) : 0;
    
    const resultado = {
      total_visitas: total || 0,
      visitas_hoje: visitasHoje || 0,
      checkins_realizados: checkIns?.length || 0,
      taxa_comparecimento: `${taxaComparecimento}%`,
      por_status: distribuicaoStatus,
      top_regioes: distribuicaoRegioes
    };
    
    console.log('Resultado consultar_visitas:', resultado);
    return resultado;
  },
  
  // ──────────────────────────────────────────────────────────
  // EVENTOS
  // ──────────────────────────────────────────────────────────
  consultar_eventos: async (params: { 
    status?: string,
    category?: string,
    periodo?: string,
    limit?: number
  }) => {
    console.log('Executando consultar_eventos com params:', params);
    
    let query = supabase
      .from('events')
      .select('id, name, date, time, location, category, region, status, capacity, registrations_count, checkedin_count')
      .order('date', { ascending: false });
    
    if (params.status) {
      query = query.eq('status', params.status);
    }
    
    if (params.category) {
      query = query.eq('category', params.category);
    }
    
    if (params.periodo === 'futuros') {
      query = query.gte('date', new Date().toISOString().split('T')[0]);
    } else if (params.periodo === 'passados') {
      query = query.lt('date', new Date().toISOString().split('T')[0]);
    }
    
    if (params.limit) query.limit(params.limit);
    
    const { data, error } = await query;
    if (error) {
      console.error('Erro ao consultar eventos:', error);
      throw error;
    }
    
    const eventos = (data || []).map(e => {
      const inscritos = e.registrations_count || 0;
      const presentes = e.checkedin_count || 0;
      const taxaConversao = inscritos > 0 ? Math.round((presentes / inscritos) * 100) : 0;
      
      return {
        nome: e.name,
        data: e.date,
        horario: e.time,
        local: e.location,
        categoria: e.category,
        regiao: e.region,
        status: e.status === 'active' ? 'Ativo' : 'Inativo',
        capacidade: e.capacity,
        inscritos,
        presentes,
        taxa_conversao: `${taxaConversao}%`
      };
    });
    
    // Totais gerais
    const totalEventos = eventos.length;
    const totalInscritos = eventos.reduce((sum, e) => sum + e.inscritos, 0);
    const totalPresentes = eventos.reduce((sum, e) => sum + e.presentes, 0);
    
    const resultado = {
      total_eventos: totalEventos,
      total_inscritos: totalInscritos,
      total_presentes: totalPresentes,
      taxa_geral_conversao: totalInscritos > 0 ? `${Math.round((totalPresentes / totalInscritos) * 100)}%` : '0%',
      eventos
    };
    
    console.log('Resultado consultar_eventos:', resultado.total_eventos, 'eventos');
    return resultado;
  },
  
  // ──────────────────────────────────────────────────────────
  // INSCRIÇÕES EM EVENTOS
  // ──────────────────────────────────────────────────────────
  consultar_inscricoes_eventos: async (params: { 
    event_id?: string,
    cidade_id?: string,
    periodo?: string
  }) => {
    console.log('Executando consultar_inscricoes_eventos com params:', params);
    
    let query = supabase
      .from('event_registrations')
      .select(`
        id, checked_in, created_at,
        event:events(name, date),
        cidade:office_cities(nome),
        leader:lideres(nome_completo)
      `);
    
    if (params.event_id) {
      query = query.eq('event_id', params.event_id);
    }
    
    if (params.cidade_id) {
      query = query.eq('cidade_id', params.cidade_id);
    }
    
    const { data, error } = await query;
    if (error) {
      console.error('Erro ao consultar inscrições:', error);
      throw error;
    }
    
    const inscricoes = data || [];
    const total = inscricoes.length;
    const checkIns = inscricoes.filter((i: any) => i.checked_in).length;
    const comLider = inscricoes.filter((i: any) => i.leader).length;
    
    // Por evento
    const eventosMap = new Map();
    inscricoes.forEach((i: any) => {
      const eventObj = Array.isArray(i.event) ? i.event[0] : i.event;
      const evento = eventObj?.name || 'Desconhecido';
      const atual = eventosMap.get(evento) || { inscritos: 0, checkins: 0 };
      atual.inscritos++;
      if (i.checked_in) atual.checkins++;
      eventosMap.set(evento, atual);
    });
    const porEvento = Array.from(eventosMap.entries())
      .map(([evento, stats]: [string, any]) => ({ 
        evento, 
        inscritos: stats.inscritos, 
        checkins: stats.checkins,
        taxa: `${Math.round((stats.checkins / stats.inscritos) * 100)}%`
      }))
      .sort((a, b) => b.inscritos - a.inscritos)
      .slice(0, 10);
    
    // Por região
    const regioesMap = new Map();
    inscricoes.forEach((i: any) => {
      const cidadeObj = Array.isArray(i.cidade) ? i.cidade[0] : i.cidade;
      const regiao = cidadeObj?.nome || 'Não informada';
      regioesMap.set(regiao, (regioesMap.get(regiao) || 0) + 1);
    });
    const porRegiao = Array.from(regioesMap.entries())
      .map(([regiao, quantidade]) => ({ regiao, quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 10);
    
    const resultado = {
      total_inscricoes: total,
      total_checkins: checkIns,
      taxa_conversao: total > 0 ? `${Math.round((checkIns / total) * 100)}%` : '0%',
      inscricoes_via_lider: comLider,
      percentual_via_lider: total > 0 ? `${Math.round((comLider / total) * 100)}%` : '0%',
      top_eventos: porEvento,
      top_regioes: porRegiao
    };
    
    console.log('Resultado consultar_inscricoes_eventos:', resultado);
    return resultado;
  },
  
  // ──────────────────────────────────────────────────────────
  // FUNIS DE CAPTAÇÃO (Lead Funnels)
  // ──────────────────────────────────────────────────────────
  consultar_funis_captacao: async (params: { status?: string, limit?: number }) => {
    console.log('Executando consultar_funis_captacao com params:', params);
    
    let query = supabase
      .from('lead_funnels')
      .select('id, nome, lead_magnet_nome, status, views_count, leads_count, downloads_count')
      .order('leads_count', { ascending: false });
    
    if (params.status) {
      query = query.eq('status', params.status);
    }
    
    if (params.limit) query.limit(params.limit);
    
    const { data, error } = await query;
    if (error) {
      console.error('Erro ao consultar funis:', error);
      throw error;
    }
    
    const funis = (data || []).map(f => {
      const views = f.views_count || 0;
      const leads = f.leads_count || 0;
      const downloads = f.downloads_count || 0;
      
      return {
        nome: f.nome,
        material: f.lead_magnet_nome,
        status: f.status === 'active' ? 'Ativo' : 'Rascunho',
        visualizacoes: views,
        leads_capturados: leads,
        downloads,
        taxa_conversao_leads: views > 0 ? `${Math.round((leads / views) * 100)}%` : '0%',
        taxa_download: leads > 0 ? `${Math.round((downloads / leads) * 100)}%` : '0%'
      };
    });
    
    // Totais
    const totais = {
      total_funis: funis.length,
      total_visualizacoes: funis.reduce((sum, f) => sum + f.visualizacoes, 0),
      total_leads: funis.reduce((sum, f) => sum + f.leads_capturados, 0),
      total_downloads: funis.reduce((sum, f) => sum + f.downloads, 0),
      funis
    };
    
    console.log('Resultado consultar_funis_captacao:', totais.total_funis, 'funis');
    return totais;
  },
  
  // ──────────────────────────────────────────────────────────
  // CAMPANHAS UTM
  // ──────────────────────────────────────────────────────────
  consultar_campanhas: async (params: { status?: string, utm_source?: string }) => {
    console.log('Executando consultar_campanhas com params:', params);
    
    let query = supabase
      .from('campaigns')
      .select('id, nome, utm_source, utm_medium, utm_campaign, status, total_cadastros, event_slug, funnel_slug')
      .order('total_cadastros', { ascending: false });
    
    if (params.status) {
      query = query.eq('status', params.status);
    }
    
    if (params.utm_source) {
      query = query.eq('utm_source', params.utm_source);
    }
    
    const { data, error } = await query;
    if (error) {
      console.error('Erro ao consultar campanhas:', error);
      throw error;
    }
    
    const campanhas = (data || []).map(c => ({
      nome: c.nome,
      fonte: c.utm_source,
      midia: c.utm_medium || 'Não especificada',
      identificador: c.utm_campaign,
      status: c.status === 'active' ? 'Ativa' : 'Inativa',
      cadastros: c.total_cadastros,
      tipo: c.event_slug ? 'Evento' : c.funnel_slug ? 'Funil de Captação' : 'Geral'
    }));
    
    // Agregar por fonte
    const fontesMap = new Map();
    campanhas.forEach(c => {
      fontesMap.set(c.fonte, (fontesMap.get(c.fonte) || 0) + c.cadastros);
    });
    const porFonte = Array.from(fontesMap.entries())
      .map(([fonte, cadastros]) => ({ fonte, cadastros }))
      .sort((a, b) => b.cadastros - a.cadastros);
    
    const resultado = {
      total_campanhas: campanhas.length,
      total_cadastros: campanhas.reduce((sum, c) => sum + c.cadastros, 0),
      por_fonte: porFonte,
      campanhas
    };
    
    console.log('Resultado consultar_campanhas:', resultado.total_campanhas, 'campanhas');
    return resultado;
  },
  
  // ──────────────────────────────────────────────────────────
  // PROGRAMAS/PROJETOS DO MANDATO
  // ──────────────────────────────────────────────────────────
  consultar_programas: async (params: { status?: string }) => {
    console.log('Executando consultar_programas com params:', params);
    
    let query = supabase
      .from('programas')
      .select('id, nome, descricao, status, inicio, impacto')
      .order('impacto', { ascending: false });
    
    if (params.status) {
      query = query.eq('status', params.status);
    }
    
    const { data, error } = await query;
    if (error) {
      console.error('Erro ao consultar programas:', error);
      throw error;
    }
    
    const programas = (data || []).map(p => ({
      nome: p.nome,
      descricao: p.descricao,
      status: p.status,
      inicio: p.inicio,
      pessoas_impactadas: p.impacto
    }));
    
    const resultado = {
      total_programas: programas.length,
      total_impacto: programas.reduce((sum, p) => sum + p.pessoas_impactadas, 0),
      programas
    };
    
    console.log('Resultado consultar_programas:', resultado.total_programas, 'programas');
    return resultado;
  },
  
  // ──────────────────────────────────────────────────────────
  // BASE DE CONHECIMENTO (Knowledge Base)
  // ──────────────────────────────────────────────────────────
  consultar_base_conhecimento: async (params: { pergunta: string, categoria?: string }) => {
    console.log('Executando consultar_base_conhecimento com params:', params);
    
    const searchTerms = params.pergunta
      .toLowerCase()
      .replace(/[^\w\sáéíóúãõâêîôûç]/g, "")
      .split(/\s+/)
      .filter((w: string) => w.length > 2)
      .slice(0, 8);

    let chunks: any[] = [];
    
    if (searchTerms.length > 0) {
      const ilikeConditions = searchTerms.map((term: string) => `content.ilike.%${term}%`);
      
      let query = supabase
        .from("kb_chunks")
        .select(`
          content, metadata,
          document:kb_documents(id, title, category)
        `)
        .or(ilikeConditions.join(","))
        .limit(10);
      
      const { data } = await query;
      chunks = data || [];
    }

    // Fallback: get all chunks if no term match
    if (chunks.length === 0) {
      let query = supabase
        .from("kb_chunks")
        .select(`
          content, metadata,
          document:kb_documents(id, title, category)
        `)
        .limit(8);
      
      const { data } = await query;
      chunks = data || [];
    }

    if (chunks.length === 0) {
      return {
        encontrado: false,
        mensagem: "Não há documentos na base de conhecimento para responder esta pergunta.",
        fontes: []
      };
    }

    const fontes = [...new Set(chunks.map((c: any) => {
      const doc = Array.isArray(c.document) ? c.document[0] : c.document;
      return doc?.title || "Documento";
    }))];

    const conteudo = chunks.map((c: any) => {
      const doc = Array.isArray(c.document) ? c.document[0] : c.document;
      return `[Fonte: ${doc?.title || "Documento"}] ${c.content}`;
    }).join("\n\n");

    console.log('Resultado consultar_base_conhecimento:', chunks.length, 'chunks,', fontes.length, 'fontes');
    
    return {
      encontrado: true,
      total_fragmentos: chunks.length,
      fontes,
      conteudo
    };
  },
  
  // ──────────────────────────────────────────────────────────
  // MÉTRICAS DE WHATSAPP (agregado, sem conteúdo)
  // ──────────────────────────────────────────────────────────
  consultar_metricas_whatsapp: async (params: { periodo?: string }) => {
    console.log('Executando consultar_metricas_whatsapp com params:', params);
    
    let query = supabase
      .from('whatsapp_messages')
      .select('id, direction, status, sent_at, delivered_at, read_at')
      .eq('direction', 'outgoing');
    
    // Filtrar por período
    if (params.periodo === 'hoje') {
      const hoje = new Date().toISOString().split('T')[0];
      query = query.gte('created_at', hoje);
    } else if (params.periodo === 'semana') {
      const semana = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      query = query.gte('created_at', semana);
    } else if (params.periodo === 'mes') {
      const mes = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      query = query.gte('created_at', mes);
    }
    
    const { data, error } = await query;
    if (error) {
      console.error('Erro ao consultar WhatsApp:', error);
      throw error;
    }
    
    const mensagens = data || [];
    const total = mensagens.length;
    const enviadas = mensagens.filter(m => m.status === 'sent' || m.status === 'delivered' || m.status === 'read').length;
    const entregues = mensagens.filter(m => m.status === 'delivered' || m.status === 'read').length;
    const lidas = mensagens.filter(m => m.status === 'read').length;
    const erros = mensagens.filter(m => m.status === 'failed').length;
    
    const resultado = {
      total_mensagens: total,
      enviadas,
      entregues,
      lidas,
      erros,
      taxa_entrega: total > 0 ? `${Math.round((entregues / total) * 100)}%` : '0%',
      taxa_leitura: entregues > 0 ? `${Math.round((lidas / entregues) * 100)}%` : '0%',
      taxa_erro: total > 0 ? `${Math.round((erros / total) * 100)}%` : '0%'
    };
    
    console.log('Resultado consultar_metricas_whatsapp:', resultado);
    return resultado;
  },
  
  // ──────────────────────────────────────────────────────────
  // ESTATÍSTICAS GERAIS (visão geral do sistema)
  // ──────────────────────────────────────────────────────────
  // ──────────────────────────────────────────────────────────
  // OPINIÃO PÚBLICA (Menções e Análise de Sentimento)
  // ──────────────────────────────────────────────────────────
  consultar_opiniao_publica: async (params: { 
    tipo?: string, 
    periodo_dias?: number,
    limit?: number 
  }) => {
    console.log('Executando consultar_opiniao_publica com params:', params);
    
    const periodDays = params.periodo_dias || 30;
    const since = new Date();
    since.setDate(since.getDate() - periodDays);
    const sinceStr = since.toISOString();
    
    // Find primary entity
    const { data: entity } = await supabase
      .from('po_monitored_entities')
      .select('id, nome, partido, cargo')
      .eq('is_principal', true)
      .single();
    
    if (!entity) {
      return { mensagem: 'Nenhuma entidade principal configurada para monitoramento de opinião pública.' };
    }
    
    // Fetch analyses with pagination
    let analyses: any[] = [];
    const pageSize = 1000;
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from('po_sentiment_analyses')
        .select('sentiment, sentiment_score, category, topics, emotions, ai_summary, is_about_adversary, mention_id')
        .eq('entity_id', entity.id)
        .gte('analyzed_at', sinceStr)
        .order('analyzed_at', { ascending: false })
        .range(from, from + pageSize - 1);
      if (error || !data || data.length === 0) break;
      analyses = analyses.concat(data);
      if (data.length < pageSize) break;
      from += pageSize;
    }
    
    if (analyses.length === 0) {
      return { 
        entidade: entity.nome,
        mensagem: `Sem dados de opinião pública nos últimos ${periodDays} dias.` 
      };
    }
    
    // Filter relevant analyses
    const relevant = analyses.filter(a => {
      const summary = (a.ai_summary || '').toLowerCase();
      if (summary.includes('irrelevante') || summary.includes('sem relação') || summary.includes('não é sobre')) return false;
      if (a.category === 'humor' && (!a.sentiment_score || a.sentiment_score === 0)) return false;
      return true;
    });
    
    const total = relevant.length;
    const positive = relevant.filter(a => a.sentiment === 'positivo').length;
    const negative = relevant.filter(a => a.sentiment === 'negativo').length;
    const neutral = relevant.filter(a => a.sentiment === 'neutro').length;
    const avgScore = total > 0 ? relevant.reduce((s, a) => s + (a.sentiment_score || 0), 0) / total : 0;
    
    // Top topics
    const topicCounts: Record<string, number> = {};
    relevant.forEach(a => {
      (a.topics || []).forEach((t: string) => {
        topicCounts[t] = (topicCounts[t] || 0) + 1;
      });
    });
    const topTopics = Object.entries(topicCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([topic, count]) => ({ tema: topic, mencoes: count }));
    
    // Top categories
    const categoryCounts: Record<string, number> = {};
    relevant.forEach(a => {
      if (a.category) categoryCounts[a.category] = (categoryCounts[a.category] || 0) + 1;
    });
    const topCategories = Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, count]) => ({ categoria: cat, quantidade: count }));
    
    // Top emotions
    const emotionCounts: Record<string, number> = {};
    relevant.forEach(a => {
      (a.emotions || []).forEach((e: string) => {
        emotionCounts[e] = (emotionCounts[e] || 0) + 1;
      });
    });
    const topEmotions = Object.entries(emotionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([emotion, count]) => ({ emocao: emotion, frequencia: count }));
    
    // Negative summaries (complaints)
    const reclamacoes = relevant
      .filter(a => a.sentiment === 'negativo' && a.ai_summary)
      .slice(0, 15)
      .map(a => a.ai_summary);
    
    // Positive summaries (praise)
    const elogios = relevant
      .filter(a => a.sentiment === 'positivo' && a.ai_summary)
      .slice(0, 15)
      .map(a => a.ai_summary);
    
    // Filter by type if requested
    if (params.tipo === 'reclamacoes') {
      return {
        entidade: entity.nome,
        periodo: `últimos ${periodDays} dias`,
        total_reclamacoes: negative,
        reclamacoes,
        temas_negativos: topTopics.filter((_, i) => i < 5),
        categorias: topCategories.filter(c => ['ataque', 'crítica', 'cobrança', 'denúncia'].includes(c.categoria.toLowerCase()))
      };
    }
    
    if (params.tipo === 'elogios') {
      return {
        entidade: entity.nome,
        periodo: `últimos ${periodDays} dias`,
        total_elogios: positive,
        elogios,
        temas_positivos: topTopics.filter((_, i) => i < 5),
        categorias: topCategories.filter(c => ['elogio', 'apoio', 'defesa'].includes(c.categoria.toLowerCase()))
      };
    }
    
    const resultado = {
      entidade: entity.nome,
      periodo: `últimos ${periodDays} dias`,
      total_mencoes_relevantes: total,
      sentimento: {
        positivas: positive,
        positivas_pct: `${total > 0 ? Math.round((positive / total) * 100) : 0}%`,
        negativas: negative,
        negativas_pct: `${total > 0 ? Math.round((negative / total) * 100) : 0}%`,
        neutras: neutral,
        neutras_pct: `${total > 0 ? Math.round((neutral / total) * 100) : 0}%`,
        score_medio: Math.round(avgScore * 1000) / 1000
      },
      temas_mais_citados: topTopics,
      categorias: topCategories,
      emocoes: topEmotions,
      resumos_reclamacoes: reclamacoes.slice(0, 10),
      resumos_elogios: elogios.slice(0, 10)
    };
    
    console.log('Resultado consultar_opiniao_publica:', total, 'menções');
    return resultado;
  },

  consultar_estatisticas_gerais: async () => {
    console.log('Executando consultar_estatisticas_gerais');
    
    // Contatos
    const { count: totalContatos } = await supabase
      .from('office_contacts')
      .select('id', { count: 'exact', head: true });
    
    // Líderes ativos
    const { count: totalLideres } = await supabase
      .from('lideres')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true);
    
    // Eventos
    const { count: totalEventos } = await supabase
      .from('events')
      .select('id', { count: 'exact', head: true });
    
    // Eventos ativos/futuros
    const { count: eventosAtivos } = await supabase
      .from('events')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')
      .gte('date', new Date().toISOString().split('T')[0]);
    
    // Visitas totais
    const { count: totalVisitas } = await supabase
      .from('office_visits')
      .select('id', { count: 'exact', head: true });
    
    // Visitas com check-in
    const { count: visitasAtendidas } = await supabase
      .from('office_visits')
      .select('id', { count: 'exact', head: true })
      .eq('checked_in', true);
    
    // Inscrições em eventos
    const { count: totalInscricoes } = await supabase
      .from('event_registrations')
      .select('id', { count: 'exact', head: true });
    
    // Check-ins em eventos
    const { count: checkinsEventos } = await supabase
      .from('event_registrations')
      .select('id', { count: 'exact', head: true })
      .eq('checked_in', true);
    
    // Funis ativos
    const { count: funisAtivos } = await supabase
      .from('lead_funnels')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active');
    
    // Total leads capturados
    const { data: leadsData } = await supabase
      .from('lead_funnels')
      .select('leads_count');
    const totalLeads = (leadsData || []).reduce((sum, f) => sum + (f.leads_count || 0), 0);
    
    // Campanhas ativas
    const { count: campanhasAtivas } = await supabase
      .from('campaigns')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active');
    
    // Programas ativos
    const { count: programasAtivos } = await supabase
      .from('programas')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'Ativo');
    
    // Regiões cadastradas
    const { count: totalRegioes } = await supabase
      .from('office_cities')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active');
    
    const resultado = {
      resumo_geral: {
        total_contatos: totalContatos || 0,
        total_lideres_ativos: totalLideres || 0,
        total_regioes: totalRegioes || 0
      },
      eventos: {
        total: totalEventos || 0,
        ativos_futuros: eventosAtivos || 0,
        total_inscricoes: totalInscricoes || 0,
        total_checkins: checkinsEventos || 0,
        taxa_conversao: totalInscricoes ? `${Math.round(((checkinsEventos || 0) / totalInscricoes) * 100)}%` : '0%'
      },
      gabinete: {
        total_visitas: totalVisitas || 0,
        visitas_atendidas: visitasAtendidas || 0,
        taxa_atendimento: totalVisitas ? `${Math.round(((visitasAtendidas || 0) / totalVisitas) * 100)}%` : '0%'
      },
      captacao: {
        funis_ativos: funisAtivos || 0,
        total_leads: totalLeads,
        campanhas_ativas: campanhasAtivas || 0
      },
      projetos: {
        programas_ativos: programasAtivos || 0
      }
    };
    
    console.log('Resultado consultar_estatisticas_gerais:', resultado);
    return resultado;
  }
};

// ═══════════════════════════════════════════════════════════
// DEFINIÇÕES DE FERRAMENTAS PARA A IA
// ═══════════════════════════════════════════════════════════

const toolDefinitions = [
  {
    type: 'function',
    function: {
      name: 'consultar_lideres',
      description: `Consulta ranking e informações dos líderes comunitários.
Use quando o usuário perguntar sobre: líderes, coordenadores, ranking de lideranças, desempenho de líderes, pontuação, gamificação, níveis (Bronze, Prata, Ouro, Diamante).
Retorna: nome, cadastros realizados, pontuação total, nível de gamificação e região de cada líder.`,
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Número máximo de líderes (padrão: 10)' },
          cidade_id: { type: 'string', description: 'Filtrar por região específica' },
          ordenar_por: { type: 'string', enum: ['pontuacao', 'cadastros'], description: 'Ordenar por pontuação ou cadastros' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'consultar_temas',
      description: `Consulta as pautas/temas de maior interesse popular.
Use quando o usuário perguntar sobre: pautas, temas, assuntos de interesse, demandas populares, o que a população quer.
Retorna: nome da pauta e quantidade de pessoas interessadas.`,
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Número máximo de temas (padrão: 10)' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'consultar_perfil_demografico',
      description: `Consulta a distribuição demográfica por gênero do eleitorado.
Use quando o usuário perguntar sobre: perfil demográfico, distribuição por gênero, percentual de homens/mulheres.
Retorna: percentual por gênero.`,
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'consultar_regioes',
      description: `Lista as Regiões Administrativas (RAs) do Distrito Federal cadastradas.
Use quando o usuário perguntar sobre: regiões, RAs, cidades, áreas de atuação, localidades.
Retorna: nome da região e código.`,
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['active', 'inactive'], description: 'Filtrar por status' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'consultar_contatos',
      description: `Consulta estatísticas da base de contatos.
Use quando o usuário perguntar sobre: contatos, base de dados, quantos cadastros temos, distribuição de contatos, verificação.
Retorna: total de contatos, distribuição por região, origem (indicação de líder, evento, funil) e gênero, taxa de verificação.`,
      parameters: {
        type: 'object',
        properties: {
          cidade_id: { type: 'string', description: 'Filtrar por região' },
          source_type: { type: 'string', enum: ['lider', 'evento', 'captacao'], description: 'Filtrar por origem' },
          genero: { type: 'string', description: 'Filtrar por gênero' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'consultar_visitas',
      description: `Consulta métricas de visitas ao gabinete.
Use quando o usuário perguntar sobre: visitas, atendimentos, gabinete, reuniões, taxa de comparecimento, check-ins no gabinete.
Retorna: total de visitas, visitas hoje, check-ins realizados, taxa de comparecimento, distribuição por status e região.`,
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'Filtrar por status da visita' },
          cidade_id: { type: 'string', description: 'Filtrar por região' },
          periodo: { type: 'string', enum: ['hoje', 'semana', 'mes'], description: 'Filtrar por período' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'consultar_eventos',
      description: `Consulta eventos realizados ou programados.
Use quando o usuário perguntar sobre: eventos, agenda, programação, inscrições em eventos, taxa de conversão de eventos.
Retorna: lista de eventos com nome, data, local, capacidade, inscritos, presentes e taxa de conversão.`,
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['active', 'inactive'], description: 'Filtrar por status' },
          category: { type: 'string', description: 'Filtrar por categoria' },
          periodo: { type: 'string', enum: ['futuros', 'passados', 'todos'], description: 'Eventos futuros, passados ou todos' },
          limit: { type: 'number', description: 'Número máximo de eventos' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'consultar_inscricoes_eventos',
      description: `Consulta detalhes das inscrições em eventos.
Use quando o usuário perguntar sobre: inscritos em eventos, participantes, check-ins em eventos, de onde vêm os participantes, quantos vieram via líderes.
Retorna: total de inscrições, check-ins, percentual via líderes, distribuição por evento e região.`,
      parameters: {
        type: 'object',
        properties: {
          event_id: { type: 'string', description: 'Filtrar por evento específico' },
          cidade_id: { type: 'string', description: 'Filtrar por região' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'consultar_funis_captacao',
      description: `Consulta métricas dos funis de captação (lead magnets).
Use quando o usuário perguntar sobre: funis, captação de leads, materiais, e-books, downloads, conversão de leads.
Retorna: lista de funis com visualizações, leads capturados, downloads e taxas de conversão.`,
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['active', 'draft'], description: 'Filtrar por status' },
          limit: { type: 'number', description: 'Número máximo de funis' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'consultar_campanhas',
      description: `Consulta performance das campanhas de marketing (UTM).
Use quando o usuário perguntar sobre: campanhas, marketing, UTM, origem do tráfego, qual canal funciona melhor, de onde vêm os cadastros.
Retorna: lista de campanhas com fonte, mídia, cadastros e tipo (evento ou funil).`,
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['active', 'inactive'], description: 'Filtrar por status' },
          utm_source: { type: 'string', description: 'Filtrar por fonte específica' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'consultar_programas',
      description: `Consulta os programas e projetos do mandato.
Use quando o usuário perguntar sobre: programas, projetos, iniciativas, ações do mandato, impacto social.
Retorna: lista de programas com nome, descrição, status e pessoas impactadas.`,
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'Filtrar por status (Ativo, Encerrado, etc.)' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'consultar_base_conhecimento',
      description: `Consulta a Base de Conhecimento do sistema com documentos oficiais, briefings, planos de governo, FAQs e pesquisas.
Use SEMPRE quando o usuário perguntar sobre: o político, mandato, propostas, plano de governo, posicionamentos, projetos de lei, biografia, atuação, histórico, realizações, FAQ, dúvidas comuns.
Retorna: conteúdo relevante dos documentos com citação das fontes.
IMPORTANTE: Priorize esta ferramenta para qualquer pergunta sobre o político ou seu mandato.`,
      parameters: {
        type: 'object',
        properties: {
          pergunta: { type: 'string', description: 'A pergunta ou tema a ser pesquisado na base de conhecimento' },
          categoria: { type: 'string', description: 'Categoria opcional para filtrar (mandato, programas, faq, biografia, legislacao, pesquisas, comunicacao)' }
        },
        required: ['pergunta']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'consultar_metricas_whatsapp',
      description: `Consulta métricas de comunicação via WhatsApp.
Use quando o usuário perguntar sobre: WhatsApp, mensagens, taxa de entrega, taxa de leitura, comunicação.
Retorna: total de mensagens, enviadas, entregues, lidas, erros e taxas.`,
      parameters: {
        type: 'object',
        properties: {
          periodo: { type: 'string', enum: ['hoje', 'semana', 'mes'], description: 'Filtrar por período' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'consultar_opiniao_publica',
      description: `Consulta dados de opinião pública e monitoramento de menções na internet e redes sociais.
Use quando o usuário perguntar sobre: opinião pública, menções, reclamações, elogios, sentimento, o que estão falando, imagem pública, críticas, ataques, percepção popular, redes sociais, comentários sobre o político, maiores reclamações, maiores elogios.
Retorna: total de menções, distribuição de sentimento (positivo/negativo/neutro), temas mais citados, categorias (elogio, ataque, crítica), emoções detectadas, e resumos das principais reclamações e elogios.`,
      parameters: {
        type: 'object',
        properties: {
          tipo: { type: 'string', enum: ['reclamacoes', 'elogios', 'geral'], description: 'Filtrar por tipo: reclamações, elogios ou visão geral' },
          periodo_dias: { type: 'number', description: 'Período em dias (padrão: 30)' },
          limit: { type: 'number', description: 'Número máximo de itens' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'consultar_estatisticas_gerais',
      description: `Consulta visão geral de todas as métricas do sistema.
Use quando o usuário perguntar sobre: resumo geral, visão geral, dashboard, status do sistema, números gerais, "me dê um resumo".
Retorna: totais de contatos, líderes, eventos, visitas, leads capturados, programas - tudo em uma visão consolidada.`,
      parameters: { type: 'object', properties: {} }
    }
  }
];

// ═══════════════════════════════════════════════════════════
// FUNÇÕES DE COMUNICAÇÃO COM LOVABLE AI GATEWAY
// ═══════════════════════════════════════════════════════════

const AI_GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';

async function callOpenAI(messages: any[], apiKey: string, systemPrompt: string) {
  const response = await fetch(AI_GATEWAY_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'openai/gpt-5-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ],
      tools: toolDefinitions,
      tool_choice: 'auto',
      max_completion_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('AI Gateway error:', { status: response.status, error: errorText });
    if (response.status === 429) throw new Error('Rate limit exceeded. Tente novamente em alguns segundos.');
    if (response.status === 402) throw new Error('Créditos insuficientes no Lovable AI.');
    throw new Error(`AI Gateway error: ${response.status}`);
  }

  return await response.json();
}

async function streamOpenAI(messages: any[], apiKey: string, systemPrompt: string, useStreaming: boolean = true) {
  const response = await fetch(AI_GATEWAY_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'openai/gpt-5-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ],
      max_completion_tokens: 2000,
      stream: useStreaming,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('AI Gateway error:', { status: response.status, error: errorText });
    if (response.status === 429) throw new Error('Rate limit exceeded. Tente novamente em alguns segundos.');
    if (response.status === 402) throw new Error('Créditos insuficientes no Lovable AI.');
    throw new Error(`AI Gateway error: ${response.status}`);
  }

  return response;
}

// ═══════════════════════════════════════════════════════════
// HANDLER PRINCIPAL
// ═══════════════════════════════════════════════════════════

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, sessionId = 'default', userName = '' } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY não está configurada');
    }

    const now = new Date();
    const dataAtual = now.toLocaleDateString('pt-BR', { 
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    });
    const horaAtual = now.toLocaleTimeString('pt-BR');

    console.log('Calling OpenAI API with', messages.length, 'messages for session:', sessionId);

    const firstName = userName ? userName.split(' ')[0] : '';
    const userContext = firstName ? `\n👤 USUÁRIO: ${userName} (chame pelo primeiro nome "${firstName}")` : '';

    // ═══════════════════════════════════════════════════════════
    // SYSTEM PROMPT COMPLETO
    // ═══════════════════════════════════════════════════════════
    const systemPrompt = `Você é o assistente virtual do Deputado Rafael Prudente, político comprometido com o desenvolvimento de Brasília e o bem-estar da população.

📅 DATA ATUAL: ${dataAtual} às ${horaAtual}${userContext}

═══════════════════════════════════════════════════════════
⚠️  REGRAS ABSOLUTAS DE COMUNICAÇÃO
═══════════════════════════════════════════════════════════

🚫 JAMAIS mostre dados técnicos brutos (JSON, IDs, nomes de colunas)
🚫 JAMAIS mencione termos como "source_type", "cidade_id", "count", etc.
🚫 JAMAIS sugira "validar com a equipe técnica" ou use jargão de programação
🚫 JAMAIS exponha estruturas de dados ou código

✅ SEMPRE interprete e apresente dados em linguagem natural
✅ SEMPRE traduza termos técnicos para português comum
✅ SEMPRE contextualize números com insights humanos
✅ SEMPRE fale como um assessor político experiente

═══════════════════════════════════════════════════════════
🎯 PERSONALIDADE E TOM DE VOZ
═══════════════════════════════════════════════════════════

Você é um **assessor político experiente e próximo do povo**:
- 🤝 Amigável, acessível e empático
- 💬 Linguagem clara e direta
- 😊 Tom otimista mas realista
- 🎖️ Demonstra orgulho do trabalho do Deputado
- 📊 Transforma dados em histórias e insights
- 🚀 Enfatiza compromisso com resultados concretos

Use emojis estratégicos (máximo 2-3 por resposta).

═══════════════════════════════════════════════════════════
📊 FUNÇÕES DISPONÍVEIS - QUANDO USAR CADA UMA
═══════════════════════════════════════════════════════════

**consultar_estatisticas_gerais** → Use para: "me dê um resumo", "visão geral", "como estamos", "status do sistema"

**consultar_lideres** → Use para: "líderes", "coordenadores", "ranking", "pontuação", "gamificação", "níveis"

**consultar_contatos** → Use para: "quantos contatos", "base de dados", "cadastros totais", "de onde vêm os contatos"

**consultar_visitas** → Use para: "visitas", "gabinete", "atendimentos", "reuniões", "taxa de comparecimento"

**consultar_eventos** → Use para: "eventos", "agenda", "programação", "inscrições"

**consultar_inscricoes_eventos** → Use para: "detalhes de inscrições", "participantes", "check-ins em eventos"

**consultar_funis_captacao** → Use para: "funis", "captação", "leads", "materiais", "e-books", "downloads"

**consultar_campanhas** → Use para: "campanhas", "marketing", "UTM", "qual canal funciona melhor"

**consultar_temas** → Use para: "pautas", "temas", "assuntos de interesse", "demandas populares"

**consultar_perfil_demografico** → Use para: "perfil demográfico", "homens/mulheres", "gênero"

**consultar_regioes** → Use para: "regiões", "RAs", "cidades", "localidades"

**consultar_programas** → Use para: "programas", "projetos", "iniciativas", "impacto social"

**consultar_metricas_whatsapp** → Use para: "WhatsApp", "mensagens", "taxa de entrega/leitura"

**consultar_opiniao_publica** → Use para: "opinião pública", "menções", "reclamações", "elogios", "o que estão falando", "sentimento", "críticas", "redes sociais", "imagem pública", "maiores reclamações", "maiores elogios"

═══════════════════════════════════════════════════════════
🎨 COMO APRESENTAR DADOS
═══════════════════════════════════════════════════════════

**MAU EXEMPLO:**
"Dados: [{'pontuacao_total':16,'source_type':'lider'}]"

**BOM EXEMPLO:**
"🥇 **Anderlan Oliveira** lidera com **16 pontos** no nível Prata - um trabalho excepcional!"

**ESTRUTURA IDEAL:**
1. Confirmação/Saudação breve
2. Dados em linguagem natural com emojis
3. Insights e interpretação
4. Recomendações práticas (se aplicável)
5. Pergunta de acompanhamento

═══════════════════════════════════════════════════════════
📝 FORMATAÇÃO
═══════════════════════════════════════════════════════════

- Use **negrito** para nomes e números-chave
- Use *itálico* para observações sutis
- Quebre parágrafos com linha dupla
- 🥇🥈🥉 para rankings
- 📊 para dados
- 💡 para insights
- 🎯 para ações
- Parágrafos curtos (máximo 3 linhas)

═══════════════════════════════════════════════════════════
🛡️ PRIVACIDADE E ÉTICA
═══════════════════════════════════════════════════════════

- NUNCA exponha telefones, emails completos ou dados pessoais
- Se pedirem contato, ofereça encaminhar via assessoria
- Respeite LGPD
- Seja transparente sobre limitações

${firstName ? `\n👤 O usuário se chama ${userName}. Chame-o de "${firstName}" de forma amigável.` : ''}`;

    // Primeira chamada para verificar tool calls
    const initialResponse = await callOpenAI(messages, LOVABLE_API_KEY, systemPrompt);
    
    console.log('Initial response received');

    const toolCalls = initialResponse.choices[0]?.message?.tool_calls;
    
    if (toolCalls && toolCalls.length > 0) {
      console.log('Tool calls detectados:', toolCalls.length);
      
      const updatedMessages = [...messages, initialResponse.choices[0].message];

      for (const toolCall of toolCalls) {
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);
        
        console.log(`Executando função: ${functionName}`, functionArgs);

        try {
          const functionToCall = availableFunctions[functionName];
          if (!functionToCall) {
            throw new Error(`Função ${functionName} não encontrada`);
          }

          const functionResponse = await functionToCall(functionArgs);
          
          if (!functionResponse || (Array.isArray(functionResponse) && functionResponse.length === 0)) {
            console.warn(`Função ${functionName} retornou dados vazios`);
            updatedMessages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify({ 
                dados: [], 
                mensagem: 'Nenhum resultado encontrado para essa consulta.'
              })
            });
          } else {
            const contextualizedData = {
              dados: functionResponse,
              instrucao: `ATENÇÃO: Interprete e apresente em linguagem natural. NUNCA mostre JSON. Traduza termos técnicos.`
            };
            
            updatedMessages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify(contextualizedData)
            });
          }
        } catch (error) {
          console.error(`Erro ao executar função ${functionName}:`, error);
          updatedMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify({ 
              erro: 'Não foi possível buscar esses dados no momento.',
              mensagem_usuario: 'Desculpe, tive uma dificuldade técnica. Pode tentar novamente?'
            })
          });
        }
      }

      console.log('Fazendo segunda chamada com resultados das funções');
      try {
        const streamResponse = await streamOpenAI(updatedMessages, LOVABLE_API_KEY, systemPrompt, true);
        
        return new Response(streamResponse.body, {
          headers: {
            ...corsHeaders,
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        });
      } catch (error: any) {
        if (error.message.includes('400')) {
          console.log('Erro com streaming, tentando sem streaming');
          const nonStreamResponse = await streamOpenAI(updatedMessages, LOVABLE_API_KEY, systemPrompt, false);
          const data = await nonStreamResponse.json();
          
          return new Response(JSON.stringify(data), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        throw error;
      }
    } else {
      console.log('Sem tool calls, fazendo streaming direto');
      try {
        const streamResponse = await streamOpenAI(messages, LOVABLE_API_KEY, systemPrompt, true);
        
        return new Response(streamResponse.body, {
          headers: {
            ...corsHeaders,
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        });
      } catch (error: any) {
        if (error.message.includes('400')) {
          console.log('Erro com streaming, tentando sem streaming');
          const nonStreamResponse = await streamOpenAI(messages, LOVABLE_API_KEY, systemPrompt, false);
          const data = await nonStreamResponse.json();
          
          return new Response(JSON.stringify(data), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        throw error;
      }
    }

  } catch (error) {
    console.error('Error in chat function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
