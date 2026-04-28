import React, { useState } from 'react';
import { MapContainer, TileLayer, Polygon, Tooltip, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { RefreshCcw } from 'lucide-react';

interface ZoneDrawerMapProps {
 onPolygonChange: (points: {lat: number, lng: number}[]) => void;
 existingZones?: any[];
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

const ZoneDrawerMap: React.FC<ZoneDrawerMapProps> = ({ onPolygonChange, existingZones }) => {
 const [points, setPoints] = useState<L.LatLng[]>([]);
 const defaultCenter: [number, number] = [21.6318, 39.1046];

 React.useEffect(() => {
 onPolygonChange(points.map(p => ({ lat: p.lat, lng: p.lng })));
 // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points]);

 return (
 <div className="w-full border border-gray-200 rounded-xl shadow-sm overflow-hidden relative">
 <div className="h-64 w-full relative z-0">
 <MapContainer center={defaultCenter} zoom={15} maxZoom={22} scrollWheelZoom={true} className="h-full w-full">
 <TileLayer
 attribution='&amp;copy <a href="https://osm.org/copyright">OpenStreetMap</a> contributors'
 url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
 maxZoom={22}
 maxNativeZoom={19}
 crossOrigin="anonymous"
 />
 {existingZones?.map(z => {
   let pts = [];
   try { pts = typeof z.coordinates === 'string' ? JSON.parse(z.coordinates) : z.coordinates; } catch(e){}
   if (pts && pts.length > 0) {
     return (
       <Polygon key={z.id} positions={pts} color="#3b82f6" fillColor="#3b82f6" fillOpacity={0.2} weight={2}>
         <Tooltip sticky>{z.name}</Tooltip>
       </Polygon>
     );
   }
   return null;
 })}
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
