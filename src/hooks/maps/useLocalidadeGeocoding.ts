import { useQuery } from "@tanstack/react-query";

interface GeocodedLocation {
  nome: string;
  lat: number;
  lng: number;
}

const IBGE_API = "https://servicodados.ibge.gov.br/api/v1";

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Fetches municipality coordinates using IBGE localidades + coordinates API.
 * Uses the v1 localidades endpoint which includes geographic coordinates.
 */
async function fetchMunicipiosByUF(uf: string): Promise<Map<string, GeocodedLocation>> {
  const map = new Map<string, GeocodedLocation>();

  try {
    // IBGE API v1 returns municipalities with coordinates when using view=nivelado
    const response = await fetch(
      `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?view=nivelado`
    );
    if (!response.ok) {
      console.error("IBGE municipios fetch failed:", response.status);
      return map;
    }

    const municipios = await response.json();
    console.log(`IBGE: ${municipios.length} municipios fetched for ${uf}`);

    // The nivelado view doesn't include coords directly.
    // Use the malhas API to get GeoJSON with centroids.
    const geoResponse = await fetch(
      `https://servicodados.ibge.gov.br/api/v3/malhas/estados/${uf}?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=municipio`
    );

    if (!geoResponse.ok) {
      console.error("IBGE malhas fetch failed:", geoResponse.status);
      return map;
    }

    const geoJson = await geoResponse.json();
    const features = geoJson.features || [];
    console.log(`IBGE: ${features.length} geo features for ${uf}`);

    // Build map: codarea -> centroid
    const idToCoord = new Map<string, { lat: number; lng: number }>();
    for (const feature of features) {
      const codarea = feature.properties?.codarea;
      if (!codarea) continue;

      const centroid = calculateCentroid(feature.geometry);
      if (centroid) {
        idToCoord.set(String(codarea), centroid);
      }
    }

    // Match municipalities to their centroids
    for (const mun of municipios) {
      const munId = String(mun["municipio-id"] || mun.id || "");
      const munNome = mun["municipio-nome"] || mun.nome || "";
      
      const coord = idToCoord.get(munId);
      if (coord && munNome) {
        const normalized = normalizeName(munNome);
        map.set(normalized, { nome: munNome, lat: coord.lat, lng: coord.lng });
      }
    }

    console.log(`IBGE geocoding: ${map.size} municipalities geocoded for ${uf}`);
    
    // Debug: check Macapá specifically
    const macapa = map.get(normalizeName("Macapá"));
    if (macapa) {
      console.log(`Macapá found at: ${macapa.lat}, ${macapa.lng}`);
    }
  } catch (err) {
    console.error("Error fetching IBGE municipalities for", uf, err);
  }

  return map;
}

/**
 * Calculate centroid from GeoJSON geometry (Polygon or MultiPolygon).
 * Returns {lat, lng} — note: GeoJSON uses [lng, lat] order.
 */
function calculateCentroid(geometry: any): { lat: number; lng: number } | null {
  if (!geometry) return null;

  let allCoords: number[][] = [];

  if (geometry.type === "Polygon") {
    allCoords = geometry.coordinates[0] || [];
  } else if (geometry.type === "MultiPolygon") {
    // Merge all outer rings
    for (const polygon of geometry.coordinates) {
      const ring = polygon[0] || [];
      allCoords.push(...ring);
    }
  }

  if (allCoords.length === 0) return null;

  let sumLng = 0;
  let sumLat = 0;
  for (const coord of allCoords) {
    sumLng += coord[0]; // GeoJSON: [lng, lat]
    sumLat += coord[1];
  }

  return {
    lat: sumLat / allCoords.length,
    lng: sumLng / allCoords.length,
  };
}

/**
 * Hook that provides geocoding for localidade strings based on UF.
 * Returns a lookup function to get coordinates by city/localidade name.
 */
export function useLocalidadeGeocoding(uf: string | null | undefined) {
  const query = useQuery({
    queryKey: ["ibge_municipios_geo", uf],
    queryFn: () => fetchMunicipiosByUF(uf!),
    enabled: !!uf,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });

  const lookup = (localidade: string): { lat: number; lng: number } | null => {
    if (!query.data) return null;
    const normalized = normalizeName(localidade);

    // Exact match
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
