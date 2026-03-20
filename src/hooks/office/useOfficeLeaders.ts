import { useQuery } from "@tanstack/react-query";
import { getLeaders, getLeadersByCity } from "@/services/office/officeService";

export function useOfficeLeaders(filters?: {
  cidade_id?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
}) {
  return useQuery({
    queryKey: ["office_leaders", filters],
    queryFn: () => getLeaders(filters)
  });
}

export function useOfficeLeadersByCity(cityId: string) {
  return useQuery({
    queryKey: ["office_leaders_by_city", cityId],
    queryFn: () => getLeadersByCity(cityId),
    enabled: !!cityId
  });
}
