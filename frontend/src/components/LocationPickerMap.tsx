import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Polygon, Tooltip, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { CheckCircle, MapPin, Loader2, Navigation, AlertCircle, Tag } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toBlob } from 'html-to-image';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// ── point-in-polygon (ray casting) ────────────────────────────────────────────
function pointInPolygon(lat: number, lng: number, poly: { lat: number; lng: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const ai = poly[i], aj = poly[j];
    const cross = ((ai.lng > lng) !== (aj.lng > lng))
      && (lat < (aj.lat - ai.lat) * (lng - ai.lng) / (aj.lng - ai.lng) + ai.lat);
    if (cross) inside = !inside;
  }
  return inside;
}

function detectZone(lat: number, lng: number, zones: any[]): { id: string; name: string } | null {
  for (const z of zones) {
    try {
      const pts: { lat: number; lng: number }[] =
        typeof z.coordinates === 'string' ? JSON.parse(z.coordinates) : z.coordinates;
      if (pts?.length >= 3 && pointInPolygon(lat, lng, pts)) return { id: z.id, name: z.name };
    } catch { /* skip malformed zone */ }
  }
  return null;
}

// ── Nominatim reverse geocoding ───────────────────────────────────────────────
async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=ar`,
      { headers: { 'Accept-Language': 'ar,en' } }
    );
    if (!res.ok) return '';
    const data = await res.json();
    const a = data.address || {};
    // Build a readable name: landmark/road + neighbourhood/suburb
    const primary = a.amenity || a.building || a.shop || a.office || a.leisure || a.road || a.footway || '';
    const area    = a.neighbourhood || a.suburb || a.quarter || a.district || a.city_district || '';
    if (primary && area) return `${primary}، ${area}`;
    if (primary)         return primary;
    if (area)            return area;
    return data.display_name?.split(',').slice(0, 2).join(',') || '';
  } catch {
    return '';
  }
}

// ── sub-components ────────────────────────────────────────────────────────────
const LocationMarker = ({ position, setPosition }: { position: L.LatLng | null; setPosition: (p: L.LatLng) => void }) => {
  useMapEvents({ click(e) { setPosition(e.latlng); } });
  const markerRef = useRef<L.Marker>(null);
  const handlers  = useMemo(() => ({ dragend() { const m = markerRef.current; if (m) setPosition(m.getLatLng()); } }), [setPosition]);
  return position ? <Marker draggable eventHandlers={handlers} position={position} ref={markerRef} /> : null;
};

const MapRecenter = ({ position }: { position: L.LatLng | null }) => {
  const map = useMap();
  useEffect(() => { if (position) map.setView(position, map.getZoom()); }, [position, map]);
  return null;
};

// ── types ─────────────────────────────────────────────────────────────────────
interface LocationPickerMapProps {
  onLocationConfirm: (lat: number, lng: number, address: string, zone?: { id: string; name: string } | null) => void;
  initialUrl?:       string;
  onCaptureMap?:     (file: File) => void;
  initialPosition?:  { lat: number; lng: number } | null;
  zones?:            any[];   // Zone objects from /api/zones
}

// ── main component ────────────────────────────────────────────────────────────
const LocationPickerMap: React.FC<LocationPickerMapProps> = ({
  onLocationConfirm, initialUrl, onCaptureMap, initialPosition, zones = [],
}) => {
  const { t } = useTranslation();
  const [position,    setPosition]    = useState<L.LatLng | null>(null);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isLocating,  setIsLocating]  = useState(false);
  const [locationError, setLocationError] = useState('');
  const [resolvedAddress, setResolvedAddress] = useState('');
  const [resolvedZone,    setResolvedZone]    = useState<{ id: string; name: string } | null>(null);
  const [geocoding,       setGeocoding]       = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const geocodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const defaultCenter: [number, number] = [21.6318, 39.1046];

  useEffect(() => {
    if (initialUrl?.includes('google.com/maps?q=')) {
      const m = initialUrl.match(/q=([\d.-]+),([\d.-]+)/);
      if (m) {
        const newLat = parseFloat(m[1]);
        const newLng = parseFloat(m[2]);
        setPosition(prev => (prev?.lat === newLat && prev?.lng === newLng) ? prev : new L.LatLng(newLat, newLng));
      }
    } else if (initialPosition) {
      setPosition(prev => (prev?.lat === initialPosition.lat && prev?.lng === initialPosition.lng) ? prev : new L.LatLng(initialPosition.lat, initialPosition.lng));
    }
  }, [initialUrl, initialPosition?.lat, initialPosition?.lng]);

  // Debounced geocode + zone detect whenever position changes
  useEffect(() => {
    if (!position) { setResolvedAddress(''); setResolvedZone(null); return; }
    setIsConfirmed(false);
    setGeocoding(true);

    if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current);
    geocodeTimerRef.current = setTimeout(async () => {
      const zone = detectZone(position.lat, position.lng, zones);
      setResolvedZone(zone);

      const addr = await reverseGeocode(position.lat, position.lng);
      setResolvedAddress(addr);
      setGeocoding(false);
    }, 600); // debounce 600 ms

    return () => { if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current); };
  }, [position, zones]);

  const handleLocateMe = () => {
    setIsLocating(true);
    setLocationError('');
    navigator.geolocation?.getCurrentPosition(
      pos => { setPosition(new L.LatLng(pos.coords.latitude, pos.coords.longitude)); setIsLocating(false); },
      ()  => { setLocationError(t('map.locationFailed')); setIsLocating(false); }
    ) ?? (() => { setLocationError(t('map.notSupported')); setIsLocating(false); })();
  };

  const handleMapMarkerSet = (newPos: L.LatLng) => {
    setPosition(newPos);
    setLocationError('');
  };

  const handleConfirm = async () => {
    if (!position) return;
    // Best location label: zone name first, then address, then coords
    const label = resolvedZone?.name
      || resolvedAddress
      || `${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}`;

    onLocationConfirm(position.lat, position.lng, label, resolvedZone);
    setIsConfirmed(true);

    if (onCaptureMap && mapRef.current) {
      setTimeout(async () => {
        const blob = await toBlob(mapRef.current!, { cacheBust: true }).catch(() => null);
        if (blob) onCaptureMap(new File([blob], `location-map-${Date.now()}.png`, { type: 'image/png' }));
      }, 300);
    }
  };

  // Location display text
  const locationLabel = resolvedZone?.name || resolvedAddress || (position ? `${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}` : '');

  return (
    <div className="w-full border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col bg-white">
      <div ref={mapRef} className="h-64 sm:h-80 md:h-96 w-full relative z-0">
        <MapContainer center={position || defaultCenter} zoom={15} maxZoom={22} scrollWheelZoom className="h-full w-full">
          <TileLayer
            attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={22} maxNativeZoom={19} crossOrigin="anonymous"
          />
          {/* Draw existing zones */}
          {zones.map(z => {
            let pts: any[] = [];
            try { pts = typeof z.coordinates === 'string' ? JSON.parse(z.coordinates) : z.coordinates; } catch {}
            if (!pts?.length) return null;
            const isActive = resolvedZone?.id === z.id;
            return (
              <Polygon key={z.id} positions={pts}
                color={isActive ? '#16a34a' : '#3b82f6'}
                fillColor={isActive ? '#16a34a' : '#3b82f6'}
                fillOpacity={isActive ? 0.25 : 0.12}
                weight={isActive ? 3 : 1.5}
              >
                <Tooltip sticky permanent={isActive}>{z.name}</Tooltip>
              </Polygon>
            );
          })}
          <LocationMarker position={position} setPosition={handleMapMarkerSet} />
          <MapRecenter position={position} />
        </MapContainer>

        {/* Locate Me button */}
        <button
          onClick={e => { e.preventDefault(); handleLocateMe(); }}
          disabled={isLocating}
          className="absolute top-3 right-3 z-[400] bg-white border border-gray-300 shadow-lg p-2 rounded-lg text-blue-500 hover:bg-slate-100 flex items-center gap-1.5 transition-all text-sm font-medium"
          title={t('map.locateMe')}
        >
          {isLocating ? <Loader2 size={16} className="animate-spin" /> : <Navigation size={16} />}
          <span className="hidden sm:inline">{t('map.locateMe')}</span>
        </button>
      </div>

      <div className="p-3 bg-white border-t border-gray-200 space-y-2">
        {locationError && (
          <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 border border-red-200 rounded-lg p-2">
            <AlertCircle size={14} className="flex-shrink-0" />{locationError}
          </div>
        )}

        {/* Resolved location display */}
        {position && (
          <div className="space-y-1">
            {geocoding ? (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Loader2 size={12} className="animate-spin" /> جاري تحديد الموقع...
              </div>
            ) : (
              <>
                {resolvedZone && (
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5">
                    <Tag size={12} />
                    <span>المنطقة: {resolvedZone.name}</span>
                  </div>
                )}
                {resolvedAddress && !resolvedZone && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
                    <MapPin size={12} />
                    <span>{resolvedAddress}</span>
                  </div>
                )}
                {resolvedAddress && resolvedZone && (
                  <div className="text-[10px] text-slate-400 px-1">{resolvedAddress}</div>
                )}
              </>
            )}
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-sm text-gray-500">
            <span className="font-medium text-gray-600 block mb-0.5">{t('map.dragPin')}</span>
            {t('map.adjustLocation')}
          </div>
          {position ? (
            isConfirmed ? (
              <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-4 py-2 rounded-lg border border-emerald-200 w-full sm:w-auto justify-center">
                <CheckCircle size={16} />
                <span className="font-bold text-sm">
                  {locationLabel || t('map.confirmed')}
                </span>
              </div>
            ) : (
              <button
                onClick={e => { e.preventDefault(); handleConfirm(); }}
                disabled={geocoding}
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-2 px-5 rounded-lg transition-all flex justify-center items-center gap-2 text-sm"
              >
                <MapPin size={14} />
                {t('map.confirmLocation')}
              </button>
            )
          ) : (
            <div className="text-sm text-blue-500 bg-blue-50 px-4 py-2 rounded-lg border border-blue-200 flex items-center gap-2">
              <MapPin size={14} />
              {t('map.waitingLocation')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LocationPickerMap;
