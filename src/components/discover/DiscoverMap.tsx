import { useEffect, useMemo, useRef } from "react";
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

function buildBarberIcon(
  label: string,
  selected: boolean,
  markerOffset: { x: number; y: number }
) {
  const truncated = label.length > 20 ? `${label.slice(0, 19)}…` : label;
  const transform = `transform:translate(${markerOffset.x}px, ${markerOffset.y}px);`;

  if (selected) {
    return L.divIcon({
      html: `
        <div style="display:inline-flex;align-items:center;gap:6px;background:#111;color:white;border-radius:999px;padding:6px 14px 6px 8px;font-family:system-ui,sans-serif;white-space:nowrap;box-shadow:0 4px 14px rgba(0,0,0,0.3);border:2px solid white;${transform}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style="flex-shrink:0;">
            <path d="M6.5 3L12 14.5" stroke="#EF4444" stroke-width="2.4" stroke-linecap="round"/>
            <path d="M17.5 3L12 14.5" stroke="#EF4444" stroke-width="2.4" stroke-linecap="round"/>
            <circle cx="5" cy="18.5" r="3" stroke="#EF4444" stroke-width="1.8" fill="none"/>
            <circle cx="19" cy="18.5" r="3" stroke="#EF4444" stroke-width="1.8" fill="none"/>
            <line x1="7.6" y1="16.5" x2="12" y2="14.5" stroke="#EF4444" stroke-width="1.8" stroke-linecap="round"/>
            <line x1="16.4" y1="16.5" x2="12" y2="14.5" stroke="#EF4444" stroke-width="1.8" stroke-linecap="round"/>
          </svg>
          <span style="font-size:12px;font-weight:700;letter-spacing:0.02em;">${truncated}</span>
        </div>
      `,
      className: "",
      iconSize: [180, 36],
      iconAnchor: [90, 18],
    });
  }

  return L.divIcon({
    html: `
      <div style="display:inline-flex;align-items:center;gap:5px;background:white;color:#111;border-radius:999px;padding:5px 12px 5px 7px;font-family:system-ui,sans-serif;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.15);border:1.5px solid #e5e5e5;${transform}">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style="flex-shrink:0;">
          <path d="M6.5 3L12 14.5" stroke="#DC2626" stroke-width="2.4" stroke-linecap="round"/>
          <path d="M17.5 3L12 14.5" stroke="#DC2626" stroke-width="2.4" stroke-linecap="round"/>
          <circle cx="5" cy="18.5" r="3" stroke="#DC2626" stroke-width="1.8" fill="none"/>
          <circle cx="19" cy="18.5" r="3" stroke="#DC2626" stroke-width="1.8" fill="none"/>
          <line x1="7.6" y1="16.5" x2="12" y2="14.5" stroke="#DC2626" stroke-width="1.8" stroke-linecap="round"/>
          <line x1="16.4" y1="16.5" x2="12" y2="14.5" stroke="#DC2626" stroke-width="1.8" stroke-linecap="round"/>
        </svg>
        <span style="font-size:10px;font-weight:600;letter-spacing:0.02em;">${truncated}</span>
      </div>
    `,
    className: "",
    iconSize: [160, 30],
    iconAnchor: [80, 15],
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
        icon: buildBarberIcon(unit.displayLabel, unit.id === selectedId),
      })
        .on("click", () => onSelectUnit(unit.id))
        .addTo(map);

      // Debug popup — ajuda a verificar se pin bate com Google Maps
      marker.bindPopup(
        `<div style="font-size:11px;line-height:1.4;">
          <strong>${unit.displayLabel}</strong><br/>
          Lat: ${unit.latitude}<br/>
          Lng: ${unit.longitude}<br/>
          <a href="https://www.google.com/maps?q=${unit.latitude},${unit.longitude}" target="_blank" style="color:#2563eb;">Verificar no Google Maps</a>
        </div>`,
        { closeButton: false, offset: [0, -10] }
      );

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
