import React, { useState } from 'react';
import api from '../../utils/api';
import MarshalIdentityForm from '../../components/public/MarshalIdentityForm';

const ControlSubmission: React.FC = () => {
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

    // Control Specific
    const [competitorNumber, setCompetitorNumber] = useState('');
    const [lapNumber, setLapNumber] = useState('');
    const [violationType, setViolationType] = useState('COLLISION');

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

            // Control Specific
            formData.append('competitorNumber', competitorNumber);
            formData.append('lapNumber', lapNumber);
            formData.append('violationType', violationType);

            files.forEach(file => {
                formData.append('attachments', file);
            });

            const res = await api.post('/public/control', formData, {
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
            <h2 className="text-xl font-bold text-blue-900 mb-4 flex items-center gap-2">
                <span className="bg-blue-100 p-2 rounded-full">🏁</span> Control / Sport Incident
            </h2>

            <form onSubmit={handleSubmit}>
                <MarshalIdentityForm
                    marshalId={marshalId} setMarshalId={setMarshalId}
                    mobile={mobile} setMobile={setMobile}
                    postNumber={postNumber} setPostNumber={setPostNumber}
                />

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Incident Time</label>
                        <div className="flex gap-2">
                            <input type="date" required value={incidentDate} onChange={e => setIncidentDate(e.target.value)} className="w-1/2 p-2 border rounded" />
                            <input type="time" required value={incidentTime} onChange={e => setIncidentTime(e.target.value)} className="w-1/2 p-2 border rounded" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Car / Bike #</label>
                            <input type="text" required value={competitorNumber} onChange={e => setCompetitorNumber(e.target.value)} className="w-full p-2 border rounded font-mono text-lg" placeholder="123" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Lap #</label>
                            <input type="number" value={lapNumber} onChange={e => setLapNumber(e.target.value)} className="w-full p-2 border rounded" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Violation Type</label>
                        <select value={violationType} onChange={e => setViolationType(e.target.value)} className="w-full p-2 border rounded bg-white">
                            <option value="COLLISION">Collision</option>
                            <option value="OFF_TRACK">Off Track Advantage</option>
                            <option value="BLOCKING">Blocking / Impedance</option>
                            <option value="SPEEDING">Speeding in Pitlane</option>
                            <option value="TECHNICAL">Technical Failure</option>
                            <option value="OTHER">Other</option>
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
                    className="mt-6 w-full bg-blue-900 text-white py-3 rounded-lg font-bold text-lg hover:bg-blue-800 transition"
                >
                    {loading ? 'Submitting...' : 'SUBMIT REPORT'}
                </button>
            </form>
        </div>
    );
};

export default ControlSubmission;
