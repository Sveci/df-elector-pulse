import { useQuery } from "@tanstack/react-query";
import { getCities, getCityById } from "@/services/office/officeService";
import type { OfficeCityType } from "@/types/office";

export function useOfficeCities(tipo?: OfficeCityType) {
  return useQuery({
    queryKey: ["office_cities", tipo],
    queryFn: async () => {
      const cities = await getCities();
      if (tipo) {
        return cities.filter(city => city.tipo === tipo);
      }
      return cities;
    }
  });
}

export function useOfficeCitiesByType() {
  const { data: allCities, ...rest } = useOfficeCities();

  const dfCities = allCities?.filter(city => city.tipo === 'DF') || [];
  const entornoCities = allCities?.filter(city => city.tipo === 'ENTORNO') || [];

  return {
    ...rest,
    data: allCities,
    dfCities,
    entornoCities,
  };
}

export function useOfficeCity(id: string) {
  return useQuery({
    queryKey: ["office_city", id],
    queryFn: () => getCityById(id),
    enabled: !!id
  });
}
