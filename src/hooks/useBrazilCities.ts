import { useQuery } from "@tanstack/react-query";

interface IBGECity {
  id: number;
  nome: string;
}

interface IBGEDistrito {
  id: number;
  nome: string;
  municipio: {
    id: number;
    nome: string;
  };
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

export function useBrazilDistricts(uf: string | undefined, cityName: string | undefined) {
  return useQuery({
    queryKey: ["ibge_districts", uf, cityName],
    queryFn: async () => {
      if (!uf || !cityName) return [];
      // First get city ID
      const citiesRes = await fetch(
        `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`
      );
      if (!citiesRes.ok) throw new Error("Erro ao buscar cidades");
      const cities: IBGECity[] = await citiesRes.json();
      const city = cities.find(c => c.nome.toLowerCase() === cityName.toLowerCase());
      if (!city) return [];

      // Then get districts for that city
      const distRes = await fetch(
        `https://servicodados.ibge.gov.br/api/v1/localidades/municipios/${city.id}/distritos?orderBy=nome`
      );
      if (!distRes.ok) throw new Error("Erro ao buscar distritos");
      const districts: IBGEDistrito[] = await distRes.json();
      return districts.map(d => ({ value: d.nome, label: d.nome }));
    },
    enabled: !!uf && !!cityName,
    staleTime: 1000 * 60 * 60,
  });
}
