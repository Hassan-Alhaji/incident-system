const fs = require('fs');

let content = fs.readFileSync('frontend/src/pages/TicketDetail.tsx', 'utf8');

// 1. Add state variable
content = content.replace(
  /const \[showCloseModal, setShowCloseModal\] = useState\(false\);/,
  "const [showCloseModal, setShowCloseModal] = useState(false);\n    const [showHrReminderModal, setShowHrReminderModal] = useState(false);"
);

// 2. Add handleInitiateClose function
const handleInitFn = `
    const handleInitiateClose = (targetType: 'FINAL_REVIEW' | 'SAFETY_MANAGER') => {
        setCloseTargetType(targetType);
        const ocSafe = ticket.offCircuitReport || {};
        const isHrPending = ocSafe.hrAssignedAt && !ocSafe.hrFilledBy;
        if (isHrPending) {
            setShowHrReminderModal(true);
        } else {
            setShowCloseModal(true);
        }
    };
`;
// Insert before formatDuration
content = content.replace(/const formatDuration =/, handleInitFn + '\n    const formatDuration =');

// 3. Update the buttons to use handleInitiateClose
content = content.replace(
  /onClick=\{\(\) => \{ setCloseTargetType\('FINAL_REVIEW'\); setShowCloseModal\(true\); \}\}/,
  "onClick={() => handleInitiateClose('FINAL_REVIEW')}"
);
content = content.replace(
  /onClick=\{\(\) => \{ setCloseTargetType\('SAFETY_MANAGER'\); setShowCloseModal\(true\); \}\}/,
  "onClick={() => handleInitiateClose('SAFETY_MANAGER')}"
);

// 4. Add the HR Reminder Modal JSX right above showCloseModal JSX
const hrReminderModal = `
        {showHrReminderModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200" dir={isRtl ? 'rtl' : 'ltr'}>
                    <div className="bg-amber-500 h-1.5 w-full" />
                    <div className="p-5">
                        <h3 className="font-black text-slate-900 text-lg mb-4 flex items-center gap-2">
                            <span className="text-amber-500 text-2xl">⚠️</span>
                            {isRtl ? 'الموارد البشرية لم تؤكد البلاغ' : 'HR Report Pending'}
                        </h3>
                        <p className="text-sm text-gray-600 mb-6 leading-relaxed">
                            {isRtl 
                                ? 'قسم الموارد البشرية لم يرسل تأكيد بلاغ التأمينات (GOSI) حتى الآن. هل ترغب في إرسال إشعار تذكير لهم، أم إغلاق التذكرة على أي حال؟' 
                                : 'HR has not sent the GOSI report confirmation yet. Do you want to notify HR to send the reporting data, or close the ticket anyway?'}
                        </p>
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={async () => {
                                    setActionLoading(true);
                                    try {
                                        await api.put(\`/tickets/\${id}/controller-action\`, { action: 'REMIND_HR' });
                                        showToast(isRtl ? 'تم إرسال تذكير للموارد البشرية' : 'HR Reminded Successfully', 'success');
                                        setShowHrReminderModal(false);
                                    } catch (err: any) {
                                        showToast(err.response?.data?.message || t('errors.generic'), 'error');
                                    } finally {
                                        setActionLoading(false);
                                    }
                                }}
                                disabled={actionLoading}
                                className="w-full px-4 py-3 text-sm font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition-all flex items-center justify-center gap-2"
                            >
                                {actionLoading ? <Loader2 size={16} className="animate-spin" /> : '🔔'}
                                {isRtl ? 'تذكير الموارد البشرية (وإبقاء التذكرة مفتوحة)' : 'Remind HR (Keep Ticket Open)'}
                            </button>
                            
                            <button
                                onClick={() => {
                                    setShowHrReminderModal(false);
                                    setControllerNotes((prev) => prev ? prev + '\\n' + (isRtl ? 'تم تنبيه الموارد البشرية بالبلاغ' : 'HR was notified about the report') : (isRtl ? 'تم تنبيه الموارد البشرية بالبلاغ' : 'HR was notified about the report'));
                                    setShowCloseModal(true);
                                }}
                                disabled={actionLoading}
                                className="w-full px-4 py-3 text-sm font-bold text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-all"
                            >
                                {isRtl ? 'تخطي وإغلاق التذكرة' : 'Skip & Close Ticket'}
                            </button>
                            
                            <button
                                onClick={() => setShowHrReminderModal(false)}
                                disabled={actionLoading}
                                className="w-full px-4 py-2 mt-2 text-xs font-bold text-gray-400 hover:text-gray-600 transition-all"
                            >
                                {isRtl ? 'إلغاء' : 'Cancel'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}
`;

content = content.replace('{showCloseModal && (', hrReminderModal + '\n        {showCloseModal && (');

fs.writeFileSync('frontend/src/pages/TicketDetail.tsx', content);
