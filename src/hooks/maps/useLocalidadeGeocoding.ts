import { useQuery } from "@tanstack/react-query";

interface GeocodedLocation {
  nome: string;
  lat: number;
  lng: number;
}

/**
 * Known coordinates for Brazilian state capitals and major cities.
 * Used as primary source — faster and more accurate than centroid calculation.
 */
const KNOWN_CITIES: Record<string, { lat: number; lng: number }> = {
  // Capitais
  "rio branco": { lat: -9.9754, lng: -67.8101 },
  "maceio": { lat: -9.6658, lng: -35.7353 },
  "macapa": { lat: 0.0349, lng: -51.0694 },
  "manaus": { lat: -3.1190, lng: -60.0217 },
  "salvador": { lat: -12.9714, lng: -38.5124 },
  "fortaleza": { lat: -3.7172, lng: -38.5433 },
  "brasilia": { lat: -15.7801, lng: -47.9292 },
  "vitoria": { lat: -20.3155, lng: -40.3128 },
  "goiania": { lat: -16.6869, lng: -49.2648 },
  "sao luis": { lat: -2.5297, lng: -44.2825 },
  "cuiaba": { lat: -15.6014, lng: -56.0979 },
  "campo grande": { lat: -20.4697, lng: -54.6201 },
  "belo horizonte": { lat: -19.9167, lng: -43.9345 },
  "belem": { lat: -1.4558, lng: -48.5024 },
  "joao pessoa": { lat: -7.1195, lng: -34.8450 },
  "curitiba": { lat: -25.4284, lng: -49.2733 },
  "recife": { lat: -8.0476, lng: -34.8770 },
  "teresina": { lat: -5.0892, lng: -42.8019 },
  "rio de janeiro": { lat: -22.9068, lng: -43.1729 },
  "natal": { lat: -5.7945, lng: -35.2110 },
  "porto alegre": { lat: -30.0346, lng: -51.2177 },
  "porto velho": { lat: -8.7612, lng: -63.9004 },
  "boa vista": { lat: 2.8195, lng: -60.6714 },
  "florianopolis": { lat: -27.5949, lng: -48.5482 },
  "sao paulo": { lat: -23.5505, lng: -46.6333 },
  "aracaju": { lat: -10.9091, lng: -37.0677 },
  "palmas": { lat: -10.1689, lng: -48.3317 },
  // Cidades importantes
  "campinas": { lat: -22.9099, lng: -47.0626 },
  "guarulhos": { lat: -23.4538, lng: -46.5333 },
  "santos": { lat: -23.9608, lng: -46.3336 },
  "niteroi": { lat: -22.8833, lng: -43.1036 },
  "osasco": { lat: -23.5325, lng: -46.7917 },
  "santo andre": { lat: -23.6737, lng: -46.5432 },
  "londrina": { lat: -23.3045, lng: -51.1696 },
  "joinville": { lat: -26.3045, lng: -48.8487 },
  "uberlandia": { lat: -18.9186, lng: -48.2772 },
  "sorocaba": { lat: -23.5015, lng: -47.4526 },
  "ribeirao preto": { lat: -21.1704, lng: -47.8103 },
  "sao jose dos campos": { lat: -23.1896, lng: -45.8841 },
  "caxias do sul": { lat: -29.1681, lng: -51.1794 },
  "juiz de fora": { lat: -21.7642, lng: -43.3503 },
  "feira de santana": { lat: -12.2669, lng: -38.9666 },
  "santana": { lat: 0.0584, lng: -51.1728 },
  "laranjal do jari": { lat: -0.8044, lng: -52.4536 },
  "oiapoque": { lat: 3.8413, lng: -51.8331 },
  "mazagao": { lat: -0.1153, lng: -51.2897 },
  "porto grande": { lat: 0.7125, lng: -51.4143 },
  "tartarugalzinho": { lat: 1.5063, lng: -50.9097 },
  "pedra branca do amapari": { lat: 0.7789, lng: -51.9486 },
  "serra do navio": { lat: 0.8994, lng: -52.0039 },
  "calcoene": { lat: 2.5042, lng: -50.9514 },
  "ferreira gomes": { lat: 0.8575, lng: -51.1794 },
  "pracuuba": { lat: 1.7450, lng: -50.7897 },
  "itaubal": { lat: 0.6003, lng: -50.6983 },
  "cutias": { lat: 0.9706, lng: -50.8019 },
  "vitoria do jari": { lat: -0.9272, lng: -52.4244 },
  "amapa": { lat: 2.0525, lng: -50.7939 },
};

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Fetches municipality coordinates for a UF using IBGE GeoJSON + known cities fallback.
 */
