import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  getCoordinateGroupKey,
  getDiscoverUnitDisplayName,
  getDuplicateMarkerPixelOffset,
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

function getTileUrl(mapStyle: "satellite" | "street") {
  return mapStyle === "satellite"
    ? "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
    : "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}";
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
  mapStyle: "satellite" | "street";
}

function buildClientIcon() {
  return L.divIcon({
    html: `
      <div style="position:relative;width:48px;height:48px;">
        <div style="position:absolute;inset:0;border-radius:50%;background:rgba(74,144,217,0.15);animation:clientPulse 2s ease-out infinite;"></div>
        <div style="position:absolute;inset:8px;border-radius:50%;background:rgba(74,144,217,0.25);"></div>
        <div style="position:absolute;inset:14px;border-radius:50%;background:#4A90D9;border:2.5px solid white;box-shadow:0 2px 10px rgba(74,144,217,0.5);display:flex;align-items:center;justify-content:center;">
          <svg width="10" height="12" viewBox="0 0 10 12" fill="none"><circle cx="5" cy="3.5" r="2.5" fill="white"/><path d="M1 10.5 Q5 7.5 9 10.5" stroke="white" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>
        </div>
      </div>
    `,
    className: "custom-client-pin",
    iconSize: [48, 48],
    iconAnchor: [24, 24],
  });
}

const PIN_WIDTH = 36;
const PIN_HEIGHT = 44;
const LABEL_HEIGHT = 22;
const TOTAL_HEIGHT = PIN_HEIGHT + LABEL_HEIGHT;

