import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  getCoordinateGroupKey,
  getDiscoverUnitDisplayName,
  offsetDuplicateCoordinate,
} from "./discoverUnitUtils";

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function smartZoomForDistance(km: number): number {
  if (km > 10) return 11;
  if (km > 5) return 12;
  if (km > 2) return 13;
  return 14;
}

interface MapUnit {
  id: string;
  nome: string;
  latitude: number | null;
  longitude: number | null;
  brandName: string;
}

interface DiscoverMapProps {
  units: MapUnit[];
  userLocation: { lat: number; lng: number } | null;
  selectedId: string | null;
  onSelectUnit: (id: string) => void;
  onRecenter: () => void;
  onBoundsChange?: (bounds: L.LatLngBounds) => void;
}

function buildIcon(label: string, selected: boolean) {
  const bg = selected ? "hsl(var(--foreground))" : "hsl(var(--card))";
  const color = selected ? "hsl(var(--background))" : "hsl(var(--foreground))";
  const border = "hsl(var(--foreground))";
  const shadow = selected
    ? "0 6px 16px hsl(var(--foreground) / 0.22)"
    : "0 3px 10px hsl(var(--foreground) / 0.14)";
  const scale = selected ? "scale(1.08)" : "scale(1)";
  const truncated = label.length > 26 ? `${label.slice(0, 25)}…` : label;
  const width = Math.max(132, Math.min(210, truncated.length * 7 + 26));

  return L.divIcon({
    className: "custom-pill-icon",
    iconSize: [width, 34],
    iconAnchor: [width / 2, 17],
    popupAnchor: [0, -17],
    html: `<div class="discover-map-pill" style="
      background:${bg};
      color:${color};
      border:2px solid ${border};
      border-radius:999px;
      padding:5px 12px;
      font-size:11px;
      font-weight:700;
      line-height:1;
      white-space:nowrap;
      box-shadow:${shadow};
      transform:${scale};
      transition:all 0.2s ease;
      cursor:pointer;
      font-family:system-ui, sans-serif;
      position:relative;
      z-index:1000;
    ">${truncated}</div>`,
  });
}

export function DiscoverMap({
  units,
  userLocation,
  selectedId,
  onSelectUnit,
  onRecenter,
  onBoundsChange,
}: DiscoverMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const userMarkerRef = useRef<L.CircleMarker | null>(null);

  const mappableUnits = useMemo(
    () =>
      units
        .map((unit) => {
          const latitude = Number.parseFloat(String(unit.latitude));
          const longitude = Number.parseFloat(String(unit.longitude));
          if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
          return { ...unit, latitude, longitude };
        })
        .filter((unit): unit is MapUnit & { latitude: number; longitude: number } => unit !== null),
    [units]
  );

  const markerUnits = useMemo(() => {
    const groupedUnits = new Map<string, Array<MapUnit & { latitude: number; longitude: number }>>();

    mappableUnits.forEach((unit) => {
      const key = getCoordinateGroupKey(unit.latitude, unit.longitude);
      const current = groupedUnits.get(key) ?? [];
      current.push(unit);
      groupedUnits.set(key, current);
    });

    return Array.from(groupedUnits.values()).flatMap((group) =>
      group.map((unit, index) => {
        const offsetPosition = offsetDuplicateCoordinate(unit.latitude, unit.longitude, index, group.length);
        return {
          ...unit,
          markerLatitude: offsetPosition.lat,
          markerLongitude: offsetPosition.lng,
          displayLabel: getDiscoverUnitDisplayName(unit.brandName, unit.nome),
        };
      })
    );
  }, [mappableUnits]);

  const defaultCenter: L.LatLngExpression = userLocation
    ? [userLocation.lat, userLocation.lng]
    : [-23.55, -46.63];

  const initialZoom = useMemo(() => {
    if (!userLocation || mappableUnits.length === 0) return 14;
    let minDist = Infinity;
    for (const unit of mappableUnits) {
      const distance = haversineKm(userLocation.lat, userLocation.lng, unit.latitude, unit.longitude);
      if (distance < minDist) minDist = distance;
    }
    return smartZoomForDistance(minDist);
  }, [userLocation, mappableUnits]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: defaultCenter,
      zoom: initialZoom,
      zoomControl: false,
      attributionControl: false,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);
    mapRef.current = map;

    const emitBounds = () => {
      if (onBoundsChange && map.getBounds().isValid()) {
        onBoundsChange(map.getBounds());
      }
    };

    map.on("moveend", emitBounds);
    map.on("zoomend", emitBounds);
    const initialBoundsTimer = window.setTimeout(emitBounds, 500);

    return () => {
      window.clearTimeout(initialBoundsTimer);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }

    if (userLocation) {
      userMarkerRef.current = L.circleMarker([userLocation.lat, userLocation.lng], {
        radius: 8,
        fillColor: "hsl(var(--primary))",
        fillOpacity: 1,
        color: "hsl(var(--background))",
        weight: 3,
      }).addTo(map);
    }
  }, [userLocation]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current.clear();

    markerUnits.forEach((unit) => {
      const marker = L.marker([unit.markerLatitude, unit.markerLongitude], {
        icon: buildIcon(unit.displayLabel, unit.id === selectedId),
      })
        .on("click", () => onSelectUnit(unit.id))
        .addTo(map);

      markersRef.current.set(unit.id, marker);
    });
  }, [markerUnits, selectedId, onSelectUnit]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (selectedId) {
      const unit = mappableUnits.find((entry) => entry.id === selectedId);
      if (unit) {
        map.flyTo([unit.latitude, unit.longitude], 16, { duration: 0.8 });
      }
      return;
    }

    if (userLocation) {
      map.flyTo([userLocation.lat, userLocation.lng], initialZoom, { duration: 0.8 });
    }
  }, [selectedId, mappableUnits, userLocation, initialZoom]);

  const handleRecenter = () => {
    const map = mapRef.current;
    if (map && userLocation) {
      map.flyTo([userLocation.lat, userLocation.lng], initialZoom, { duration: 0.8 });
    }
    onRecenter();
  };

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const timer = window.setTimeout(() => map.invalidateSize(), 400);
    return () => window.clearTimeout(timer);
  });

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full z-0" />

      {userLocation && (
        <button
          onClick={handleRecenter}
          className="absolute bottom-4 right-4 z-[500] flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card shadow-lg transition-transform active:scale-90"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-foreground"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
          </svg>
        </button>
      )}
    </div>
  );
}
