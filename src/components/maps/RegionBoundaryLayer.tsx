import { Polygon, Tooltip } from "react-leaflet";
import { useMemo } from "react";
import { dfRABoundaries } from "@/data/maps/df-ra-boundaries";

interface RegionBoundaryLayerProps {
  selectedRegionCode: string | null;
  selectedRegionName: string | null;
  enabled: boolean;
}

export function RegionBoundaryLayer({
  selectedRegionCode,
  selectedRegionName,
  enabled,
}: RegionBoundaryLayerProps) {
  const boundary = useMemo(() => {
    if (!enabled || !selectedRegionCode) return null;

    return dfRABoundaries.find(
      (b) => b.codigo_ra === selectedRegionCode || b.nome === selectedRegionName
    );
  }, [selectedRegionCode, selectedRegionName, enabled]);

  if (!boundary) return null;

  return (
    <Polygon
      positions={boundary.coordinates}
      pathOptions={{
        color: "hsl(var(--primary))",
        weight: 3,
        fillColor: "hsl(var(--primary))",
        fillOpacity: 0.08,
        dashArray: "8, 6",
        lineCap: "round",
        lineJoin: "round",
      }}
    >
      <Tooltip
        permanent
        direction="center"
        className="!bg-primary/90 !text-primary-foreground !border-none !rounded-lg !px-3 !py-1.5 !font-semibold !shadow-lg"
      >
        {boundary.nome}
      </Tooltip>
    </Polygon>
  );
}
