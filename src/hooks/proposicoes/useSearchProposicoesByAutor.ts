import { useState } from "react";

export interface ProposicaoBuscada {
  id: number;
  siglaTipo: string;
  numero: number;
  ano: number;
  ementa: string;
  // Câmara-specific
  statusProposicao?: {
    codSituacao?: number;
    descricaoSituacao?: string;
    siglaOrgao?: string;
    dataHora?: string;
    regime?: string;
    descricaoApreciacao?: string;
  };
  urlInteiroTeor?: string;
  ementaDetalhada?: string;
  // Senado-specific
  Codigo?: number;
  Ementa?: string;
  DescricaoIdentificacao?: string;
  // Meta
  casa: "camara" | "senado";
}

// ─── Buscar proposições na Câmara por nome do autor ──────────────────────────
async function fetchProposicoesCamaraByAutor(
  nomeAutor: string,
  pagina = 1
): Promise<{ dados: ProposicaoBuscada[]; hasMore: boolean }> {
  const params = new URLSearchParams({
    autor: nomeAutor,
    itens: "15",
    pagina: String(pagina),
    ordem: "DESC",
    ordenarPor: "ano",
  });

  const resp = await fetch(
    `https://dadosabertos.camara.leg.br/api/v2/proposicoes?${params}`,
    { headers: { Accept: "application/json" } }
  );
  if (!resp.ok) return { dados: [], hasMore: false };
  const json = await resp.json();

  const dados: ProposicaoBuscada[] = (json.dados || []).map((p: any) => ({
    ...p,
    casa: "camara" as const,
  }));

  // Check if there are more pages
  const links = json.links || [];
  const hasMore = links.some((l: any) => l.rel === "next");

  return { dados, hasMore };
}

// ─── Buscar proposições no Senado por nome do autor ──────────────────────────
async function fetchProposicoesSenado(
  nomeAutor: string
): Promise<ProposicaoBuscada[]> {
  const params = new URLSearchParams({
    nomeAutor,
    v: "7",
  });

  const resp = await fetch(
    `https://legis.senado.leg.br/dadosabertos/materia/pesquisa/lista?${params}`,
    { headers: { Accept: "application/json" } }
  );
  if (!resp.ok) return [];
  const json = await resp.json();

  const lista = json?.PesquisaBasicaMateria?.Materias?.Materia;
  if (!lista) return [];

  const materias = Array.isArray(lista) ? lista : [lista];

  return materias.map((m: any) => ({
    id: Number(m.Codigo || m.CodigoMateria),
    siglaTipo: m.SiglaSubtipoMateria || m.Sigla || "",
    numero: Number(m.NumeroMateria || m.Numero || 0),
    ano: Number(m.AnoMateria || m.Ano || 0),
    ementa: m.EmentaMateria || m.Ementa || m.DescricaoIdentificacao || "",
    Codigo: Number(m.Codigo || m.CodigoMateria),
    Ementa: m.EmentaMateria || m.Ementa || "",
    DescricaoIdentificacao: m.DescricaoIdentificacao || "",
    casa: "senado" as const,
  }));
}

// ─── Buscar detalhes de uma proposição da Câmara ─────────────────────────────
export async function fetchDetalheCamara(camaraId: number): Promise<any> {
  const resp = await fetch(
    `https://dadosabertos.camara.leg.br/api/v2/proposicoes/${camaraId}`,
    { headers: { Accept: "application/json" } }
  );
  if (!resp.ok) return null;
  const json = await resp.json();
  return json.dados || null;
}

// ─── Hook de busca por autor ─────────────────────────────────────────────────
export function useSearchProposicoesByAutor() {
  const [results, setResults] = useState<ProposicaoBuscada[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [lastSearchParams, setLastSearchParams] = useState<{
    nome: string;
    casa: "camara" | "senado" | "ambas";
  } | null>(null);

  async function search(
    nomeAutor: string,
    casa: "camara" | "senado" | "ambas" = "ambas"
  ) {
    if (!nomeAutor.trim()) return;

    setLoading(true);
    setError(null);
    setResults([]);
    setCurrentPage(1);
    setLastSearchParams({ nome: nomeAutor, casa });

    try {
      let allResults: ProposicaoBuscada[] = [];

      if (casa === "camara" || casa === "ambas") {
        const camara = await fetchProposicoesCamaraByAutor(nomeAutor, 1);
        allResults.push(...camara.dados);
        setHasMore(camara.hasMore);
      }

      if (casa === "senado" || casa === "ambas") {
        const senado = await fetchProposicoesSenado(nomeAutor);
        allResults.push(...senado);
        // Senado doesn't paginate the same way
        if (casa === "senado") setHasMore(false);
      }

      if (allResults.length === 0) {
        setError("Nenhuma proposição encontrada para este autor.");
      }

      setResults(allResults);
    } catch (err: any) {
      setError("Erro ao buscar proposições: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    if (!lastSearchParams || loading) return;

    const nextPage = currentPage + 1;
    setLoading(true);

    try {
      const camara = await fetchProposicoesCamaraByAutor(
        lastSearchParams.nome,
        nextPage
      );
      setResults((prev) => [...prev, ...camara.dados]);
      setHasMore(camara.hasMore);
      setCurrentPage(nextPage);
    } catch {
      // ignore pagination errors
    } finally {
      setLoading(false);
    }
  }

  return { results, loading, error, hasMore, search, loadMore };
}
