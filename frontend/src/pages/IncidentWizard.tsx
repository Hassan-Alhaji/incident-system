import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ClipboardList,
    AlertTriangle,
    MapPin,
    Camera,
    Users,
    CheckCircle,
    Flag,
    Activity,
    Layers,
    ArrowLeft,
    ArrowRight,
    Send,
    User
} from 'lucide-react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';


const STEPS_GENERAL = [
    { id: 'info', title: 'Event Info', icon: ClipboardList },
    { id: 'type', title: 'Type', icon: AlertTriangle },
    { id: 'details', title: 'Details', icon: MapPin },
    { id: 'evidence', title: 'Evidence', icon: Camera },
    { id: 'witnesses', title: 'Witnesses', icon: Users },
    { id: 'review', title: 'Review', icon: CheckCircle },
];

const STEPS_MEDICAL = [
    { id: 'info', title: 'Type', icon: AlertTriangle },
    { id: 'patient', title: 'Patient & Event', icon: User },
    { id: 'clinical', title: 'Clinical', icon: Activity },
    { id: 'evidence', title: 'Evidence', icon: Camera },
    { id: 'review', title: 'Review', icon: CheckCircle },
];

const IncidentWizard = () => {
    const navigate = useNavigate();
    const { user } = useAuth();

    useEffect(() => {
        if (user) {
            setFormData(prev => ({
                ...prev,
                reporterName: user.name || '',
                reporterMobile: user.mobile || prev.reporterMobile || '',
                // Signature left empty for explicit action
            }));
        }
    }, [user]);

    const [events, setEvents] = useState<any[]>([]);

    useEffect(() => {
        api.get('/events?active=true')
            .then(res => setEvents(res.data))
            .catch(err => console.error(err));
    }, []);

    // Allow Medical Roles AND Admins to see Medical Report option
    const isMedicalRole = user?.isMedical || user?.role?.includes('MEDICAL') || user?.role === 'ADMIN';

    const [currentStep, setCurrentStep] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Logic State
    const [eventCategory, setEventCategory] = useState<'TRACK' | 'OTHER' | ''>('');
    const [selectedType, setSelectedType] = useState<string>('');
    const [subType, setSubType] = useState<'INCIDENT' | 'MEDICAL' | 'PIT_GRID'>('INCIDENT');

    // General Form Data
    const [formData, setFormData] = useState({
        eventName: '',
        venue: 'Jeddah Corniche Circuit',
        dateTime: new Date().toISOString().slice(0, 16),
        location: '',
        postNumber: '',
        description: '',
        priority: 'MEDIUM',

        reporterName: '',
        reporterMobile: '',
        reporterSignature: '',

        // Pit/Grid Fields
        pitNumber: '',
        carNumber: '',
        sessionCategory: 'Practice',
        lapNumber: '',
        teamName: '',
        speedLimit: '',
        speedRecorded: '',
        radarOperatorName: '',
        radarOperatorPhone: '',
        drivingOnWhiteLine: false,
        refueling: false,
        driverChange: false,
        excessMechanics: false,
        pitRemarks: '',

        drivers: [] as { name: string, carNo: string }[],
        witnesses: [] as { name: string, contact: string, location: string }[],
    });

    // Medical Specific Data
    const [medicalData, setMedicalData] = useState({
        // Header
        headerDriverName: '',

        // Patient
        patientSurname: '',
        patientGivenName: '',
        patientDob: '',
        patientGender: '',
        patientAddress: '',
        patientSuburb: '',
        patientState: '',
        patientPostcode: '',
        patientEmail: '',
        patientMobile: '',
        patientPhone: '',
        patientOccupation: '',
        motorsportId: '',
        patientCarNo: '',
        patientRole: '',

        // Event
        permitNumber: '',
        incidentTime: '',

        // License
        licenseAction: '',

        // Injury
        injuryType: '',
        treatmentLocation: '',
        treatmentLocationDetail: '',
        arrivalMethod: '',
        incidentDescription: '',

        // Statement
        whereSeen: '',
        initialCondition: '',
        treatmentGiven: '',
        subsequentTreatment: [] as string[],
        subsequentDetail: '',
        medicalPersonnelName: user?.name || '',
    });

    const [files, setFiles] = useState<File[]>([]);

    // Determine Active Steps
    const activeSteps = subType === 'MEDICAL' ? STEPS_MEDICAL : STEPS_GENERAL;

    // Helper: Update Fields
    const updateField = (field: string, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };
    const updateMedical = (field: string, value: any) => {
        setMedicalData(prev => ({ ...prev, [field]: value }));
    };
    const toggleSubsequentTreatment = (val: string) => {
        setMedicalData(prev => {
            const list = prev.subsequentTreatment.includes(val)
                ? prev.subsequentTreatment.filter(x => x !== val)
                : [...prev.subsequentTreatment, val];
            return { ...prev, subsequentTreatment: list };
        });
    };

    const handleSelectCategory = (category: 'TRACK' | 'OTHER') => {
        setEventCategory(category);
    };

    const handleSelectType = (type: string, sub: 'INCIDENT' | 'MEDICAL' | 'PIT_GRID') => {
        setSelectedType(type);
        setSubType(sub);
        if (sub !== 'MEDICAL') {
            setCurrentStep(prev => prev + 1);
        }
    };

    const handleNext = () => {
        if (currentStep < activeSteps.length - 1) {
            // Validation
            if (activeSteps[currentStep].id === 'type' && (!eventCategory || !selectedType)) {
                alert("Please select category and type.");
                return;
            }
            setCurrentStep(prev => prev + 1);
        } else {
            handleSubmit();
        }
    };

    const handleBack = () => {
        if (currentStep > 0) setCurrentStep(prev => prev - 1);
    };

    const handleSubmit = async () => {
        setIsSubmitting(true);
        try {
            // Construct Payload
            const payload: any = {
                type: selectedType,
                priority: formData.priority,
                eventName: formData.eventName,
                venue: formData.venue,
                incidentDate: (subType === 'MEDICAL' && medicalData.incidentTime) ? new Date(`${formData.dateTime.slice(0, 10)}T${medicalData.incidentTime}`) : new Date(formData.dateTime),
                location: formData.location,
                postNumber: formData.postNumber,

                reporterName: formData.reporterName,
                reporterSignature: formData.reporterSignature,
                marshalMobile: formData.reporterMobile,

                description: subType === 'MEDICAL' ? medicalData.incidentDescription : formData.description,

                // General JSONs
                drivers: subType === 'MEDICAL'
                    ? JSON.stringify([{ name: medicalData.headerDriverName, carNo: '' }])
                    : JSON.stringify(formData.drivers),
                witnesses: JSON.stringify(formData.witnesses),
            };

            // Medical Report Payload
            if (subType === 'MEDICAL') {
                payload.medicalReport = {
                    patientSurname: medicalData.patientSurname,
                    patientGivenName: medicalData.patientGivenName,
                    patientName: `${medicalData.patientGivenName} ${medicalData.patientSurname}`.trim(),
                    patientDob: medicalData.patientDob ? new Date(medicalData.patientDob) : null,
                    patientGender: medicalData.patientGender,
                    patientAddress: medicalData.patientAddress,
                    patientSuburb: medicalData.patientSuburb,
                    patientState: medicalData.patientState,
                    patientPostcode: medicalData.patientPostcode,
                    patientEmail: medicalData.patientEmail,
                    patientMobile: medicalData.patientMobile,
                    patientPhone: medicalData.patientPhone,
                    patientOccupation: medicalData.patientOccupation,
                    motorsportId: medicalData.motorsportId,
                    carNumber: medicalData.patientCarNo,
                    patientRole: medicalData.patientRole,

                    permitNumber: medicalData.permitNumber,
                    licenseAction: medicalData.licenseAction,

                    injuryType: medicalData.injuryType,
                    treatmentLocation: medicalData.treatmentLocation,
                    treatmentLocationDetail: medicalData.treatmentLocationDetail,
                    arrivalMethod: medicalData.arrivalMethod,
                    incidentDescription: medicalData.incidentDescription,

                    whereSeen: medicalData.whereSeen,
                    initialCondition: medicalData.initialCondition,
                    treatmentGiven: medicalData.treatmentGiven,
                    subsequentTreatment: JSON.stringify(medicalData.subsequentTreatment),
                    subsequentDetail: medicalData.subsequentDetail,

                    summary: `Patient: ${medicalData.patientGivenName} ${medicalData.patientSurname}. Condition: ${medicalData.initialCondition}`,
                };
            }

            // Pit Grid Payload
            if (subType === 'PIT_GRID') {
                payload.pitGridReport = {
                    pitNumber: formData.pitNumber,
                    sessionCategory: formData.sessionCategory,
                    carNumber: formData.carNumber,
                    lapNumber: formData.lapNumber ? Number(formData.lapNumber) : null,
                    teamName: formData.teamName,

                    speedLimit: formData.speedLimit,
                    speedRecorded: formData.speedRecorded,

                    radarOperatorName: formData.radarOperatorName,
                    radarOperatorPhone: formData.radarOperatorPhone,

                    drivingOnWhiteLine: !!formData.drivingOnWhiteLine,
                    refueling: !!formData.refueling,
                    driverChange: !!formData.driverChange,
                    excessMechanics: !!formData.excessMechanics,

                    remarks: formData.pitRemarks,
                };
            }

            // Create Ticket
            const res = await api.post('/tickets', payload);
            const ticketId = res.data.id;

            // Upload Files
            if (files.length > 0) {
                const uploadData = new FormData();
                files.forEach(file => uploadData.append('files', file));
                await api.post(`/tickets/${ticketId}/attachments`, uploadData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            }

            navigate('/dashboard');

        } catch (error: any) {
            console.error(error);
            const msg = error.response?.data?.message || error.message || 'Failed to submit ticket';
            alert(`Error: ${msg}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Render Steps
    return (
        <div className="max-w-5xl mx-auto pb-20">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-2xl font-bold mb-6 text-gray-900">
                    {subType === 'MEDICAL' ? 'Medical Incident Report' : 'New Incident Report'}
                </h1>

                {/* Stepper */}
                <div className="flex justify-between relative px-2 md:px-4">
                    <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-200 -z-10 -translate-y-1/2 rounded" />
                    <div
                        className="absolute top-1/2 left-0 h-1 bg-emerald-600 -z-10 -translate-y-1/2 rounded transition-all duration-300"
                        style={{ width: `${(currentStep / (activeSteps.length - 1)) * 100}%` }}
                    />
                    {activeSteps.map((step, index) => {
                        const Icon = step.icon;
                        const active = index <= currentStep;
                        return (
                            <div key={step.id} className="flex flex-col items-center bg-gray-50 px-2 transition-colors">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${active ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-gray-300 text-gray-400'}`}>
                                    <Icon size={18} />
                                </div>
                                <span className={`text-xs mt-2 font-medium ${active ? 'text-emerald-600' : 'text-gray-400'}`}>{step.title}</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Content Card */}
            <div className="bg-white rounded-xl shadow-lg p-4 md:p-8 min-h-[500px]">

                {/* STEP 0: EVENT INFO */}
                {currentStep === 0 && (
                    <div className="space-y-6 max-w-2xl mx-auto">
                        <h2 className="text-xl font-bold mb-4">Event Information</h2>
                        <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl mb-6 text-sm text-emerald-800">
                            Please provide the event details and your post assignment.
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Event Name</label>
                                <select
                                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-emerald-500"
                                    value={formData.eventName}
                                    onChange={e => updateField('eventName', e.target.value)}
                                >
                                    <option value="">Select Event</option>
                                    {events.map(e => (
                                        <option key={e.id} value={e.name}>{e.name}</option>
                                    ))}
                                </select>

                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Venue</label>
                                <input
                                    type="text"
                                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-emerald-500"
                                    value={formData.venue}
                                    onChange={e => updateField('venue', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Date & Time</label>
                                <input
                                    type="datetime-local"
                                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-emerald-500"
                                    value={formData.dateTime}
                                    onChange={e => updateField('dateTime', e.target.value)}
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Post Number</label>
                                <input
                                    type="text"
                                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-emerald-500"
                                    placeholder="e.g. 14.2"
                                    value={formData.postNumber}
                                    onChange={e => updateField('postNumber', e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* --- COMMON: TYPE SELECTION --- */}
                {(activeSteps[currentStep].id === 'type') && (
                    <div className="space-y-8 max-w-3xl mx-auto">
                        <h2 className="text-xl font-bold text-center">
                            {!eventCategory ? 'Select Event Category' : 'Select Report Type'}
                        </h2>
                        {/* Category Selector */}
                        {!eventCategory ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                                <button onClick={() => handleSelectCategory('TRACK')} className="p-8 border-2 border-gray-200 rounded-2xl hover:border-red-500 hover:bg-red-50 transition-all text-center group">
                                    <div className="bg-red-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-red-600 group-hover:scale-110 transition-transform"><Flag size={36} /></div>
                                    <h3 className="text-2xl font-bold text-gray-900">Track Event</h3>
                                </button>
                                <button onClick={() => handleSelectCategory('OTHER')} className="p-8 border-2 border-gray-200 rounded-2xl hover:border-emerald-500 hover:bg-emerald-50 transition-all text-center group">
                                    <div className="bg-emerald-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-emerald-600 group-hover:scale-110 transition-transform"><Layers size={36} /></div>
                                    <h3 className="text-2xl font-bold text-gray-900">Other Event</h3>
                                </button>
                            </div>
                        ) : (
                            <div className="animate-fade-in-up">
                                <div className="flex items-center gap-2 mb-6 cursor-pointer text-gray-500 hover:text-gray-900" onClick={() => { setEventCategory(''); setSelectedType(''); }}>
                                    <ArrowLeft size={16} /> <span>Change Category ({eventCategory})</span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div onClick={() => handleSelectType('SAFETY', 'INCIDENT')} className={`p-6 border-2 rounded-xl cursor-pointer hover:border-red-500 ${selectedType === 'SAFETY' ? 'border-red-500 bg-red-50' : 'border-gray-200'}`}>
                                        <h4 className="font-bold">Incident Report</h4>
                                    </div>
                                    <div onClick={() => handleSelectType('SPORT', 'PIT_GRID')} className={`p-6 border-2 rounded-xl cursor-pointer hover:border-emerald-500 ${selectedType === 'SPORT' ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200'}`}>
                                        <h4 className="font-bold">Pit/Grid Report</h4>
                                    </div>
                                    {isMedicalRole && (
                                        <div onClick={() => handleSelectType('MEDICAL', 'MEDICAL')} className={`p-6 border-2 rounded-xl cursor-pointer hover:border-green-500 ${selectedType === 'MEDICAL' ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}>
                                            <h4 className="font-bold">Medical Report</h4>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* --- MEDICAL: STEP 1 - PATIENT & EVENT --- */}
                {subType === 'MEDICAL' && activeSteps[currentStep].id === 'patient' && (
                    <div className="space-y-8 max-w-4xl mx-auto">
                        {/* Section 1: Header */}
                        <section className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                            <h3 className="font-bold text-gray-900 mb-4 border-b pb-2">1. Driver / Incident Header</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase">Driver's Name</label>
                                    <input className="w-full border p-2 rounded" value={medicalData.headerDriverName} onChange={e => updateMedical('headerDriverName', e.target.value)} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase">Date</label>
                                    <input type="date" className="w-full border p-2 rounded" value={formData.dateTime.slice(0, 10)} readOnly />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase">POST #</label>
                                    <input type="number" step="0.1" className="w-full border p-2 rounded" value={formData.postNumber} onChange={e => updateField('postNumber', e.target.value)} placeholder="e.g. 14.2" />
                                </div>
                            </div>
                        </section>

                        {/* Section 2: Injured Person */}
                        <section className="space-y-4">
                            <h3 className="font-bold text-gray-900 border-b pb-2">2. Injured Person Details</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <input className="border p-2 rounded" placeholder="Surname" value={medicalData.patientSurname} onChange={e => updateMedical('patientSurname', e.target.value)} />
                                <input className="border p-2 rounded" placeholder="Given Name(s)" value={medicalData.patientGivenName} onChange={e => updateMedical('patientGivenName', e.target.value)} />
                                <div className="grid grid-cols-2 gap-2">
                                    <input type="date" className="border p-2 rounded" placeholder="Date of Birth" value={medicalData.patientDob} onChange={e => updateMedical('patientDob', e.target.value)} />
                                    <select className="border p-2 rounded" value={medicalData.patientGender} onChange={e => updateMedical('patientGender', e.target.value)}>
                                        <option value="">Gender</option>
                                        <option value="MALE">Male</option>
                                        <option value="FEMALE">Female</option>
                                    </select>
                                </div>
                                <input className="border p-2 rounded" placeholder="Address" value={medicalData.patientAddress} onChange={e => updateMedical('patientAddress', e.target.value)} />
                                <div className="grid grid-cols-3 gap-2">
                                    <input className="border p-2 rounded" placeholder="Suburb" value={medicalData.patientSuburb} onChange={e => updateMedical('patientSuburb', e.target.value)} />
                                    <input className="border p-2 rounded" placeholder="State" value={medicalData.patientState} onChange={e => updateMedical('patientState', e.target.value)} />
                                    <input className="border p-2 rounded" placeholder="Postcode" value={medicalData.patientPostcode} onChange={e => updateMedical('patientPostcode', e.target.value)} />
                                </div>
                                <input className="border p-2 rounded" placeholder="Email" value={medicalData.patientEmail} onChange={e => updateMedical('patientEmail', e.target.value)} />
                                <div className="grid grid-cols-2 gap-2">
                                    <input className="border p-2 rounded" placeholder="Mobile" value={medicalData.patientMobile} onChange={e => updateMedical('patientMobile', e.target.value)} />
                                    <input className="border p-2 rounded" placeholder="Phone" value={medicalData.patientPhone} onChange={e => updateMedical('patientPhone', e.target.value)} />
                                </div>
                                <input className="border p-2 rounded" placeholder="Occupation" value={medicalData.patientOccupation} onChange={e => updateMedical('patientOccupation', e.target.value)} />
                                <div className="grid grid-cols-2 gap-2">
                                    <input className="border p-2 rounded" placeholder="Motorsport License ID" value={medicalData.motorsportId} onChange={e => updateMedical('motorsportId', e.target.value)} />
                                    <input className="border p-2 rounded" placeholder="Car Number" value={medicalData.patientCarNo} onChange={e => updateMedical('patientCarNo', e.target.value)} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Role at Event</label>
                                <div className="flex flex-wrap gap-2">
                                    {['DRIVER', 'CO_DRIVER', 'OFFICIAL', 'PIT_CREW', 'SPECTATOR', 'OTHER'].map(role => (
                                        <button
                                            key={role}
                                            className={`px-3 py-1 rounded-full text-sm border ${medicalData.patientRole === role ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-600 border-gray-300'}`}
                                            onClick={() => updateMedical('patientRole', role)}
                                        >
                                            {role.replace('_', ' ')}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </section>

                        {/* Section 3: Event Details */}
                        <section className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                            <h3 className="font-bold text-gray-900 mb-4 border-b pb-2">3. Event Details</h3>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div><span className="text-gray-500">Venue:</span> <span className="font-medium">{formData.venue}</span></div>
                                <div><span className="text-gray-500">Event:</span> <span className="font-medium">{formData.eventName}</span></div>
                                <div><span className="text-gray-500">Date:</span> <span className="font-medium">{formData.dateTime.slice(0, 10)}</span></div>
                                <div><span className="text-gray-500">Time:</span> <input type="time" className="ml-2 border rounded p-1" value={medicalData.incidentTime} onChange={e => updateMedical('incidentTime', e.target.value)} /></div>
                                <div className="col-span-2 flex items-center gap-2">
                                    <span className="text-gray-500">Permit Number:</span>
                                    <input className="flex-1 border p-1 rounded" placeholder="Permit #" value={medicalData.permitNumber} onChange={e => updateMedical('permitNumber', e.target.value)} />
                                </div>
                            </div>
                        </section>

                        {/* Section 4: License */}
                        <section>
                            <h3 className="font-bold text-gray-900 mb-2">4. Competitor's License Recommendation</h3>
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                                    <input type="radio" name="license" checked={medicalData.licenseAction === 'SUSPENDED'} onChange={() => updateMedical('licenseAction', 'SUSPENDED')} />
                                    <span>Should be <strong>suspended</strong> pending further examination</span>
                                </label>
                                <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                                    <input type="radio" name="license" checked={medicalData.licenseAction === 'NOT_SUSPENDED'} onChange={() => updateMedical('licenseAction', 'NOT_SUSPENDED')} />
                                    <span>Should <strong>NOT</strong> be suspended</span>
                                </label>
                            </div>
                        </section>
                    </div>
                )}

                {/* --- MEDICAL: STEP 2 - CLINICAL --- */}
                {subType === 'MEDICAL' && activeSteps[currentStep].id === 'clinical' && (
                    <div className="space-y-8 max-w-4xl mx-auto">
                        {/* Section 5: Injury & Incident */}
                        <section className="space-y-4">
                            <h3 className="font-bold text-gray-900 border-b pb-2">5. Injury & Incident Details</h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-gray-700 font-bold mb-2">Injury Type</label>
                                    <div className="flex gap-4">
                                        <label className="flex items-center gap-2"><input type="radio" name="injury" checked={medicalData.injuryType === 'PERSONAL_INJURY'} onChange={() => updateMedical('injuryType', 'PERSONAL_INJURY')} /> Personal Injury</label>
                                        <label className="flex items-center gap-2"><input type="radio" name="injury" checked={medicalData.injuryType === 'NO_PERSONAL_INJURY'} onChange={() => updateMedical('injuryType', 'NO_PERSONAL_INJURY')} /> No Personal Injury</label>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-gray-700 font-bold mb-2">Arrival Method</label>
                                    <select className="w-full border p-2 rounded" value={medicalData.arrivalMethod} onChange={e => updateMedical('arrivalMethod', e.target.value)}>
                                        <option value="">Select Method...</option>
                                        <option value="FOOT">On Foot</option>
                                        <option value="AMBULANCE">Ambulance</option>
                                        <option value="NON_MEDICAL_VEHICLE">Non-Medical Vehicle</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-gray-700 font-bold mb-2">Treatment Location</label>
                                <div className="flex gap-4 flex-wrap">
                                    <label className="flex items-center gap-2"><input type="radio" name="loc" checked={medicalData.treatmentLocation === 'COLLISION_SCENE'} onChange={() => updateMedical('treatmentLocation', 'COLLISION_SCENE')} /> Collision Scene</label>
                                    <label className="flex items-center gap-2"><input type="radio" name="loc" checked={medicalData.treatmentLocation === 'MEDICAL_CENTRE'} onChange={() => updateMedical('treatmentLocation', 'MEDICAL_CENTRE')} /> Medical Centre</label>
                                    <label className="flex items-center gap-2"><input type="radio" name="loc" checked={medicalData.treatmentLocation === 'OTHER'} onChange={() => updateMedical('treatmentLocation', 'OTHER')} /> Other</label>
                                </div>
                                {medicalData.treatmentLocation === 'OTHER' && (
                                    <input className="mt-2 w-full border p-2 rounded" placeholder="Specify location" value={medicalData.treatmentLocationDetail} onChange={e => updateMedical('treatmentLocationDetail', e.target.value)} />
                                )}
                            </div>

                            <div>
                                <label className="block text-gray-700 font-bold mb-2">Description of Collision & Circumstances</label>
                                <textarea className="w-full border p-3 rounded h-32" value={medicalData.incidentDescription} onChange={e => updateMedical('incidentDescription', e.target.value)} />
                            </div>
                        </section>

                        {/* Section 6: Statement */}
                        <section className="space-y-4">
                            <h3 className="font-bold text-gray-900 border-b pb-2">6. Statement by Medical Personnel</h3>

                            <div>
                                <label className="block text-sm font-bold text-gray-700">Where Seen</label>
                                <input className="w-full border p-2 rounded" value={medicalData.whereSeen} onChange={e => updateMedical('whereSeen', e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700">Condition on Initial Presentation</label>
                                <textarea className="w-full border p-2 rounded h-24" value={medicalData.initialCondition} onChange={e => updateMedical('initialCondition', e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700">Treatment Performed</label>
                                <textarea className="w-full border p-2 rounded h-24" value={medicalData.treatmentGiven} onChange={e => updateMedical('treatmentGiven', e.target.value)} />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Subsequent Treatment Recommended</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {['HOME_REST', 'OWN_DOCTOR', 'HOSPITAL', 'URGENT', 'NON_URGENT', 'OTHER'].map(opt => (
                                        <label key={opt} className="flex items-center gap-2 border p-2 rounded cursor-pointer hover:bg-gray-50">
                                            <input type="checkbox" checked={medicalData.subsequentTreatment.includes(opt)} onChange={() => toggleSubsequentTreatment(opt)} />
                                            {opt.replace('_', ' ')}
                                        </label>
                                    ))}
                                </div>
                                {medicalData.subsequentTreatment.includes('OTHER') && (
                                    <input className="mt-2 w-full border p-2 rounded" placeholder="Specify other" value={medicalData.subsequentDetail} onChange={e => updateMedical('subsequentDetail', e.target.value)} />
                                )}
                            </div>
                        </section>

                        {/* Section 7: Medical Personnel */}
                        <section className="bg-emerald-50 p-4 rounded-xl">
                            <h3 className="font-bold text-emerald-900 mb-2">7. Medical Personnel Information</h3>
                            <div>
                                <label className="block text-xs font-bold text-emerald-700 uppercase">Name of Medical Personnel</label>
                                <input className="w-full border border-emerald-200 bg-white p-2 rounded" value={medicalData.medicalPersonnelName} readOnly />
                            </div>
                        </section>
                    </div>
                )}

                {/* --- NON-MEDICAL FLOW --- */}
                {subType !== 'MEDICAL' && activeSteps[currentStep].id === 'details' && (
                    <div className="space-y-6 max-w-3xl mx-auto">
                        <div className="flex items-center gap-4 mb-6">
                            <span className="px-3 py-1 bg-gray-100 rounded-full text-xs font-bold text-gray-600">{eventCategory}</span>
                            <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold">{subType.replace('_', ' ')}</span>
                        </div>

                        {eventCategory === 'OTHER' && (
                            /* Incident Subject */
                            <div className="bg-white p-4 rounded-xl border border-gray-200">
                                <h3 className="font-bold text-gray-900 mb-4 border-b pb-2">1. Incident Subject</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Car Number (Concerned)</label>
                                        <input className="w-full border p-2 rounded" placeholder="e.g. 44" value={formData.carNumber} onChange={e => updateField('carNumber', e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Time</label>
                                        <input type="time" className="w-full border p-2 rounded" value={formData.dateTime.slice(11, 16)} onChange={e => {
                                            // Update Time part of dateTime
                                            const datePart = formData.dateTime.slice(0, 10);
                                            updateField('dateTime', `${datePart}T${e.target.value}`);
                                        }} />
                                    </div>
                                </div>
                            </div>

                        )}
                        {eventCategory === 'TRACK' && (
                            <div className="bg-white p-4 rounded-xl border border-gray-200 mb-6">
                                <h3 className="font-bold text-gray-900 mb-4 border-b pb-2">1. Report Header Information</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Official Name</label>
                                        <input className="w-full border p-2 rounded bg-gray-100" value={formData.reporterName || user?.name || ''} readOnly />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Date & Time</label>
                                        <input className="w-full border p-2 rounded bg-gray-100" value={formData.dateTime.replace('T', ' ')} readOnly />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Sector / Post</label>
                                        <input className="w-full border p-2 rounded" value={formData.postNumber} onChange={e => updateField('postNumber', e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Location (Flag Point)</label>
                                        <input className="w-full border p-2 rounded" value={formData.location} onChange={e => updateField('location', e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Vehicle No(s)</label>
                                        <input className="w-full border p-2 rounded" placeholder="e.g. 44, 16" value={formData.carNumber} onChange={e => updateField('carNumber', e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Lap No.</label>
                                        <input className="w-full border p-2 rounded" value={formData.lapNumber} onChange={e => updateField('lapNumber', e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Session</label>
                                        <select className="w-full border p-2 rounded" value={formData.sessionCategory} onChange={e => updateField('sessionCategory', e.target.value)}>
                                            <option>Practice</option><option>Qualifying</option><option>Race</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Event</label>
                                        <input className="w-full border p-2 rounded bg-gray-100" value={formData.eventName} readOnly />
                                    </div>
                                </div>
                            </div>
                        )}
                        {eventCategory !== 'TRACK' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                                    <input type="text" placeholder="Sector / Turn" className="w-full border border-gray-300 rounded-lg p-3" value={formData.location} onChange={e => updateField('location', e.target.value)} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                                    <select className="w-full border border-gray-300 rounded-lg p-3" value={formData.priority} onChange={e => updateField('priority', e.target.value)}>
                                        <option value="LOW">Low</option>
                                        <option value="MEDIUM">Medium</option>
                                        <option value="HIGH">High</option>
                                        <option value="CRITICAL">Critical</option>
                                    </select>
                                </div>
                            </div>
                        )}

                        {/* Pit/Grid Specifics */}
                        {subType === 'PIT_GRID' && (
                            <div className="space-y-6 bg-emerald-50 p-6 rounded-xl border border-emerald-100">
                                <h3 className="font-bold text-emerald-900 border-b border-emerald-200 pb-2">Pit & Grid Details</h3>

                                {/* 1) Pit Selection */}
                                <div>
                                    <label className="block text-sm font-medium text-emerald-900 mb-2">Pit In Use</label>
                                    <div className="flex gap-4">
                                        {['Pit 1', 'Pit 2', 'Pit 3', 'Pit 4'].map(pit => (
                                            <label key={pit} className="flex items-center gap-2 cursor-pointer bg-white px-3 py-2 rounded border border-emerald-200 hover:border-emerald-400">
                                                <input
                                                    type="radio"
                                                    name="pitSelect"
                                                    checked={formData.pitNumber === pit}
                                                    onChange={() => updateField('pitNumber', pit)}
                                                    className="text-emerald-600 focus:ring-emerald-500"
                                                />
                                                <span className="text-sm font-medium text-gray-700">{pit}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {/* 2) Report Header Extra Info */}
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-emerald-700 uppercase mb-1">Session</label>
                                        <select className="w-full border border-emerald-200 rounded-lg p-2" value={formData.sessionCategory} onChange={e => updateField('sessionCategory', e.target.value)}>
                                            <option>Practice</option><option>Qualifying</option><option>Race</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-emerald-700 uppercase mb-1">Vehicle No</label>
                                        <input type="text" className="w-full border border-emerald-200 rounded-lg p-2" value={formData.carNumber} onChange={e => updateField('carNumber', e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-emerald-700 uppercase mb-1">Lap No</label>
                                        <input type="number" className="w-full border border-emerald-200 rounded-lg p-2" value={formData.lapNumber} onChange={e => updateField('lapNumber', e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-emerald-700 uppercase mb-1">Team Name</label>
                                        <input type="text" className="w-full border border-emerald-200 rounded-lg p-2" value={formData.teamName} onChange={e => updateField('teamName', e.target.value)} />
                                    </div>
                                </div>

                                {/* 3) Pit Lane Speed */}
                                <div className="bg-white p-4 rounded-lg border border-emerald-200">
                                    <h4 className="text-sm font-bold text-emerald-900 mb-3 block">Pit Lane Speed</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">Speed Limit</label>
                                            <input type="text" placeholder="e.g. 80 km/h" className="w-full border border-gray-200 rounded bg-gray-50 p-2" value={formData.speedLimit} onChange={e => updateField('speedLimit', e.target.value)} />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">Recorded Speed</label>
                                            <input type="text" placeholder="e.g. 85 km/h" className="w-full border border-red-200 rounded bg-red-50 p-2 text-red-900 font-bold" value={formData.speedRecorded} onChange={e => updateField('speedRecorded', e.target.value)} />
                                        </div>
                                    </div>
                                </div>

                                {/* 4) Radar Operator */}
                                <div className="bg-white p-4 rounded-lg border border-emerald-200">
                                    <h4 className="text-sm font-bold text-emerald-900 mb-3 block">Radar Operator</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">Operator Name</label>
                                            <input type="text" className="w-full border border-gray-200 rounded p-2" value={formData.radarOperatorName} onChange={e => updateField('radarOperatorName', e.target.value)} />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">Operator Phone</label>
                                            <input type="text" className="w-full border border-gray-200 rounded p-2" value={formData.radarOperatorPhone} onChange={e => updateField('radarOperatorPhone', e.target.value)} />
                                        </div>
                                    </div>
                                </div>

                                {/* 5) Required Checks */}
                                <div>
                                    <label className="block text-sm font-medium text-emerald-900 mb-2">Violation Checks</label>
                                    <div className="space-y-2">
                                        {[
                                            { key: 'drivingOnWhiteLine', label: 'Driving on white line after pit exit' },
                                            { key: 'refueling', label: 'Refueling Violation' },
                                            { key: 'driverChange', label: 'Driver Change Violation' },
                                            { key: 'excessMechanics', label: 'Mechanic Quantity (>2)' }
                                        ].map(check => (
                                            <label key={check.key} className="flex items-center gap-3 p-2 border rounded-lg bg-white hover:bg-gray-50 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={(formData as any)[check.key] || false}
                                                    onChange={e => updateField(check.key, e.target.checked)}
                                                    className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
                                                />
                                                <span className="text-sm text-gray-700">{check.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {/* 7) Remarks */}
                                <div>
                                    <label className="block text-sm font-medium text-emerald-900 mb-1">Remarks / Recommendations</label>
                                    <textarea rows={3} className="w-full border border-emerald-200 rounded-lg p-2" value={formData.pitRemarks} onChange={e => updateField('pitRemarks', e.target.value)} />
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                            <textarea rows={4} className="w-full border border-gray-300 rounded-lg p-3" value={formData.description} onChange={e => updateField('description', e.target.value)} />
                        </div>
                        {eventCategory === 'TRACK' && (
                            <div className="mt-6">
                                <label className="block text-sm font-medium text-gray-700 mb-1">4. Signature of Official Submitting</label>
                                <input className="w-full border p-2 rounded border-emerald-300 bg-emerald-50" placeholder="Type your name to sign" value={formData.reporterSignature} onChange={e => updateField('reporterSignature', e.target.value)} />
                            </div>

                        )}
                        {eventCategory === 'OTHER' && (
                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 mt-6">
                                <h3 className="font-bold text-gray-900 mb-4 border-b pb-2">3. Reporter Information</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Reporter Name</label>
                                        <input className="w-full border p-2 rounded bg-gray-100" value={formData.reporterName} readOnly={!!user} onChange={e => updateField('reporterName', e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Mobile Number</label>
                                        <input className="w-full border p-2 rounded bg-gray-100" value={formData.reporterMobile} readOnly={!!user && !!user.mobile} onChange={e => updateField('reporterMobile', e.target.value)} />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700">Signature (Type Name) <span className="text-red-500">*</span></label>
                                        <input className="w-full border p-2 rounded border-emerald-300 bg-emerald-50" placeholder="Type your name to sign" value={formData.reporterSignature} onChange={e => updateField('reporterSignature', e.target.value)} />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )
                }

                {/* General Witnesses Step (Only for Non-Medical) */}
                {
                    subType !== 'MEDICAL' && activeSteps[currentStep].id === 'witnesses' && (
                        <div className="max-w-2xl mx-auto space-y-6">
                            <h3 className="text-xl font-bold">Witnesses</h3>
                            {formData.witnesses.map((w, i) => (
                                <div key={i} className="bg-gray-50 p-4 rounded space-y-2">
                                    <input className="w-full border p-2" placeholder="Name" value={w.name} onChange={e => { const n = [...formData.witnesses]; n[i].name = e.target.value; updateField('witnesses', n); }} />
                                    <input className="w-full border p-2" placeholder="Contact" value={w.contact} onChange={e => { const n = [...formData.witnesses]; n[i].contact = e.target.value; updateField('witnesses', n); }} />
                                </div>
                            ))}
                            <button onClick={() => updateField('witnesses', [...formData.witnesses, { name: '', contact: '', location: '' }])} className="w-full py-3 border-2 border-dashed rounded font-bold text-gray-400">+ Add Witness</button>
                        </div>
                    )
                }

                {/* --- EVIDENCE (Common) --- */}
                {
                    activeSteps[currentStep].id === 'evidence' && (
                        <div className="max-w-2xl mx-auto text-center py-12">
                            <div className="border-2 border-dashed border-gray-300 rounded-2xl p-12 bg-gray-50 flex flex-col items-center justify-center">
                                <Camera size={48} className="text-emerald-500 mb-4" />
                                <h3 className="text-lg font-bold text-gray-900">Upload Evidence</h3>
                                <input type="file" id="file-upload" className="hidden" multiple accept="image/*,video/*" onChange={e => e.target.files && setFiles(Array.from(e.target.files))} />
                                <label htmlFor="file-upload" className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold cursor-pointer hover:bg-emerald-700 transition">Browse Files</label>
                                {files.length > 0 && <div className="mt-8 text-sm text-gray-600">{files.length} files selected</div>}
                            </div>
                            {subType === 'MEDICAL' && <p className="mt-4 text-sm text-gray-500">Section 8: Upload photos/files related to the incident</p>}
                        </div>
                    )
                }

                {/* --- REVIEW (Common) --- */}
                {
                    activeSteps[currentStep].id === 'review' && (
                        <div className="max-w-2xl mx-auto space-y-8">
                            <div className="bg-green-50 border border-green-200 p-6 rounded-2xl flex items-center gap-4">
                                <CheckCircle size={32} className="text-green-600" />
                                <div>
                                    <h3 className="text-lg font-bold text-green-900">Ready to Submit</h3>
                                    <p className="text-green-700">Please review the details below before submitting.</p>
                                </div>
                            </div>

                            {/* --- MEDICAL SUMMARY --- */}
                            {subType === 'MEDICAL' && (
                                <div className="space-y-6">
                                    {/* Patient / Sections 1 & 2 */}
                                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm relative overflow-hidden">
                                        <div className="absolute top-0 left-0 w-2 h-full bg-emerald-500"></div>
                                        <h4 className="font-bold text-gray-800 mb-4 border-b pb-2 flex items-center gap-2">
                                            <User size={18} className="text-emerald-500" /> Patient & License Info
                                        </h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 text-sm">
                                            <div><span className="text-gray-500 text-xs uppercase tracking-wider">Patient Name</span> <div className="font-medium text-gray-900">{medicalData.patientGivenName} {medicalData.patientSurname}</div></div>
                                            <div><span className="text-gray-500 text-xs uppercase tracking-wider">DOB / Gender</span> <div className="font-medium text-gray-900">{medicalData.patientDob} ({medicalData.patientGender})</div></div>
                                            <div><span className="text-gray-500 text-xs uppercase tracking-wider">Role</span> <div className="font-medium text-gray-900">{medicalData.patientRole?.replace('_', ' ')}</div></div>
                                            <div><span className="text-gray-500 text-xs uppercase tracking-wider">Competitor No</span> <div className="font-medium text-gray-900">{medicalData.patientCarNo || '-'}</div></div>
                                            <div><span className="text-gray-500 text-xs uppercase tracking-wider">Motorsport ID</span> <div className="font-medium text-gray-900">{medicalData.motorsportId || '-'}</div></div>
                                            <div><span className="text-gray-500 text-xs uppercase tracking-wider">License Action</span> <div className={`font-bold ${medicalData.licenseAction === 'SUSPENDED' ? 'text-red-600' : 'text-green-600'}`}>{medicalData.licenseAction?.replace('_', ' ')}</div></div>
                                        </div>
                                    </div>

                                    {/* Event / Section 3 */}
                                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm relative overflow-hidden">
                                        <div className="absolute top-0 left-0 w-2 h-full bg-gray-500"></div>
                                        <h4 className="font-bold text-gray-800 mb-4 border-b pb-2 flex items-center gap-2">
                                            <ClipboardList size={18} className="text-gray-500" /> Event Details
                                        </h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 text-sm">
                                            <div><span className="text-gray-500 text-xs uppercase tracking-wider">Event</span> <div className="font-medium text-gray-900">{formData.eventName}</div></div>
                                            <div><span className="text-gray-500 text-xs uppercase tracking-wider">Venue</span> <div className="font-medium text-gray-900">{formData.venue}</div></div>
                                            <div><span className="text-gray-500 text-xs uppercase tracking-wider">Permit No</span> <div className="font-medium text-gray-900">{medicalData.permitNumber}</div></div>
                                            <div><span className="text-gray-500 text-xs uppercase tracking-wider">Time of Incident</span> <div className="font-medium text-gray-900">{medicalData.incidentTime}</div></div>
                                        </div>
                                    </div>

                                    {/* Clinical / Sections 5 & 6 */}
                                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm relative overflow-hidden">
                                        <div className="absolute top-0 left-0 w-2 h-full bg-red-500"></div>
                                        <h4 className="font-bold text-gray-800 mb-4 border-b pb-2 flex items-center gap-2">
                                            <Activity size={18} className="text-red-500" /> Clinical Report
                                        </h4>
                                        <div className="space-y-4 text-sm">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div><span className="text-gray-500 text-xs uppercase tracking-wider">Injury Type</span> <div className="font-medium text-gray-900">{medicalData.injuryType?.replace(/_/g, ' ')}</div></div>
                                                <div><span className="text-gray-500 text-xs uppercase tracking-wider">Arrival Method</span> <div className="font-medium text-gray-900">{medicalData.arrivalMethod?.replace(/_/g, ' ')}</div></div>
                                                <div><span className="text-gray-500 text-xs uppercase tracking-wider">Treatment Loc</span> <div className="font-medium text-gray-900">{medicalData.treatmentLocation?.replace(/_/g, ' ')} {medicalData.treatmentLocationDetail ? `(${medicalData.treatmentLocationDetail})` : ''}</div></div>
                                            </div>

                                            {medicalData.incidentDescription && (
                                                <div>
                                                    <span className="text-gray-500 text-xs uppercase tracking-wider block mb-1">Description of Circumstances</span>
                                                    <div className="bg-gray-50 p-3 rounded text-gray-800 italic">{medicalData.incidentDescription}</div>
                                                </div>
                                            )}
                                            {medicalData.initialCondition && (
                                                <div>
                                                    <span className="text-gray-500 text-xs uppercase tracking-wider block mb-1">Initial Condition</span>
                                                    <div className="bg-gray-50 p-3 rounded text-gray-800 italic">{medicalData.initialCondition}</div>
                                                </div>
                                            )}
                                            {medicalData.treatmentGiven && (
                                                <div>
                                                    <span className="text-gray-500 text-xs uppercase tracking-wider block mb-1">Treatment Performed</span>
                                                    <div className="bg-gray-50 p-3 rounded text-gray-800 italic">{medicalData.treatmentGiven}</div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* --- INCIDENT / GENERAL SUMMARY --- */}
                            {subType !== 'MEDICAL' && (
                                <div className="space-y-6">
                                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm relative overflow-hidden">
                                        <div className="absolute top-0 left-0 w-2 h-full bg-emerald-500"></div>
                                        <h4 className="font-bold text-gray-800 mb-4 border-b pb-2 flex items-center gap-2">
                                            <AlertTriangle size={18} className="text-emerald-500" /> Incident Report Details
                                        </h4>
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                            <div><span className="text-gray-500 text-xs uppercase tracking-wider">Type</span> <div className="font-bold text-gray-900">{selectedType}</div></div>
                                            <div><span className="text-gray-500 text-xs uppercase tracking-wider">Sub-Type</span> <div className="font-bold text-gray-900">{subType.replace('_', ' ')}</div></div>
                                            <div><span className="text-gray-500 text-xs uppercase tracking-wider">Category</span> <div className="font-medium text-gray-900">{eventCategory}</div></div>
                                            <div><span className="text-gray-500 text-xs uppercase tracking-wider">Priority</span> <div className="font-medium text-gray-900">{formData.priority}</div></div>
                                            <div><span className="text-gray-500 text-xs uppercase tracking-wider">Location</span> <div className="font-medium text-gray-900">{formData.location}</div></div>
                                            <div><span className="text-gray-500 text-xs uppercase tracking-wider">Post Number</span> <div className="font-medium text-gray-900">{formData.postNumber || 'N/A'}</div></div>
                                        </div>

                                        {subType === 'PIT_GRID' && (
                                            <div className="mt-4 pt-4 border-t space-y-4">
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                    <div><span className="text-gray-500 text-xs uppercase tracking-wider">Pit</span> <div className="font-bold">{formData.pitNumber || '-'}</div></div>
                                                    <div><span className="text-gray-500 text-xs uppercase tracking-wider">Session</span> <div className="font-bold">{formData.sessionCategory}</div></div>
                                                    <div><span className="text-gray-500 text-xs uppercase tracking-wider">Car #</span> <div className="font-bold">{formData.carNumber}</div></div>
                                                    <div><span className="text-gray-500 text-xs uppercase tracking-wider">Lap</span> <div className="font-bold">{formData.lapNumber || '-'}</div></div>
                                                </div>

                                                {(formData.speedRecorded || formData.speedLimit) && (
                                                    <div className="bg-gray-50 p-3 rounded flex gap-6 border border-gray-100">
                                                        <div><span className="text-gray-500 text-xs uppercase tracking-wider">Speed Limit</span> <div className="font-medium">{formData.speedLimit || 'N/A'}</div></div>
                                                        <div><span className="text-gray-500 text-xs uppercase tracking-wider">Recorded</span> <div className="font-bold text-red-600">{formData.speedRecorded || 'N/A'}</div></div>
                                                    </div>
                                                )}

                                                <div>
                                                    <span className="text-gray-500 text-xs uppercase tracking-wider block mb-2">Violations / Checks</span>
                                                    <div className="flex flex-wrap gap-2">
                                                        {formData.drivingOnWhiteLine && <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-bold rounded">White Line</span>}
                                                        {formData.refueling && <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-bold rounded">Refueling</span>}
                                                        {formData.driverChange && <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-bold rounded">Driver Change</span>}
                                                        {formData.excessMechanics && <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-bold rounded">Excess Mechanics</span>}
                                                        {(!formData.drivingOnWhiteLine && !formData.refueling && !formData.driverChange && !formData.excessMechanics) && (
                                                            <span className="text-gray-400 text-sm italic">No specific violations checked</span>
                                                        )}
                                                    </div>
                                                </div>

                                                {formData.pitRemarks && (
                                                    <div>
                                                        <span className="text-gray-500 text-xs uppercase tracking-wider block mb-1">Remarks</span>
                                                        <div className="bg-yellow-50 p-3 rounded text-gray-800 border border-yellow-100">{formData.pitRemarks}</div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        <div className="mt-4 pt-4 border-t">
                                            <span className="text-gray-500 text-xs uppercase tracking-wider block mb-1">Description</span>
                                            <div className="bg-gray-50 p-3 rounded text-gray-800">{formData.description || 'No description provided.'}</div>
                                        </div>
                                    </div>

                                    {formData.witnesses.length > 0 && (
                                        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm relative overflow-hidden">
                                            <div className="absolute top-0 left-0 w-2 h-full bg-purple-500"></div>
                                            <h4 className="font-bold text-gray-800 mb-4 border-b pb-2 flex items-center gap-2">
                                                <Users size={18} className="text-purple-500" /> Witnesses
                                            </h4>
                                            <div className="space-y-2">
                                                {formData.witnesses.map((w, i) => (
                                                    <div key={i} className="flex justify-between items-center text-sm bg-gray-50 p-2 rounded">
                                                        <span className="font-medium">{w.name}</span>
                                                        <span className="text-gray-500">{w.contact}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* --- EVIDENCE SUMMARY --- */}
                            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-3 bg-emerald-50 rounded-lg text-emerald-600">
                                        <Camera size={24} />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-gray-900">Evidence Attached</h4>
                                        <p className="text-sm text-gray-500">Photos and videos uploaded</p>
                                    </div>
                                </div>
                                <span className="bg-gray-900 text-white px-4 py-2 rounded-full text-sm font-bold">
                                    {files.length} {files.length === 1 ? 'File' : 'Files'}
                                </span>
                            </div>

                            {/* --- SYSTEM AUTO FIELDS (Section 9) --- */}
                            <div className="bg-gray-100 p-6 rounded-xl border border-gray-300">
                                <h4 className="font-bold text-gray-700 mb-4 uppercase text-xs">9. System-Auto Fields</h4>
                                <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                                    <div><label className="block text-gray-400 text-xs">Marshal ID</label> {user?.marshalId || 'Auto (Backend)'}</div>
                                    <div><label className="block text-gray-400 text-xs">Marshal Name</label> {user?.name}</div>
                                    <div><label className="block text-gray-400 text-xs">Marshal Email</label> {user?.email}</div>
                                    <div><label className="block text-gray-400 text-xs">Marshal Mobile</label> {user?.mobile || 'Auto (Backend)'}</div>
                                    <div><label className="block text-gray-400 text-xs">Date</label> {new Date().toLocaleDateString()}</div>
                                </div>
                            </div>
                        </div>
                    )
                }

            </div >

            {/* Footer Actions */}
            < div className="flex justify-between mt-8 max-w-5xl mx-auto" >
                <button onClick={handleBack} disabled={currentStep === 0 || isSubmitting} className="px-8 py-3 rounded-xl border border-gray-200 font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2"><ArrowLeft size={18} /> Back</button>
                {activeSteps[currentStep].id !== 'type' && (
                    <button onClick={handleNext} disabled={isSubmitting} className="px-8 py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 disabled:bg-gray-300 shadow-lg shadow-emerald-200 transition-all flex items-center gap-2">
                        {isSubmitting ? 'Submitting...' : (currentStep === activeSteps.length - 1 ? 'Submit Report' : 'Next Step')}
                        {!isSubmitting && currentStep < activeSteps.length - 1 && <ArrowRight size={18} />}
                        {!isSubmitting && currentStep === activeSteps.length - 1 && <Send size={18} />}
                    </button>
                )}
            </div >
        </div >
    );
};

export default IncidentWizard;
