const fs = require('fs');

async function fixBackend() {
    let c = fs.readFileSync('backend/controllers/ocTicketController.js', 'utf8');

    // 1. Destructure immediateCauses and preventiveActions
    c = c.replace(
        /const \{ underlyingCauses, rootCauses, analysisMethod, investigatorSignature, targetDepManagerId, returnReason, action \} = req\.body;/,
        "const { immediateCauses, preventiveActions, underlyingCauses, rootCauses, analysisMethod, investigatorSignature, targetDepManagerId, returnReason, action } = req.body;"
    );

    // 2. Add validation for the new fields
    c = c.replace(
        /if \(!analysisMethod \|\| !rootCauses \|\| !underlyingCauses\) \{[\s\n]*return res\.status\(400\)\.json\(\{ message: 'Analysis Method, Root Causes, and Underlying Causes are strictly required\.' \}\);[\s\n]*\}/,
        "if (!immediateCauses || !preventiveActions || !analysisMethod || !rootCauses || !underlyingCauses) { return res.status(400).json({ message: 'All 5 Incident Analysis fields are strictly required.' }); }"
    );

    // 3. Update the Prisma execution to include them
    c = c.replace(
        /data: \{\s*underlyingCauses,\s*rootCauses,\s*analysisMethod,\s*investigatorSignature,/m,
        "data: {\n                    immediateCauses,\n                    preventiveActions,\n                    underlyingCauses,\n                    rootCauses,\n                    analysisMethod,\n                    investigatorSignature,"
    );

    fs.writeFileSync('backend/controllers/ocTicketController.js', c);
    console.log('Fixed Backend Investigation Logic.');
}

async function fixFrontend() {
    let c = fs.readFileSync('frontend/src/pages/oc/OCTicketDetail.tsx', 'utf8');

    // Add state variable
    c = c.replace(
        /const \[investigatorReturnReason, setInvestigatorReturnReason\] = useState\(''\);/,
        "const [investigatorReturnReason, setInvestigatorReturnReason] = useState('');\n    const [isRepResponseClear, setIsRepResponseClear] = useState<boolean | null>(null);"
    );

    // Update handleSubmitInvestigation
    c = c.replace(
        /await api\.put\(\`\/oc\/tickets\/\$\{id\}\/investigation\`\, \{\s*action: actionParam,\s*underlyingCauses,\s*rootCauses,\s*analysisMethod,\s*targetDepManagerId,\s*returnReason: investigatorReturnReason\s*\}\);/m,
        "await api.put(`/oc/tickets/\${id}/investigation`, {\n                action: actionParam,\n                immediateCauses, preventiveActions, underlyingCauses, rootCauses, analysisMethod, targetDepManagerId,\n                returnReason: investigatorReturnReason\n            });"
    );

    // Completely replace SECTION 4 content for investigatorEdit
    const oldSection4Start = `{canInvestigatorEdit ? (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-1">{t('oc.wizard.analysisMethod') || 'Analysis Method *'}</label>`;

    const newSection4Start = `{canInvestigatorEdit ? (
                                <div className="space-y-4">
                                    {ticket.status === 'DEP_REP_RESPONDED' && (
                                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                                            <h4 className="text-sm font-bold text-blue-900 mb-2 flex items-center gap-2">
                                                <ShieldAlert size={16} /> 
                                                Is the department's response clear and complete? (هل الرد/البيانات الواردة من القسم واضحة ومكتملة للبدء بالتحليل؟)
                                            </h4>
                                            <div className="flex gap-4 mt-3">
                                                <label className="flex items-center gap-2 cursor-pointer bg-white px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 flex-1">
                                                    <input type="radio" name="repClear" checked={isRepResponseClear === true} onChange={() => setIsRepResponseClear(true)} className="text-blue-600 focus:ring-blue-500" />
                                                    <span className="text-sm font-bold text-gray-700">Yes, it is clear (نعم واضحة)</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer bg-white px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 flex-1">
                                                    <input type="radio" name="repClear" checked={isRepResponseClear === false} onChange={() => setIsRepResponseClear(false)} className="text-blue-600 focus:ring-blue-500" />
                                                    <span className="text-sm font-bold text-gray-700">No, return it (لا، غير واضحة)</span>
                                                </label>
                                            </div>
                                        </div>
                                    )}

                                    {(isRepResponseClear !== false) && (
                                    <>
                                        <div className="grid grid-cols-1 gap-4">
                                            <div>
                                                <label className="block text-xs font-semibold text-gray-700 mb-1">Immediate Causes (الأسباب المباشرة) <span className="text-red-500">*</span></label>
                                                <textarea value={immediateCauses} onChange={(e) => setImmediateCauses(e.target.value)} rows={3}
                                                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400" />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-700 mb-1">{t('oc.wizard.analysisMethod') || 'Analysis Method (طريقة التحليل)'} <span className="text-red-500">*</span></label>`;

    // Now replacing the buttons area and closing the condition block
    const oldActionArea = `<div className="mt-6 pt-4 border-t border-gray-100">
                                            <h4 className="text-sm font-bold text-gray-800 mb-3">Investigation Actions (الإجراءات)</h4>
                                            
                                            <div className="bg-red-50 p-4 rounded-xl border border-red-100 mb-4">
                                                <label className="block text-xs font-semibold text-red-700 mb-2">🔙 Return to Department (إعادة للقسم) - Reason Required</label>
                                                <textarea value={investigatorReturnReason} onChange={(e) => setInvestigatorReturnReason(e.target.value)} rows={2}
                                                    placeholder="Enter reason for returning to the department rep..."
                                                    className="w-full bg-white border border-red-200 rounded-lg px-3 py-2 text-sm text-gray-900 mb-2 focus:ring-2 focus:ring-red-500/20 focus:border-red-400" />
                                                <button onClick={() => setConfirmAction({ action: 'RETURN_TO_DEPARTMENT', handler: () => handleSubmitInvestigation('RETURN_TO_DEPARTMENT') })} 
                                                    disabled={actionLoading || !investigatorReturnReason}
                                                    className="w-full bg-white border-2 border-red-200 text-red-600 font-bold py-2.5 rounded-xl text-sm transition-all hover:bg-red-50 disabled:opacity-50">
                                                    {actionLoading ? <Loader2 className="animate-spin inline mr-2" size={14} /> : null}
                                                    Return Ticket to Department Rep
                                                </button>
                                            </div>

                                            <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                                                <p className="text-xs text-amber-700 mb-3"><span className="font-bold">Note:</span> The Incident Analysis (RCA) fields above MUST be thoroughly completed before attempting to route or close the ticket below.</p>
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                                    <button onClick={() => setConfirmAction({ action: 'ROUTE_DEP_MANAGER', handler: () => handleSubmitInvestigation('ROUTE_DEP_MANAGER') })} 
                                                        disabled={actionLoading || !underlyingCauses || !rootCauses || !analysisMethod || !targetDepManagerId}
                                                        className="w-full bg-indigo-600 text-white font-bold py-2.5 rounded-xl text-sm shadow-md transition-all hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2">
                                                        {actionLoading ? <Loader2 className="animate-spin" size={14} /> : <User size={14} />} Route to Dept Manager
                                                    </button>
                                                    
                                                    <button onClick={() => setConfirmAction({ action: 'ROUTE_HSE_MANAGER', handler: () => handleSubmitInvestigation('ROUTE_HSE_MANAGER') })} 
                                                        disabled={actionLoading || !underlyingCauses || !rootCauses || !analysisMethod}
                                                        className="w-full bg-emerald-600 text-white font-bold py-2.5 rounded-xl text-sm shadow-md transition-all hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2">
                                                        {actionLoading ? <Loader2 className="animate-spin" size={14} /> : <ShieldCheck size={14} />} Route to HSE Manager
                                                    </button>
                                                    
                                                    {user?.canCloseTickets && (
                                                        <button onClick={() => setConfirmAction({ action: 'CLOSE_TICKET', handler: () => handleSubmitInvestigation('CLOSE_TICKET') })} 
                                                            disabled={actionLoading || !underlyingCauses || !rootCauses || !analysisMethod}
                                                            className="w-full bg-red-600 text-white font-bold py-2.5 rounded-xl text-sm shadow-md transition-all hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2">
                                                            {actionLoading ? <Loader2 className="animate-spin" size={14} /> : <XCircle size={14} />} Close Ticket
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>`;

    const newActionArea = `<div>
                                                <label className="block text-xs font-semibold text-gray-700 mb-1">Preventive Actions (الإجراءات الوقائية) <span className="text-red-500">*</span></label>
                                                <textarea value={preventiveActions} onChange={(e) => setPreventiveActions(e.target.value)} rows={3}
                                                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400" />
                                            </div>
                                            
                                        <div className="mt-6 pt-4 border-t border-gray-100">
                                            <h4 className="text-sm font-bold text-gray-800 mb-3">Investigation Actions (الإجراءات)</h4>
                                            
                                            <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                                                <p className="text-xs text-amber-700 mb-3"><span className="font-bold">Note:</span> The 5 Incident Analysis fields above MUST be thoroughly completed before attempting to route or close the ticket below.</p>
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                                    <button onClick={() => setConfirmAction({ action: 'ROUTE_DEP_MANAGER', handler: () => handleSubmitInvestigation('ROUTE_DEP_MANAGER') })} 
                                                        disabled={actionLoading || !immediateCauses || !preventiveActions || !underlyingCauses || !rootCauses || !analysisMethod || !targetDepManagerId}
                                                        className="w-full bg-indigo-600 text-white font-bold py-2.5 rounded-xl text-sm shadow-md transition-all hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2">
                                                        {actionLoading ? <Loader2 className="animate-spin" size={14} /> : <User size={14} />} Route to Dept Manager
                                                    </button>
                                                    
                                                    <button onClick={() => setConfirmAction({ action: 'ROUTE_HSE_MANAGER', handler: () => handleSubmitInvestigation('ROUTE_HSE_MANAGER') })} 
                                                        disabled={actionLoading || !immediateCauses || !preventiveActions || !underlyingCauses || !rootCauses || !analysisMethod}
                                                        className="w-full bg-emerald-600 text-white font-bold py-2.5 rounded-xl text-sm shadow-md transition-all hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2">
                                                        {actionLoading ? <Loader2 className="animate-spin" size={14} /> : <ShieldCheck size={14} />} Route to HSE Manager
                                                    </button>
                                                    
                                                    {(user?.canCloseTickets || user?.role === 'ADMIN') && (
                                                        <button onClick={() => setConfirmAction({ action: 'CLOSE_TICKET', handler: () => handleSubmitInvestigation('CLOSE_TICKET') })} 
                                                            disabled={actionLoading || !immediateCauses || !preventiveActions || !underlyingCauses || !rootCauses || !analysisMethod}
                                                            className="w-full bg-red-600 text-white font-bold py-2.5 rounded-xl text-sm shadow-md transition-all hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2">
                                                            {actionLoading ? <Loader2 className="animate-spin" size={14} /> : <XCircle size={14} />} Submit & Close Ticket
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                    )}

                                    {/* The Return Reason Block */}
                                    {isRepResponseClear === false && (
                                        <div className="bg-red-50 p-4 border border-red-200 rounded-xl mt-4 animate-in fade-in slide-in-from-top-2">
                                            <label className="block text-sm font-bold text-red-800 mb-2">🔙 Return to Department (إعادة للقسم) - Reason Required</label>
                                            <p className="text-xs text-red-600 mb-3">Please clarify what is missing or unclear so the department can update their response.</p>
                                            <textarea value={investigatorReturnReason} onChange={(e) => setInvestigatorReturnReason(e.target.value)} rows={3}
                                                placeholder="Enter reason for returning to the department rep..."
                                                className="w-full bg-white border border-red-200 rounded-lg px-3 py-2 text-sm text-gray-900 mb-3 shadow-inner focus:ring-2 focus:ring-red-500/20 focus:border-red-400" />
                                            <button onClick={() => setConfirmAction({ action: 'RETURN_TO_DEPARTMENT', handler: () => handleSubmitInvestigation('RETURN_TO_DEPARTMENT') })} 
                                                disabled={actionLoading || !investigatorReturnReason}
                                                className="w-full bg-white border-2 border-red-200 text-red-700 font-bold py-3 rounded-xl shadow-sm hover:shadow-md transition-all hover:bg-red-50 disabled:opacity-50 flex justify-center items-center gap-2">
                                                {actionLoading ? <Loader2 className="animate-spin inline" size={16} /> : <CornerDownRight size={16} />}
                                                Return Ticket to Department Rep
                                            </button>
                                        </div>
                                    )}

                                </div>`;

    c = c.replace(oldSection4Start, newSection4Start);
    c = c.replace(oldActionArea, newActionArea);

    // Minor fix for the label of the * required fields inside RCA
    c = c.replace(
        /<label className="block text-xs font-semibold text-gray-700 mb-1">\{t\('oc.wizard.underlyingCauses'\) \|\| 'Underlying Causes'\}<\/label>/g,
        "<label className=\"block text-xs font-semibold text-gray-700 mb-1\">{t('oc.wizard.underlyingCauses') || 'Underlying Causes (الأسباب الكامنة)'} <span className=\"text-red-500\">*</span></label>"
    );
    c = c.replace(
        /<label className="block text-xs font-semibold text-gray-700 mb-1">\{t\('oc.wizard.rootCauses'\) \|\| 'Root Causes'\}<\/label>/g,
        "<label className=\"block text-xs font-semibold text-gray-700 mb-1\">{t('oc.wizard.rootCauses') || 'Root Causes (الأسباب الجذرية)'} <span className=\"text-red-500\">*</span></label>"
    );

    fs.writeFileSync('frontend/src/pages/oc/OCTicketDetail.tsx', c);
    console.log('Fixed Frontend Investigation Logic.');
}

async function run() {
    fixBackend();
    fixFrontend();
}

run();
