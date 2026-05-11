import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useNavigate } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';

const getPinColor = (severity: string) => {
  switch (severity) {
    case 'FATAL':
    case 'CRITICAL':
    case 'SEVERE':
    case 'MAJOR':
      return '#ef4444'; // Bright Red
    case 'SIGNIFICANT':
    case 'MODERATE':
      return '#f97316'; // Bright Orange
    case 'MINOR':
    default:
      return '#22c55e'; // Bright Green
  }
};

const createCustomIcon = (color: string, isClosed: boolean) => {
  const innerHtml = isClosed 
    ? `<div style="transform: rotate(45deg); color: white; font-size: 14px; font-weight: bold; margin-top: -2px;">✓</div>`
    : `<div style="width: 10px; height: 10px; background-color: white; border-radius: 50%; box-shadow: 0 0 4px rgba(255,255,255,0.8);"></div>`;

  return L.divIcon({
    className: 'custom-leaflet-icon',
    html: `
      <div style="
        width: 32px;
        height: 32px;
        background-color: ${color};
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        border: ${isClosed ? '2px solid #334155' : '3px solid white'};
        box-shadow: 0 4px 8px rgba(0,0,0,0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: ${isClosed ? '0.8' : '1'};
      ">
        ${innerHtml}
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
};

interface MapCase {
  id: string;
  ticketNo: string;
  status: string;
  severityLevel: string;
  locationLat: number | null;
  locationLng: number | null;
  location: string | null;
}

interface AnalyticsMapProps {
  cases: MapCase[];
  isRtl: boolean;
}

const MapBounds: React.FC<{ cases: MapCase[] }> = ({ cases }) => {
  const map = useMap();
  useEffect(() => {
    if (cases.length > 0) {
      const bounds = L.latLngBounds(cases.map(c => [c.locationLat!, c.locationLng!]));
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });
      }
    }
  }, [cases, map]);
  return null;
};

const AnalyticsMap: React.FC<AnalyticsMapProps> = ({ cases, isRtl }) => {
  const navigate = useNavigate();
  const validCases = cases.filter(c => c.locationLat && c.locationLng);

  // Default center (Saudi Arabia)
  const defaultCenter: [number, number] = [23.8859, 45.0792];

  return (
    <div className="w-full h-[400px] md:h-[550px] rounded-xl overflow-hidden shadow-inner border border-slate-200 relative">
      <MapContainer center={defaultCenter} zoom={5} className="w-full h-full z-0">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        <MapBounds cases={validCases} />
        {validCases.map(c => {
          const color = getPinColor(c.severityLevel);
          const isClosed = c.status === 'CLOSED';
          const icon = createCustomIcon(color, isClosed);
          
          return (
            <React.Fragment key={c.id}>
              <Marker position={[c.locationLat!, c.locationLng!]} icon={icon}>
                <Popup>
                  <div className={`p-1 ${isRtl ? 'text-right dir-rtl' : 'text-left dir-ltr'}`}>
                    <p className="font-bold text-slate-800 text-sm mb-1">{c.ticketNo}</p>
                    <div className="flex gap-2 text-xs mb-2">
                      <span className="font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: color, color: 'white' }}>
                        {c.severityLevel}
                      </span>
                      <span className="font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                        {c.status}
                      </span>
                    </div>
                    {c.location && <p className="text-xs text-slate-500 mb-3">{c.location}</p>}
                    <button 
                      onClick={(e) => {
                        e.preventDefault();
                        navigate(`/tickets/${c.id}`);
                      }}
                      className="w-full text-center bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-1.5 rounded transition-colors"
                    >
                      {isRtl ? 'عرض التذكرة' : 'View Ticket'}
                    </button>
                  </div>
                </Popup>
              </Marker>
            </React.Fragment>
          );
        })}
      </MapContainer>
    </div>
  );
};

export default AnalyticsMap;
