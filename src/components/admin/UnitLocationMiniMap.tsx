import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface UnitLocationMiniMapProps {
  position: { lat: number; lng: number } | null;
  onChange: (position: { lat: number; lng: number }) => void;
  height?: number;
}

const BRAZIL_CENTER = { lat: -14.235, lng: -51.9253 };

function createEditorIcon() {
  return L.divIcon({
    className: "unit-location-editor-icon",
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    html: `
      <div style="
        width:24px;
        height:24px;
        border-radius:999px;
        background:hsl(var(--primary));
        border:3px solid hsl(var(--background));
        box-shadow:0 10px 22px hsl(var(--foreground) / 0.16);
      "></div>
    `,
  });
}

export function UnitLocationMiniMap({
  position,
  onChange,
  height = 220,
}: UnitLocationMiniMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const center = position ?? BRAZIL_CENTER;
    const map = L.map(containerRef.current, {
      center: [center.lat, center.lng],
      zoom: position ? 16 : 4,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);
    mapRef.current = map;

    const syncMarker = (lat: number, lng: number, shouldCenter: boolean) => {
      if (!markerRef.current) {
        markerRef.current = L.marker([lat, lng], {
          draggable: true,
          icon: createEditorIcon(),
        })
          .on("dragend", (event) => {
            const next = (event.target as L.Marker).getLatLng();
            onChangeRef.current({ lat: next.lat, lng: next.lng });
          })
          .addTo(map);
      } else {
        markerRef.current.setLatLng([lat, lng]);
      }

      if (shouldCenter) {
        map.flyTo([lat, lng], Math.max(map.getZoom(), 16), { duration: 0.35 });
      }
    };

    if (position) {
      syncMarker(position.lat, position.lng, false);
    }

    map.on("click", (event) => {
      syncMarker(event.latlng.lat, event.latlng.lng, false);
      onChange({ lat: event.latlng.lat, lng: event.latlng.lng });
    });

    const invalidateTimer = window.setTimeout(() => map.invalidateSize(), 250);

    return () => {
      window.clearTimeout(invalidateTimer);
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!position) {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      map.setView([BRAZIL_CENTER.lat, BRAZIL_CENTER.lng], 4);
      return;
    }

    if (!markerRef.current) {
      markerRef.current = L.marker([position.lat, position.lng], {
        draggable: true,
        icon: createEditorIcon(),
      })
        .on("dragend", (event) => {
          const next = (event.target as L.Marker).getLatLng();
          onChange({ lat: next.lat, lng: next.lng });
        })
        .addTo(map);
    } else {
      markerRef.current.setLatLng([position.lat, position.lng]);
    }

    map.setView([position.lat, position.lng], Math.max(map.getZoom(), 16));
  }, [position?.lat, position?.lng]);

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm shadow-foreground/5">
      <div ref={containerRef} style={{ height }} className="w-full" />
    </div>
  );
}
