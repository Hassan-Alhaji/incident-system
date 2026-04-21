const fs = require('fs');
let c = fs.readFileSync('src/pages/oc/OCTicketDetail.tsx', 'utf8');

// 1. Modify statusOrder
c = c.replace(
    /const statusOrder = \['OPEN', 'HSE_REVIEW', 'PENDING_DEP_REP', 'UNDER_INVESTIGATION', 'ESCALATED_TO_DEP_MANAGER', 'FINAL_REVIEW', 'CLOSED', 'CLOSED_REJECTED'\];/,
    "const statusOrder = ['OPEN', 'HSE_REVIEW', 'PENDING_DEP_REP', 'DEP_REP_RESPONDED', 'UNDER_INVESTIGATION', 'ESCALATED_TO_DEP_MANAGER', 'FINAL_REVIEW', 'CLOSED', 'CLOSED_REJECTED'];"
);

// 2. Modify canInvestigatorEdit
c = c.replace(
    /const canInvestigatorEdit = isInvestigator && ticket\.status === 'UNDER_INVESTIGATION';/,
    "const canInvestigatorEdit = isInvestigator && (ticket.status === 'UNDER_INVESTIGATION' || ticket.status === 'DEP_REP_RESPONDED');"
);

// 3. Add investigatorReturnReason state
c = c.replace(
    /const \[preventiveActions, setPreventiveActions\] = useState\(''\);/,
    "const [preventiveActions, setPreventiveActions] = useState('');\n    const [investigatorReturnReason, setInvestigatorReturnReason] = useState('');"
);

// 4. Update handleSubmitInvestigation
const oldSubmitInvest = `const handleSubmitInvestigation = async () => {
        setActionLoading(true);
        setError('');
        try {
            await api.put(\`/oc/tickets/\${id}/investigation\`, {
                underlyingCauses, rootCauses, analysisMethod, targetDepManagerId
            });
            await fetchTicket();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Submission failed');
        } finally {
            setActionLoading(false);
        }
    };`;

const newSubmitInvest = `const handleSubmitInvestigation = async (actionParam: string) => {
        setActionLoading(true);
        setError('');
        try {
            await api.put(\`/oc/tickets/\${id}/investigation\`, {
                action: actionParam,
                underlyingCauses, rootCauses, analysisMethod, targetDepManagerId,
                returnReason: investigatorReturnReason
            });
            await fetchTicket();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Submission failed');
        } finally {
            setActionLoading(false);
            setConfirmAction(null);
        }
    };`;

c = c.replace(oldSubmitInvest, newSubmitInvest);

// 5. Replace Section 4 Submit Buttons
const oldButtons = `<div className="flex justify-end mt-4">
                                        <button onClick={handleSubmitInvestigation} disabled={actionLoading || !underlyingCauses || !rootCauses || !analysisMethod || !targetDepManagerId}
                                            className="bg-amber-600 text-white font-bold py-2.5 px-6 rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all hover:bg-amber-700 disabled:opacity-50 text-sm">
                                            {actionLoading ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle size={16} />}
                                            {t('oc.actions.submitAnalysis', 'Complete & Submit RCA')}
                                        </button>
                                    </div>`;

const newButtons = `<div className="mt-6 pt-4 border-t border-gray-100">
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
                                        </div>`;

c = c.replace(oldButtons, newButtons);

// 6. Update Confirm Modal Strings to include new actions simply
c = c.replace(
    /confirmAction\.action === 'RETURN_REPORTER'/,
    "['RETURN_REPORTER', 'RETURN_TO_DEPARTMENT'].includes(confirmAction.action)"
);
c = c.replace(
    /'Are you sure you want to route this ticket to the selected destination\? \(هل أنت متأكد من توجيه التذكرة للجهة المحددة؟\)'/,
    "confirmAction.action === 'CLOSE_TICKET' ? 'Are you sure you want to strictly CLOSE this ticket? (هل أنت متأكد من إغلاق التذكرة نهائياً؟)' : 'Are you sure you want to route this ticket to the selected destination? (هل أنت متأكد من توجيه التذكرة للجهة المحددة؟)'"
);


fs.writeFileSync('src/pages/oc/OCTicketDetail.tsx', c);
console.log('Fixed OCTicketDetail logic for controller analysis step');
