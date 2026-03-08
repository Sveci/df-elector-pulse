import { useQuery } from "@tanstack/react-query";

interface IBGEMunicipio {
  id: number;
  nome: string;
}

interface GeocodedLocation {
  nome: string;
  lat: number;
  lng: number;
}

// Cache of IBGE municipality coordinates (fetched once per UF)
// IBGE doesn't provide coordinates directly, so we use the IBGE localidades API
const IBGE_API = "https://servicodados.ibge.gov.br/api/v1";

/**
 * Fetches municipality coordinates from IBGE API for a given UF.
 * Returns a map of normalized city name -> { lat, lng }
 */
async function fetchMunicipiosByUF(uf: string): Promise<Map<string, GeocodedLocation>> {
  const map = new Map<string, GeocodedLocation>();
  
  try {
    // Get municipalities with coordinates from IBGE
    const response = await fetch(
      `${IBGE_API}/localidades/estados/${uf}/municipios`
    );
    if (!response.ok) return map;
    
    const municipios: IBGEMunicipio[] = await response.json();
    
    // Fetch coordinates for each municipality using the malhas endpoint
    // Actually, IBGE doesn't give lat/lng directly. Use a different approach:
    // Use the IBGE geocoding via their centroids API
    const coordResponse = await fetch(
      `https://servicodados.ibge.gov.br/api/v3/malhas/estados/${uf}?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=municipio`
    );
    
    if (coordResponse.ok) {
      const geoJson = await coordResponse.json();
      
      // Match features to municipalities by id
      const idToCoord = new Map<number, { lat: number; lng: number }>();
      
      for (const feature of geoJson.features || []) {
        const codarea = parseInt(feature.properties?.codarea || "0");
        // Calculate centroid from the geometry
        const coords = extractCentroid(feature.geometry);
        if (coords && codarea) {
          idToCoord.set(codarea, coords);
        }
      }
      
      for (const mun of municipios) {
        const coord = idToCoord.get(mun.id);
        if (coord) {
          const normalized = normalizeName(mun.nome);
          map.set(normalized, { nome: mun.nome, lat: coord.lat, lng: coord.lng });
        }
      }
    }
  } catch (err) {
    console.error("Error fetching IBGE municipalities for", uf, err);
  }
  
  return map;
}

/**
 * Extract centroid from a GeoJSON geometry (Polygon or MultiPolygon)
 */
function extractCentroid(geometry: any): { lat: number; lng: number } | null {
  if (!geometry) return null;
  
  let allCoords: number[][] = [];
  
  if (geometry.type === "Polygon") {
    allCoords = geometry.coordinates[0] || [];
  } else if (geometry.type === "MultiPolygon") {
    // Use the largest polygon
    let maxLen = 0;
    for (const polygon of geometry.coordinates) {
      const ring = polygon[0] || [];
      if (ring.length > maxLen) {
        maxLen = ring.length;
        allCoords = ring;
      }
    }
  }
  
  if (allCoords.length === 0) return null;
  
  // Simple centroid: average of all coordinates
  let sumLng = 0, sumLat = 0;
  for (const [lng, lat] of allCoords) {
    sumLng += lng;
    sumLat += lat;
  }
  
  return {
    lat: sumLat / allCoords.length,
    lng: sumLng / allCoords.length,
  };
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Hook that provides geocoding for localidade strings based on UF.
 * Returns a function to look up coordinates by city/localidade name.
 */
export function useLocalidadeGeocoding(uf: string | null | undefined) {
  const query = useQuery({
    queryKey: ["ibge_municipios_geo", uf],
    queryFn: () => fetchMunicipiosByUF(uf!),
    enabled: !!uf,
    staleTime: 30 * 60 * 1000, // 30 min cache
    gcTime: 60 * 60 * 1000,
  });

  const lookup = (localidade: string): { lat: number; lng: number } | null => {
    if (!query.data) return null;
    const normalized = normalizeName(localidade);
    const exact = query.data.get(normalized);
    if (exact) return { lat: exact.lat, lng: exact.lng };
    
    // Fuzzy: try finding a municipality that starts with or contains the localidade
    for (const [key, val] of query.data) {
      if (key.includes(normalized) || normalized.includes(key)) {
        return { lat: val.lat, lng: val.lng };
      }
    }
    return null;
  };

  return {
    lookup,
    isLoading: query.isLoading,
    isReady: query.isSuccess && !!query.data,
  };
}
