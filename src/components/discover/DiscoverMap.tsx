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

function buildClientIcon() {
  return L.divIcon({
    html: `
      <div style="position:relative;width:44px;height:44px;">
        <div style="position:absolute;top:0;left:0;width:44px;height:44px;border-radius:50%;background:rgba(74,144,217,0.15);animation:discover-pulse 2s infinite;"></div>
        <div style="position:absolute;top:6px;left:6px;width:32px;height:32px;border-radius:50%;background:rgba(74,144,217,0.2);"></div>
        <div style="position:absolute;top:10px;left:10px;width:24px;height:24px;border-radius:50%;background:#4A90D9;border:2.5px solid white;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(74,144,217,0.4);">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="4" r="2.5" fill="white"/><path d="M2 11 Q6 8 10 11" stroke="white" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>
        </div>
      </div>
    `,
    className: "",
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
}

function buildBarberIcon(label: string, selected: boolean) {
  const truncated = label.length > 22 ? `${label.slice(0, 21)}…` : label;
  const scissorsColor = selected ? "#DC2626" : "#B91C1C";
  const scissorsSize = selected ? 28 : 22;
  const labelBg = selected ? "#111" : "white";
  const labelColor = selected ? "white" : "#111";
  const labelBorder = selected ? "none" : "1.5px solid #ddd";
  const labelSize = selected ? "11px" : "9px";
  const labelWeight = selected ? "700" : "600";
  const labelPad = selected ? "4px 12px" : "3px 9px";
  const shadow = selected
    ? "filter:drop-shadow(0 3px 6px rgba(220,38,38,0.35));"
    : "filter:drop-shadow(0 2px 4px rgba(0,0,0,0.18));";

  return L.divIcon({
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;${shadow}">
        <svg width="${scissorsSize}" height="${scissorsSize}" viewBox="0 0 24 24" fill="none">
          <path d="M6.5 3L12 14.5" stroke="${scissorsColor}" stroke-width="2.4" stroke-linecap="round"/>
          <path d="M17.5 3L12 14.5" stroke="${scissorsColor}" stroke-width="2.4" stroke-linecap="round"/>
          <circle cx="5" cy="18.5" r="3.2" stroke="${scissorsColor}" stroke-width="1.8" fill="none"/>
          <circle cx="19" cy="18.5" r="3.2" stroke="${scissorsColor}" stroke-width="1.8" fill="none"/>
          <line x1="7.8" y1="16.5" x2="12" y2="14.5" stroke="${scissorsColor}" stroke-width="1.8" stroke-linecap="round"/>
          <line x1="16.2" y1="16.5" x2="12" y2="14.5" stroke="${scissorsColor}" stroke-width="1.8" stroke-linecap="round"/>
        </svg>
        <div style="background:${labelBg};color:${labelColor};border:${labelBorder};border-radius:20px;padding:${labelPad};font-family:system-ui,sans-serif;font-size:${labelSize};font-weight:${labelWeight};white-space:nowrap;margin-top:2px;box-shadow:0 1px 4px rgba(0,0,0,0.12);">
          ${truncated}
        </div>
      </div>
    `,
    className: "",
    iconSize: [140, 70],
    iconAnchor: [70, 40],
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
      userMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], {
        icon: buildClientIcon(),
        zIndexOffset: 1000,
      }).addTo(map) as unknown as L.CircleMarker;
    }
  }, [userLocation]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current.clear();

    markerUnits.forEach((unit) => {
      const marker = L.marker([unit.markerLatitude, unit.markerLongitude], {
        icon: buildBarberIcon(unit.displayLabel, unit.id === selectedId),
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