function buildBarberIcon(
  label: string,
  selected: boolean,
  _markerOffset: { x: number; y: number },
  zoom: number
) {
  const truncated = label.length > 20 ? `${label.slice(0, 19)}…` : label;

  // Zoom muito afastado: só um pontinho
  if (zoom < 10) {
    return L.divIcon({
      html: `<div style="width:8px;height:8px;background:#111;border-radius:50%;border:1.5px solid white;"></div>`,
      iconSize: [8, 8],
      iconAnchor: [4, 4],
      className: "custom-barber-pin",
    });
  }

  const fill = selected ? "#111111" : "#ffffff";
  const stroke = selected ? "none" : "#111111";
  const scissorStroke = selected ? "#fff" : "#555";
  const scissorLine = selected ? "#fff" : "#333";
  const scissorFill = selected ? "#fff" : "#555";

  const teardropSvg = `
    <svg width="${PIN_WIDTH}" height="${PIN_HEIGHT}" viewBox="0 0 36 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M18 0 C8.059 0 0 8.059 0 18 C0 28.627 18 44 18 44 C18 44 36 28.627 36 18 C36 8.059 27.941 0 18 0Z" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
      <g transform="translate(9, 6)">
        <circle cx="4" cy="14" r="3" stroke="${scissorStroke}" stroke-width="1.5" fill="none"/>
        <circle cx="14" cy="14" r="3" stroke="${scissorStroke}" stroke-width="1.5" fill="none"/>
        <circle cx="4" cy="14" r="1.2" fill="${scissorFill}"/>
        <circle cx="14" cy="14" r="1.2" fill="${scissorFill}"/>
        <line x1="6" y1="11.5" x2="10" y2="3" stroke="${scissorLine}" stroke-width="1.8" stroke-linecap="round"/>
        <line x1="12" y1="11.5" x2="8" y2="3" stroke="${scissorLine}" stroke-width="1.8" stroke-linecap="round"/>
      </g>
    </svg>
  `;

  // Zoom médio: só pin sem label
  if (zoom < 13) {
    return L.divIcon({
      html: `<div style="display:flex;flex-direction:column;align-items:center;width:${PIN_WIDTH}px;">${teardropSvg}</div>`,
      className: "custom-barber-pin",
      iconSize: [PIN_WIDTH, PIN_HEIGHT],
      iconAnchor: [PIN_WIDTH / 2, PIN_HEIGHT],
      popupAnchor: [0, -PIN_HEIGHT],
    });
  }

  // Zoom próximo: pin completo com label
  const labelBg = selected ? "#111" : "#fff";
  const labelColor = selected ? "#fff" : "#111";
  const labelBorder = selected ? "none" : "1.5px solid #ddd";

  return L.divIcon({
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;width:${PIN_WIDTH}px;">
        ${teardropSvg}
        <div style="background:${labelBg};color:${labelColor};border:${labelBorder};border-radius:20px;padding:3px 8px;font-family:system-ui,sans-serif;font-size:10px;font-weight:700;white-space:nowrap;margin-top:-6px;box-shadow:0 2px 6px rgba(0,0,0,0.15);max-width:120px;overflow:hidden;text-overflow:ellipsis;">${truncated}</div>
      </div>
    `,
    className: "custom-barber-pin",
    iconSize: [PIN_WIDTH, TOTAL_HEIGHT],
    iconAnchor: [PIN_WIDTH / 2, PIN_HEIGHT],
    popupAnchor: [0, -PIN_HEIGHT],
  });
}

export function DiscoverMap({
  units,
  userLocation,
  selectedId,
  onSelectUnit,
  onRecenter,
  onBoundsChange,
  mapStyle,
}: DiscoverMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const userMarkerRef = useRef<L.CircleMarker | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const initialMapStyleRef = useRef(mapStyle);
  const [currentZoom, setCurrentZoom] = useState(14);
  const userMarkerRef = useRef<L.CircleMarker | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const initialMapStyleRef = useRef(mapStyle);

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
        const markerOffset = getDuplicateMarkerPixelOffset(index, group.length);
        return {
          ...unit,
          markerLatitude: unit.latitude,
          markerLongitude: unit.longitude,
          markerOffsetX: markerOffset.x,
          markerOffsetY: markerOffset.y,
          displayLabel: getDiscoverUnitDisplayName(unit.brandName, unit.nome),
        };
      })
    );
  }, [mappableUnits]);

  const defaultCenter: L.LatLngExpression = userLocation
    ? [userLocation.lat, userLocation.lng]
    : mappableUnits.length > 0
      ? [mappableUnits[0].latitude, mappableUnits[0].longitude]
      : [-23.55, -46.63];

  const initialZoom = useMemo(() => {
    if (userLocation && mappableUnits.length > 0) {
      let minDist = Infinity;
      for (const unit of mappableUnits) {
        const distance = haversineKm(userLocation.lat, userLocation.lng, unit.latitude, unit.longitude);
        if (distance < minDist) minDist = distance;
      }
      return smartZoomForDistance(minDist);
    }

    if (mappableUnits.length === 1) return 16;
    if (mappableUnits.length > 1) return 14;
    return 14;
  }, [userLocation, mappableUnits]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: defaultCenter,
      zoom: initialZoom,
      zoomControl: false,
      attributionControl: false,
    });
    const initialTile = L.tileLayer(getTileUrl(initialMapStyleRef.current), {
      maxZoom: 20,
    }).addTo(map);
    tileLayerRef.current = initialTile;
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
        icon: buildBarberIcon(unit.displayLabel, unit.id === selectedId, {
          x: unit.markerOffsetX,
          y: unit.markerOffsetY,
        }),
        zIndexOffset: unit.id === selectedId ? 900 : 500,
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
      return;
    }

    if (mappableUnits.length > 0) {
      const primaryUnit = mappableUnits[0];
      map.flyTo([primaryUnit.latitude, primaryUnit.longitude], initialZoom, { duration: 0.8 });
    }
  }, [selectedId, mappableUnits, userLocation, initialZoom]);

  const handleRecenter = () => {
    const map = mapRef.current;
    if (map && userLocation) {
      map.flyTo([userLocation.lat, userLocation.lng], initialZoom, { duration: 0.8 });
    }
    onRecenter();
  };

  // ── Toggle tile layer on mapStyle change ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      tileLayerRef.current.remove();
    }

    tileLayerRef.current = L.tileLayer(getTileUrl(mapStyle), { maxZoom: 20 }).addTo(map);
  }, [mapStyle]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const timer = window.setTimeout(() => map.invalidateSize(), 200);
    return () => window.clearTimeout(timer);
  }, []);


  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full z-0" />
    </div>
  );
}
