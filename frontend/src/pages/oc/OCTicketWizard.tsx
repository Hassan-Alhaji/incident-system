import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import api from '../../utils/api';
import LocationPickerMap from '../../components/LocationPickerMap';
import { isPointInPolygon } from '../../utils/geoUtils';
import {
 AlertTriangle, ArrowLeft, ArrowRight, Camera, Check, ChevronDown,
 Clock, FileImage, Flame, Loader2, MapPin, Plus, Send, ShieldAlert,
 Trash2, Upload, User, Zap, Activity, FileWarning, X, Phone, CheckCircle
} from 'lucide-react';

const FilePreview = ({ file, onRemove }: { file: File, onRemove: () => void }) => {
 const [preview, setPreview] = React.useState<string>('');

 React.useEffect(() => {
 if (file.type.startsWith('image/')) {
 const url = URL.createObjectURL(file);
 setPreview(url);
 return () => URL.revokeObjectURL(url);
 }
 }, [file]);

 return (
 <div className="relative group">
 {preview ? (
 <img src={preview} alt="" className="w-full h-24 object-cover rounded-lg border border-gray-200" />
 ) : (
 <div className="w-full h-24 bg-white border border-gray-200 rounded-lg flex items-center justify-center">
 <FileImage size={20} className="text-gray-800" />
 </div>
 )}
 <button onClick={onRemove}
 className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center shadow-lg">
 <X size={12} className="text-gray-800" />
 </button>
 <p className="text-[9px] text-gray-800 mt-1 truncate">{file.name}</p>
 </div>
 );
};

interface InjuredPerson { name: string; affiliate: string; contact: string; dept: string; jobTitle: string; empNumber: string; }
interface Witness { name: string; mobile: string; }

const INCIDENT_TYPES = ['VIOLATION', 'HEALTH', 'NEAR_MISS', 'PROPERTY_DAMAGE', 'INJURY', 'FIRE', 'SECURITY_BREACH', 'OTHER'];
const SEVERITY_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

const typeIconMap: Record<string, React.ReactNode> = {
 VIOLATION: <ShieldAlert size={20} />, HEALTH: <Activity size={20} />, NEAR_MISS: <Zap size={20} />,
 PROPERTY_DAMAGE: <FileWarning size={20} />, INJURY: <AlertTriangle size={20} />, FIRE: <Flame size={20} />,
 SECURITY_BREACH: <ShieldAlert size={20} />, OTHER: <FileWarning size={20} />,
};

const severityColorMap: Record<string, string> = {
 LOW: 'border-slate-500 bg-slate-500/10 text-gray-800',
 MEDIUM: 'border-blue-600 bg-blue-600/10 text-blue-500',
 HIGH: 'border-orange-500 bg-orange-500/10 text-orange-400',
 CRITICAL: 'border-red-500 bg-red-500/10 text-red-400',
};

