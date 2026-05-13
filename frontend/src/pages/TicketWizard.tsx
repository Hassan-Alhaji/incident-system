import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import api from '../utils/api';
import { useToast } from '../components/Toast';
import LocationPickerMap from '../components/LocationPickerMap';
import {
  AlertTriangle, ArrowLeft, ArrowRight, Camera, Check, Clock,
  FileImage, Loader2, MapPin, Plus, Send, ShieldAlert, Trash2,
  Upload, User, X, Phone, CheckCircle, Eye, Search
} from 'lucide-react';

const NavArrowRight = ({ size, isRtl }: { size: number; isRtl: boolean }) =>
  isRtl ? <ArrowLeft size={size} /> : <ArrowRight size={size} />;
const NavArrowLeft = ({ size, isRtl }: { size: number; isRtl: boolean }) =>
  isRtl ? <ArrowRight size={size} /> : <ArrowLeft size={size} />;

const FilePreview = ({ file, onRemove }: { file: File; onRemove: () => void }) => {
  const [preview, setPreview] = useState('');
  useEffect(() => {
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [file]);
  return (
    <div className="relative group">
      {preview ? <img src={preview} alt="" className="w-full h-24 object-cover rounded-lg border border-gray-200" /> : <div className="w-full h-24 bg-white border border-gray-200 rounded-lg flex items-center justify-center"><FileImage size={20} className="text-gray-400" /></div>}
      <button onClick={onRemove} className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center shadow-lg"><X size={12} className="text-white" /></button>
      <p className="text-[9px] text-gray-500 mt-1 truncate">{file.name}</p>
    </div>
  );
};

const SummaryFilePreview = ({ file }: { file: File }) => {
  const [preview, setPreview] = useState('');
  useEffect(() => {
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [file]);
  return preview ? <img src={preview} alt="" className="w-full h-16 object-cover rounded-lg border border-gray-200" /> : <div className="w-full h-16 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-center"><FileImage size={16} className="text-gray-400" /></div>;
};

interface InjuredPerson { name: string; mobile: string; type: string; dept: string; company: string; }
interface Witness { name: string; mobile: string; }

const INCIDENT_TYPES = [
  { key: 'OBSERVATION', icon: <Eye size={22} />, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
  { key: 'SECURITY', icon: <ShieldAlert size={22} />, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200' },
];

const TicketWizard = () => {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const isRtl = i18n.dir() === 'rtl';

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedId, setSubmittedId] = useState('');
  const [error, setError] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const TOTAL_STEPS = 4;

  // Step 1: Type
  const [incidentType, setIncidentType] = useState('');

  // Step 2: Details
  const [incidentDate, setIncidentDate] = useState('');
  const [incidentTime, setIncidentTime] = useState('');
  const [locationLat, setLocationLat] = useState<number | null>(null);
  const [locationLng, setLocationLng] = useState<number | null>(null);
  const [locationAddress, setLocationAddress] = useState('');
  const [locationDescription, setLocationDescription] = useState('');
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [zoneName, setZoneName] = useState('');
  const [zones, setZones] = useState<any[]>([]);
  const [whatHappened, setWhatHappened] = useState('');
  const [lateReportReason, setLateReportReason] = useState('');
  const [eventId, setEventId] = useState<string | null>(null);
  const [events, setEvents] = useState<any[]>([]);

  // Step 3: Injuries & Witnesses
  const [hasInjury, setHasInjury] = useState(false);
  const [injuredPersons, setInjuredPersons] = useState<InjuredPerson[]>([]);
  const [witnesses, setWitnesses] = useState<Witness[]>([]);
  const [serviceProviders, setServiceProviders] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedServiceProviderId, setSelectedServiceProviderId] = useState('');

  // Step 4: Attachments
  const [files, setFiles] = useState<File[]>([]);

  // Late report check
  const isLateReport = () => {
    try {
      if (!incidentDate || !incidentTime) return false;
      const dt = new Date(`${incidentDate}T${incidentTime}`);
      return (Date.now() - dt.getTime()) / (1000 * 60 * 60) > 24;
    } catch { return false; }
  };

  useEffect(() => {
    api.get('/service-providers').then(r => setServiceProviders(r.data)).catch(console.error);
    api.get('/departments').then(r => setDepartments(r.data)).catch(console.error);
    api.get('/zones').then(r => setZones(r.data)).catch(console.error);
    api.get('/events').then(r => setEvents(r.data)).catch(console.error);
  }, []);

  // --- DRAFT SAVING ---
  useEffect(() => {
    const draft = localStorage.getItem('ticket_wizard_draft');
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        if (parsed.incidentType) setIncidentType(parsed.incidentType);
        if (parsed.incidentDate) setIncidentDate(parsed.incidentDate);
        if (parsed.incidentTime) setIncidentTime(parsed.incidentTime);
        if (parsed.locationLat) setLocationLat(parsed.locationLat);
        if (parsed.locationLng) setLocationLng(parsed.locationLng);
        if (parsed.locationAddress) setLocationAddress(parsed.locationAddress);
        if (parsed.locationDescription) setLocationDescription(parsed.locationDescription);
        if (parsed.zoneId) setZoneId(parsed.zoneId);
        if (parsed.zoneName) setZoneName(parsed.zoneName);
        if (parsed.whatHappened) setWhatHappened(parsed.whatHappened);
        if (parsed.eventId) setEventId(parsed.eventId);
        if (parsed.lateReportReason) setLateReportReason(parsed.lateReportReason);
        if (parsed.hasInjury) setHasInjury(parsed.hasInjury);

      } catch (e) { console.error('Error loading draft', e); }
    }
  }, []);

  useEffect(() => {
    if (!submitted) {
      const draft = { incidentType, incidentDate, incidentTime, locationLat, locationLng, locationAddress, locationDescription, zoneId, zoneName, whatHappened, lateReportReason, hasInjury, eventId }; // Omitted injuredPersons & witnesses for privacy
      const timeoutId = setTimeout(() => {
        localStorage.setItem('ticket_wizard_draft', JSON.stringify(draft));
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [incidentType, incidentDate, incidentTime, locationLat, locationLng, locationAddress, locationDescription, zoneId, zoneName, whatHappened, lateReportReason, hasInjury, eventId, submitted]);


  const handleLocationConfirm = (lat: number, lng: number, address: string, zone?: { id: string; name: string } | null) => {
    setLocationLat(lat);
    setLocationLng(lng);
    setLocationAddress(address || `${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    setZoneId(zone?.id ?? null);
    setZoneName(zone?.name ?? '');
  };

  const addInjuredPerson = () => setInjuredPersons([...injuredPersons, { name: '', mobile: '', type: 'EMPLOYEE', dept: '', company: '' }]);
  const updateInjured = (i: number, field: keyof InjuredPerson, val: string) => { const u = [...injuredPersons]; u[i] = { ...u[i], [field]: val }; setInjuredPersons(u); };
  const removeInjured = (i: number) => setInjuredPersons(injuredPersons.filter((_, idx) => idx !== i));

  const addWitness = () => setWitnesses([...witnesses, { name: '', mobile: '' }]);
  const updateWitness = (i: number, field: keyof Witness, val: string) => { const u = [...witnesses]; u[i] = { ...u[i], [field]: val }; setWitnesses(u); };
  const removeWitness = (i: number) => setWitnesses(witnesses.filter((_, idx) => idx !== i));

  const handleFileAdd = (e: React.ChangeEvent<HTMLInputElement>) => { 
    if (e.target.files) {
      const maxBytes = 10 * 1024 * 1024; // 10MB
      const allFiles = Array.from(e.target.files);
      const validFiles = allFiles.filter(f => f.size <= maxBytes);
      if (validFiles.length < allFiles.length) showToast(t('errors.fileTooLarge', 'Some files skipped (exceeds 10MB).'), 'warning');
      setFiles([...files, ...validFiles]);
    }
  };
  const handleCamera = () => { 
    const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*'; input.capture = 'environment'; 
    input.onchange = (e: any) => { 
      if (e.target.files) {
        const maxBytes = 10 * 1024 * 1024;
        const allFiles = Array.from(e.target.files as FileList);
        const validFiles = allFiles.filter(f => f.size <= maxBytes);
        if (validFiles.length < allFiles.length) showToast(t('errors.fileTooLarge', 'File is too large (exceeds 10MB).'), 'warning');
        setFiles([...files, ...validFiles]);
      }
    }; 
    input.click(); 
  };

  const canProceed = () => {
    if (step === 1) {
      if (!incidentType) { showToast(t('oc.wizard.selectType', 'Please select an incident type.'), 'warning'); return false; }
      return true;
    }
    if (step === 2) {
      if (!incidentDate || !incidentTime) { showToast(t('oc.wizard.missingDate', 'Please provide incident date and time.'), 'warning'); return false; }
      const dt = new Date(`${incidentDate}T${incidentTime}`);
      if (dt.getTime() > Date.now()) { showToast(t('oc.wizard.futureDate', 'Future dates are not allowed. Please enter a valid past time.'), 'warning'); return false; }
      
      if (!locationLat) { showToast(t('oc.wizard.missingLocation', 'Please confirm the location on the map.'), 'warning'); return false; }
      if (!whatHappened.trim()) { showToast(t('oc.wizard.missingDesc', 'Please describe what happened.'), 'warning'); return false; }
      if (isLateReport() && !lateReportReason.trim()) { showToast(t('oc.wizard.missingLateReason', 'Please provide a reason for the late report.'), 'warning'); return false; }
      return true;
    }
    if (step === 3) {
      if (hasInjury) {
        if (injuredPersons.length === 0) { showToast(t('errors.addAtLeastOneInjured'), 'warning'); return false; }
        for (const p of injuredPersons) {
          if (!p.name.trim() || !p.mobile.trim()) { showToast(t('errors.fillInjuredNameMobile'), 'warning'); return false; }
          if (p.mobile.trim().length < 9) { showToast(t('errors.mobileLength', 'Mobile number must be at least 9 digits.'), 'warning'); return false; }
          if (p.type === 'EMPLOYEE' && !p.dept) { showToast(t('errors.selectInjuredDept'), 'warning'); return false; }
          if (p.type === 'CONTRACTOR' && !p.company) { showToast(t('errors.selectInjuredCompany'), 'warning'); return false; }
        }
      }
      for (const w of witnesses) {
        if (!w.name.trim() || !w.mobile.trim()) { showToast(t('errors.fillWitnessInfo', 'Please fill name and mobile for all witnesses, or remove them.'), 'warning'); return false; }
        if (w.mobile.trim().length < 9) { showToast(t('errors.mobileLength', 'Mobile number must be at least 9 digits.'), 'warning'); return false; }
      }
      
      if (files.length === 0) {
        showToast(isRtl ? 'الرجاء إرفاق الصور المطلوبة.' : 'Attachments are strictly required.', 'warning');
        return false;
      }
    }
    if (step === 4) {
      // Step 4 is just summary now
    }
    return true;
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
    setSubmitting(true); setError('');
    try {
      const payload = { incidentType, incidentDate, incidentTime, locationLat, locationLng, locationAddress, locationDescription, whatHappened, hasInjury, injuredPersons: hasInjury ? injuredPersons : [], witnesses, lateReportReason: isLateReport() ? lateReportReason : null, serviceProviderId: selectedServiceProviderId || null, zoneId: zoneId || null, eventId: eventId || null };
      const res = await api.post('/tickets', payload);
      const ticketId = res.data.id;
      if (files.length > 0) { const fd = new FormData(); files.forEach(f => fd.append('files', f)); await api.post(`/tickets/${ticketId}/attachments`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }); }
      setSubmittedId(ticketId); setSubmitted(true);
      localStorage.removeItem('ticket_wizard_draft');
      setTimeout(() => navigate(`/tickets/${ticketId}`), 5000);
    } catch (err: any) { setError(err.response?.data?.message || t('errors.failedToSubmit')); } finally { setSubmitting(false); }
  };

  if (submitted) return (
    <div className="flex flex-col items-center justify-center py-16 space-y-5">
      <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center animate-bounce shadow-lg shadow-emerald-200">
        <CheckCircle size={48} className="text-emerald-500" />
      </div>
      <h2 className="text-2xl font-black text-gray-800 text-center">{t('oc.wizard.submitSuccess', 'Your report has been successfully submitted. Thank you.')}</h2>
      <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-50 border border-blue-200 rounded-2xl p-5 max-w-sm text-center space-y-2 shadow-sm">
        <p className="text-blue-800 font-bold text-sm">{t('oc.wizard.thankYouTitle', 'Thank you for keeping us safe! 🙏')}</p>
        <p className="text-blue-600 text-xs leading-relaxed">{t('oc.wizard.thankYouBody', 'Your report helps us improve workplace safety for everyone. Our team will review it and take appropriate action.')}</p>
      </div>
      <p className="text-gray-400 text-sm animate-pulse">{t('oc.wizard.redirecting', 'Redirecting...')}</p>
    </div>
  );

  return (
    <div className="space-y-4 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => step > 1 ? setStep(step - 1) : navigate('/dashboard')} className="p-2 bg-white rounded-lg border border-gray-200 text-gray-600 hover:text-blue-600 transition-all"><NavArrowLeft size={18} isRtl={isRtl} /></button>
        <div><h1 className="text-lg font-bold text-gray-800">{t('oc.wizard.title', 'New Incident Report')}</h1><p className="text-sm text-gray-500">{t('oc.wizard.step', 'Step')} {step} / {TOTAL_STEPS}</p></div>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-1">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (<div key={i} className={`flex-1 h-1.5 rounded-full transition-all ${i < step ? 'bg-gradient-to-r from-blue-600 to-blue-400' : 'bg-gray-200'}`} />))}
      </div>

      {/* Reporter info */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-3 flex items-center gap-3">
        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center"><User size={14} className="text-blue-600" /></div>
        <div><p className="text-sm font-medium text-gray-800">{user?.name}</p><p className="text-[10px] text-gray-400">{new Date().toLocaleString()}</p></div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2"><AlertTriangle className="text-red-500 flex-shrink-0" size={16} /><p className="text-red-600 text-sm">{error}</p></div>}

      {/* STEP 1: Type Selection */}
      {step === 1 && (
        <div className="space-y-4">
          <label className="block text-sm font-semibold text-gray-700">{t('oc.wizard.incidentType', 'Incident Type')} *</label>
          <div className="grid grid-cols-1 gap-3">
            {INCIDENT_TYPES.map(type => {
              const selected = incidentType === type.key;
              return (
                <button key={type.key} onClick={() => setIncidentType(type.key)} className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left ${selected ? `${type.bg} ${type.border} ${type.color} shadow-md ring-2 ring-offset-1 ${type.key === 'OBSERVATION' ? 'ring-blue-300' : 'ring-violet-300'}` : `bg-white ${type.border} text-gray-700 hover:shadow-sm hover:${type.bg}`}`}>
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${type.bg} ${type.color}`}>{type.icon}</div>
                  <div>
                    <span className="font-bold text-base">{t(`oc.incidentTypes.${type.key}`, type.key)}</span>
                    <p className="text-xs mt-0.5 opacity-70">{t(`oc.incidentTypes.${type.key}_desc`, '')}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* STEP 2: Date/Location/Description */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2 shadow-sm">
            <AlertTriangle className="text-amber-600 flex-shrink-0 mt-0.5" size={18} />
            <p className="text-sm text-amber-900 font-bold leading-snug">
              {t('wizard.timeAlert', 'تنبيه: الرجاء إدخال تاريخ ووقت وقوع الحادث الفعلي بدقة (وليس الوقت الحالي).')}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`block text-sm font-bold mb-1.5 ${showErrors && !incidentDate ? 'text-red-500' : 'text-gray-700'}`}><Clock size={12} className="inline mr-1" />{t('oc.wizard.incidentDate', 'Date of Incident')} *</label>
              <input type="date" value={incidentDate} onChange={e => setIncidentDate(e.target.value)} className={`w-full bg-white border ${showErrors && !incidentDate ? 'border-red-400 ring-4 ring-red-500/10' : 'border-gray-200'} rounded-xl px-3 py-2.5 text-sm text-gray-800 transition-all`} dir="ltr" />
            </div>
            <div>
              <label className={`block text-sm font-bold mb-1.5 ${showErrors && !incidentTime ? 'text-red-500' : 'text-gray-700'}`}><Clock size={12} className="inline mr-1" />{t('oc.wizard.incidentTime', 'Time of Incident')} *</label>
              <input type="time" value={incidentTime} onChange={e => setIncidentTime(e.target.value)} className={`w-full bg-white border ${showErrors && !incidentTime ? 'border-red-400 ring-4 ring-red-500/10' : 'border-gray-200'} rounded-xl px-3 py-2.5 text-sm text-gray-800 transition-all`} dir="ltr" />
            </div>
          </div>

          {isLateReport() && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3 shadow-sm">
              <p className="text-red-700 text-sm font-bold flex items-center gap-2"><AlertTriangle size={16} /> {t('wizard.lateReport', 'بلاغ متأخر (>24 ساعة) - يُرجى توضيح السبب')}</p>
              <textarea value={lateReportReason} onChange={e => setLateReportReason(e.target.value)} placeholder={t('wizard.lateReasonPlaceholder', 'لماذا يتم رفع هذا البلاغ متأخراً؟')} className={`w-full p-3 border rounded-xl text-sm bg-white resize-y transition-all ${showErrors && !lateReportReason.trim() ? 'border-red-400 ring-4 ring-red-500/10' : 'border-red-200 focus:border-red-400'}`} rows={3} />
            </div>
          )}

          <div>
            <label className={`block text-sm font-medium mb-1.5 ${showErrors && !locationLat ? 'text-red-500' : 'text-gray-700'}`}><MapPin size={12} className="inline mr-1" />{t('oc.wizard.location', 'Location')} *</label>
            <LocationPickerMap
              onLocationConfirm={handleLocationConfirm}
              initialPosition={locationLat && locationLng ? { lat: locationLat, lng: locationLng } : null}
              zones={zones}
            />
            {locationLat && (
              <p className="text-[10px] text-emerald-600 mt-1 flex items-center gap-1">
                <Check size={10} />
                {zoneName ? `${isRtl ? 'المنطقة' : 'Zone'}: ${zoneName}` : locationAddress || `${locationLat.toFixed(4)}, ${locationLng?.toFixed(4)}`}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5 text-gray-700">{t('oc.wizard.locationDesc', 'Location Description (Optional)')}</label>
            <input type="text" value={locationDescription} onChange={e => setLocationDescription(e.target.value)} placeholder={t('oc.wizard.locationDescPlaceholder', 'e.g. Near main gate, Building A...')} className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5 text-gray-700">{t('oc.wizard.relatedEvent', 'Is this report related to a specific event? (Optional)')}</label>
            <select value={eventId || ''} onChange={e => setEventId(e.target.value)} className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800">
              <option value="">{t('oc.wizard.noEvent', '-- Select Event (Optional) --')}</option>
              {events.map(ev => (
                <option key={ev.id} value={ev.id}>{isRtl ? ev.nameAr : ev.nameEn}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={`block text-sm font-medium mb-1.5 ${showErrors && !whatHappened.trim() ? 'text-red-500' : 'text-gray-700'}`}>{t('oc.wizard.whatHappened', 'What Happened?')} *</label>
            <textarea value={whatHappened} onChange={e => setWhatHappened(e.target.value)} rows={8} placeholder={t('oc.wizard.whatHappenedPlaceholder', 'Describe the incident...')} className={`w-full bg-white border rounded-xl px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 resize-y min-h-[200px] ${showErrors && !whatHappened.trim() ? 'border-red-300' : 'border-gray-200'}`} />
          </div>
        </div>
      )}

      {/* STEP 3: Injuries & Witnesses */}
      {step === 3 && (
        <div className="space-y-4">
          {/* Attachments (Moved from Step 4) */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-semibold text-gray-700 flex items-center gap-2"><FileImage size={16} className="text-purple-500" />{t('oc.wizard.attachments', 'Attachments')} *</label>
            </div>
            
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex items-start gap-2">
              <AlertTriangle className="text-amber-500 flex-shrink-0 mt-0.5" size={16} />
              <p className="text-sm text-amber-800 font-medium">{t('oc.wizard.attachmentReminder', 'Important: Attaching photos or supporting documents is strictly required to proceed.')}</p>
            </div>

            {files.length > 0 && <div className="grid grid-cols-3 gap-2 mb-3">{files.map((f, i) => <FilePreview key={i} file={f} onRemove={() => setFiles(files.filter((_, idx) => idx !== i))} />)}</div>}
            <div className="grid grid-cols-2 gap-2">
              <label className="flex items-center justify-center gap-2 p-3 border-2 border-dashed border-gray-200 rounded-xl text-gray-500 text-sm font-medium cursor-pointer hover:border-blue-400 transition-all"><Upload size={18} />{t('oc.wizard.uploadFiles', 'Upload')}<input type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={handleFileAdd} /></label>
              <button onClick={handleCamera} className="flex items-center justify-center gap-2 p-3 border-2 border-dashed border-gray-200 rounded-xl text-gray-500 text-sm font-medium hover:border-blue-400 transition-all"><Camera size={18} />{t('oc.wizard.takePhoto', 'Camera')}</button>
            </div>
          </div>

          {/* Injury Toggle */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-gray-700 flex items-center gap-2"><AlertTriangle size={16} className="text-red-500" />{t('oc.wizard.hasInjury', 'Any Injuries?')}</label>
              <button 
                onClick={() => { 
                const newState = !hasInjury;
                setHasInjury(newState); 
                if (newState && injuredPersons.length === 0) {
                  setInjuredPersons([{ name: '', mobile: '', type: 'EMPLOYEE', dept: '', company: '' }]);
                } else if (!newState) {
                  setInjuredPersons([]); 
                }
              }} className={`w-12 h-7 rounded-full transition-all relative ${hasInjury ? 'bg-red-500' : 'bg-gray-200'}`}>
                <span className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all ${hasInjury ? 'right-1' : 'left-1'}`} />
              </button>
            </div>
            {hasInjury && (
              <div className="mt-4 space-y-3">
                {injuredPersons.map((p, idx) => (
                  <div key={idx} className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between"><span className="text-sm font-bold text-red-600">{t('oc.wizard.injuredPerson', 'Injured Person')} #{idx + 1}</span><button onClick={() => removeInjured(idx)} className="text-gray-400 hover:text-red-500"><Trash2 size={14} /></button></div>
                    <select value={p.type} onChange={e => updateInjured(idx, 'type', e.target.value)} className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm"><option value="EMPLOYEE">{t('oc.wizard.employee', 'Employee')}</option><option value="CONTRACTOR">{t('oc.wizard.contractor', 'Contractor')}</option><option value="OTHER">{t('oc.wizard.other', 'Other')}</option></select>
                    <input placeholder={t('oc.wizard.injuredName', 'Name') + ' *'} value={p.name} onChange={e => updateInjured(idx, 'name', e.target.value)} className={`w-full bg-white border ${showErrors && !p.name.trim() ? 'border-red-300' : 'border-gray-200'} rounded-lg px-3 py-2 text-sm`} />
                    <input placeholder={t('oc.wizard.contactNumber', 'Mobile') + ' *'} value={p.mobile} dir="ltr" type="tel" inputMode="numeric" onChange={e => updateInjured(idx, 'mobile', e.target.value.replace(/[^0-9+]/g, ''))} className={`w-full bg-white border ${showErrors && !p.mobile.trim() ? 'border-red-300' : 'border-gray-200'} rounded-lg px-3 py-2 text-sm`} />
                    {p.type === 'EMPLOYEE' && (
                      <select value={p.dept} onChange={e => updateInjured(idx, 'dept', e.target.value)} className={`w-full bg-white border ${showErrors && !p.dept ? 'border-red-300' : 'border-gray-200'} rounded-lg px-3 py-2 text-sm`}>
                        <option value="">{t('oc.wizard.department', 'Department')} *</option>
                        {departments.map((d: any) => <option key={d.id} value={d.name}>{i18n.language === 'ar' && d.nameAr ? d.nameAr : d.name}</option>)}
                      </select>
                    )}
                    {p.type === 'CONTRACTOR' && (
                      <select value={p.company ? selectedServiceProviderId : ''} onChange={e => { setSelectedServiceProviderId(e.target.value); updateInjured(idx, 'company', e.target.selectedOptions[0]?.text || ''); }} className={`w-full bg-white border ${showErrors && !p.company ? 'border-red-300' : 'border-orange-200'} rounded-lg px-3 py-2 text-sm`}>
                        <option value="">{t('oc.wizard.selectCompany', 'Select Company')} *</option>
                        {serviceProviders.filter(sp => sp.status !== 'BLACKLISTED').map(sp => <option key={sp.id} value={sp.id}>{sp.name}</option>)}
                      </select>
                    )}
                  </div>
                ))}
                <button onClick={addInjuredPerson} className="w-full border-2 border-dashed border-red-300 rounded-xl p-2.5 text-red-500 text-sm font-medium flex items-center justify-center gap-2"><Plus size={16} /> {t('oc.wizard.addInjuredPerson', 'Add Injured Person')}</button>
              </div>
            )}
          </div>

          {/* Witnesses */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
            <label className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-3"><User size={16} className="text-blue-500" />{t('oc.wizard.witnesses', 'Witnesses')} ({t('oc.wizard.optional', 'Optional')})</label>
            {witnesses.map((w, idx) => (
              <div key={idx} className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                <input placeholder={t('oc.wizard.witnessName', 'Name')} value={w.name} onChange={e => updateWitness(idx, 'name', e.target.value)} className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                <div className="flex gap-2">
                  <input placeholder={t('oc.wizard.witnessMobile', 'Mobile')} value={w.mobile} dir="ltr" type="tel" inputMode="numeric" onChange={e => updateWitness(idx, 'mobile', e.target.value.replace(/[^0-9+]/g, ''))} className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  <button onClick={() => removeWitness(idx)} className="text-gray-400 hover:text-red-500 p-2"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
            <button onClick={addWitness} className="w-full border-2 border-dashed border-gray-200 rounded-xl p-2.5 text-gray-500 text-sm font-medium flex items-center justify-center gap-2"><Plus size={16} /> {t('oc.wizard.addWitness', 'Add Witness')}</button>
          </div>
        </div>
      )}

      {/* STEP 4: Attachments & Review */}
      {step === 4 && (
        <div className="space-y-4">
          {/* Review Summary */}
          <div className="bg-white border border-blue-200 rounded-xl shadow-sm p-4 space-y-4">
            <h3 className="text-sm font-bold text-blue-600 flex items-center gap-2"><CheckCircle size={18} /> {t('oc.wizard.reviewSummary', 'Review Summary')}</h3>
            <div className="space-y-3 text-sm">
              <div className="flex flex-col border-b border-gray-100 pb-2">
                <span className="text-gray-500 text-xs mb-0.5">{t('oc.wizard.incidentType', 'Type')}</span>
                <span className="text-gray-800 font-medium">{t(`oc.incidentTypes.${incidentType}`, incidentType)}</span>
              </div>
              <div className="flex flex-col border-b border-gray-100 pb-2">
                <span className="text-gray-500 text-xs mb-0.5">{t('oc.wizard.dateTime', 'Date/Time')}</span>
                <span className="text-gray-800 font-medium">{incidentDate} {incidentTime}</span>
              </div>
              <div className="flex flex-col border-b border-gray-100 pb-2">
                <span className="text-gray-500 text-xs mb-0.5">{t('oc.wizard.location', 'Location')}</span>
                <span className="text-gray-800 font-medium">
                  {zoneName ? `📍 ${zoneName}` : locationAddress || (locationLat ? `${locationLat.toFixed(4)}, ${locationLng?.toFixed(4)}` : '-')}
                  {locationDescription ? ` — ${locationDescription}` : ''}
                </span>
              </div>
              <div className="flex flex-col border-b border-gray-100 pb-2">
                <span className="text-gray-500 text-xs mb-0.5">{t('oc.wizard.relatedEvent', 'Event')}</span>
                <span className="text-gray-800 font-medium">{eventId && events.find(e => e.id === eventId) ? (isRtl ? events.find(e => e.id === eventId)?.nameAr : events.find(e => e.id === eventId)?.nameEn) : 'None'}</span>
              </div>
              <div className="flex flex-col border-b border-gray-100 pb-2">
                <span className="text-gray-500 text-xs mb-0.5">{t('oc.wizard.whatHappened', 'Description')}</span>
                <span className="text-gray-800 font-medium whitespace-pre-wrap">{whatHappened}</span>
              </div>

              {files.length > 0 && (
                <div className="flex flex-col border-b border-gray-100 pb-2">
                  <span className="text-gray-500 text-xs mb-1.5">{t('oc.wizard.attachments', 'Attachments')} ({files.length})</span>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {files.map((f, i) => <SummaryFilePreview key={i} file={f} />)}
                  </div>
                </div>
              )}

              {hasInjury && injuredPersons.length > 0 && (
                <div className="flex flex-col border-b border-gray-100 pb-2">
                  <span className="text-gray-500 text-xs mb-1.5">{t('oc.wizard.hasInjury', 'Injured Persons')}</span>
                  <div className="space-y-1.5">
                    {injuredPersons.map((p, i) => (
                      <div key={i} className="bg-red-50 text-red-800 px-2.5 py-1.5 rounded-lg text-xs flex justify-between items-center">
                        <span className="font-bold">{p.name} <span className="font-normal opacity-70">({p.type})</span></span>
                        <span dir="ltr" className="opacity-90">{p.mobile}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {witnesses.length > 0 && (
                <div className="flex flex-col border-b border-gray-100 pb-2">
                  <span className="text-gray-500 text-xs mb-1.5">{t('oc.wizard.witnesses', 'Witnesses')}</span>
                  <div className="space-y-1.5">
                    {witnesses.map((w, i) => (
                      <div key={i} className="bg-blue-50 text-blue-800 px-2.5 py-1.5 rounded-lg text-xs flex justify-between items-center">
                        <span className="font-bold">{w.name}</span>
                        <span dir="ltr" className="opacity-90">{w.mobile}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {isLateReport() && <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs text-amber-700 mt-2"><strong>⚠ Late Report:</strong> {lateReportReason}</div>}
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3 pt-2">
        {step > 1 && <button onClick={() => { setStep(step - 1); setShowErrors(false); }} className="flex-1 bg-white border border-gray-200 text-gray-700 font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-gray-50 transition-all"><NavArrowLeft size={16} isRtl={isRtl} /> {t('oc.wizard.back', 'Back')}</button>}
        {step < TOTAL_STEPS ? (
          <button onClick={handleNext} className="flex-1 bg-gradient-to-r from-blue-600 to-blue-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg hover:from-blue-700 hover:to-blue-600 transition-all">{t('oc.wizard.next', 'Next')} <NavArrowRight size={16} isRtl={isRtl} /></button>
        ) : (
          <button onClick={handleSubmit} disabled={submitting} className="flex-1 bg-gradient-to-r from-blue-600 to-blue-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 transition-all">{submitting ? <Loader2 className="animate-spin" size={18} /> : <Check size={16} />}{submitting ? t('oc.wizard.submitting', 'Submitting...') : t('oc.wizard.submit', 'Submit Report')}</button>
        )}
      </div>

    </div>
  );
};

export default TicketWizard;
