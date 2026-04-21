const fs = require('fs');
let content = fs.readFileSync('src/pages/oc/OCTicketDetail.tsx', 'utf8');

// The RCA section field blocks to reorder:
// 1. Analysis Method
// 2. Immediate Causes
// 3. Underlying Causes
// 4. Root Causes
// 5. Preventive Actions
// We want exactly this order.

// Looking at the file, the fields are wrapped in <div> tags, except immediate and preventive are wrapped in a <div className="grid grid-cols-1 gap-4">

// Instead of regex over everything, let's use exact string replacements one by one to extract and reassemble.

let originalImmediateBlock = `                                            <div>
                                                <label className="block text-xs font-semibold text-gray-700 mb-1">Immediate Causes (الأسباب المباشرة) <span className="text-red-500">*</span></label>
                                                <textarea value={immediateCauses} onChange={(e) => setImmediateCauses(e.target.value)} rows={3}
                                                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400" />
                                            </div>`;

let originalPreventiveBlock = `                                            <div>
                                                <label className="block text-xs font-semibold text-gray-700 mb-1">Preventive Actions (الإجراءات الوقائية) <span className="text-red-500">*</span></label>
                                                <textarea value={preventiveActions} onChange={(e) => setPreventiveActions(e.target.value)} rows={3}
                                                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400" />
                                            </div>`;

let originalAnalysisBlock = `                                        <div>
                                            <label className="block text-xs font-semibold text-gray-700 mb-1">{t('oc.wizard.analysisMethod', 'Analysis Method (طريقة التحليل)')} <span className="text-red-500">*</span></label>
                                            <select value={analysisMethod} onChange={(e) => setAnalysisMethod(e.target.value)}
                                                className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-purple-500/20">
                                                <option value="">{t('oc.investigation.selectMethod')}</option>
                                                <option value="Fish Bone">Fish Bone</option>
                                                <option value="Tree Analysis">Tree Analysis</option>
                                                <option value="5 Whys">5 Whys</option>
                                                <option value="Root Cause Analysis">Root Cause Analysis</option>
                                            </select>
                                        </div>`;

let originalUnderlyingBlock = `                                        <div>
                                            <label className="block text-xs font-semibold text-gray-700 mb-1">{t('oc.investigation.underlyingCauses')} <span className="text-red-500">*</span></label>
                                            <textarea value={underlyingCauses} onChange={(e) => setUnderlyingCauses(e.target.value)} rows={4}
                                                placeholder={t('oc.investigation.underlyingCausesPlaceholder')}
                                                className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 min-h-[120px] resize-y focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400" />
                                        </div>`;

let originalRootBlock = `                                        <div>
                                            <label className="block text-xs font-semibold text-gray-700 mb-1">{t('oc.investigation.rootCauses')} <span className="text-red-500">*</span></label>
                                            <textarea value={rootCauses} onChange={(e) => setRootCauses(e.target.value)} rows={4}
                                                placeholder={t('oc.investigation.rootCausesPlaceholder')}
                                                className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 min-h-[120px] resize-y focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400" />
                                        </div>`;

let originalWrapperStart = `                                        <div className="grid grid-cols-1 gap-4">`;
let originalWrapperEnd = `                                        </div>`;

// Replace all those blocks out with an empty string so they don't duplicate. We'll reconstruct them together.
content = content.replace(originalWrapperStart + '\\n' + originalImmediateBlock + '\\n' + originalPreventiveBlock + '\\n' + originalWrapperEnd, '{{RCA_FIELDS_PLACEHOLDER}}');
content = content.replace(originalAnalysisBlock, '');
content = content.replace(originalUnderlyingBlock, '');
content = content.replace(originalRootBlock, '');

// Removing any trailing blank lines left over using regex replacing new lines near the placeholder
content = content.replace(/\\n\\s*\\n\\s*\\{\\{RCA_FIELDS_PLACEHOLDER\\}\\}\\n\\s*\\n/g, '\\n{{RCA_FIELDS_PLACEHOLDER}}\\n');
content = content.replace(/\\n\\s*\\n{{RCA_FIELDS_PLACEHOLDER}}/g, '\\n{{RCA_FIELDS_PLACEHOLDER}}');
content = content.replace(/{{RCA_FIELDS_PLACEHOLDER}}\\n\\s*\\n/g, '{{RCA_FIELDS_PLACEHOLDER}}\\n');


let reorderedBlocks = 
`                                        <div className="grid grid-cols-1 gap-4">
` + originalAnalysisBlock.replace(/                                        /g, '                                            ') + `

` + originalImmediateBlock + `

` + originalUnderlyingBlock.replace(/                                        /g, '                                            ') + `

` + originalRootBlock.replace(/                                        /g, '                                            ') + `

` + originalPreventiveBlock + `
                                        </div>`;

content = content.replace('{{RCA_FIELDS_PLACEHOLDER}}', reorderedBlocks);
fs.writeFileSync('src/pages/oc/OCTicketDetail.tsx', content);

console.log("Rearranged successfully");
