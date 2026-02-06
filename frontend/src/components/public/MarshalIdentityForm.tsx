import React from 'react';

interface MarshalIdentityProps {
    marshalId: string;
    setMarshalId: (val: string) => void;
    mobile: string;
    setMobile: (val: string) => void;
    postNumber: string;
    setPostNumber: (val: string) => void;
}

const MarshalIdentityForm: React.FC<MarshalIdentityProps> = ({
    marshalId, setMarshalId, mobile, setMobile, postNumber, setPostNumber
}) => {
    return (
        <div className="space-y-4 mb-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
            <h3 className="font-semibold text-blue-800 border-b border-blue-200 pb-2 mb-3">Marshal Identity</h3>

            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Marshal ID *</label>
                    <input
                        type="text"
                        required
                        value={marshalId}
                        onChange={(e) => setMarshalId(e.target.value)}
                        className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="M-101"
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Mobile *</label>
                    <input
                        type="tel"
                        required
                        value={mobile}
                        onChange={(e) => setMobile(e.target.value)}
                        className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="05X..."
                    />
                </div>
            </div>

            <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Post / Location # *</label>
                <input
                    type="number"
                    step="0.1"
                    required
                    value={postNumber}
                    onChange={(e) => setPostNumber(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none font-mono text-lg"
                    placeholder="e.g. 12 or 12.5"
                />
            </div>
        </div>
    );
};

export default MarshalIdentityForm;
