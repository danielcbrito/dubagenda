import { useEffect, useRef, useMemo } from "react";
import { MapContainer, TileLayer, Marker, useMap, CircleMarker } from "react-leaflet";
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
}

// Custom icon builder
function buildIcon(label: string, selected: boolean) {
  const bg = selected ? "#0a0a0a" : "#ffffff";
  const color = selected ? "#ffffff" : "#0a0a0a";
  const border = selected ? "#0a0a0a" : "#d4d4d4";
  const shadow = selected ? "0 4px 12px rgba(0,0,0,0.3)" : "0 2px 6px rgba(0,0,0,0.12)";
  const scale = selected ? "scale(1.1)" : "scale(1)";
  const truncated = label.length > 14 ? label.slice(0, 13) + "…" : label;

  return L.divIcon({
    className: "",
    iconSize: [0, 0],
    iconAnchor: [0, 16],
    html: `<div style="
      background:${bg};color:${color};border:1.5px solid ${border};
      padding:4px 10px;border-radius:20px;font-size:12px;font-weight:600;
      white-space:nowrap;box-shadow:${shadow};transform:${scale};
      transition:all 0.2s ease;cursor:pointer;font-family:system-ui;
      display:flex;align-items:center;gap:4px;
    ">${truncated}</div>`,
  });
}

// Sub-component to fly the map
function FlyTo({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, zoom, { duration: 0.8 });
  }, [center[0], center[1], zoom]);
  return null;
}

export function DiscoverMap({
  units,
  userLocation,
  selectedId,
  onSelectUnit,
  onRecenter,
}: DiscoverMapProps) {
  const defaultCenter: [number, number] = userLocation
    ? [userLocation.lat, userLocation.lng]
    : [-23.55, -46.63]; // São Paulo fallback

  const flyTarget = useMemo(() => {
    if (selectedId) {
      const unit = units.find((u) => u.id === selectedId);
      if (unit?.latitude && unit?.longitude) {
        return { center: [unit.latitude, unit.longitude] as [number, number], zoom: 16 };
      }
    }
    return { center: defaultCenter, zoom: 14 };
  }, [selectedId, units, defaultCenter]);

  const mappableUnits = units.filter(
    (u) => u.latitude !== null && u.longitude !== null
  );

  return (
    <div className="relative w-full h-full">
      <MapContainer
        center={defaultCenter}
        zoom={14}
        zoomControl={false}
        attributionControl={false}
        style={{ height: "100%", width: "100%" }}
        className="z-0"
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <FlyTo center={flyTarget.center} zoom={flyTarget.zoom} />

        {/* User location */}
        {userLocation && (
          <CircleMarker
            center={[userLocation.lat, userLocation.lng]}
            radius={8}
            pathOptions={{
              fillColor: "#4285F4",
              fillOpacity: 1,
              color: "#ffffff",
              weight: 3,
            }}
          />
        )}

        {/* Unit markers */}
        {mappableUnits.map((unit) => (
          <Marker
            key={unit.id}
            position={[unit.latitude!, unit.longitude!]}
            icon={buildIcon(unit.brandName, unit.id === selectedId)}
            eventHandlers={{ click: () => onSelectUnit(unit.id) }}
          />
        ))}
      </MapContainer>

      {/* Recenter button */}
      {userLocation && (
        <button
          onClick={onRecenter}
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
