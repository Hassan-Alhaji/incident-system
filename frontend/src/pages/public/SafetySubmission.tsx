import React, { useState, useEffect } from 'react';
import axios from 'axios';
import api from '../../utils/api';
import { useSearchParams } from 'react-router-dom';
import MarshalIdentityForm from '../../components/public/MarshalIdentityForm';
import LocationPickerMap from '../../components/LocationPickerMap';
import { isPointInPolygon } from '../../utils/geoUtils';

const SafetySubmission: React.FC = () => {
 const [searchParams] = useSearchParams();
 const urlZoneId = searchParams.get('zone');
 const [loading, setLoading] = useState(false);
 const [success, setSuccess] = useState<string | null>(null);
 const [error, setError] = useState<string | null>(null);

 // Identity
 const [marshalId, setMarshalId] = useState('');
 const [mobile, setMobile] = useState('');
 const [postNumber, setPostNumber] = useState('');

 // Common
 const [description, setDescription] = useState('');
 const [incidentDate, setIncidentDate] = useState(new Date().toISOString().split('T')[0]);
 const [incidentTime, setIncidentTime] = useState(new Date().toTimeString().slice(0, 5));

 // Safety Specific
 const [hazardType, setHazardType] = useState('DEBRIS');
 const [isTrackBlocked, setIsTrackBlocked] = useState('false');
 
 // Zone & Map Link
 const [zones, setZones] = useState<any[]>([]);
 const [selectedZone, setSelectedZone] = useState<any>(urlZoneId ? { id: urlZoneId, name: 'QR Auto Zone' } : null);
 const [mapLink, setMapLink] = useState('');
 const [locationLat, setLocationLat] = useState<number | null>(null);
 const [locationLng, setLocationLng] = useState<number | null>(null);

 const [files, setFiles] = useState<File[]>([]);

 useEffect(() => {
 const fetchZones = async () => {
 try {
 const res = await api.get('/zones');
 setZones(res.data);
 } catch (e) {
 console.error('Error fetching zones:', e);
 }
 };
 fetchZones();
 }, []);

 const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
 if (e.target.files) {
 setFiles(Array.from(e.target.files));
 }
 };

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 setLoading(true);
 setError(null);

 try {
 const formData = new FormData();
 formData.append('marshalId', marshalId);
 formData.append('marshalMobile', mobile);
 formData.append('postNumber', postNumber);
 formData.append('description', description);
 formData.append('incidentDate', incidentDate);
 formData.append('incidentTime', incidentTime);
 
 // Send map link + pin coordinates
 const locString = locationLat ? `${locationLat},${locationLng}` : `Post ${postNumber}`;
 formData.append('location', mapLink || locString);
 
 if (selectedZone) formData.append('zoneId', selectedZone.id);

 // Safety Specific
 formData.append('hazardType', hazardType);
 formData.append('isTrackBlocked', isTrackBlocked);

 files.forEach(file => {
 formData.append('attachments', file);
 });

 const res = await api.post('/public/safety', formData, {
 headers: { 'Content-Type': 'multipart/form-data' }
 });

 setSuccess(res.data.ticketId);
 } catch (err: any) {
 setError(err.response?.data?.error || 'Failed to submit ticket');
 } finally {
 setLoading(false);
 }
 };

 if (success) {
 return (
 <div className="text-center py-10">
 <div className="bg-green-100 text-green-800 p-6 rounded-lg mb-6">
 <h2 className="text-2xl font-bold mb-2">Report Submitted!</h2>
 <p className="text-lg">Reference: <span className="font-mono font-bold">{success}</span></p>
 </div>
 <button
 onClick={() => window.location.reload()}
 className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold w-full"
 >
 Submit Another
 </button>
 </div>
 );
 }

 return (
 <div>
 <h2 className="text-xl font-bold text-orange-600 mb-4 flex items-center gap-2">
 <span className="bg-orange-100 p-2 rounded-full">⚠️</span> Safety Hazard
 </h2>

 <form onSubmit={handleSubmit}>
 <MarshalIdentityForm
 marshalId={marshalId} setMarshalId={setMarshalId}
 mobile={mobile} setMobile={setMobile}
 postNumber={postNumber} setPostNumber={setPostNumber}
 />

 <div className="space-y-4">
 <div>
 <label className="block text-base font-medium text-gray-700">Incident Time</label>
 <div className="flex gap-2">
 <input type="date" required value={incidentDate} onChange={e => setIncidentDate(e.target.value)} className="w-1/2 p-2 border rounded" />
 <input type="time" required value={incidentTime} onChange={e => setIncidentTime(e.target.value)} className="w-1/2 p-2 border rounded" />
 </div>
 </div>

 <div>
 <label className="block text-base font-medium text-gray-700">Hazard Type</label>
 <select value={hazardType} onChange={e => setHazardType(e.target.value)} className="w-full p-2 border rounded bg-white">
 <option value="DEBRIS">Debris on Track</option>
 <option value="FLUID">Fluid / Oil Spill</option>
 <option value="BARRIER">Barrier Damage</option>
 <option value="FIRE">Fire</option>
 <option value="BLOCKED_TRACK">Blocked Track</option>
 <option value="WEATHER">Weather Issue</option>
 </select>
 </div>

 <div>
 <label className="block text-base font-medium text-gray-700">Is Track Blocked?</label>
 <select value={isTrackBlocked} onChange={e => setIsTrackBlocked(e.target.value)} className="w-full p-2 border rounded bg-white">
 <option value="false">No - Passable</option>
 <option value="true">Yes - BLOCKED (Red Flag)</option>
 </select>
 </div>

 <div>
 <label className="block text-base font-medium text-gray-700">Incident Location & Auto-Zone (Zone is Optional)</label>
 <div className="mb-2">
 <LocationPickerMap onLocationConfirm={(lat, lng) => {
 setLocationLat(lat);
 setLocationLng(lng);
  
 // Auto-detect zone
 if (zones.length > 0 && !urlZoneId) {
 let foundZone = null;
 for (const zone of zones) {
 if (zone.coordinates && typeof zone.coordinates === 'string') {
 try {
 const polygon = JSON.parse(zone.coordinates);
 if (isPointInPolygon({ lat, lng }, polygon)) {
 foundZone = zone;
 break;
 }
 } catch (e) {}
 }
 }
 setSelectedZone(foundZone);
 }
 }} />
 </div>
 {selectedZone ? (
 <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-base flex items-center justify-between">
 <div>
 <span className="font-bold">Detected Zone:</span> {selectedZone.name}
 </div>
 {urlZoneId && <span className="text-base bg-emerald-200 px-2 py-1 rounded">Via QR</span>}
 </div>
 ) : (
 <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-600 text-base">
 No zone detected. The incident will be logged without a zone.
 </div>
 )}
 </div>

 <div>
 <label className="block text-base font-medium text-gray-700">Map Location Link (Optional but Recommended)</label>
 <input
 type="url"
 value={mapLink}
 onChange={e => setMapLink(e.target.value)}
 className="w-full p-2 border rounded"
 placeholder="e.g. https://maps.google.com/?q=..."
 />
 <p className="text-base text-gray-500 mt-1">Paste a Google Maps or Apple Maps pin link</p>
 </div>

 <div>
 <label className="block text-base font-medium text-gray-700">Description *</label>
 <textarea
 required
 rows={3}
 value={description}
 onChange={e => setDescription(e.target.value)}
 className="w-full p-2 border rounded"
 placeholder="Describe damage or hazard..."
 />
 </div>

 <div>
 <label className="block text-base font-medium text-gray-700">Photos</label>
 <input type="file" multiple accept="image/*" onChange={handleFileChange} className="w-full p-2 border border-dashed rounded" />
 </div>
 </div>

 {error && <div className="text-red-600 text-base mt-4">{error}</div>}

 <button
 type="submit"
 disabled={loading}
 className="mt-6 w-full bg-orange-600 text-gray-800 py-3 rounded-lg font-bold text-lg hover:bg-orange-700 transition"
 >
 {loading ? 'Submitting...' : 'SUBMIT REPORT'}
 </button>
 </form>
 </div>
 );
};

export default SafetySubmission;
