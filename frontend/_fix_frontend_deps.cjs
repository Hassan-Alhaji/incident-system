const fs = require('fs');
let c = fs.readFileSync('src/pages/oc/OCTicketDetail.tsx', 'utf8');

// 1. Add states
c = c.replace(
    /const \[targetDepManagerId, setTargetDepManagerId\] = useState\(''\);/,
    `const [targetDepManagerId, setTargetDepManagerId] = useState('');
    const [targetDepartmentId, setTargetDepartmentId] = useState('');
    const [departments, setDepartments] = useState<any[]>([]);`
);

// 2. Fetch departments in useEffect
const fetchRegex = /api\.get\('\/users'\)\.then\(res => setRouteUsers\(res\.data\.users \|\| res\.data\)\)\.catch\(console\.error\);/;
if (c.includes("api.get('/users')")) {
    c = c.replace(fetchRegex, `api.get('/users').then(res => setRouteUsers(res.data.users || res.data)).catch(console.error);
        api.get('/departments').then(res => setDepartments(res.data)).catch(console.error);`);
} else {
    // Fallback inject in useEffect
    c = c.replace(/useEffect\(\(\) => \{/, `useEffect(() => {\n        api.get('/departments').then(res => setDepartments(res.data)).catch(console.error);`);
}

// 3. Add the Destination dropdown before the Submit buttons
const bottomButtonsRegex = /<div className="flex flex-col md:flex-row gap-3">[\s\S]*?<button onClick=\{\(\) => setConfirmAction\(\{ action: 'RETURN_REPORTER'/;
const replacementDropdown = `<div className="mt-4 mb-2">
                                                <label className="block text-xs font-semibold text-gray-700 mb-1">Route Destination (الجهة الموجه إليها) <span className="text-gray-400 font-normal ml-1">(if routing)</span></label>
                                                <select value={targetDepartmentId} onChange={(e) => setTargetDepartmentId(e.target.value)}
                                                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400">
                                                    <option value="">-- Not Routing (لن يتم التوجيه) --</option>
                                                    <option value="HSE_MANAGER">⭐ HSE Manager (مدير السلامة)</option>
                                                    {departments.map((dep: any) => (
                                                        <option key={dep.id} value={dep.id}>
                                                            🏢 {dep.name} {dep.nameAr ? \`/ \${dep.nameAr}\` : ''}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="flex flex-col md:flex-row gap-3">
                                        <button onClick={() => setConfirmAction({ action: 'RETURN_REPORTER', handler: () => handleControllerAction('RETURN_REPORTER') })}`;
c = c.replace(bottomButtonsRegex, replacementDropdown);

// 4. Update the "Route to Department" button to be disabled if `!targetDepartmentId`, and clarify its text
const routeBtnRegex = /<button onClick=\{\(\) => setConfirmAction\(\{ action: 'ROUTE_DEP_REP', handler: \(\) => handleControllerAction\('ROUTE_DEP_REP'\) \}\)\} disabled=\{actionLoading \|\| !controllerNotes\}/;
c = c.replace(routeBtnRegex, `<button onClick={() => setConfirmAction({ action: 'ROUTE_DEP_REP', handler: () => handleControllerAction('ROUTE_DEP_REP') })} disabled={actionLoading || !controllerNotes || !targetDepartmentId}`);

// Also change button text to just "Submit Route" in translations, but we'll do it right in the component to be safe since we merged "Route to HSE_MANAGER".
c = c.replace(/\{t\('oc\.actions\.routeDepRep', 'Route to Department'\)\}/, `{t('oc.actions.routeDepRep', 'Route to Destination')}`);

// 5. Provide targetDepartmentId to handleControllerAction
const putActionRegex = /action: actionParam,\s*targetId: controllerAction === 'ROUTE_TO_USER' \? targetDepManagerId : undefined,/;
c = c.replace(putActionRegex, `action: actionParam,\n                targetDepartmentId: actionParam === 'ROUTE_DEP_REP' ? targetDepartmentId : undefined,`);

// Fallback if targetId doesn't exist anymore due to our previous script!
const putActionRegex2 = /action: actionParam,\s*notes: controllerNotes,/;
c = c.replace(putActionRegex2, `action: actionParam,\n                targetDepartmentId: actionParam === 'ROUTE_DEP_REP' ? targetDepartmentId : undefined,\n                notes: controllerNotes,`);

fs.writeFileSync('src/pages/oc/OCTicketDetail.tsx', c);
console.log('Fixed OCTicketDetail layout for Departments');
