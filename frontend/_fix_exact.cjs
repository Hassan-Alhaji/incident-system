const fs = require('fs');

let c = fs.readFileSync('src/pages/oc/OCTicketDetail.tsx', 'utf8');

// The reason it failed earlier is because we must use exact string replacement without spaces messing it up.
// Let's replace the handleSubmitInvestigation block:
const oldSubmitBlock = 
`    const handleSubmitInvestigation = async () => {
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

const newSubmitBlock = 
`    const handleSubmitInvestigation = async (actionParam: string) => {
        setActionLoading(true);
        setError('');
        try {
            await api.put(\`/oc/tickets/\${id}/investigation\`, {
                action: actionParam,
                immediateCauses, preventiveActions, underlyingCauses, rootCauses, analysisMethod, targetDepManagerId,
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

c = c.replace(oldSubmitBlock, newSubmitBlock);


// Fix the confirmation modal block:
const oldConfirmBlock = 
`                        <p className="text-center text-gray-600 font-medium text-sm mb-4">
                            {confirmAction.action === 'ROUTE_DEP_REP' 
                                ? 'Are you sure you want to route this ticket to the selected destination? (هل أنت متأكد من توجيه التذكرة للجهة المحددة؟)'
                                : confirmAction.action === 'RETURN_REPORTER'
                                    ? 'Are you sure you want to return this ticket to the sender? (هل أنت متأكد من إعادة التذكرة للمرسل؟)'
                                    : confirmAction.action}
                        </p>`;

const newConfirmBlock = 
`                        <p className="text-center text-gray-600 font-medium text-sm mb-4">
                            {confirmAction.action === 'ROUTE_DEP_REP' 
                                ? 'Are you sure you want to route this ticket to the selected destination? (هل أنت متأكد من توجيه التذكرة للجهة المحددة؟)'
                                : confirmAction.action === 'RETURN_REPORTER'
                                    ? 'Are you sure you want to return this ticket to the sender? (هل أنت متأكد من إعادة التذكرة للمرسل؟)'
                                    : confirmAction.action === 'RETURN_TO_DEPARTMENT'
                                        ? 'Are you sure you want to return this to the department representative? (هل أنت متأكد من إعادتها لممثل القسم؟)'
                                        : confirmAction.action === 'CLOSE_TICKET'
                                            ? 'Are you sure you want to completely close this ticket? (هل أنت متأكد من إغلاق التذكرة نهائياً؟)'
                                            : \`Are you sure you want to proceed with: \${confirmAction.action}?\`}
                        </p>`;

c = c.replace(oldConfirmBlock, newConfirmBlock);

// Instead of string replacement, we can split by lines, looking for exact text to replace.
// This guarantees it works despite line endings (`\r\n` vs `\n`).

// Convert to an array of lines and apply changes!
let lines = c.split(/\r?\n/);

// Find handleSubmitInvestigation to replace properly just in case standard replacing failed above
let submitIdx = lines.findIndex(l => l.includes('const handleSubmitInvestigation = async () => {') && l.includes('setActionLoading') === false);
if (submitIdx !== -1) {
    lines.splice(submitIdx, 14, 
'    const handleSubmitInvestigation = async (actionParam: string) => {',
'        setActionLoading(true);',
'        setError(\'\');',
'        try {',
'            await api.put(`/oc/tickets/${id}/investigation`, {',
'                action: actionParam,',
'                immediateCauses, preventiveActions, underlyingCauses, rootCauses, analysisMethod, targetDepManagerId,',
'                returnReason: investigatorReturnReason',
'            });',
'            await fetchTicket();',
'        } catch (err: any) {',
'            setError(err.response?.data?.message || \'Submission failed\');',
'        } finally {',
'            setActionLoading(false);',
'            setConfirmAction(null);',
'        }',
'    };'
    );
}

// Find confirm modal
let confirmIdx = lines.findIndex(l => l.includes('? \'Are you sure you want to return this ticket to the sender? (هل أنت متأكد من إعادة التذكرة للمرسل؟)\''));
if (confirmIdx !== -1) {
    if (lines[confirmIdx + 1].includes(': confirmAction.action}')) {
        lines[confirmIdx + 1] = '                                    : [' + "'RETURN_TO_DEPARTMENT'" + ', ' + "'RETURN_REPORTER'" + '].includes(confirmAction.action) ? "Are you sure you want to return this ticket? (هل أنت متأكد من الإرجاع؟)" : confirmAction.action === "CLOSE_TICKET" ? "Are you sure you want to Close this ticket? (تأكيد الإغلاق؟)" : "Are you sure? (هل أنت متأكد؟)"';
    }
}

fs.writeFileSync('src/pages/oc/OCTicketDetail.tsx', lines.join('\n'));
console.log('Fixed exactly using arrays!');
