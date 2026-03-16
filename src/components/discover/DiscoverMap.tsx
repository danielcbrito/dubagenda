import { useEffect, useRef, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface MapUnit {
  id: string;
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
  const truncated = label.length > 18 ? `${label.slice(0, 17)}…` : label;

  return L.divIcon({
    className: "custom-pill-icon",
    iconSize: [120, 34],
    iconAnchor: [60, 17],
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

  const defaultCenter: L.LatLngExpression = userLocation
    ? [userLocation.lat, userLocation.lng]
    : [-23.55, -46.63];

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: defaultCenter,
      zoom: 14,
      zoomControl: false,
      attributionControl: false,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);
    mapRef.current = map;

    // Track bounds changes
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

  // Update user location marker
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
        fillColor: "#4285F4",
        fillOpacity: 1,
        color: "#ffffff",
        weight: 3,
      }).addTo(map);
    }
  }, [userLocation]);

  // Update unit markers
  const mappableUnits = useMemo(
    () => units
      .map((unit) => {
        const latitude = Number.parseFloat(String(unit.latitude));
        const longitude = Number.parseFloat(String(unit.longitude));

        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          return null;
        }

        return {
          ...unit,
          latitude,
          longitude,
        };
      })
      .filter((unit): unit is MapUnit & { latitude: number; longitude: number } => unit !== null),
    [units]
  );

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current.clear();

    // Add new markers
    mappableUnits.forEach((unit) => {
      const marker = L.marker([unit.latitude!, unit.longitude!], {
        icon: buildIcon(unit.brandName, unit.id === selectedId),
      })
        .on("click", () => onSelectUnit(unit.id))
        .addTo(map);
      markersRef.current.set(unit.id, marker);
    });
  }, [mappableUnits, selectedId, onSelectUnit]);

  // Fly to selected
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (selectedId) {
      const unit = units.find((u) => u.id === selectedId);
      if (unit?.latitude && unit?.longitude) {
        map.flyTo([unit.latitude, unit.longitude], 16, { duration: 0.8 });
      }
    } else if (userLocation) {
      map.flyTo([userLocation.lat, userLocation.lng], 14, { duration: 0.8 });
    }
  }, [selectedId]);

  // Handle recenter
  const handleRecenter = () => {
    const map = mapRef.current;
    if (map && userLocation) {
      map.flyTo([userLocation.lat, userLocation.lng], 14, { duration: 0.8 });
    }
    onRecenter();
  };

  // Invalidate size when container resizes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const timer = setTimeout(() => map.invalidateSize(), 400);
    return () => clearTimeout(timer);
  });

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full z-0" />

      {userLocation && (
        <button
          onClick={handleRecenter}
          className="absolute bottom-4 right-4 z-[500] w-10 h-10 rounded-full bg-card border border-border shadow-lg flex items-center justify-center active:scale-90 transition-transform"
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
