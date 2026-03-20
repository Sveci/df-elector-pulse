// Approximate polygon boundaries for DF Administrative Regions
// These are simplified polygons centered on each RA coordinate
// For precise boundaries, replace with official GeoJSON from GDF/SEDUH/IPE
// Source: Coordinates from office_cities table + estimated coverage areas

export interface RABoundary {
  codigo_ra: string;
  nome: string;
  coordinates: [number, number][];
}

// Generate irregular polygon vertices around a center point
// Creates a more natural-looking boundary than perfect hexagons
function generatePolygon(
  centerLat: number,
  centerLng: number,
  radiusKm: number,
  vertices: number = 8,
  irregularity: number = 0.2
): [number, number][] {
  const points: [number, number][] = [];
  const kmPerDegreeLat = 111.32;
  const kmPerDegreeLng = 111.32 * Math.cos(centerLat * (Math.PI / 180));

  // Generate seed for consistent randomness based on coordinates
  const seed = Math.abs(centerLat * 1000 + centerLng * 100);
  const pseudoRandom = (i: number) => {
    const x = Math.sin(seed + i * 127.1) * 43758.5453;
    return x - Math.floor(x);
  };

  for (let i = 0; i < vertices; i++) {
    const baseAngle = (2 * Math.PI * i) / vertices;
    // Add slight angle variation for irregular shape
    const angleVariation = (pseudoRandom(i) - 0.5) * 0.3;
    const angle = baseAngle + angleVariation;

    // Vary the radius for each vertex
    const radiusVariation = 1 + (pseudoRandom(i + vertices) - 0.5) * irregularity * 2;
    const r = radiusKm * radiusVariation;

    const latOffset = (r * Math.sin(angle)) / kmPerDegreeLat;
    const lngOffset = (r * Math.cos(angle)) / kmPerDegreeLng;
    points.push([centerLat + latOffset, centerLng + lngOffset]);
  }

  // Close the polygon
  points.push(points[0]);

  return points;
}