const OCTicketWizard = () => {
 const { user } = useAuth();
 const { t, i18n } = useTranslation();
 const navigate = useNavigate();

 const getInitialState = (key: string, defaultValue: any) => {
 try {
 const saved = localStorage.getItem('oc_draft');
 if (saved) {
 const parsed = JSON.parse(saved);
 if (parsed[key] !== undefined) return parsed[key];
 }
 } catch (e) {}
 return defaultValue;
 };

 const [step, setStep] = useState(() => getInitialState('step', 1));
 const [submitting, setSubmitting] = useState(false);
 const [submitted, setSubmitted] = useState(false);
 const [submittedId, setSubmittedId] = useState('');
 const [error, setError] = useState('');
 const [showErrors, setShowErrors] = useState(false);
 const TOTAL_STEPS = 4;

 // Step 1
 const [incidentType, setIncidentType] = useState(() => getInitialState('incidentType', ''));

 // Step 2
 const [incidentDate, setIncidentDate] = useState(() => getInitialState('incidentDate', new Date().toISOString().split('T')[0]));
 const [incidentTime, setIncidentTime] = useState(() => getInitialState('incidentTime', new Date().toTimeString().slice(0, 5)));
 const [locationLat, setLocationLat] = useState<number | null>(() => getInitialState('locationLat', null));
 const [locationLng, setLocationLng] = useState<number | null>(() => getInitialState('locationLng', null));
 const [locationAddress, setLocationAddress] = useState(() => getInitialState('locationAddress', ''));
 const [whatHappened, setWhatHappened] = useState(() => getInitialState('whatHappened', ''));
 
 // Zones mapped logic
 const [zones, setZones] = useState<any[]>([]);
 const [selectedZone, setSelectedZone] = useState<any>(() => getInitialState('selectedZone', null));

 // Step 3
 const [hasInjury, setHasInjury] = useState(() => getInitialState('hasInjury', false));
 const [injuredPersons, setInjuredPersons] = useState<InjuredPerson[]>(() => getInitialState('injuredPersons', []));
 const [witnesses, setWitnesses] = useState<Witness[]>(() => getInitialState('witnesses', []));
 const [selectedServiceProviderId, setSelectedServiceProviderId] = useState(() => getInitialState('selectedServiceProviderId', ''));
 const [serviceProviders, setServiceProviders] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);

 // Persist to localStorage
 React.useEffect(() => {
 localStorage.setItem('oc_draft', JSON.stringify({
 step, incidentType, incidentDate, incidentTime,
 locationLat, locationLng, locationAddress, whatHappened,
 hasInjury, injuredPersons, witnesses, selectedZone, selectedServiceProviderId
 }));
 }, [step, incidentType, incidentDate, incidentTime, locationLat, locationLng, locationAddress, whatHappened, hasInjury, injuredPersons, witnesses, selectedZone, selectedServiceProviderId]);
 
 // Fetch Zones
 React.useEffect(() => {
 const fetchZones = async () => {
 try {
 const res = await api.get('/zones');
 setZones(res.data);
 } catch (e) {
 console.error(e);
 }
 };
 fetchZones();
 const fetchProviders = async () => {
 try { const res = await api.get('/service-providers'); setServiceProviders(res.data); } catch (e) { console.error(e); }
 };
 fetchProviders();
  const fetchDepartments = async () => {
    try { const res = await api.get('/departments'); setDepartments(res.data); } catch (e) { console.error(e); }
  };
  fetchDepartments();
 }, []);

 // Step 4
 const [files, setFiles] = useState<File[]>([]);

 const handleLocationConfirm = (lat: number, lng: number) => {
 setLocationLat(lat);
 setLocationLng(lng);
 setLocationAddress(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
 };

 React.useEffect(() => {
 if (locationLat !== null && locationLng !== null && zones.length > 0) {
 let foundZone = null;
 for (const zone of zones) {
 if (zone.coordinates && typeof zone.coordinates === 'string') {
 try {
 const polygon = JSON.parse(zone.coordinates);
 if (isPointInPolygon({ lat: locationLat, lng: locationLng }, polygon)) {
 foundZone = zone;
 break;
 }
 } catch (e) {}
 }
 }
 setSelectedZone(foundZone);
 }
 }, [locationLat, locationLng, zones]);

 const addInjuredPerson = () => {
 setInjuredPersons([...injuredPersons, { name: '', affiliate: 'Employee', contact: '', dept: '', jobTitle: '', empNumber: '' }]);
 };

 const updateInjuredPerson = (index: number, field: keyof InjuredPerson, value: string) => {
 const updated = [...injuredPersons];
 updated[index] = { ...updated[index], [field]: value };
 setInjuredPersons(updated);
 };

 const removeInjuredPerson = (index: number) => {
 setInjuredPersons(injuredPersons.filter((_, i) => i !== index));
 };

 const addWitness = () => {
 setWitnesses([...witnesses, { name: '', mobile: '' }]);
 };

 const updateWitness = (index: number, field: keyof Witness, value: string) => {
 const updated = [...witnesses];
 updated[index] = { ...updated[index], [field]: value };
 setWitnesses(updated);
 };

 const removeWitness = (index: number) => {
 setWitnesses(witnesses.filter((_, i) => i !== index));
 };

 const handleFileAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
 if (e.target.files) {
 const newFiles = Array.from(e.target.files);
 setFiles([...files, ...newFiles]);
 }
 };

 const handleCameraCapture = () => {
 const input = document.createElement('input');
 input.type = 'file';
 input.accept = 'image/*';
 input.capture = 'environment';
 input.onchange = (e: any) => {
 if (e.target.files) {
 setFiles([...files, ...Array.from(e.target.files as FileList)]);
 }
 };
 input.click();
 };

 const removeFile = (index: number) => {
 setFiles(files.filter((_, i) => i !== index));
 };

 // Validation per step
 const canProceed = () => {
 if (step === 1) return incidentType;
 if (step === 2) return incidentDate && incidentTime && locationLat && locationLng && whatHappened.trim();
 if (step === 3) return true;
 if (step === 4) return true;
 return false;
 };

 // Fix #4: Get missing fields for current step
 const getMissingFields = (): string[] => {
 const missing: string[] = [];
 if (step === 1) {
 if (!incidentType) missing.push(t('oc.wizard.incidentType'));
 }
 if (step === 2) {
 if (!incidentDate) missing.push(t('oc.wizard.incidentDate'));
 if (!incidentTime) missing.push(t('oc.wizard.incidentTime'));
 if (!locationLat || !locationLng) missing.push(t('oc.wizard.location'));
 if (!whatHappened.trim()) missing.push(t('oc.wizard.whatHappened'));
 }
 return missing;
 };

 // Fix #14: Step completion indicator
 const isStepComplete = (s: number) => {
 if (s === 1) return !!(incidentType);
 if (s === 2) return !!(incidentDate && incidentTime && locationLat && locationLng && whatHappened.trim());
 if (s === 3) return true;
 if (s === 4) return true;
 return false;
 };

 const handleNext = () => {
 if (canProceed()) {
 setShowErrors(false);
 setStep(step + 1);
 } else {
 setShowErrors(true);
 }
 };

 const handleSubmit = async () => {
 setSubmitting(true);
 setError('');
 try {
 const payload = {
 incidentType, severity: 'YELLOW', incidentDate, incidentTime,
 locationLat, locationLng, locationAddress, whatHappened,
 zoneId: selectedZone?.id || null,
 serviceProviderId: selectedServiceProviderId || null,
 hasInjury, injuredPersons: hasInjury ? injuredPersons : [], witnesses,
 };

 const res = await api.post('/oc/tickets', payload);
 const ticketId = res.data.id;

 if (files.length > 0) {
 const formData = new FormData();
 files.forEach(f => formData.append('files', f));
 await api.post(`/oc/tickets/${ticketId}/attachments`, formData, {
 headers: { 'Content-Type': 'multipart/form-data' }
 });
 }

 // Fix #3: Show success screen instead of immediate redirect
 localStorage.removeItem('oc_draft');
 setSubmittedId(ticketId);
 setSubmitted(true);
 setTimeout(() => navigate(`/oc/tickets/${ticketId}`), 3000);
 } catch (err: any) {
 setError(err.response?.data?.message || 'Failed to submit ticket');
 console.error('Submit error:', err);
 } finally {
 setSubmitting(false);
 }
 };

 // Fix #3: Success Screen
 if (submitted) {
 return (
 <div className="flex flex-col items-center justify-center py-20 space-y-4 animate-in fade-in">
 <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center animate-bounce">
 <CheckCircle size={40} className="text-emerald-400" />
 </div>
 <h2 className="text-xl font-bold text-gray-800">{t('oc.wizard.submitSuccess')}</h2>
 <p className="text-base text-gray-800 text-center">{t('oc.wizard.redirecting')}</p>
 <div className="w-32 h-1 bg-white rounded-full overflow-hidden">
 <div className="h-full bg-gradient-to-r from-blue-600 to-blue-800 rounded-full animate-[progress_3s_linear]"
 style={{ animation: 'progress 3s linear forwards' }} />
 </div>
 <style>{`@keyframes progress { from { width: 0% } to { width: 100% } }`}</style>
 </div>
 );
 }

 return (
 <div className="space-y-4 pb-8">
 {/* Header */}
 <div className="flex items-center gap-3">
 <button onClick={() => step > 1 ? setStep(step - 1) : navigate('/oc/dashboard')}
 className="p-2 bg-white rounded-lg border border-gray-200 text-gray-800 hover:text-gray-800 transition-all">
 <ArrowLeft size={18} />
 </button>
 <div>
 <h1 className="text-lg font-bold text-gray-800">{t('oc.wizard.title')}</h1>
 <p className="text-base text-gray-800">{t('oc.wizard.step')} {step} / {TOTAL_STEPS}</p>
 </div>
 </div>

 {/* Fix #14: Step Indicator with completion marks */}
 <div className="flex items-center gap-1">
 {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
 <div key={i} className={`flex-1 h-1.5 rounded-full transition-all duration-300 relative
 ${i < step ? 'bg-gradient-to-r from-blue-600 to-orange-500' : 'bg-white'}`}>
 {i < step - 1 && isStepComplete(i + 1) && (
 <Check size={8} className="absolute -top-1 right-0 text-emerald-400" />
 )}
 </div>
 ))}
 </div>

 {/* Reporter Info (Auto) */}
 <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-3 flex items-center gap-3">
 <div className="w-8 h-8 bg-blue-600/20 rounded-lg flex items-center justify-center">
 <User size={14} className="text-blue-500" />
 </div>
 <div>
 <p className="text-base font-medium text-gray-800">{user?.name}</p>
 <p className="text-[10px] text-gray-800">{new Date().toLocaleString('en-US')}</p>
 </div>
 </div>

 {error && (
 <div className="bg-red-500/10 border border-red-500/30 rounded-xl shadow-sm p-3 flex items-center gap-2">
 <AlertTriangle className="text-red-400 flex-shrink-0" size={16} />
 <p className="text-red-400 text-base">{error}</p>
 </div>
 )}

 {/* Fix #4: Missing fields banner */}
 {showErrors && getMissingFields().length > 0 && (
 <div className="bg-red-500/10 border border-red-500/30 rounded-xl shadow-sm p-3 space-y-1">
 <p className="text-red-400 text-base font-bold flex items-center gap-1">
 <AlertTriangle size={12} /> {t('oc.wizard.requiredFields')}
 </p>
 {getMissingFields().map((f, i) => (
 <p key={i} className="text-red-400/80 text-[11px]">• {f}</p>
 ))}
 </div>
 )}

 {/* STEP 1: Type */}
 {step === 1 && (
 <div className="space-y-5 animate-in fade-in">
 <div>
 <label className={`block text-base font-semibold mb-3 ${showErrors && !incidentType ? 'text-red-400' : 'text-gray-600'}`}>
 {t('oc.wizard.incidentType')} *
 </label>
 <div className="grid grid-cols-2 gap-2">
 {INCIDENT_TYPES.map(type => (
 <button key={type} onClick={() => setIncidentType(type)}
 className={`flex items-center gap-2 p-3 rounded-xl shadow-sm border transition-all text-base font-medium
 ${incidentType === type
 ? 'bg-blue-600/15 border-blue-600/50 text-blue-500 shadow-lg shadow-amber-500/10'
 : showErrors && !incidentType
 ? 'bg-white border-red-500/50 text-gray-800'
 : 'bg-white border-gray-200 text-gray-800 hover:border-gray-300'}`}>
 {typeIconMap[type]}
 {t(`oc.incidentTypes.${type}`)}
 </button>
 ))}
 </div>
 </div>
 </div>
 )}

 {/* STEP 2: Date/Time + Location + Description */}
 {step === 2 && (
 <div className="space-y-4 animate-in fade-in">
 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="block text-base font-medium mb-1.5 text-gray-800">
 <Clock size={12} className="inline mr-1" />{t('oc.wizard.incidentDate')} *
 </label>
 <input type="date" value={incidentDate} readOnly
 className="w-full bg-gray-100 border border-gray-200 rounded-xl shadow-sm px-3 py-2.5 text-base text-gray-600 cursor-not-allowed" dir="ltr" />
 </div>
 <div>
 <label className="block text-base font-medium mb-1.5 text-gray-800">
 <Clock size={12} className="inline mr-1" />{t('oc.wizard.incidentTime')} *
 </label>
 <input type="time" value={incidentTime} readOnly
 className="w-full bg-gray-100 border border-gray-200 rounded-xl shadow-sm px-3 py-2.5 text-base text-gray-600 cursor-not-allowed" dir="ltr" />
 </div>
 </div>

 <div>
 <label className={`block text-base font-medium mb-1.5 ${showErrors && !locationLat ? 'text-red-400' : 'text-gray-800'}`}>
 <MapPin size={12} className="inline mr-1" />{t('oc.wizard.location')} *
 </label>
 <LocationPickerMap onLocationConfirm={handleLocationConfirm} initialPosition={locationLat && locationLng ? { lat: locationLat, lng: locationLng } : null} />
 {locationLat && (
 <p className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1">
 <Check size={10} /> {t('oc.wizard.locationConfirmed')} ({locationLat.toFixed(4)}, {locationLng?.toFixed(4)})
 </p>
 )}
 </div>
 
 <div>
 <label className="block text-base font-medium mb-1.5 text-gray-800">
 <MapPin size={12} className="inline mr-1" /> Detected Zone (Optional)
 </label>
 {selectedZone ? (
 <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl shadow-sm text-emerald-400 text-base flex items-center gap-2">
 <CheckCircle size={16} />
 <span className="font-bold">{selectedZone.name}</span>
 </div>
 ) : (
 <div className="p-3 bg-white border border-gray-200 rounded-xl shadow-sm text-gray-800 text-base">
 No zone detected. The incident will be logged without a zone.
 </div>
 )}
 </div>

 <div>
 <label className={`block text-base font-medium mb-1.5 ${showErrors && !whatHappened.trim() ? 'text-red-400' : 'text-gray-800'}`}>
 {t('oc.wizard.whatHappened')} *
 </label>
 <textarea
 value={whatHappened}
 onChange={(e) => setWhatHappened(e.target.value)}
 rows={4}
 placeholder={t('oc.wizard.whatHappenedPlaceholder')}
 className={`w-full bg-white border rounded-xl shadow-sm px-3 py-2.5 text-base text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 min-h-[120px] resize-y
 ${showErrors && !whatHappened.trim() ? 'border-red-500/50' : 'border-gray-200'}`}
 />
 </div>
  {/* Attachments */}
  <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
  <label className="text-base font-semibold text-gray-600 flex items-center gap-2 mb-3">
  <FileImage size={16} className="text-purple-400" />
  {t('oc.wizard.attachments')}
  </label>
  {files.length > 0 && (
  <div className="grid grid-cols-3 gap-2 mb-3">
  {files.map((file, idx) => (
  <FilePreview key={idx} file={file} onRemove={() => removeFile(idx)} />
  ))}
  </div>
  )}
  <div className="grid grid-cols-2 gap-2">
  <label className="flex items-center justify-center gap-2 p-3 border-2 border-dashed border-gray-200 rounded-xl shadow-sm text-gray-800 text-base font-medium cursor-pointer hover:border-blue-600/50 hover:text-blue-500 transition-all">
  <Upload size={18} />
  {t('oc.wizard.uploadFiles')}
  <input type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={handleFileAdd} />
  </label>
  <button onClick={handleCameraCapture}
  className="flex items-center justify-center gap-2 p-3 border-2 border-dashed border-gray-200 rounded-xl shadow-sm text-gray-800 text-base font-medium hover:border-blue-600/50 hover:text-blue-500 transition-all">
  <Camera size={18} />
  {t('oc.wizard.takePhoto')}
  </button>
  </div>
  </div>

 </div>
 )}

 {/* STEP 3: Injury + Witnesses */}
 {step === 3 && (
 <div className="space-y-4 animate-in fade-in">
 {/* Injury Toggle */}
 <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
 <div className="flex items-center justify-between">
 <label className="text-base font-semibold text-gray-600 flex items-center gap-2">
 <AlertTriangle size={16} className="text-red-400" />
 {t('oc.wizard.hasInjury')}
 </label>
 <button onClick={() => { setHasInjury(!hasInjury); if (hasInjury) setInjuredPersons([]); }}
 className={`w-12 h-7 rounded-full transition-all relative ${hasInjury ? 'bg-red-500' : 'bg-slate-200'}`}>
 <span className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all ${hasInjury ? 'right-1' : 'left-1'}`} />
 </button>
 </div>

 {hasInjury && (
 <div className="mt-4 space-y-3">
 {injuredPersons.map((person, idx) => (
 <div key={idx} className="bg-white border border-red-500/20 rounded-xl shadow-sm p-3 space-y-2">
 <div className="flex items-center justify-between">
 <span className="text-base font-bold text-red-400">{t('oc.wizard.injuredPerson')} #{idx + 1}</span>
 <button onClick={() => removeInjuredPerson(idx)} className="text-gray-800 hover:text-red-400"><Trash2 size={14} /></button>
 </div>
 <input placeholder={t('oc.wizard.injuredName')} value={person.name}
 onChange={(e) => updateInjuredPerson(idx, 'name', e.target.value)}
 className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-base text-gray-800 placeholder-gray-400" />
 <select value={person.affiliate} onChange={(e) => updateInjuredPerson(idx, 'affiliate', e.target.value)}
 className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-base text-gray-800">
 <option value="Employee">{t('oc.wizard.employee')}</option>
 <option value="Contractor">{t('oc.wizard.contractor')}</option>
 <option value="Other">{t('oc.wizard.other')}</option>
 </select>
 <input placeholder={t('oc.wizard.contactNumber')} value={person.contact} dir="ltr"
 onChange={(e) => updateInjuredPerson(idx, 'contact', e.target.value)}
 className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-base text-gray-800 placeholder-gray-400" />
 {person.affiliate === 'Employee' && (
 <div className="grid grid-cols-2 gap-2">
  <select value={person.dept}
  onChange={(e) => updateInjuredPerson(idx, 'dept', e.target.value)}
  className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-base text-gray-800">
  <option value="">{t('oc.wizard.department')}</option>
  {departments.map((d: any) => (
  <option key={d.id} value={d.name}>{i18n.language === 'ar' && d.nameAr ? d.nameAr : d.name}</option>
  ))}
  </select>
 <input placeholder={t('oc.wizard.jobTitle')} value={person.jobTitle}
 onChange={(e) => updateInjuredPerson(idx, 'jobTitle', e.target.value)}
 className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-base text-gray-800 placeholder-gray-400" />
 </div>
 )}
 {person.affiliate === 'Contractor' && (
 <div className="mt-2">
 <label className="block text-[11px] font-medium text-orange-500 mb-1">Contractor Company (شركة المتعاقد) *</label>
 <select value={selectedServiceProviderId} onChange={(e) => setSelectedServiceProviderId(e.target.value)}
 className="w-full bg-white border border-orange-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:ring-2 focus:ring-orange-400/30">
 <option value="">-- Select Company --</option>
 {serviceProviders.filter(sp => sp.status !== 'BLACKLISTED').map(sp => (<option key={sp.id} value={sp.id}>{sp.name} (CR: {sp.commercialRegistrationNumber})</option>))}
  <option value="OTHER">-- أخرى / Other --</option>
 </select>
 </div>
 )}
 </div>
 ))}
 <button onClick={addInjuredPerson}
 className="w-full border-2 border-dashed border-red-500/30 rounded-xl shadow-sm p-2.5 text-red-400 text-base font-medium flex items-center justify-center gap-2 hover:border-red-400 transition-all">
 <Plus size={16} /> {t('oc.wizard.addInjuredPerson')}
 </button>
 </div>
 )}
 </div>

 {/* Witnesses — Fix #15: mobile-friendly layout */}
 <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
 <label className="text-base font-semibold text-gray-600 flex items-center gap-2 mb-3">
 <User size={16} className="text-blue-400" />
 {t('oc.wizard.witnesses')}
 </label>
 {witnesses.map((w, idx) => (
 <div key={idx} className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
 <input placeholder={t('oc.wizard.witnessName')} value={w.name}
 onChange={(e) => updateWitness(idx, 'name', e.target.value)}
 className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-base text-gray-800 placeholder-gray-400" />
 <div className="flex gap-2">
 <input placeholder={t('oc.wizard.witnessMobile')} value={w.mobile} dir="ltr"
 onChange={(e) => updateWitness(idx, 'mobile', e.target.value)}
 className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-base text-gray-800 placeholder-gray-400" />
 <button onClick={() => removeWitness(idx)} className="text-gray-800 hover:text-red-400 p-2"><Trash2 size={14} /></button>
 </div>
 </div>
 ))}
 <button onClick={addWitness}
 className="w-full border-2 border-dashed border-gray-200 rounded-xl shadow-sm p-2.5 text-gray-800 text-base font-medium flex items-center justify-center gap-2 hover:border-gray-300 transition-all">
 <Plus size={16} /> {t('oc.wizard.addWitness')}
 </button>
 </div>
 </div>
 )}

 {/* STEP 4: Review Summary */}
 {step === 4 && (
 <div className="space-y-4 animate-in fade-in">

 {/* Review Summary */}
 <div className="bg-white border border-blue-600/30 rounded-xl shadow-sm p-4 space-y-3">
 <h3 className="text-base font-bold text-blue-500">{t('oc.wizard.reviewSummary')}</h3>
 <div className="space-y-2 text-base">
 <div className="flex justify-between border-b border-gray-200 pb-1.5">
 <span className="text-gray-800">{t('oc.wizard.incidentType')}</span>
 <span className="text-gray-800 font-medium">{t(`oc.incidentTypes.${incidentType}`)}</span>
 </div>

 <div className="flex justify-between border-b border-gray-200 pb-1.5">
 <span className="text-gray-800">{t('oc.wizard.dateTime')}</span>
 <span className="text-gray-800" dir="ltr">{incidentDate} {incidentTime}</span>
 </div>
 <div className="flex justify-between border-b border-gray-200 pb-1.5">
 <span className="text-gray-800">{t('oc.wizard.location')}</span>
 <span className="text-emerald-400" dir="ltr">{locationLat?.toFixed(4)}, {locationLng?.toFixed(4)}</span>
 </div>
 <div className="flex justify-between border-b border-gray-200 pb-1.5">
 <span className="text-gray-800">{t('oc.wizard.hasInjury')}</span>
 <span className={hasInjury ? 'text-red-400 font-bold' : 'text-gray-800'}>{hasInjury ? t('oc.yes') : t('oc.no')}</span>
 </div>
 {hasInjury && injuredPersons.length > 0 && (
 <div className="flex justify-between border-b border-gray-200 pb-1.5">
 <span className="text-gray-800">{t('oc.wizard.injuredCount')}</span>
 <span className="text-red-400 font-bold">{injuredPersons.length}</span>
 </div>
 )}
 <div className="flex justify-between border-b border-gray-200 pb-1.5">
 <span className="text-gray-800">{t('oc.wizard.witnesses')}</span>
 <span className="text-gray-800">{witnesses.length}</span>
 </div>
 <div className="flex justify-between">
 <span className="text-gray-800">{t('oc.wizard.attachments')}</span>
 <span className="text-gray-800">{files.length}</span>
 </div>
 </div>
 </div>
 </div>
 )}

 {/* Navigation Buttons */}
 <div className="flex gap-3 pt-2">
 {step > 1 && (
 <button onClick={() => { setStep(step - 1); setShowErrors(false); }}
 className="flex-1 bg-white border border-gray-200 text-gray-800 font-bold py-3 rounded-xl shadow-sm flex items-center justify-center gap-2 hover:bg-slate-200 transition-all">
 <ArrowLeft size={16} /> {t('oc.wizard.back')}
 </button>
 )}
 {step < TOTAL_STEPS ? (
 <button onClick={handleNext}
 className={`flex-1 bg-gradient-to-r from-blue-600 to-blue-800 hover:from-amber-600 hover:to-orange-700 text-white font-bold py-3 rounded-xl shadow-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-500/20 ${!canProceed() && showErrors ? 'animate-shake' : ''}`}>
 {t('oc.wizard.next')} <ArrowRight size={16} />
 </button>
 ) : (
 /* Fix #23: Keep amber color for submit button */
 <button onClick={handleSubmit} disabled={submitting}
 className="flex-1 bg-gradient-to-r from-blue-600 to-blue-800 hover:from-amber-600 hover:to-orange-700 text-white font-bold py-3 rounded-xl shadow-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50">
 {submitting ? <Loader2 className="animate-spin" size={18} /> : <Check size={16} />}
 {submitting ? t('oc.wizard.submitting') : t('oc.wizard.submit')}
 </button>
 )}
 </div>
 </div>
 );
};

export default OCTicketWizard;
