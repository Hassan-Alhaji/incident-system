const fs = require('fs');

// 1. Update Translations
let ar = JSON.parse(fs.readFileSync('src/locales/ar.json', 'utf8'));
ar.oc.actions.returnToReporter = 'إعادة للتذكرة لمرسلها (نقص معلومات)';
fs.writeFileSync('src/locales/ar.json', JSON.stringify(ar, null, 4));

let en = JSON.parse(fs.readFileSync('src/locales/en.json', 'utf8'));
en.oc.actions.returnToReporter = 'Return to Sender (Need Info)';
fs.writeFileSync('src/locales/en.json', JSON.stringify(en, null, 4));

// 2. Update OCTicketDetail.tsx
let c = fs.readFileSync('src/pages/oc/OCTicketDetail.tsx', 'utf8');

// Modifying handleControllerAction
const handleActionOld = `const handleControllerAction = async () => {`;
const handleActionNew = `const handleControllerAction = async (actionParam: string) => {`;
c = c.replace(handleActionOld, handleActionNew);

// Modifying the put request to use actionParam
const payloadRegex = /action:\s*controllerAction,/;
c = c.replace(payloadRegex, `action: actionParam,`);

// Remove Action block layout
const actionBlockRegex = /<div className="grid grid-cols-1 md:grid-cols-2 gap-4">\s*<div>\s*<label className="block text-xs font-semibold text-gray-700 mb-2">\{t\('oc\.sections\.action'\)[^<]*<\/label>\s*<div className="flex flex-col gap-2">\s*<label className={`cursor-pointer border rounded-lg p-3 text-sm font-bold transition-all \${controllerAction === 'ROUTE_DEP_REP' \? 'bg-amber-100 border-amber-500 text-amber-800' : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'`}\}>\s*<input type="radio" className="hidden" name="controllerAction" value="ROUTE_DEP_REP" checked=\{controllerAction === 'ROUTE_DEP_REP'\} onChange=\{\(\) => setControllerAction\('ROUTE_DEP_REP'\)\} \/>\s*<span className="flex items-center gap-2"><Send size=\{16\}\/> \{t\('oc\.actions\.routeDepRep'\) \|\| 'Route to Department Representative'\}<\/span>\s*<\/label>\s*<label className={`cursor-pointer border rounded-lg p-3 text-sm font-bold transition-all \${controllerAction === 'RETURN_REPORTER' \? 'bg-red-50 border-red-500 text-red-800' : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'`}\}>\s*<input type="radio" className="hidden" name="controllerAction" value="RETURN_REPORTER" checked=\{controllerAction === 'RETURN_REPORTER'\} onChange=\{\(\) => setControllerAction\('RETURN_REPORTER'\)\} \/>\s*<span className="flex items-center gap-2"><ArrowLeft size=\{16\}\/> \{t\('oc\.actions\.returnToReporter'\) \|\| 'Return to Reporter \(Need Info\)'\}<\/span>\s*<\/label>\s*<label className={`cursor-pointer border rounded-lg p-3 text-sm font-bold transition-all \${controllerAction === 'ROUTE_HSE_MANAGER' \? 'bg-purple-50 border-purple-500 text-purple-800' : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'`}\}>\s*<input type="radio" className="hidden" name="controllerAction" value="ROUTE_HSE_MANAGER" checked=\{controllerAction === 'ROUTE_HSE_MANAGER'\} onChange=\{\(\) => setControllerAction\('ROUTE_HSE_MANAGER'\)\} \/>\s*<span className="flex items-center gap-2"><ShieldCheck size=\{16\}\/> \{t\('oc\.actions\.routeHSEManager'\) \|\| 'Escalate to HSE Manager'\}<\/span>\s*<\/label>\s*<\/div>\s*<\/div>\s*<\/div>/g;

// Safe replace: Try string splitting if regex fails because of whitespace
if (c.includes('name="controllerAction"')) {
    // Instead of regex, we can just replace everything between `<div className="grid grid-cols-1 md:grid-cols-2 gap-4">` and its closing `</div>` right before `<div>\n<label className="block text-xs font-semibold text-gray-700 mb-1">{t('oc.sections.notes')`
    const strStart = `<div className="grid grid-cols-1 md:grid-cols-2 gap-4">`;
    const strEnd = `<div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-1">{t('oc.sections.notes') || 'Notes'} *</label>`;
    
    let idxStart = c.indexOf(strStart);
    let idxEnd = c.indexOf(strEnd);
    if(idxStart !== -1 && idxEnd !== -1 && idxStart < idxEnd) {
        c = c.substring(0, idxStart) + strEnd + c.substring(idxEnd + strEnd.length);
    }
}

// Replace bottom Submit Button with two buttons
const oldButton = `<button onClick={() => setConfirmAction({ action: controllerAction, handler: handleControllerAction })} disabled={actionLoading || !controllerNotes || !controllerAction}
                                        className="w-full bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all hover:bg-amber-600 disabled:opacity-50 text-sm">
                                        {actionLoading ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle size={14} />}
                                        {t('oc.sections.submitDecision') || 'Submit Decision'}
                                    </button>`;

const newButtons = `<div className="flex flex-col md:flex-row gap-3">
                                        <button onClick={() => setConfirmAction({ action: 'RETURN_REPORTER', handler: () => handleControllerAction('RETURN_REPORTER') })} disabled={actionLoading || !controllerNotes}
                                            className="w-full md:w-1/3 bg-white border-2 border-red-200 text-red-600 font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all hover:bg-red-50 disabled:opacity-50 text-sm">
                                            {actionLoading ? <Loader2 className="animate-spin" size={14} /> : <ArrowLeft size={14} />}
                                            {t('oc.actions.returnToReporter', 'Return to Sender')}
                                        </button>
                                        <button onClick={() => setConfirmAction({ action: 'ROUTE_DEP_REP', handler: () => handleControllerAction('ROUTE_DEP_REP') })} disabled={actionLoading || !controllerNotes}
                                            className="w-full md:w-2/3 bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all hover:bg-amber-600 disabled:opacity-50 text-sm">
                                            {actionLoading ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />}
                                            {t('oc.actions.routeDepRep', 'Route to Department')}
                                        </button>
                                    </div>`;

c = c.replace(oldButton, newButtons);

fs.writeFileSync('src/pages/oc/OCTicketDetail.tsx', c);
console.log('SUCCESS');
