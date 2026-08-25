import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Polygon, Tooltip, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { RefreshCcw, Maximize2, X } from 'lucide-react';

interface ZoneDrawerMapProps {
 onPolygonChange: (points: {lat: number, lng: number}[]) => void;
 existingZones?: any[];
}

const PolygonDrawer = ({ points, setPoints }: { points: L.LatLng[], setPoints: (p: L.LatLng[]) => void }) => {
 useMapEvents({
   click(e) { setPoints([...points, e.latlng]); }
 });
 return points.length > 0 ? (
   <Polygon positions={points} color="#f59e0b" fillColor="#f59e0b" fillOpacity={0.3} weight={3} />
 ) : null;
};

const MapContent = ({ points, setPoints, existingZones }: {
 points: L.LatLng[];
 setPoints: (p: L.LatLng[]) => void;
 existingZones?: any[];
}) => (
 <>
   <TileLayer
     attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a>'
     url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
     maxZoom={22}
     maxNativeZoom={19}
     crossOrigin="anonymous"
   />
   {existingZones?.map(z => {
     let pts: any[] = [];
     try { pts = typeof z.coordinates === 'string' ? JSON.parse(z.coordinates) : z.coordinates; } catch {}
     if (!pts || pts.length === 0) return null;
     return (
       <Polygon key={z.id} positions={pts} color="#3b82f6" fillColor="#3b82f6" fillOpacity={0.2} weight={2}>
         <Tooltip sticky>{z.name}</Tooltip>
       </Polygon>
     );
   })}
   <PolygonDrawer points={points} setPoints={setPoints} />
 </>
);

const ZoneDrawerMap: React.FC<ZoneDrawerMapProps> = ({ onPolygonChange, existingZones }) => {
 const [points, setPoints] = useState<L.LatLng[]>([]);
 const [fullscreen, setFullscreen] = useState(false);
 const defaultCenter: [number, number] = [21.6318, 39.1046];

 useEffect(() => {
   onPolygonChange(points.map(p => ({ lat: p.lat, lng: p.lng })));
   // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [points]);

 // ESC to close fullscreen
 useEffect(() => {
   const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFullscreen(false); };
   if (fullscreen) window.addEventListener('keydown', onKey);
   return () => window.removeEventListener('keydown', onKey);
 }, [fullscreen]);

 return (
   <>
     {/* ── Normal map (compact) ── */}
     <div className="w-full border border-gray-200 rounded-xl shadow-sm overflow-hidden relative">
       <div className="h-64 w-full relative z-0">
         <MapContainer center={defaultCenter} zoom={15} maxZoom={22} scrollWheelZoom className="h-full w-full">
           <MapContent points={points} setPoints={setPoints} existingZones={existingZones} />
         </MapContainer>

         {/* Fullscreen button */}
         <button
           onClick={() => setFullscreen(true)}
           className="absolute top-3 left-3 z-[400] bg-white border border-blue-300 shadow px-2.5 py-1.5 rounded-lg text-blue-600 hover:bg-blue-50 flex items-center gap-1.5 text-xs font-bold transition"
         >
           <Maximize2 size={13} /> تكبير الخريطة
         </button>

         {/* Clear button */}
         <button
           onClick={(e) => { e.preventDefault(); setPoints([]); }}
           className="absolute top-3 right-3 z-[400] bg-white border border-red-200 shadow px-2.5 py-1.5 rounded-lg text-red-500 hover:bg-red-50 flex items-center gap-1.5 text-xs font-bold transition"
         >
           <RefreshCcw size={13} /> مسح
         </button>

         {/* Points counter */}
         {points.length > 0 && (
           <div className="absolute bottom-3 left-3 z-[400] bg-white border border-amber-300 shadow text-amber-700 text-xs font-bold px-2.5 py-1 rounded-full">
             📍 {points.length} نقطة
           </div>
         )}
       </div>
       <div className="bg-blue-50 px-3 py-2 text-xs text-blue-800 text-center border-t border-gray-200 font-medium">
         انقر على الخريطة لرسم حدود الزون — اضغط <strong>تكبير الخريطة</strong> للرسم بدقة أعلى
       </div>
     </div>

     {/* ── Fullscreen overlay ── */}
     {fullscreen && (
       <div className="fixed inset-0 z-[9999] flex flex-col" style={{ background: 'rgba(0,0,0,0.75)' }}>
         {/* Fullscreen header */}
         <div className="bg-white border-b border-gray-200 px-4 py-2.5 flex items-center justify-between flex-shrink-0 shadow-md">
           <div className="flex items-center gap-3">
             <span className="text-lg">🗺️</span>
             <div>
               <p className="font-bold text-gray-800 text-sm">رسم الزون — شاشة كاملة</p>
               <p className="text-xs text-gray-500">انقر على الخريطة لإضافة نقاط الحدود</p>
             </div>
             {points.length > 0 && (
               <span className="bg-amber-100 text-amber-700 border border-amber-300 text-xs font-bold px-2.5 py-0.5 rounded-full">
                 📍 {points.length} نقطة
               </span>
             )}
           </div>
           <div className="flex items-center gap-2">
             <button
               onClick={(e) => { e.preventDefault(); setPoints([]); }}
               className="flex items-center gap-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 text-xs font-bold px-3 py-1.5 rounded-lg transition"
             >
               <RefreshCcw size={13} /> مسح الرسم
             </button>
             <button
               onClick={() => setFullscreen(false)}
               className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-1.5 rounded-lg transition shadow"
             >
               <X size={13} /> حفظ وإغلاق
             </button>
           </div>
         </div>

         {/* Fullscreen map */}
         <div className="flex-1 relative min-h-0">
           <MapContainer center={defaultCenter} zoom={16} maxZoom={22} scrollWheelZoom className="h-full w-full">
             <MapContent points={points} setPoints={setPoints} existingZones={existingZones} />
           </MapContainer>
         </div>

         {/* Footer hint */}
         <div className="bg-amber-50 border-t border-amber-200 px-4 py-2 text-xs text-amber-800 font-medium text-center flex-shrink-0">
           كل نقرة تُضيف نقطة جديدة للحدود — استخدم عجلة الفأرة للتكبير والتصغير — اضغط <kbd className="bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded text-amber-900 font-mono">ESC</kbd> أو &quot;حفظ وإغلاق&quot; عند الانتهاء
         </div>
       </div>
     )}
   </>
 );
};

export default ZoneDrawerMap;
