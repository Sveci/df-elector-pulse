import { useQuery } from "@tanstack/react-query";

interface IBGECity {
  id: number;
  nome: string;
}

export function useBrazilCities(uf: string | undefined) {
  return useQuery({
    queryKey: ["ibge_cities", uf],
    queryFn: async () => {
      if (!uf) return [];
      const res = await fetch(
        `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`
      );
      if (!res.ok) throw new Error("Erro ao buscar cidades");
      const data: IBGECity[] = await res.json();
      return data.map(c => ({ value: c.nome, label: c.nome }));
    },
    enabled: !!uf,
    staleTime: 1000 * 60 * 60, // 1h cache
  });
}