// RA data with coordinates and estimated area sizes
// Sizes based on approximate real area of each RA
const raData: Array<{
  codigo_ra: string;
  nome: string;
  lat: number;
  lng: number;
  radius: number;
  vertices?: number;
}> = [
  // Large RAs (>100 km²)
  { codigo_ra: "RA-01", nome: "Brasília", lat: -15.7942, lng: -47.8825, radius: 5, vertices: 10 },
  { codigo_ra: "RA-04", nome: "Brazlândia", lat: -15.6797, lng: -48.1962, radius: 6, vertices: 9 },
  { codigo_ra: "RA-06", nome: "Planaltina", lat: -15.6185, lng: -47.6574, radius: 7, vertices: 10 },
  { codigo_ra: "RA-16", nome: "Lago Sul", lat: -15.83, lng: -47.82, radius: 4.5, vertices: 9 },
  { codigo_ra: "RA-24", nome: "Park Way", lat: -15.88, lng: -47.96, radius: 5, vertices: 8 },
  { codigo_ra: "RA-27", nome: "Jardim Botânico", lat: -15.87, lng: -47.79, radius: 4, vertices: 8 },

  // Medium RAs (30-100 km²)
  { codigo_ra: "RA-02", nome: "Gama", lat: -16.0163, lng: -48.0564, radius: 4, vertices: 9 },
  { codigo_ra: "RA-03", nome: "Taguatinga", lat: -15.8363, lng: -48.0514, radius: 3.5, vertices: 8 },
  { codigo_ra: "RA-05", nome: "Sobradinho", lat: -15.6497, lng: -47.7944, radius: 4, vertices: 9 },
  { codigo_ra: "RA-07", nome: "Paranoá", lat: -15.7725, lng: -47.7792, radius: 4, vertices: 8 },
  { codigo_ra: "RA-09", nome: "Ceilândia", lat: -15.8233, lng: -48.1117, radius: 4.5, vertices: 10 },
  { codigo_ra: "RA-12", nome: "Samambaia", lat: -15.8767, lng: -48.0833, radius: 3.5, vertices: 8 },
  { codigo_ra: "RA-13", nome: "Santa Maria", lat: -16.0178, lng: -48.0078, radius: 3.5, vertices: 8 },
  { codigo_ra: "RA-14", nome: "São Sebastião", lat: -15.9, lng: -47.78, radius: 3.5, vertices: 8 },
  { codigo_ra: "RA-18", nome: "Lago Norte", lat: -15.73, lng: -47.84, radius: 3.5, vertices: 8 },
  { codigo_ra: "RA-26", nome: "Sobradinho II", lat: -15.635, lng: -47.83, radius: 3.5, vertices: 8 },
  { codigo_ra: "RA-31", nome: "Fercal", lat: -15.58, lng: -47.9, radius: 4, vertices: 8 },

  // Small-Medium RAs (10-30 km²)
  { codigo_ra: "RA-10", nome: "Guará", lat: -15.8144, lng: -47.9719, radius: 2.5, vertices: 8 },
  { codigo_ra: "RA-15", nome: "Recanto das Emas", lat: -15.9089, lng: -48.0603, radius: 2.5, vertices: 8 },
  { codigo_ra: "RA-17", nome: "Riacho Fundo", lat: -15.8728, lng: -48.0, radius: 2.2, vertices: 8 },
  { codigo_ra: "RA-20", nome: "Águas Claras", lat: -15.835, lng: -48.025, radius: 2.5, vertices: 8 },
  { codigo_ra: "RA-21", nome: "Riacho Fundo II", lat: -15.9, lng: -48.045, radius: 2, vertices: 8 },
  { codigo_ra: "RA-28", nome: "Itapoã", lat: -15.755, lng: -47.77, radius: 2, vertices: 7 },
  { codigo_ra: "RA-30", nome: "Vicente Pires", lat: -15.8, lng: -48.04, radius: 2.5, vertices: 8 },
  { codigo_ra: "RA-32", nome: "Sol Nascente/Pôr do Sol", lat: -15.795, lng: -48.115, radius: 3, vertices: 9 },
  { codigo_ra: "RA-33", nome: "Arniqueira", lat: -15.835, lng: -48.0, radius: 2, vertices: 7 },
  { codigo_ra: "RA-34", nome: "Arapoanga", lat: -15.6027, lng: -47.6324, radius: 2, vertices: 7 },

  // Small RAs (<10 km²)
  { codigo_ra: "RA-08", nome: "Núcleo Bandeirante", lat: -15.8711, lng: -47.9727, radius: 1.5, vertices: 7 },
  { codigo_ra: "RA-11", nome: "Cruzeiro", lat: -15.79, lng: -47.93, radius: 1.8, vertices: 7 },
  { codigo_ra: "RA-19", nome: "Candangolândia", lat: -15.8450, lng: -47.9550, radius: 1.2, vertices: 7 },
  { codigo_ra: "RA-22", nome: "Sudoeste/Octogonal", lat: -15.80, lng: -47.925, radius: 1.8, vertices: 7 },
  { codigo_ra: "RA-23", nome: "Varjão", lat: -15.71, lng: -47.865, radius: 0.8, vertices: 6 },
  { codigo_ra: "RA-25", nome: "SCIA", lat: -15.785, lng: -47.965, radius: 1.5, vertices: 7 },
  { codigo_ra: "RA-29", nome: "SIA", lat: -15.8, lng: -47.945, radius: 1.5, vertices: 7 },
];

// Generate boundaries for all RAs
export const dfRABoundaries: RABoundary[] = raData.map((ra) => ({
  codigo_ra: ra.codigo_ra,
  nome: ra.nome,
  coordinates: generatePolygon(ra.lat, ra.lng, ra.radius, ra.vertices || 8, 0.25),
}));

// Get boundary by RA code
export function getBoundaryByCode(codigoRA: string): RABoundary | undefined {
  return dfRABoundaries.find((b) => b.codigo_ra === codigoRA);
}

// Get boundary by city name
export function getBoundaryByName(nome: string): RABoundary | undefined {
  return dfRABoundaries.find((b) => b.nome === nome);
}

// Get RA center coordinates by codigo_ra
export function getRACenter(codigoRA: string): [number, number] | null {
  const ra = raData.find((r) => r.codigo_ra === codigoRA);
  return ra ? [ra.lat, ra.lng] : null;
}

// Get appropriate zoom level based on RA size
export function getRAZoomLevel(codigoRA: string): number {
  const ra = raData.find((r) => r.codigo_ra === codigoRA);
  if (!ra) return 13;

  // Zoom based on RA radius
  if (ra.radius >= 5) return 11;      // Large RAs
  if (ra.radius >= 3) return 12;      // Medium RAs
  if (ra.radius >= 2) return 13;      // Small RAs
  return 14;                          // Very small RAs
}
