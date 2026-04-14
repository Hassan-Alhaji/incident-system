import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import api from '../../utils/api';
import LocationPickerMap from '../../components/LocationPickerMap';
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
                <img src={preview} alt="" className="w-full h-24 object-cover rounded-lg border border-slate-700" />
            ) : (
                <div className="w-full h-24 bg-slate-800 border border-slate-700 rounded-lg flex items-center justify-center">
                    <FileImage size={20} className="text-slate-500" />
                </div>
            )}
            <button onClick={onRemove}
                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center shadow-lg">
                <X size={12} className="text-white" />
            </button>
            <p className="text-[9px] text-slate-500 mt-1 truncate">{file.name}</p>
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
    LOW: 'border-slate-500 bg-slate-500/10 text-slate-300',
    MEDIUM: 'border-amber-500 bg-amber-500/10 text-amber-400',
    HIGH: 'border-orange-500 bg-orange-500/10 text-orange-400',
    CRITICAL: 'border-red-500 bg-red-500/10 text-red-400',
};

const OCTicketWizard = () => {
    const { user } = useAuth();
    const { t } = useTranslation();
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
    const [severity, setSeverity] = useState(() => getInitialState('severity', ''));

    // Step 2
    const [incidentDate, setIncidentDate] = useState(() => getInitialState('incidentDate', new Date().toISOString().split('T')[0]));
    const [incidentTime, setIncidentTime] = useState(() => getInitialState('incidentTime', new Date().toTimeString().slice(0, 5)));
    const [locationLat, setLocationLat] = useState<number | null>(() => getInitialState('locationLat', null));
    const [locationLng, setLocationLng] = useState<number | null>(() => getInitialState('locationLng', null));
    const [locationAddress, setLocationAddress] = useState(() => getInitialState('locationAddress', ''));
    const [whatHappened, setWhatHappened] = useState(() => getInitialState('whatHappened', ''));

    // Step 3
    const [hasInjury, setHasInjury] = useState(() => getInitialState('hasInjury', false));
    const [injuredPersons, setInjuredPersons] = useState<InjuredPerson[]>(() => getInitialState('injuredPersons', []));
    const [witnesses, setWitnesses] = useState<Witness[]>(() => getInitialState('witnesses', []));

    // Persist to localStorage
    React.useEffect(() => {
        localStorage.setItem('oc_draft', JSON.stringify({
            step, incidentType, severity, incidentDate, incidentTime,
            locationLat, locationLng, locationAddress, whatHappened,
            hasInjury, injuredPersons, witnesses
        }));
    }, [step, incidentType, severity, incidentDate, incidentTime, locationLat, locationLng, locationAddress, whatHappened, hasInjury, injuredPersons, witnesses]);

    // Step 4
    const [files, setFiles] = useState<File[]>([]);

    const handleLocationConfirm = (lat: number, lng: number) => {
        setLocationLat(lat);
        setLocationLng(lng);
        setLocationAddress(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    };

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
        if (step === 1) return incidentType && severity;
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
            if (!severity) missing.push(t('oc.wizard.severity'));
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
        if (s === 1) return !!(incidentType && severity);
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
                incidentType, severity, incidentDate, incidentTime,
                locationLat, locationLng, locationAddress, whatHappened,
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
                <h2 className="text-xl font-bold text-white">{t('oc.wizard.submitSuccess')}</h2>
                <p className="text-sm text-slate-400 text-center">{t('oc.wizard.redirecting')}</p>
                <div className="w-32 h-1 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-amber-500 to-orange-600 rounded-full animate-[progress_3s_linear]"
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
                    className="p-2 bg-slate-800 rounded-lg border border-slate-700 text-slate-400 hover:text-white transition-all">
                    <ArrowLeft size={18} />
                </button>
                <div>
                    <h1 className="text-lg font-bold text-white">{t('oc.wizard.title')}</h1>
                    <p className="text-xs text-slate-400">{t('oc.wizard.step')} {step} / {TOTAL_STEPS}</p>
                </div>
            </div>

            {/* Fix #14: Step Indicator with completion marks */}
            <div className="flex items-center gap-1">
                {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                    <div key={i} className={`flex-1 h-1.5 rounded-full transition-all duration-300 relative
                        ${i < step ? 'bg-gradient-to-r from-amber-500 to-orange-500' : 'bg-slate-800'}`}>
                        {i < step - 1 && isStepComplete(i + 1) && (
                            <Check size={8} className="absolute -top-1 right-0 text-emerald-400" />
                        )}
                    </div>
                ))}
            </div>

            {/* Reporter Info (Auto) */}
            <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-3 flex items-center gap-3">
                <div className="w-8 h-8 bg-amber-500/20 rounded-lg flex items-center justify-center">
                    <User size={14} className="text-amber-400" />
                </div>
                <div>
                    <p className="text-sm font-medium text-white">{user?.name}</p>
                    <p className="text-[10px] text-slate-400">{new Date().toLocaleString('en-US')}</p>
                </div>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-center gap-2">
                    <AlertTriangle className="text-red-400 flex-shrink-0" size={16} />
                    <p className="text-red-400 text-sm">{error}</p>
                </div>
            )}

            {/* Fix #4: Missing fields banner */}
            {showErrors && getMissingFields().length > 0 && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 space-y-1">
                    <p className="text-red-400 text-xs font-bold flex items-center gap-1">
                        <AlertTriangle size={12} /> {t('oc.wizard.requiredFields')}
                    </p>
                    {getMissingFields().map((f, i) => (
                        <p key={i} className="text-red-400/80 text-[11px]">• {f}</p>
                    ))}
                </div>
            )}

            {/* STEP 1: Type + Severity */}
            {step === 1 && (
                <div className="space-y-5 animate-in fade-in">
                    <div>
                        <label className={`block text-sm font-semibold mb-3 ${showErrors && !incidentType ? 'text-red-400' : 'text-slate-200'}`}>
                            {t('oc.wizard.incidentType')} *
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            {INCIDENT_TYPES.map(type => (
                                <button key={type} onClick={() => setIncidentType(type)}
                                    className={`flex items-center gap-2 p-3 rounded-xl border transition-all text-sm font-medium
                                        ${incidentType === type
                                            ? 'bg-amber-500/15 border-amber-500/50 text-amber-400 shadow-lg shadow-amber-500/10'
                                            : showErrors && !incidentType
                                                ? 'bg-slate-900 border-red-500/50 text-slate-300'
                                                : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-600'}`}>
                                    {typeIconMap[type]}
                                    {t(`oc.incidentTypes.${type}`)}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className={`block text-sm font-semibold mb-3 ${showErrors && !severity ? 'text-red-400' : 'text-slate-200'}`}>
                            {t('oc.wizard.severity')} *
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            {SEVERITY_LEVELS.map(level => (
                                <button key={level} onClick={() => setSeverity(level)}
                                    className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all text-sm font-bold
                                        ${severity === level
                                            ? severityColorMap[level]
                                            : showErrors && !severity
                                                ? 'border-red-500/50 bg-slate-900 text-slate-400'
                                                : 'border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600'}`}>
                                    {t(`priority.${level}`)}
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
                            <label className={`block text-xs font-medium mb-1.5 ${showErrors && !incidentDate ? 'text-red-400' : 'text-slate-300'}`}>
                                <Clock size={12} className="inline mr-1" />{t('oc.wizard.incidentDate')} *
                            </label>
                            <input type="date" value={incidentDate} onChange={(e) => setIncidentDate(e.target.value)}
                                className={`w-full bg-slate-800 border rounded-xl px-3 py-2.5 text-sm text-white focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50
                                    ${showErrors && !incidentDate ? 'border-red-500/50' : 'border-slate-700'}`} dir="ltr" />
                        </div>
                        <div>
                            <label className={`block text-xs font-medium mb-1.5 ${showErrors && !incidentTime ? 'text-red-400' : 'text-slate-300'}`}>
                                <Clock size={12} className="inline mr-1" />{t('oc.wizard.incidentTime')} *
                            </label>
                            <input type="time" value={incidentTime} onChange={(e) => setIncidentTime(e.target.value)}
                                className={`w-full bg-slate-800 border rounded-xl px-3 py-2.5 text-sm text-white focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50
                                    ${showErrors && !incidentTime ? 'border-red-500/50' : 'border-slate-700'}`} dir="ltr" />
                        </div>
                    </div>

                    <div>
                        <label className={`block text-xs font-medium mb-1.5 ${showErrors && !locationLat ? 'text-red-400' : 'text-slate-300'}`}>
                            <MapPin size={12} className="inline mr-1" />{t('oc.wizard.location')} *
                        </label>
                        <LocationPickerMap onLocationConfirm={handleLocationConfirm} />
                        {locationLat && (
                            <p className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1">
                                <Check size={10} /> {t('oc.wizard.locationConfirmed')} ({locationLat.toFixed(4)}, {locationLng?.toFixed(4)})
                            </p>
                        )}
                    </div>

                    <div>
                        <label className={`block text-xs font-medium mb-1.5 ${showErrors && !whatHappened.trim() ? 'text-red-400' : 'text-slate-300'}`}>
                            {t('oc.wizard.whatHappened')} *
                        </label>
                        <textarea
                            value={whatHappened}
                            onChange={(e) => setWhatHappened(e.target.value)}
                            rows={4}
                            placeholder={t('oc.wizard.whatHappenedPlaceholder')}
                            className={`w-full bg-slate-800 border rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50 min-h-[120px] resize-y
                                ${showErrors && !whatHappened.trim() ? 'border-red-500/50' : 'border-slate-700'}`}
                        />
                    </div>
                </div>
            )}

            {/* STEP 3: Injury + Witnesses */}
            {step === 3 && (
                <div className="space-y-4 animate-in fade-in">
                    {/* Injury Toggle */}
                    <div className="bg-slate-900/80 border border-slate-700/50 rounded-xl p-4">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                                <AlertTriangle size={16} className="text-red-400" />
                                {t('oc.wizard.hasInjury')}
                            </label>
                            <button onClick={() => { setHasInjury(!hasInjury); if (hasInjury) setInjuredPersons([]); }}
                                className={`w-12 h-7 rounded-full transition-all relative ${hasInjury ? 'bg-red-500' : 'bg-slate-700'}`}>
                                <span className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all ${hasInjury ? 'right-1' : 'left-1'}`} />
                            </button>
                        </div>

                        {hasInjury && (
                            <div className="mt-4 space-y-3">
                                {injuredPersons.map((person, idx) => (
                                    <div key={idx} className="bg-slate-800/80 border border-red-500/20 rounded-xl p-3 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-red-400">{t('oc.wizard.injuredPerson')} #{idx + 1}</span>
                                            <button onClick={() => removeInjuredPerson(idx)} className="text-slate-500 hover:text-red-400"><Trash2 size={14} /></button>
                                        </div>
                                        <input placeholder={t('oc.wizard.injuredName')} value={person.name}
                                            onChange={(e) => updateInjuredPerson(idx, 'name', e.target.value)}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500" />
                                        <select value={person.affiliate} onChange={(e) => updateInjuredPerson(idx, 'affiliate', e.target.value)}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white">
                                            <option value="Employee">{t('oc.wizard.employee')}</option>
                                            <option value="Contractor">{t('oc.wizard.contractor')}</option>
                                            <option value="Other">{t('oc.wizard.other')}</option>
                                        </select>
                                        <input placeholder={t('oc.wizard.contactNumber')} value={person.contact} dir="ltr"
                                            onChange={(e) => updateInjuredPerson(idx, 'contact', e.target.value)}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500" />
                                        {person.affiliate === 'Employee' && (
                                            <div className="grid grid-cols-2 gap-2">
                                                <input placeholder={t('oc.wizard.department')} value={person.dept}
                                                    onChange={(e) => updateInjuredPerson(idx, 'dept', e.target.value)}
                                                    className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500" />
                                                <input placeholder={t('oc.wizard.jobTitle')} value={person.jobTitle}
                                                    onChange={(e) => updateInjuredPerson(idx, 'jobTitle', e.target.value)}
                                                    className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500" />
                                            </div>
                                        )}
                                    </div>
                                ))}
                                <button onClick={addInjuredPerson}
                                    className="w-full border-2 border-dashed border-red-500/30 rounded-xl p-2.5 text-red-400 text-sm font-medium flex items-center justify-center gap-2 hover:border-red-400 transition-all">
                                    <Plus size={16} /> {t('oc.wizard.addInjuredPerson')}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Witnesses — Fix #15: mobile-friendly layout */}
                    <div className="bg-slate-900/80 border border-slate-700/50 rounded-xl p-4">
                        <label className="text-sm font-semibold text-slate-200 flex items-center gap-2 mb-3">
                            <User size={16} className="text-blue-400" />
                            {t('oc.wizard.witnesses')}
                        </label>
                        {witnesses.map((w, idx) => (
                            <div key={idx} className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                                <input placeholder={t('oc.wizard.witnessName')} value={w.name}
                                    onChange={(e) => updateWitness(idx, 'name', e.target.value)}
                                    className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500" />
                                <div className="flex gap-2">
                                    <input placeholder={t('oc.wizard.witnessMobile')} value={w.mobile} dir="ltr"
                                        onChange={(e) => updateWitness(idx, 'mobile', e.target.value)}
                                        className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500" />
                                    <button onClick={() => removeWitness(idx)} className="text-slate-500 hover:text-red-400 p-2"><Trash2 size={14} /></button>
                                </div>
                            </div>
                        ))}
                        <button onClick={addWitness}
                            className="w-full border-2 border-dashed border-slate-700 rounded-xl p-2.5 text-slate-400 text-sm font-medium flex items-center justify-center gap-2 hover:border-slate-600 transition-all">
                            <Plus size={16} /> {t('oc.wizard.addWitness')}
                        </button>
                    </div>
                </div>
            )}

            {/* STEP 4: Attachments + Review */}
            {step === 4 && (
                <div className="space-y-4 animate-in fade-in">
                    {/* Attachments */}
                    <div className="bg-slate-900/80 border border-slate-700/50 rounded-xl p-4">
                        <label className="text-sm font-semibold text-slate-200 flex items-center gap-2 mb-3">
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
                            <label className="flex items-center justify-center gap-2 p-3 border-2 border-dashed border-slate-700 rounded-xl text-slate-400 text-sm font-medium cursor-pointer hover:border-amber-500/50 hover:text-amber-400 transition-all">
                                <Upload size={18} />
                                {t('oc.wizard.uploadFiles')}
                                <input type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={handleFileAdd} />
                            </label>
                            <button onClick={handleCameraCapture}
                                className="flex items-center justify-center gap-2 p-3 border-2 border-dashed border-slate-700 rounded-xl text-slate-400 text-sm font-medium hover:border-amber-500/50 hover:text-amber-400 transition-all">
                                <Camera size={18} />
                                {t('oc.wizard.takePhoto')}
                            </button>
                        </div>
                    </div>

                    {/* Review Summary */}
                    <div className="bg-slate-900/80 border border-amber-500/30 rounded-xl p-4 space-y-3">
                        <h3 className="text-sm font-bold text-amber-400">{t('oc.wizard.reviewSummary')}</h3>
                        <div className="space-y-2 text-xs">
                            <div className="flex justify-between border-b border-slate-800 pb-1.5">
                                <span className="text-slate-400">{t('oc.wizard.incidentType')}</span>
                                <span className="text-white font-medium">{t(`oc.incidentTypes.${incidentType}`)}</span>
                            </div>
                            <div className="flex justify-between border-b border-slate-800 pb-1.5">
                                <span className="text-slate-400">{t('oc.wizard.severity')}</span>
                                <span className={`font-bold ${severity === 'CRITICAL' ? 'text-red-400' : severity === 'HIGH' ? 'text-orange-400' : severity === 'MEDIUM' ? 'text-amber-400' : 'text-slate-300'}`}>
                                    {t(`priority.${severity}`)}
                                </span>
                            </div>
                            <div className="flex justify-between border-b border-slate-800 pb-1.5">
                                <span className="text-slate-400">{t('oc.wizard.dateTime')}</span>
                                <span className="text-white" dir="ltr">{incidentDate} {incidentTime}</span>
                            </div>
                            <div className="flex justify-between border-b border-slate-800 pb-1.5">
                                <span className="text-slate-400">{t('oc.wizard.location')}</span>
                                <span className="text-emerald-400" dir="ltr">{locationLat?.toFixed(4)}, {locationLng?.toFixed(4)}</span>
                            </div>
                            <div className="flex justify-between border-b border-slate-800 pb-1.5">
                                <span className="text-slate-400">{t('oc.wizard.hasInjury')}</span>
                                <span className={hasInjury ? 'text-red-400 font-bold' : 'text-slate-300'}>{hasInjury ? t('oc.yes') : t('oc.no')}</span>
                            </div>
                            {hasInjury && injuredPersons.length > 0 && (
                                <div className="flex justify-between border-b border-slate-800 pb-1.5">
                                    <span className="text-slate-400">{t('oc.wizard.injuredCount')}</span>
                                    <span className="text-red-400 font-bold">{injuredPersons.length}</span>
                                </div>
                            )}
                            <div className="flex justify-between border-b border-slate-800 pb-1.5">
                                <span className="text-slate-400">{t('oc.wizard.witnesses')}</span>
                                <span className="text-white">{witnesses.length}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">{t('oc.wizard.attachments')}</span>
                                <span className="text-white">{files.length}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex gap-3 pt-2">
                {step > 1 && (
                    <button onClick={() => { setStep(step - 1); setShowErrors(false); }}
                        className="flex-1 bg-slate-800 border border-slate-700 text-slate-300 font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-slate-700 transition-all">
                        <ArrowLeft size={16} /> {t('oc.wizard.back')}
                    </button>
                )}
                {step < TOTAL_STEPS ? (
                    <button onClick={handleNext}
                        className={`flex-1 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-500/20 ${!canProceed() && showErrors ? 'animate-shake' : ''}`}>
                        {t('oc.wizard.next')} <ArrowRight size={16} />
                    </button>
                ) : (
                    /* Fix #23: Keep amber color for submit button */
                    <button onClick={handleSubmit} disabled={submitting}
                        className="flex-1 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50">
                        {submitting ? <Loader2 className="animate-spin" size={18} /> : <Check size={16} />}
                        {submitting ? t('oc.wizard.submitting') : t('oc.wizard.submit')}
                    </button>
                )}
            </div>
        </div>
    );
};

export default OCTicketWizard;
