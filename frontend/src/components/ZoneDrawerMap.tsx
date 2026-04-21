import React, { useState } from 'react';
import { MapContainer, TileLayer, Polygon, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { RefreshCcw } from 'lucide-react';

interface ZoneDrawerMapProps {
 onPolygonChange: (points: {lat: number, lng: number}[]) => void;
}

const PolygonDrawer = ({ points, setPoints }: { points: L.LatLng[], setPoints: (p: L.LatLng[]) => void }) => {
 useMapEvents({
 click(e) {
 setPoints([...points, e.latlng]);
 }
 });

 return points.length > 0 ? (
 <Polygon positions={points} color="#f59e0b" fillColor="#f59e0b" fillOpacity={0.3} weight={3} />
 ) : null;
};

const ZoneDrawerMap: React.FC<ZoneDrawerMapProps> = ({ onPolygonChange }) => {
 const [points, setPoints] = useState<L.LatLng[]>([]);
 const defaultCenter: [number, number] = [21.6318, 39.1046];

 React.useEffect(() => {
 onPolygonChange(points.map(p => ({ lat: p.lat, lng: p.lng })));
 // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points]);

 return (
 <div className="w-full border border-gray-200 rounded-xl shadow-sm overflow-hidden relative">
 <div className="h-64 w-full relative z-0">
 <MapContainer center={defaultCenter} zoom={15} scrollWheelZoom={true} className="h-full w-full">
 <TileLayer
 attribution='&amp;copy <a href="https://osm.org/copyright">OpenStreetMap</a> contributors'
 url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
 crossOrigin="anonymous"
 />
 <PolygonDrawer points={points} setPoints={setPoints} />
 </MapContainer>
 
 <button
 onClick={(e) => { e.preventDefault(); setPoints([]); }}
 className="absolute top-3 right-3 z-[400] bg-white border border-gray-200 shadow p-2 rounded text-red-500 hover:bg-white flex items-center gap-1 text-base font-bold"
 title="Clear Polygon"
 >
 <RefreshCcw size={14} /> Clear Drawing
 </button>
 </div>
 <div className="bg-blue-50 p-2 text-base text-blue-800 text-center border-t border-gray-200 font-medium">
 Click on the map multiple times to draw the boundaries of the Zone.
 </div>
 </div>
 );
};

export default ZoneDrawerMap;