async function fetchMunicipiosByUF(uf: string): Promise<Map<string, GeocodedLocation>> {
  const map = new Map<string, GeocodedLocation>();

  try {
    // Step 1: Get municipality names from IBGE
    const response = await fetch(
      `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?view=nivelado`
    );
    if (!response.ok) return map;
    const municipios = await response.json();

    // Step 2: Get GeoJSON for centroid calculation
    const geoResponse = await fetch(
      `https://servicodados.ibge.gov.br/api/v3/malhas/estados/${uf}?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=municipio`
    );
    
    const idToCoord = new Map<string, { lat: number; lng: number }>();
    if (geoResponse.ok) {
      const geoJson = await geoResponse.json();
      for (const feature of geoJson.features || []) {
        const codarea = feature.properties?.codarea;
        if (!codarea) continue;
        const centroid = calculateCentroid(feature.geometry);
        if (centroid) {
          idToCoord.set(String(codarea), centroid);
        }
      }
    }

    // Step 3: Map municipalities using known coords first, then centroid
    for (const mun of municipios) {
      const munId = String(mun["municipio-id"] || mun.id || "");
      const munNome = mun["municipio-nome"] || mun.nome || "";
      if (!munNome) continue;

      const normalized = normalizeName(munNome);
      
      // Priority 1: Known coordinates (most accurate)
      const known = KNOWN_CITIES[normalized];
      if (known) {
        map.set(normalized, { nome: munNome, lat: known.lat, lng: known.lng });
        continue;
      }

      // Priority 2: Centroid from GeoJSON
      const coord = idToCoord.get(munId);
      if (coord) {
        map.set(normalized, { nome: munNome, lat: coord.lat, lng: coord.lng });
      }
    }

    console.log(`Geocoding: ${map.size} municipalities resolved for ${uf}`);
  } catch (err) {
    console.error("Error fetching IBGE municipalities for", uf, err);
  }

  return map;
}

function calculateCentroid(geometry: any): { lat: number; lng: number } | null {
  if (!geometry) return null;

  let allCoords: number[][] = [];

  if (geometry.type === "Polygon") {
    allCoords = geometry.coordinates[0] || [];
  } else if (geometry.type === "MultiPolygon") {
    for (const polygon of geometry.coordinates) {
      allCoords.push(...(polygon[0] || []));
    }
  }

  if (allCoords.length === 0) return null;

  let sumLng = 0, sumLat = 0;
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
    if (!query.data) {
      // Fallback: check known cities even if IBGE hasn't loaded
      const known = KNOWN_CITIES[normalizeName(localidade)];
      return known || null;
    }

    const normalized = normalizeName(localidade);
    const exact = query.data.get(normalized);
    if (exact) return { lat: exact.lat, lng: exact.lng };

    // Fuzzy match
    for (const [key, val] of query.data) {
      if (key.includes(normalized) || normalized.includes(key)) {
        return { lat: val.lat, lng: val.lng };
      }
    }

    // Last resort: known cities
    const known = KNOWN_CITIES[normalized];
    return known || null;
  };

  return {
    lookup,
    isLoading: query.isLoading,
    isReady: query.isSuccess && !!query.data,
  };
}
