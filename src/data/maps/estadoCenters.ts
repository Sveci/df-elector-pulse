// Center coordinates and zoom levels for Brazilian states (capital cities)
export interface EstadoCenter {
  uf: string;
  lat: number;
  lng: number;
  zoom: number;
}

export const ESTADO_CENTERS: EstadoCenter[] = [
  { uf: "AC", lat: -9.9754, lng: -67.8249, zoom: 8 },
  { uf: "AL", lat: -9.6658, lng: -35.7353, zoom: 9 },
  { uf: "AP", lat: 0.0349, lng: -51.0694, zoom: 8 },
  { uf: "AM", lat: -3.1190, lng: -60.0217, zoom: 7 },
  { uf: "BA", lat: -12.9714, lng: -38.5124, zoom: 7 },
  { uf: "CE", lat: -3.7172, lng: -38.5433, zoom: 8 },
  { uf: "DF", lat: -15.7801, lng: -47.9292, zoom: 10 },
  { uf: "ES", lat: -20.3155, lng: -40.3128, zoom: 9 },
  { uf: "GO", lat: -16.6869, lng: -49.2648, zoom: 8 },
  { uf: "MA", lat: -2.5297, lng: -44.2825, zoom: 8 },
  { uf: "MT", lat: -15.6014, lng: -56.0979, zoom: 7 },
  { uf: "MS", lat: -20.4697, lng: -54.6201, zoom: 8 },
  { uf: "MG", lat: -19.9167, lng: -43.9345, zoom: 7 },
  { uf: "PA", lat: -1.4558, lng: -48.5024, zoom: 7 },
  { uf: "PB", lat: -7.1195, lng: -34.8450, zoom: 9 },
  { uf: "PR", lat: -25.4284, lng: -49.2733, zoom: 8 },
  { uf: "PE", lat: -8.0476, lng: -34.8770, zoom: 8 },
  { uf: "PI", lat: -5.0892, lng: -42.8019, zoom: 8 },
  { uf: "RJ", lat: -22.9068, lng: -43.1729, zoom: 9 },
  { uf: "RN", lat: -5.7945, lng: -35.2110, zoom: 9 },
  { uf: "RS", lat: -30.0346, lng: -51.2177, zoom: 8 },
  { uf: "RO", lat: -8.7612, lng: -63.9004, zoom: 8 },
  { uf: "RR", lat: 2.8195, lng: -60.6714, zoom: 8 },
  { uf: "SC", lat: -27.5949, lng: -48.5482, zoom: 8 },
  { uf: "SP", lat: -23.5505, lng: -46.6333, zoom: 8 },
  { uf: "SE", lat: -10.9091, lng: -37.0677, zoom: 9 },
  { uf: "TO", lat: -10.1689, lng: -48.3317, zoom: 8 },
];

// Major city coordinates for city-level zoom
export interface CidadeCenter {
  nome: string;
  uf: string;
  lat: number;
  lng: number;
}

// This is a fallback; the system will use IBGE geocoding when available
export function getEstadoCenter(uf: string): { lat: number; lng: number; zoom: number } | null {
  const found = ESTADO_CENTERS.find(e => e.uf === uf);
  return found ? { lat: found.lat, lng: found.lng, zoom: found.zoom } : null;
}

// Default center for Brazil (national scope)
export const BRAZIL_CENTER: [number, number] = [-14.235, -51.9253];
export const BRAZIL_ZOOM = 4;
