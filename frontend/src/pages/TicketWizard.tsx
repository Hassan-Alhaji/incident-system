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
  { key: 'OBSERVATION', icon: <AlertTriangle size={22} />, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
];

const TicketWizard = () => {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const isRtl = i18n.dir() === 'rtl';

  const [step, setStep] = useState(1);  // Step 1 is now auto-skipped since only OBSERVATION type exists
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedId, setSubmittedId] = useState('');
  const [error, setError] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const [showAttachmentConfirm, setShowAttachmentConfirm] = useState(false);
  const [attachmentConfirmed, setAttachmentConfirmed] = useState(false);
  const submittingRef = React.useRef(false);
  const TOTAL_STEPS = 3;

  // Step 1: Type
  const [incidentType, setIncidentType] = useState('OBSERVATION');

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
  const [hasWitness, setHasWitness] = useState<boolean | null>(null);
  const [witnesses, setWitnesses] = useState<Witness[]>([]);
  const [serviceProviders, setServiceProviders] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedServiceProviderId, setSelectedServiceProviderId] = useState('');
  const [reporterDepartmentId, setReporterDepartmentId] = useState('');

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
        if (parsed.hasWitness) setHasWitness(parsed.hasWitness);
        if (parsed.injuredPersons) setInjuredPersons(parsed.injuredPersons);
        if (parsed.witnesses) setWitnesses(parsed.witnesses);
        if (parsed.reporterDepartmentId) setReporterDepartmentId(parsed.reporterDepartmentId);

      } catch (e) { console.error('Error loading draft', e); }
    }
  }, []);

  useEffect(() => {
    if (!submitted && !submitting) {
      const draft = { incidentType, incidentDate, incidentTime, locationLat, locationLng, locationAddress, locationDescription, zoneId, zoneName, whatHappened, lateReportReason, hasInjury, hasWitness, eventId, injuredPersons, witnesses, reporterDepartmentId };
      const timeoutId = setTimeout(() => {
        localStorage.setItem('ticket_wizard_draft', JSON.stringify(draft));
      }, 1500);
      return () => clearTimeout(timeoutId);
    }
  }, [incidentType, incidentDate, incidentTime, locationLat, locationLng, locationAddress, locationDescription, zoneId, zoneName, whatHappened, lateReportReason, hasInjury, hasWitness, eventId, injuredPersons, witnesses, reporterDepartmentId, submitted, submitting]);


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
      if (!reporterDepartmentId) { showToast(isRtl ? 'الرجاء اختيار القسم' : 'Please select your department.', 'warning'); return false; }
      if (!incidentDate || !incidentTime) { showToast(t('oc.wizard.missingDate', 'Please provide incident date and time.'), 'warning'); return false; }
      const dt = new Date(`${incidentDate}T${incidentTime}`);
      if (dt.getTime() > Date.now()) { showToast(t('oc.wizard.futureDate', 'Future dates are not allowed. Please enter a valid past time.'), 'warning'); return false; }
      
      if (!locationLat) { showToast(t('oc.wizard.missingLocation', 'Please confirm the location on the map.'), 'warning'); return false; }
      
      if (hasInjury) {
        if (injuredPersons.length === 0) { showToast(t('errors.addAtLeastOneInjured'), 'warning'); return false; }
        for (const p of injuredPersons) {
          if (!p.name.trim() || !p.mobile.trim()) { showToast(t('errors.fillInjuredNameMobile'), 'warning'); return false; }
          if (p.mobile.trim().length < 9) { showToast(t('errors.mobileLength', 'Mobile number must be at least 9 digits.'), 'warning'); return false; }
          if (p.type === 'EMPLOYEE' && !p.dept) { showToast(t('errors.selectInjuredDept'), 'warning'); return false; }
          if (p.type === 'CONTRACTOR' && !p.company) { showToast(t('errors.selectInjuredCompany'), 'warning'); return false; }
        }
        
        if (hasWitness === null) {
          showToast(t('errors.selectWitnessStatus', 'Please select if there is a witness.'), 'warning');
          return false;
        }

        if (hasWitness === true) {
          for (const w of witnesses) {
            if (!w.name.trim() || !w.mobile.trim()) { showToast(t('errors.fillWitnessInfo', 'Please fill name and mobile for all witnesses, or remove them.'), 'warning'); return false; }
            if (w.mobile.trim().length < 9) { showToast(t('errors.mobileLength', 'Mobile number must be at least 9 digits.'), 'warning'); return false; }
          }
        }
      }

      if (!whatHappened.trim()) { showToast(t('oc.wizard.missingDesc', 'Please describe what happened.'), 'warning'); return false; }
      if (isLateReport() && !lateReportReason.trim()) { showToast(t('oc.wizard.missingLateReason', 'Please provide a reason for the late report.'), 'warning'); return false; }
      return true;
    }
    if (step === 2) {
      if (files.length === 0 && !attachmentConfirmed) {
        setShowAttachmentConfirm(true);
        return false;
      }
    }
    if (step === 3) {
      // Step 3 is just summary now
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
    if (submittingRef.current) return; // Prevent double-submit
    submittingRef.current = true;
    setSubmitting(true); setError('');
    try {
      const payload = { incidentType, incidentDate, incidentTime, locationLat, locationLng, locationAddress, locationDescription, whatHappened, hasInjury, injuredPersons: hasInjury ? injuredPersons : [], witnesses: hasInjury ? witnesses : [], lateReportReason: isLateReport() ? lateReportReason : null, serviceProviderId: selectedServiceProviderId || null, zoneId: zoneId || null, eventId: eventId || null, reporterDepartmentId: reporterDepartmentId || null };
      const res = await api.post('/tickets', payload);
      const ticketId = res.data.id;
      if (files.length > 0) { const fd = new FormData(); files.forEach(f => fd.append('files', f)); await api.post(`/tickets/${ticketId}/attachments`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }); }
      setSubmittedId(ticketId); setSubmitted(true);
      localStorage.removeItem('ticket_wizard_draft');
      setTimeout(() => navigate(`/tickets/${ticketId}`), 5000);
    } catch (err: any) { setError(err.response?.data?.message || t('errors.failedToSubmit')); submittingRef.current = false; } finally { setSubmitting(false); }
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

      {/* Type is now auto-set to OBSERVATION — no selection step needed */}

      {/* STEP 1: Date/Location/Description */}
      {step === 1 && (
        <div className="space-y-4">
          {/* Reporter Department Selection */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
            <label className={`block text-sm font-bold mb-2 ${showErrors && !reporterDepartmentId ? 'text-red-500' : 'text-gray-700'}`}>
              {isRtl ? 'قسم المُبلِّغ' : 'Reporter Department'} *
            </label>
            <select
              value={reporterDepartmentId}
              onChange={e => setReporterDepartmentId(e.target.value)}
              className={`w-full bg-white border ${showErrors && !reporterDepartmentId ? 'border-red-400 ring-4 ring-red-500/10' : 'border-gray-200'} rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all`}
            >
              <option value="">{isRtl ? '— اختر القسم —' : '— Select Department —'}</option>
              {departments.map((d: any) => (
                <option key={d.id} value={d.id}>{isRtl ? (d.nameAr || d.name) : d.name}</option>
              ))}
            </select>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2 shadow-sm">
            <AlertTriangle className="text-amber-600 flex-shrink-0 mt-0.5" size={18} />
            <p className="text-sm text-amber-900 font-bold leading-snug">
              {t('wizard.timeAlert', 'تنبيه: الرجاء إدخال تاريخ ووقت وقوع الحادث الفعلي بدقة (وليس الوقت الحالي).')}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={`block text-sm font-bold mb-1.5 ${showErrors && !incidentDate ? 'text-red-500' : 'text-gray-700'}`}><Clock size={12} className="inline mr-1" />{t('oc.wizard.incidentDate', 'Date of Incident')} *</label>
              <input type="date" max={new Date().toISOString().split('T')[0]} value={incidentDate} onChange={e => setIncidentDate(e.target.value)} className={`w-full bg-white border ${showErrors && !incidentDate ? 'border-red-400 ring-4 ring-red-500/10' : 'border-gray-200'} rounded-xl px-3 py-2.5 text-sm text-gray-800 transition-all`} dir="ltr" />
            </div>
            <div>
              <label className={`block text-sm font-bold mb-1.5 ${showErrors && !incidentTime ? 'text-red-500' : 'text-gray-700'}`}><Clock size={12} className="inline mr-1" />{t('oc.wizard.incidentTime', 'Time of Incident')} *</label>
              <input type="time" max={incidentDate === new Date().toISOString().split('T')[0] ? new Date().toTimeString().slice(0, 5) : undefined} value={incidentTime} onChange={e => setIncidentTime(e.target.value)} className={`w-full bg-white border ${showErrors && !incidentTime ? 'border-red-400 ring-4 ring-red-500/10' : 'border-gray-200'} rounded-xl px-3 py-2.5 text-sm text-gray-800 transition-all`} dir="ltr" />
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
            <label className="block text-sm font-medium mb-2 text-gray-700">
              {isRtl ? 'هل هذا الحادث يتبع فعالية قائمة؟' : 'Is this incident related to an ongoing event?'}
            </label>
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                onClick={() => { /* keep eventId */ }}
                className={`flex-1 px-3 py-2 rounded-xl text-sm font-bold border transition-all ${
                  eventId !== null && eventId !== ''
                    ? 'bg-blue-600 border-blue-600 text-white shadow-md'
                    : 'bg-white border-gray-200 text-gray-700 hover:border-blue-300'
                }`}
                onClickCapture={() => setEventId(eventId || (events.filter((ev: any) => ev.status === 'ACTIVE')[0]?.id ?? ''))}
              >
                {isRtl ? '✓ نعم' : '✓ Yes'}
              </button>
              <button
                type="button"
                onClick={() => setEventId(null)}
                className={`flex-1 px-3 py-2 rounded-xl text-sm font-bold border transition-all ${
                  eventId === null
                    ? 'bg-slate-700 border-slate-700 text-white shadow-md'
                    : 'bg-white border-gray-200 text-gray-700 hover:border-slate-300'
                }`}
              >
                {isRtl ? '✗ لا' : '✗ No'}
              </button>
            </div>
            {eventId !== null && (
              <select
                value={eventId}
                onChange={e => setEventId(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800"
              >
                <option value="">{isRtl ? '-- اختر فعالية --' : '-- Select Event --'}</option>
                {events.filter((ev: any) => ev.status === 'ACTIVE').map(ev => (
                  <option key={ev.id} value={ev.id}>{isRtl ? ev.nameAr : ev.nameEn}</option>
                ))}
              </select>
            )}
          </div>

          {/* Injury Question */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 space-y-3">
            <label className="block text-sm font-bold text-gray-700 flex items-center gap-2">
              <AlertTriangle size={16} className="text-red-500" />
              {t('oc.wizard.hasInjury', 'Any Injuries?')} *
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setHasInjury(true);
                  if (injuredPersons.length === 0) {
                    setInjuredPersons([{ name: '', mobile: '', type: 'EMPLOYEE', dept: '', company: '' }]);
                  }
                }}
                className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-bold border transition-all ${
                  hasInjury === true
                    ? 'bg-red-500 border-red-500 text-white shadow-md'
                    : 'bg-white border-gray-200 text-gray-700 hover:border-red-300'
                }`}
              >
                {isRtl ? '✓ نعم' : '✓ Yes'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setHasInjury(false);
                  setInjuredPersons([]);
                  setHasWitness(null);
                  setWitnesses([]);
                }}
                className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-bold border transition-all ${
                  hasInjury === false
                    ? 'bg-slate-700 border-slate-700 text-white shadow-md'
                    : 'bg-white border-gray-200 text-gray-700 hover:border-slate-300'
                }`}
              >
                {isRtl ? '✗ لا' : '✗ No'}
              </button>
            </div>
            {hasInjury && (
              <div className="mt-4 space-y-3 pt-2 border-t border-gray-100">
                {injuredPersons.map((p, idx) => (
                  <div key={idx} className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-2 animate-in slide-in-from-top-2 duration-150">
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
                        {serviceProviders.filter(sp => sp.status === 'ACTIVE').map(sp => (
                          <option key={sp.id} value={sp.id}>{isRtl ? (sp.nameAr || sp.name) : sp.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                ))}
                <button onClick={addInjuredPerson} className="w-full border-2 border-dashed border-red-300 rounded-xl p-2.5 text-red-500 text-sm font-medium flex items-center justify-center gap-2 hover:bg-red-50/50 transition-all"><Plus size={16} /> {t('oc.wizard.addInjuredPerson', 'Add Injured Person')}</button>
              </div>
            )}
          </div>

          {/* Witness Question */}
          {hasInjury && (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 space-y-3">
              <label className="block text-sm font-bold text-gray-700 flex items-center gap-2">
                <User size={16} className="text-blue-500" />
                {isRtl ? 'هل يوجد شاهد على الحادث؟' : 'Are there any witnesses?'} *
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setHasWitness(true);
                    if (witnesses.length === 0) {
                      setWitnesses([{ name: '', mobile: '' }]);
                    }
                  }}
                  className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-bold border transition-all ${
                    hasWitness === true
                      ? 'bg-blue-600 border-blue-600 text-white shadow-md'
                      : 'bg-white border-gray-200 text-gray-700 hover:border-blue-300'
                  }`}
                >
                  {isRtl ? '✓ نعم' : '✓ Yes'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setHasWitness(false);
                    setWitnesses([]);
                  }}
                  className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-bold border transition-all ${
                    hasWitness === false
                      ? 'bg-slate-700 border-slate-700 text-white shadow-md'
                      : 'bg-white border-gray-200 text-gray-700 hover:border-slate-300'
                  }`}
                >
                  {isRtl ? '✗ لا' : '✗ No'}
                </button>
              </div>

              {hasWitness && (
                <div className="mt-4 space-y-3 pt-2 border-t border-gray-100 animate-in slide-in-from-top-2 duration-150">
                  {witnesses.map((w, idx) => (
                    <div key={idx} className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2 p-2 border border-blue-50 rounded-xl bg-blue-50/20">
                      <input placeholder={t('oc.wizard.witnessName', 'Name') + ' *'} value={w.name} onChange={e => updateWitness(idx, 'name', e.target.value)} className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                      <div className="flex gap-2">
                        <input placeholder={t('oc.wizard.witnessMobile', 'Mobile') + ' *'} value={w.mobile} dir="ltr" type="tel" inputMode="numeric" onChange={e => updateWitness(idx, 'mobile', e.target.value.replace(/[^0-9+]/g, ''))} className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                        <button onClick={() => removeWitness(idx)} className="text-gray-400 hover:text-red-500 p-2"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  ))}
                  <button onClick={addWitness} className="w-full border-2 border-dashed border-gray-200 rounded-xl p-2.5 text-gray-500 text-sm font-medium flex items-center justify-center gap-2 hover:bg-gray-50 transition-all"><Plus size={16} /> {t('oc.wizard.addWitness', 'Add Witness')}</button>
                </div>
              )}
            </div>
          )}

          <div>
            <label className={`block text-sm font-medium mb-1.5 ${showErrors && !whatHappened.trim() ? 'text-red-500' : 'text-gray-700'}`}>{t('oc.wizard.whatHappened', 'What Happened?')} *</label>
            <textarea value={whatHappened} onChange={e => setWhatHappened(e.target.value)} rows={8} placeholder={t('oc.wizard.whatHappenedPlaceholder', 'Describe the incident...')} className={`w-full bg-white border rounded-xl px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 resize-y min-h-[200px] ${showErrors && !whatHappened.trim() ? 'border-red-300' : 'border-gray-200'}`} />
          </div>
        </div>
      )}

      {/* STEP 2: Attachments */}
      {step === 2 && (
        <div className="space-y-4">
          {/* Attachments (Moved from Step 4) */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-semibold text-gray-700 flex items-center gap-2"><FileImage size={16} className="text-purple-500" />{t('oc.wizard.attachments', 'Attachments')} <span className="text-gray-400 text-xs mx-1">({isRtl ? 'اختياري' : 'Optional'})</span></label>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 flex items-start gap-2">
              <AlertTriangle className="text-blue-500 flex-shrink-0 mt-0.5" size={16} />
              <p className="text-sm text-blue-800 font-medium">{isRtl ? 'من الأفضل إرفاق إثبات للحادث إذا وجد.' : 'It is better to attach proof of the incident if available.'}</p>
            </div>

            {files.length > 0 && <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">{files.map((f, i) => <FilePreview key={i} file={f} onRemove={() => setFiles(files.filter((_, idx) => idx !== i))} />)}</div>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label className="flex items-center justify-center gap-2 p-3 border-2 border-dashed border-gray-200 rounded-xl text-gray-500 text-sm font-medium cursor-pointer hover:border-blue-400 transition-all"><Upload size={18} />{t('oc.wizard.uploadFiles', 'Upload')}<input type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={handleFileAdd} /></label>
              <button onClick={handleCamera} className="flex items-center justify-center gap-2 p-3 border-2 border-dashed border-gray-200 rounded-xl text-gray-500 text-sm font-medium hover:border-blue-400 transition-all"><Camera size={18} />{t('oc.wizard.takePhoto', 'Camera')}</button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: Review & Submit */}
      {step === 3 && (
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
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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

      {/* Custom Attachment Confirm Modal */}
      {showAttachmentConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }} dir={isRtl ? 'rtl' : 'ltr'}>
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="text-amber-600" size={24} />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">
                {isRtl ? 'لا يوجد مرفقات' : 'No Attachments'}
              </h3>
              <p className="text-sm text-slate-500 mb-6">
                {isRtl 
                  ? 'من الأفضل إرفاق إثبات للحادث إذا وجد. هل ترغب في الاستمرار بدون مرفقات؟' 
                  : 'It is better to attach proof of the incident if available. Do you want to continue without attachments?'}
              </p>
              <div className="flex w-full gap-3">
                <button
                  type="button"
                  onClick={() => setShowAttachmentConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all"
                >
                  {isRtl ? 'إضافة مرفق' : 'Add Attachment'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAttachmentConfirm(false);
                    setAttachmentConfirmed(true);
                    setStep(step + 1);
                  }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-amber-500 hover:bg-amber-600 text-white transition-all"
                >
                  {isRtl ? 'الاستمرار بدون' : 'Continue without'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default TicketWizard;
