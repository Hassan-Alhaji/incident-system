import React, { useState } from 'react';
import axios from 'axios';
import MarshalIdentityForm from '../../components/public/MarshalIdentityForm';
import { Camera, FileText } from 'lucide-react'; // Assuming lucide-react is installed, else use standard icons

const MedicalSubmission: React.FC = () => {
    const [step, setStep] = useState(1);
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

    // Access specific
    const [patientName, setPatientName] = useState('');
    const [patientRole, setPatientRole] = useState('DRIVER');
    const [injuryType, setInjuryType] = useState('TRAUMA');
    const [conscious, setConscious] = useState('true');
    const [transportRequired, setTransportRequired] = useState(false);

    // Files
    const [files, setFiles] = useState<File[]>([]);

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
            formData.append('location', `Post ${postNumber}`);

            // Medical Specific
            formData.append('patientName', patientName);
            formData.append('patientRole', patientRole);
            formData.append('injuryType', injuryType);
            formData.append('conscious', conscious);
            formData.append('transportRequired', transportRequired.toString());

            files.forEach(file => {
                formData.append('attachments', file);
            });

            const res = await axios.post('http://localhost:3000/api/public/medical', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setSuccess(res.data.ticketId);
            setStep(3); // Success Screen
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to submit ticket');
        } finally {
            setLoading(false);
        }
    };

    if (step === 3 && success) {
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
            <h2 className="text-xl font-bold text-red-600 mb-4 flex items-center gap-2">
                <span className="bg-red-100 p-2 rounded-full">🚑</span> Medical Incident
            </h2>

            <form onSubmit={handleSubmit}>
                {/* Step 1: Identity */}
                <MarshalIdentityForm
                    marshalId={marshalId} setMarshalId={setMarshalId}
                    mobile={mobile} setMobile={setMobile}
                    postNumber={postNumber} setPostNumber={setPostNumber}
                />

                {/* Step 2: Incident Details */}
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Incident Time (Approx)</label>
                        <div className="flex gap-2">
                            <input type="date" required value={incidentDate} onChange={e => setIncidentDate(e.target.value)} className="w-1/2 p-2 border rounded" />
                            <input type="time" required value={incidentTime} onChange={e => setIncidentTime(e.target.value)} className="w-1/2 p-2 border rounded" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Consciousness</label>
                        <select value={conscious} onChange={e => setConscious(e.target.value)} className="w-full p-2 border rounded bg-white">
                            <option value="true">Conscious (Alert)</option>
                            <option value="false">Unconscious</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Role</label>
                        <select value={patientRole} onChange={e => setPatientRole(e.target.value)} className="w-full p-2 border rounded bg-white">
                            <option value="DRIVER">Driver / Rider</option>
                            <option value="MARSHAL">Marshal</option>
                            <option value="SPECTATOR">Spectator</option>
                            <option value="OFFICIAL">Official</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Description *</label>
                        <textarea
                            required
                            rows={3}
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            className="w-full p-2 border rounded"
                            placeholder="Describe what happened..."
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Photos</label>
                        <input type="file" multiple accept="image/*" onChange={handleFileChange} className="w-full p-2 border border-dashed rounded" />
                    </div>
                </div>

                {error && <div className="text-red-600 text-sm mt-4">{error}</div>}

                <button
                    type="submit"
                    disabled={loading}
                    className="mt-6 w-full bg-red-600 text-white py-3 rounded-lg font-bold text-lg hover:bg-red-700 transition"
                >
                    {loading ? 'Submitting...' : 'SUBMIT REPORT'}
                </button>
            </form>
        </div>
    );
};

export default MedicalSubmission;
