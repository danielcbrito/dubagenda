import { useEffect, useMemo, useRef, useState, memo } from "react";
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
  barbersCount?: number;
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

const SHOP_WIDTH = 64;
const SHOP_HEIGHT = 42;

function buildBarberIcon(
  label: string,
  _selected: boolean,
  markerOffset: { x: number; y: number },
  zoom: number
) {
  const truncated = label.length > 22 ? `${label.slice(0, 21)}…` : label;

  // Zoom muito afastado (< 10): indicador compacto vermelho da marca
  if (zoom < 10) {
    return L.divIcon({
      html: `<div style="width:10px;height:10px;background:#B2101D;border-radius:50%;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.35);"></div>`,
      iconSize: [10, 10],
      iconAnchor: [5 - markerOffset.x, 5 - markerOffset.y],
      className: "barber-pin-clean",
    });
  }

  // Miniatura 3D Realista da Barbearia (Casa 3D isométrica branca com barber poles)
  const pinImgHtml = `
    <div style="position:relative;width:${SHOP_WIDTH}px;height:${SHOP_HEIGHT}px;display:flex;align-items:center;justify-content:center;transition:transform 0.15s ease-out;cursor:pointer;">
      <img
        src="/barbershop-3d-pin.png"
        alt="${truncated}"
        style="width:${SHOP_WIDTH}px;height:${SHOP_HEIGHT}px;object-fit:contain;filter:drop-shadow(0 4px 10px rgba(0,0,0,0.3));pointer-events:none;"
      />
    </div>
  `;

  // Zoom médio (10..12): Barbearia 3D sem tag flutuante
  if (zoom < 13) {
    return L.divIcon({
      html: pinImgHtml,
      className: "barber-pin-clean",
      iconSize: [SHOP_WIDTH, SHOP_HEIGHT],
      iconAnchor: [SHOP_WIDTH / 2 - markerOffset.x, SHOP_HEIGHT - 2 - markerOffset.y],
      popupAnchor: [0, -SHOP_HEIGHT],
    });
  }

  // Zoom próximo (>= 13): Tag flutuante com nome da barbearia sempre clean branca
  const labelBg = "#FFFFFF";
  const labelColor = "#0A0A0A";
  const labelBorder = "1px solid rgba(0,0,0,0.12)";

  const totalHeight = SHOP_HEIGHT + 24;

  return L.divIcon({
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;pointer-events:auto;cursor:pointer;">
        <div style="background:${labelBg};color:${labelColor};border:${labelBorder};border-radius:20px;padding:3px 9px;font-family:system-ui,-apple-system,sans-serif;font-size:10.5px;font-weight:700;white-space:nowrap;margin-bottom:2px;box-shadow:0 3px 8px rgba(0,0,0,0.16);display:inline-flex;align-items:center;max-width:145px;pointer-events:none;">
          <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${truncated}</span>
        </div>
        ${pinImgHtml}
      </div>
    `,
    className: "barber-pin-clean",
    iconSize: [SHOP_WIDTH, totalHeight],
    iconAnchor: [SHOP_WIDTH / 2 - markerOffset.x, totalHeight - 2 - markerOffset.y],
    popupAnchor: [0, -(totalHeight - 2)],
  });
}

/**
 * Offset the target LatLng downward so the visual center
 * appears in the top half of the map (above the bottom sheet).
 * The sheet covers ~50% at default snap, so we shift by ~30% of container height.
 */
function getOffsetCenter(map: L.Map, lat: number, lng: number, zoom: number): L.LatLng {
  const targetPoint = map.project([lat, lng], zoom);
  const containerHeight = map.getSize().y;
  // Shift downward by 30% of container → visually pushes center UP
  targetPoint.y += containerHeight * 0.22;
  return map.unproject(targetPoint, zoom);
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
          barbersCount: unit.barbersCount,
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

    // Offset initial center to account for bottom sheet
    const centerArr: [number, number] = Array.isArray(defaultCenter) ? defaultCenter as [number, number] : [(defaultCenter as L.LatLng).lat, (defaultCenter as L.LatLng).lng];
    const offsetInitial = getOffsetCenter(map, centerArr[0], centerArr[1], initialZoom);
    map.setView(offsetInitial, initialZoom, { animate: false });
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
    map.on("zoomend", () => setCurrentZoom(map.getZoom()));
    setCurrentZoom(map.getZoom());
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
        icon: buildBarberIcon(
          unit.displayLabel,
          unit.id === selectedId,
          {
            x: unit.markerOffsetX,
            y: unit.markerOffsetY,
          },
          currentZoom
        ),
        zIndexOffset: unit.id === selectedId ? 900 : 500,
      })
        .on("click", () => onSelectUnit(unit.id))
        .addTo(map);

      markersRef.current.set(unit.id, marker);
    });
  }, [markerUnits, selectedId, onSelectUnit, currentZoom]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (selectedId) {
      const unit = mappableUnits.find((entry) => entry.id === selectedId);
      if (unit) {
        const offset = getOffsetCenter(map, unit.latitude, unit.longitude, 16);
        map.flyTo(offset, 16, { duration: 0.8 });
      }
      return;
    }

    if (userLocation) {
      const offset = getOffsetCenter(map, userLocation.lat, userLocation.lng, initialZoom);
      map.flyTo(offset, initialZoom, { duration: 0.8 });
      return;
    }

    if (mappableUnits.length > 0) {
      const primaryUnit = mappableUnits[0];
      const offset = getOffsetCenter(map, primaryUnit.latitude, primaryUnit.longitude, initialZoom);
      map.flyTo(offset, initialZoom, { duration: 0.8 });
    }
  }, [selectedId, mappableUnits, userLocation, initialZoom]);

  const handleRecenter = () => {
    const map = mapRef.current;
    if (map && userLocation) {
      const offset = getOffsetCenter(map, userLocation.lat, userLocation.lng, initialZoom);
      map.flyTo(offset, initialZoom, { duration: 0.8 });
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
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 0,
        }}
      />
    </div>
  );
}
