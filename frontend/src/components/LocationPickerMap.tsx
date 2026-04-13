import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { CheckCircle, MapPin, Loader2, Navigation, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toBlob } from 'html-to-image';

// Fix leaflet default icon issue in React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png'
});

interface LocationPickerMapProps {
    onLocationConfirm: (lat: number, lng: number) => void;
    initialUrl?: string;
    onCaptureMap?: (file: File) => void;
}

// Sub-component to handle map click and update marker
const LocationMarker = ({ position, setPosition }: { position: L.LatLng | null, setPosition: (pos: L.LatLng) => void }) => {
    useMapEvents({
        click(e) {
            setPosition(e.latlng);
        },
    });

    const markerRef = useRef<L.Marker>(null);
    const eventHandlers = useMemo(
        () => ({
            dragend() {
                const marker = markerRef.current;
                if (marker != null) {
                    setPosition(marker.getLatLng());
                }
            },
        }),
        [setPosition],
    );

    return position === null ? null : (
        <Marker
            draggable={true}
            eventHandlers={eventHandlers}
            position={position}
            ref={markerRef}
        />
    );
};

// Component to recenter map when position updates
const MapRecenter = ({ position }: { position: L.LatLng | null }) => {
    const map = useMap();
    useEffect(() => {
        if (position) {
            map.setView(position, map.getZoom());
        }
    }, [position, map]);
    return null;
}

const LocationPickerMap: React.FC<LocationPickerMapProps> = ({ onLocationConfirm, initialUrl, onCaptureMap }) => {
    const { t } = useTranslation();
    const [position, setPosition] = useState<L.LatLng | null>(null);
    const [isConfirmed, setIsConfirmed] = useState(false);
    const [isLocating, setIsLocating] = useState(false);
    const [locationError, setLocationError] = useState('');
    const mapRef = useRef<HTMLDivElement>(null);

    // Default center (Jeddah as fallback)
    const defaultCenter: [number, number] = [21.6318, 39.1046];

    useEffect(() => {
        if (initialUrl && initialUrl.includes('google.com/maps?q=')) {
            try {
                const match = initialUrl.match(/q=([\d.-]+),([\d.-]+)/);
                if (match && match.length === 3) {
                    setPosition(new L.LatLng(parseFloat(match[1]), parseFloat(match[2])));
                }
            } catch (e) {
                // error parsing, fallback
            }
        }
    }, [initialUrl]);

    const handleLocateMe = () => {
        setIsLocating(true);
        setLocationError('');
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((pos) => {
                setPosition(new L.LatLng(pos.coords.latitude, pos.coords.longitude));
                setIsLocating(false);
                setIsConfirmed(false);
            }, () => {
                setLocationError(t('map.locationFailed'));
                setIsLocating(false);
            });
        } else {
            setLocationError(t('map.notSupported'));
            setIsLocating(false);
        }
    };

    // NO auto-locate on mount — user must click button (Fix #12)

    const handleMapMarkerSet = (newPos: L.LatLng) => {
        setPosition(newPos);
        setIsConfirmed(false);
        setLocationError('');
    };

    const handleConfirm = async () => {
        if (position) {
            onLocationConfirm(position.lat, position.lng);
            setIsConfirmed(true);

            if (onCaptureMap && mapRef.current) {
                try {
                    setTimeout(async () => {
                        if (mapRef.current) {
                            const blob = await toBlob(mapRef.current, { cacheBust: true });
                            if (blob) {
                                const file = new File([blob], `location-map-${Date.now()}.png`, { type: 'image/png' });
                                onCaptureMap(file);
                            }
                        }
                    }, 300);
                } catch (e) {
                    console.error('Failed to capture map screenshot:', e);
                }
            }
        }
    };

    return (
        <div className="w-full border border-slate-700 rounded-xl overflow-hidden flex flex-col bg-slate-900">
            <div ref={mapRef} className="h-64 sm:h-80 md:h-96 w-full relative z-0">
                <MapContainer center={position || defaultCenter} zoom={15} scrollWheelZoom={true} className="h-full w-full">
                    <TileLayer
                        attribution='&amp;copy <a href="https://osm.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        crossOrigin="anonymous"
                    />
                    <LocationMarker position={position} setPosition={handleMapMarkerSet} />
                    <MapRecenter position={position} />
                </MapContainer>
                
                {/* Locate Me button */}
                <button
                    onClick={(e) => { e.preventDefault(); handleLocateMe(); }}
                    disabled={isLocating}
                    className="absolute top-3 right-3 z-[400] bg-slate-800 border border-slate-600 shadow-lg p-2 rounded-lg text-amber-400 hover:bg-slate-700 flex items-center justify-center gap-1.5 transition-all text-xs font-medium"
                    title={t('map.locateMe')}
                >
                    {isLocating ? (
                        <Loader2 size={16} className="animate-spin" />
                    ) : (
                        <Navigation size={16} />
                    )}
                    <span className="hidden sm:inline">{t('map.locateMe')}</span>
                </button>
            </div>
            
            <div className="p-3 bg-slate-800 border-t border-slate-700">
                {/* Error message (replaces alert()) */}
                {locationError && (
                    <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/30 rounded-lg p-2 mb-2">
                        <AlertCircle size={14} className="flex-shrink-0" />
                        <span>{locationError}</span>
                    </div>
                )}

                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="text-xs text-slate-400">
                        <span className="font-medium text-slate-200 block mb-0.5">{t('map.dragPin')}</span>
                        {t('map.adjustLocation')}
                    </div>
                    {position ? (
                        isConfirmed ? (
                            <div className="flex items-center gap-2 text-emerald-400 bg-emerald-500/10 px-4 py-2 rounded-lg border border-emerald-500/30 w-full sm:w-auto justify-center">
                                <CheckCircle size={16} />
                                <span className="font-bold text-xs">{t('map.confirmed')}</span>
                            </div>
                        ) : (
                            <button
                                onClick={(e) => { e.preventDefault(); handleConfirm(); }}
                                className="w-full sm:w-auto bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold py-2 px-5 rounded-lg shadow-lg shadow-amber-500/20 transition-all flex justify-center items-center gap-2 text-xs"
                            >
                                <MapPin size={14} />
                                {t('map.confirmLocation')}
                            </button>
                        )
                    ) : (
                        <div className="text-xs text-amber-400 bg-amber-500/10 px-4 py-2 rounded-lg border border-amber-500/30 flex items-center gap-2">
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
