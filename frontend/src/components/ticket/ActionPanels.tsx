import React from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Loader2, Send, Bell } from 'lucide-react';
import { HazardIcon, HAZARD_CATEGORIES } from '../HazardIcons';
import { MagicWandButton } from '../TicketSections';

export const ControllerSubmittedPanel = ({ isController, ticket, t, isRtl, newType, setNewType, typeChangeReason, setTypeChangeReason, severityLevel, setSeverityLevel, hazardCategory, setHazardCategory, controllerNotes, setControllerNotes, rcaCause, setRcaCause, rcaWhy, setRcaWhy, rcaRootCause, setRcaRootCause, rcaCategory, setRcaCategory, rcaPreventiveActions, setRcaPreventiveActions, targetDepartmentId, setTargetDepartmentId, departments, serviceProviders, selectedServiceProviderId, setSelectedServiceProviderId, confirmThen, handleControllerAction, actionLoading, hasEmployeeInjury, oc, notifyHr, setNotifyHr }: any) => {
    const injuriesCount = (() => {
        try { return oc?.injuredPersons ? JSON.parse(oc.injuredPersons).length : 0; } catch { return 0; }
    })();
    const attachmentsCount = ticket.attachments?.length || 0;
    return (
<div className="space-y-3">
                                    {/* Quick context summary so the controller doesn't have to scroll up */}
                                    <div className="bg-gradient-to-br from-slate-50 to-blue-50/40 border border-slate-200 rounded-xl p-3 space-y-2">
                                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                                            {isRtl ? '📋 ملخص سريع' : '📋 Quick Context'}
                                        </p>
                                        <div className="flex flex-wrap gap-2 text-[11px]">
                                            <span className="bg-white border border-slate-200 rounded-full px-2 py-0.5 font-semibold text-slate-700">
                                                {isRtl ? 'النوع: ' : 'Type: '}{t(`oc.incidentTypes.${ticket.type}`, ticket.type)}
                                            </span>
                                            <span className={`rounded-full px-2 py-0.5 font-semibold border ${injuriesCount > 0 ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-white border-slate-200 text-slate-500'}`}>
                                                {isRtl ? `إصابات: ${injuriesCount}` : `Injuries: ${injuriesCount}`}
                                            </span>
                                            <span className="bg-white border border-slate-200 rounded-full px-2 py-0.5 font-semibold text-slate-700">
                                                {isRtl ? `مرفقات: ${attachmentsCount}` : `Attachments: ${attachmentsCount}`}
                                            </span>
                                            {oc?.isLateReport && (
                                                <span className="bg-amber-50 border border-amber-200 text-amber-700 rounded-full px-2 py-0.5 font-semibold">
                                                    {isRtl ? '⏰ بلاغ متأخر' : '⏰ Late Report'}
                                                </span>
                                            )}
                                        </div>
                                        {oc?.whatHappened && (
                                            <div className="mt-3 text-xs">
                                                <p className="font-semibold text-slate-600 mb-1.5">
                                                    {isRtl ? 'وصف الحادث:' : 'Incident Description:'}
                                                </p>
                                                <div className="p-2.5 bg-white border border-slate-200 rounded-lg text-slate-700 whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto shadow-sm">
                                                    {oc.whatHappened}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="p-3 bg-white border rounded-lg space-y-2">
                                        <p className="text-xs font-bold text-gray-500">{t('ticketActions.changeTypeOptional', 'Change Type (Optional)')}</p>
                                        <div className="grid grid-cols-3 gap-2">
                                            {[
                                                { value: 'OBSERVATION', labelEn: 'Observation', labelAr: 'ملاحظة', icon: '👁️', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
                                                { value: 'NEAR_MISS', labelEn: 'Near Miss', labelAr: 'حادث وشيك', icon: '🎯', color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200' },
                                                { value: 'INJURY', labelEn: 'Injury', labelAr: 'إصابة', icon: '🤕', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
                                                { value: 'HEALTH', labelEn: 'Health', labelAr: 'الصحة', icon: '⚕️', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
                                                { value: 'PROPERTY_DAMAGE', labelEn: 'Property Damage', labelAr: 'ضرر في الممتلكات', icon: '🏢', color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200' },
                                                { value: 'OTHER', labelEn: 'Other', labelAr: 'أخرى', icon: '📌', color: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-200' }
                                            ].map(type => {
                                                const isSelected = (newType || ticket.type) === type.value;
                                                const isDisabledByInjury = ticket.hasInjury === true;
                                                return (
                                                    <button
                                                        key={type.value}
                                                        type="button"
                                                        onClick={() => !isDisabledByInjury && setNewType(type.value)}
                                                        disabled={isDisabledByInjury}
                                                        className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all text-center
                                                            ${isSelected
                                                                ? `${type.border} ${type.bg} shadow-md scale-[1.02]`
                                                                : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'}
                                                            ${isDisabledByInjury ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                                    >
                                                        <span className="text-3xl mb-1">{type.icon}</span>
                                                        <span className={`text-sm font-bold leading-tight ${isSelected ? type.color : 'text-gray-600'}`}>
                                                            {isRtl ? type.labelAr : type.labelEn}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        {ticket.hasInjury && (
                                            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2 mt-2 font-medium">
                                                {isRtl ? '⚠️ لا يمكن تغيير النوع لأن التقرير يحتوي على إصابة' : '⚠️ Type cannot be changed because this report contains an injury'}
                                            </p>
                                        )}
                                        {(newType === 'OTHER') && newType !== ticket.type && <input placeholder={isRtl ? 'وصف النوع...' : 'Describe the type...'} value={typeChangeReason} onChange={e => setTypeChangeReason(e.target.value)} className="w-full mt-2 p-2 border border-gray-200 rounded-lg text-sm" />}
                                    </div>
                                    <div className="p-3 bg-white border rounded-lg space-y-2">
                                        <p className="text-xs font-bold text-gray-500">{t('ticketActions.classification', 'Classification')}</p>
                                        <div className="grid grid-cols-3 gap-2">
                                            {[
                                                { value: 'MINOR', labelEn: 'Minor', labelAr: 'بسيط', icon: '🟢', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', activeBorder: 'border-emerald-500' },
                                                { value: 'SIGNIFICANT', labelEn: 'Significant', labelAr: 'مهم', icon: '🟡', color: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-200', activeBorder: 'border-yellow-500' },
                                                { value: 'MAJOR', labelEn: 'Major', labelAr: 'جسيم', icon: '🔴', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', activeBorder: 'border-red-500' }
                                            ].map(sev => {
                                                const isSelected = severityLevel === sev.value;
                                                return (
                                                    <button
                                                        key={sev.value}
                                                        type="button"
                                                        onClick={() => setSeverityLevel(sev.value)}
                                                        className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all text-center
                                                            ${isSelected
                                                                ? `${sev.activeBorder} ${sev.bg} shadow-md scale-105`
                                                                : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'}
                                                            cursor-pointer`}
                                                    >
                                                        <span className="text-3xl mb-1">{sev.icon}</span>
                                                        <span className={`text-sm font-bold leading-tight ${isSelected ? sev.color : 'text-gray-600'}`}>
                                                            {isRtl ? sev.labelAr : sev.labelEn}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    {/* Hazard Category Grid */}
                                    <div className="p-3 bg-white border rounded-lg space-y-2">
                                        <p className="text-xs font-bold text-gray-500">{t('ticketDetail.hazardCategory', 'Hazard Category')}</p>
                                        <div className="grid grid-cols-3 gap-2">
                                            {HAZARD_CATEGORIES.map(cat => {
                                                const isSelected = hazardCategory.includes(cat.value);
                                                return (
                                                    <button
                                                        key={cat.value}
                                                        type="button"
                                                        onClick={() => setHazardCategory((prev: string[]) => prev.includes(cat.value) ? prev.filter((v: string) => v !== cat.value) : [...prev, cat.value])}
                                                        className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all text-center
                                                            ${isSelected
                                                                ? 'border-amber-500 bg-amber-50 shadow-md scale-105'
                                                                : 'border-gray-200 bg-white hover:border-amber-300 hover:bg-amber-50/50'}
                                                            cursor-pointer hover:shadow-sm`}
                                                    >
                                                        <HazardIcon category={cat.value} className="w-11 h-11 mb-1" />
                                                        <span className={`text-xs sm:text-sm font-bold leading-tight ${isSelected ? 'text-amber-700' : 'text-gray-600'}`}>
                                                            {isRtl ? cat.labelAr : cat.labelEn}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Show HR auto-routing notice if employee injured */}
                                    {hasEmployeeInjury && (
                                        <div className="bg-teal-50 border border-teal-200 rounded-xl px-3 py-2.5">
                                            <p className="text-xs text-teal-800 font-semibold flex items-center gap-1.5">
                                                <span className="text-lg">🏥</span>
                                                {t('ticketDetail.hrAutoNotice')}
                                            </p>
                                        </div>
                                    )}

                                    {/* ── RCA (Root Cause Analysis) — Required for non-Observations ── */}
                                    {(() => {
                                        const rcaRequired = (newType || ticket.type) !== 'OBSERVATION';
                                        return (
                                            <div className="bg-gradient-to-br from-amber-50 to-orange-50/40 border border-amber-200 rounded-xl p-4 space-y-3">
                                                <div className="flex items-start gap-2 pb-2 border-b border-amber-200/70">
                                                    <span className="text-lg">📋</span>
                                                    <div>
                                                        <h4 className="text-sm font-black text-amber-900">
                                                            {isRtl 
                                                                ? `تحليل السبب الجذري (RCA)${rcaRequired ? '' : ' - اختياري'}` 
                                                                : `Root Cause Analysis (RCA)${rcaRequired ? '' : ' - Optional'}`}
                                                        </h4>
                                                        <p className="text-[11px] text-amber-700 mt-0.5">
                                                            {rcaRequired 
                                                                ? (isRtl ? 'مطلوب قبل التوجيه — 10 كلمات على الأقل لكل حقل' : 'Required before routing — minimum 10 words per field')
                                                                : (isRtl ? 'اختياري لبلاغات الملاحظات — يمكنك ملؤه أو تجاوزه' : 'Optional for Observation tickets — you can fill it or skip it')}
                                                        </p>
                                                    </div>
                                                </div>
                                                {[
                                                    { num: 1, label: isRtl ? '1. الأسباب المباشرة' : '1. Immediate Causes', value: rcaCause, setter: setRcaCause, type: 'RCA_CAUSE' },
                                                    { num: 2, label: isRtl ? '2. الأسباب الكامنة (لماذا حدث؟)' : '2. Underlying Causes (Why?)', value: rcaWhy, setter: setRcaWhy, type: 'RCA_WHY' },
                                                    { num: 3, label: isRtl ? '3. السبب الجذري' : '3. Root Cause', value: rcaRootCause, setter: setRcaRootCause, type: 'RCA_ROOT_CAUSE' },
                                                    { num: 4, label: isRtl ? '4. الإجراءات التصحيحية' : '4. Corrective Actions', value: rcaCategory, setter: setRcaCategory, type: 'RCA_CORRECTIVE' },
                                                    { num: 5, label: isRtl ? '5. الإجراءات الوقائية' : '5. Preventive Actions', value: rcaPreventiveActions, setter: setRcaPreventiveActions, type: 'RCA_PREVENTIVE' },
                                                ].map(f => (
                                                    <div key={f.num} className="space-y-1">
                                                        <div className="flex items-center justify-between">
                                                            <label className="text-xs font-bold text-slate-700">
                                                                {f.label}{rcaRequired && <span className="text-red-500 ms-1">*</span>}
                                                            </label>
                                                            <MagicWandButton text={f.value} context={oc?.whatHappened || ''} type={f.type} onEnhanced={f.setter} />
                                                        </div>
                                                        <textarea
                                                            value={f.value}
                                                            onChange={e => f.setter(e.target.value)}
                                                            rows={5}
                                                            placeholder={rcaRequired 
                                                                ? (isRtl ? 'اكتب إجابتك (10 كلمات على الأقل)...' : 'Write your answer (min 10 words)...')
                                                                : (isRtl ? 'اكتب إجابتك (اختياري)...' : 'Write your answer (optional)...')}
                                                            className="w-full text-sm border border-amber-200 rounded-lg p-2 bg-white focus:ring-2 focus:ring-amber-400 focus:border-amber-400 transition-all"
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })()}

                                    <div className="p-3 bg-white border border-gray-200 rounded-xl space-y-3">
                                        <div>
                                            <p className="text-xs font-bold text-gray-500 mb-1.5">{t('ticketActions.routeToDept', 'Route to Department')}<span className="text-red-500 ms-1">*</span></p>
                                            <select id="targetDepartmentId" name="targetDepartmentId" value={targetDepartmentId} onChange={e => setTargetDepartmentId(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white"><option value="">{t('ticketActions.selectDept', 'Select Department')}</option>{departments.map((d: any) => <option key={d.id} value={d.id}>{isRtl && d.nameAr ? d.nameAr : d.name}</option>)}</select>
                                        </div>
                                        <div className="pt-2 border-t border-gray-100">
                                            <div className="flex items-center gap-1.5 mb-1.5">
                                                <p className="text-xs font-bold text-gray-500">{isRtl ? 'مزود الخدمة المستهدف' : 'Target Service Provider'}</p>
                                                <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-semibold">{isRtl ? 'اختياري' : 'Optional'}</span>
                                            </div>
                                            <select value={selectedServiceProviderId || ''} onChange={e => setSelectedServiceProviderId(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white">
                                                <option value="">{isRtl ? 'بدون مزود خدمة (N/A)' : 'No Service Provider (N/A)'}</option>
                                                {serviceProviders?.map((sp: any) => (
                                                    <option key={sp.id} value={sp.id}>{isRtl ? (sp.nameAr || sp.name) : sp.name}</option>
                                                ))}
                                            </select>
                                            <p className="text-[10px] text-slate-400 mt-1">{isRtl ? 'يمكنك تحديده الآن أو تأجيله لمرحلة الإغلاق إذا اتضح المتسبب لاحقاً.' : 'You can set it now or later at closure if the responsible party is identified later.'}</p>
                                        </div>
                                    </div>

                                    {/* Point 8: HR notification confirmation when injury exists */}
                                    {ticket.hasInjury && (
                                        <div className="bg-gradient-to-br from-red-50 to-orange-50/40 border border-red-200 rounded-xl p-4 space-y-3">
                                            <p className="text-sm font-bold text-red-800 flex items-center gap-2">
                                                🏥 {isRtl ? 'هذا البلاغ يحتوي على إصابة — هل تريد إشعار الموارد البشرية؟' : 'This report contains an injury — Notify HR?'}
                                            </p>
                                            <p className="text-xs text-red-700 opacity-80">
                                                {isRtl ? 'بعض الإصابات البسيطة قد لا تستدعي إشعار الموارد البشرية. قرارك.' : 'Some minor injuries may not require HR notification. It\'s your call.'}
                                            </p>
                                            <div className="grid grid-cols-2 gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setNotifyHr(true)}
                                                    className={`p-3 rounded-xl border-2 text-sm font-bold text-center transition-all ${notifyHr === true ? 'border-red-400 bg-red-100 text-red-800 shadow-md scale-[1.02]' : 'border-gray-200 bg-white text-gray-600 hover:border-red-300'}`}
                                                >
                                                    ✅ {isRtl ? 'نعم، أشعر HR' : 'Yes, Notify HR'}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setNotifyHr(false)}
                                                    className={`p-3 rounded-xl border-2 text-sm font-bold text-center transition-all ${notifyHr === false ? 'border-slate-400 bg-slate-100 text-slate-800 shadow-md scale-[1.02]' : 'border-gray-200 bg-white text-gray-600 hover:border-slate-300'}`}
                                                >
                                                    ❌ {isRtl ? 'لا، لا داعي' : 'No, Skip HR'}
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    <div className="border border-gray-300 rounded-lg bg-white focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all">
                                        <div className="flex items-center justify-between px-2 pt-2">
                                            <span className="text-xs font-bold text-gray-500">{isRtl ? 'ملاحظات التوجيه / سبب الإرجاع' : 'Routing Notes / Return Reason'}</span>
                                            <MagicWandButton text={controllerNotes} context={oc.whatHappened || ''} type="CONTROLLER_ASSIGN_NOTES" onEnhanced={setControllerNotes} />
                                        </div>
                                        <textarea id="controllerNotes" name="controllerNotes" placeholder={isRtl ? 'اكتب ملاحظات لتوجيه التذكرة للقسم، أو سبب إرجاعها للمبلّغ...' : 'Write notes for routing or reason for returning...'} value={controllerNotes} onChange={e => setControllerNotes(e.target.value)} className="w-full p-3 text-sm border-none focus:ring-0 outline-none resize-y bg-transparent min-h-[100px]" rows={4} />
                                    </div>

                                    {(!severityLevel || !controllerNotes.trim()) && (
                                        <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 space-y-1.5">
                                            {!severityLevel && (
                                                <p className="text-xs text-amber-800 font-semibold flex items-center gap-2">
                                                    <span className="w-4 h-4 bg-amber-400 text-white rounded-full flex items-center justify-center text-[9px] font-black flex-shrink-0">!</span>
                                                    {t('ticketDetail.classificationRequired')}
                                                </p>
                                            )}
                                            {severityLevel && !controllerNotes.trim() && (
                                                <p className="text-xs text-amber-800 font-semibold flex items-center gap-2">
                                                    <span className="w-4 h-4 bg-amber-400 text-white rounded-full flex items-center justify-center text-[9px] font-black flex-shrink-0">!</span>
                                                    {t('ticketDetail.notesRequired')}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                    <div className="grid grid-cols-2 gap-2 pt-1">
                                        <button
                                            onClick={() => confirmThen(() => handleControllerAction('RETURN_REPORTER'), isRtl ? 'إرجاع إلى المبلّغ' : 'Return to Reporter', isRtl ? `ستُرجع التذكرة للمبلّغ.\nالملاحظات: "${controllerNotes}"` : `Ticket returned to reporter.\nNotes: "${controllerNotes}"`, 'danger')}
                                            disabled={actionLoading || !controllerNotes.trim()}
                                            className="bg-red-50 border border-red-200 text-red-700 py-2.5 px-3 rounded-xl text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:bg-red-100 flex items-center justify-center gap-1.5"
                                        >
                                            {actionLoading ? <Loader2 className="animate-spin" size={14} /> : <span>↩</span>}
                                            {t('ticketActions.return', 'إرجاع')}
                                        </button>
                                        <button
                                            onClick={() => { if (!severityLevel || !targetDepartmentId || !controllerNotes.trim()) return; const deptName = departments.find(d => d.id === targetDepartmentId)?.name || targetDepartmentId; confirmThen(() => handleControllerAction('ASSIGN'), isRtl ? 'توجيه التذكرة' : 'Route Ticket', isRtl ? `سيتم التوجيه إلى "${deptName}" بتصنيف "${severityLevel}".` : `Routing to "${deptName}" with severity "${severityLevel}".`, 'primary'); }}
                                            disabled={actionLoading || !targetDepartmentId || !severityLevel || !controllerNotes.trim()}
                                            className="bg-blue-600 text-white py-2.5 px-3 rounded-xl text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:bg-blue-700 flex items-center justify-center gap-1.5"
                                        >
                                            {actionLoading ? <Loader2 className="animate-spin" size={14} /> : <span>✓</span>}
                                            {t('ticketActions.assign', 'توجيه')}
                                        </button>
                                    </div>
                                </div>
);
};


export const HrPanel = ({ isHrRep, ticket, t, isRtl, hrNotes, setHrNotes, handleHrAction, actionLoading }: any) => {
    const isSubmitted = !!ticket.offCircuitReport?.hrFilledBy;

    if (isSubmitted) {
        return (
            <div className="space-y-3 bg-teal-50 border border-teal-200 rounded-xl p-4 text-center">
                <div className="w-12 h-12 bg-teal-100 text-teal-600 rounded-full flex items-center justify-center mx-auto mb-2">
                    <Check size={24} />
                </div>
                <h4 className="font-bold text-teal-800 text-lg">{isRtl ? 'تم الإرسال بنجاح' : 'Submitted'}</h4>
                <p className="text-sm text-teal-700">{isRtl ? 'إذا كان لديك أي متطلبات إضافية، يرجى التواصل مع قسم السلامة (HSE) وتزويدهم برقم التذكرة.' : 'If you have any additional requirement please contact HSE department with ticket number.'}</p>
            </div>
        );
    }

    return (
        <div className="space-y-3 bg-teal-50 border border-teal-200 rounded-xl p-4">
            <p className="text-sm font-bold text-teal-800 text-center">🏥 {t('ticketDetail.gosiPrompt')}</p>
            
            <div className="bg-white rounded-xl border border-teal-100 p-1 mb-3">
                <textarea
                    placeholder={isRtl ? 'ملاحظات إضافية (اختياري)...' : 'Additional HR Notes (Optional)...'}
                    value={hrNotes}
                    onChange={(e) => setHrNotes(e.target.value)}
                    className="w-full bg-transparent border-none focus:ring-0 text-sm p-3 resize-y min-h-[80px] outline-none"
                />
            </div>

            <button
                onClick={handleHrAction}
                disabled={actionLoading}
                className="w-full bg-teal-600 hover:bg-teal-700 text-white p-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
                {actionLoading ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />} 
                {t('ticketDetail.submitGosi')}
            </button>
        </div>
    );
};


export const DepartmentPanel = ({ isDepRep, ticket, t, handleDepartmentAction, actionLoading }: any) => {
    return (
<div className="space-y-3 bg-white p-4 border border-slate-200 shadow-sm rounded-xl">
                                    <p className="text-xs text-slate-500 italic text-center leading-relaxed">
                                        {t('ticketDetail.completeFields')}
                                    </p>
                                    <button onClick={handleDepartmentAction} disabled={actionLoading} className="w-full bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm">
                                        {actionLoading ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />} 
                                        {t('ticketDetail.submitResponse')}
                                    </button>
                                </div>
);
};


export const ControllerFinalReviewPanel = ({ isController, ticket, t, hasRejectedPlan, controllerNotes, setControllerNotes, oc, reminderDate, setReminderDate, reminderMessage, setReminderMessage, handleFinalReview, actionLoading, confirmThen, isRtl, handleCloseRequest, hrIncomplete, handleStandaloneRemindHr }: any) => {
    return (
<div className="space-y-3">

                                    {hrIncomplete && (
                                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xl">⚠️</span>
                                                <div>
                                                    <p className="text-xs font-bold text-red-800">{isRtl ? 'بيانات GOSI غير مكتملة' : 'Incomplete GOSI Data'}</p>
                                                    <p className="text-[10px] text-red-600">{isRtl ? 'بعض الموظفين المصابين لم تكتمل بيانات GOSI لهم.' : 'Some injured employees are missing GOSI submission data.'}</p>
                                                </div>
                                            </div>
                                            <button 
                                                onClick={() => handleStandaloneRemindHr('FINAL_REVIEW')}
                                                disabled={actionLoading}
                                                className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold py-1.5 px-3 rounded shadow-sm transition-all"
                                            >
                                                {isRtl ? 'تذكير الموارد البشرية' : 'Remind HR'}
                                            </button>
                                        </div>
                                    )}

                                    <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg space-y-2">
                                        <div className="flex items-start gap-2">
                                            <Bell size={14} className="text-orange-600 mt-0.5 flex-shrink-0" />
                                            <div>
                                                <p className="text-xs font-bold text-orange-800">{t('ticketActions.setReminder', 'Set Reminder')}</p>
                                                <p className="text-[10px] text-orange-700 leading-tight mt-0.5">{isRtl ? 'يمكنك وضع تنبيه لمتابعة الإجراءات في المستقبل قبل إغلاق التذكرة.' : 'You can set a reminder to follow up in the future before closing the ticket.'}</p>
                                            </div>
                                        </div>
                                        <input type="date" min={new Date().toISOString().split('T')[0]} value={reminderDate} onChange={e => setReminderDate(e.target.value)} className="w-full p-1.5 border border-orange-200 rounded text-xs focus:ring-orange-500 focus:border-orange-500" />
                                        <input placeholder={t('ticketActions.reminderMessage', 'Reminder message...')} value={reminderMessage} onChange={e => setReminderMessage(e.target.value)} className="w-full p-1.5 border border-orange-200 rounded text-xs focus:ring-orange-500 focus:border-orange-500" />
                                        <button onClick={() => confirmThen(() => handleFinalReview('SET_REMINDER'), isRtl ? 'تعيين تنبيه' : 'Set Reminder', isRtl ? 'سيتم حفظ التنبيه وتحويل حالة التذكرة إلى PENDING_REMINDER ولن يتم إغلاقها نهائياً.' : 'A reminder will be set, changing the status to PENDING_REMINDER. The ticket will remain open.', 'warning')} disabled={actionLoading || !reminderDate || !reminderMessage} className="w-full bg-orange-500 text-white p-1.5 rounded text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-opacity hover:bg-orange-600">{t('ticketActions.setReminder', 'Set Reminder')}</button>
                                    </div>

                                    {/* Warning banner when a plan is rejected */}
                                    {hasRejectedPlan && (
                                        <div className="bg-red-50 border border-red-300 rounded-xl px-4 py-3 flex items-start gap-3">
                                            <span className="text-red-500 text-lg">⚠️</span>
                                            <p className="text-sm font-bold text-red-700">
                                                {t('ticketDetail.rejectedPlanWarning')}
                                            </p>
                                        </div>
                                    )}

                                    <div className={`grid gap-2 pt-1 ${hasRejectedPlan ? 'grid-cols-2' : 'grid-cols-2'}`}>
                                        <button
                                            onClick={() => confirmThen(() => handleFinalReview('RETURN_DEPARTMENT'), isRtl ? 'إرجاع إلى القسم' : 'Return to Department', isRtl ? `ستُرجع التذكرة إلى القسم المختص للمراجعة وإعادة الرد.\nالملاحظات: "${controllerNotes}"` : `The ticket will be returned to the department for revision and re-submission.\nNotes: "${controllerNotes}"`, 'danger')}
                                            disabled={actionLoading || !controllerNotes}
                                            className="bg-rose-50 border-2 border-rose-300 text-rose-700 p-3 rounded-xl text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:bg-rose-100 flex items-center justify-center gap-2"
                                        >
                                            {actionLoading ? <Loader2 className="animate-spin" size={16} /> : <span>↩</span>}
                                            {isRtl ? 'إرجاع للقسم' : 'Return to Dept'}
                                        </button>
                                        <button
                                            onClick={() => confirmThen(() => handleFinalReview('ESCALATE'), isRtl ? 'تصعيد التذكرة' : 'Escalate Ticket', isRtl ? 'ستُرفع التذكرة للمستوى الأعلى (Safety Manager). لا يمكن التراجع عن هذا الإجراء.' : 'The ticket will be escalated to the Safety Manager. This action cannot be undone.', 'warning')}
                                            disabled={actionLoading}
                                            className="bg-amber-500 text-white p-3 rounded-xl text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:bg-amber-600 flex items-center justify-center gap-2"
                                        >
                                            {actionLoading ? <Loader2 className="animate-spin" size={16} /> : <span>⬆</span>}
                                            {isRtl ? 'تصعيد' : 'Escalate'}
                                        </button>
                                        {!hasRejectedPlan && (
                                            <button
                                                onClick={() => handleCloseRequest('FINAL_REVIEW')}
                                                disabled={actionLoading}
                                                className="col-span-2 bg-emerald-600 text-white p-3 rounded-xl text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:bg-emerald-700 flex items-center justify-center gap-2"
                                            >
                                                {actionLoading ? <Loader2 className="animate-spin" size={16} /> : <span>✓</span>}
                                                {isRtl ? 'إغلاق التذكرة' : 'Close Ticket'}
                                            </button>
                                        )}
                                    </div>
                                </div>
);
};


export const SafetyManagerPanel = ({ isSafetyManager, ticket, t, controllerNotes, setControllerNotes, oc, confirmThen, handleSafetyManagerAction, isRtl, handleCloseRequest, hrIncomplete, handleStandaloneRemindHr, actionLoading, departments, targetDepartmentId, setTargetDepartmentId }: any) => {
    return (
<div className="space-y-3">
                                    <div className="border border-gray-300 rounded-lg bg-white focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all">
                                        <div className="flex items-center justify-between px-2 pt-2">
                                            <span className="text-xs font-bold text-gray-500">{t('ticketActions.closureNotes', 'Closure / Escalation Notes')}</span>
                                            <MagicWandButton text={controllerNotes} context={oc.whatHappened || ''} type="CONTROLLER_CLOSURE_NOTES" onEnhanced={setControllerNotes} />
                                        </div>
                                        <textarea placeholder={t('ticketActions.notesPlaceholder', 'Notes...')} value={controllerNotes} onChange={e => setControllerNotes(e.target.value)} className="w-full p-3 text-sm border-none focus:ring-0 outline-none resize-y bg-transparent min-h-[150px]" rows={6} />
                                    </div>

                                    {hrIncomplete && (
                                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xl">⚠️</span>
                                                <div>
                                                    <p className="text-xs font-bold text-red-800">{isRtl ? 'بيانات GOSI غير مكتملة' : 'Incomplete GOSI Data'}</p>
                                                    <p className="text-[10px] text-red-600">{isRtl ? 'بعض الموظفين المصابين لم تكتمل بيانات GOSI لهم.' : 'Some injured employees are missing GOSI submission data.'}</p>
                                                </div>
                                            </div>
                                            <button 
                                                onClick={() => handleStandaloneRemindHr('SAFETY_MANAGER')}
                                                disabled={actionLoading}
                                                className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold py-1.5 px-3 rounded shadow-sm transition-all"
                                            >
                                                {isRtl ? 'تذكير الموارد البشرية' : 'Remind HR'}
                                            </button>
                                        </div>
                                    )}

                                    <div className="p-3 bg-white border border-gray-200 rounded-xl space-y-2 mt-2">
                                        <p className="text-xs font-bold text-gray-500">{t('ticketActions.routeToDept', 'Route to Department')}</p>
                                        <select id="targetDepartmentId" name="targetDepartmentId" value={targetDepartmentId} onChange={e => setTargetDepartmentId(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white"><option value="">{t('ticketActions.selectDept', 'Select Department')}</option>{departments.map((d: any) => <option key={d.id} value={d.id}>{isRtl && d.nameAr ? d.nameAr : d.name}</option>)}</select>
                                    </div>

                                    <div className="grid grid-cols-3 gap-2 pt-1">
                                        <button
                                            onClick={() => confirmThen(() => handleSafetyManagerAction('RETURN'), isRtl ? 'إرجاع للكنترولر' : 'Return to Controller', isRtl ? 'ستُرجع التذكرة إلى الكنترولر للمراجعة.' : 'The ticket will be returned to the controller for review.', 'danger')}
                                            disabled={actionLoading}
                                            className="bg-rose-50 border border-rose-200 text-rose-700 p-2 rounded-xl text-xs font-bold disabled:opacity-50 transition-all hover:bg-rose-100 flex items-center justify-center gap-1.5"
                                        >
                                            {actionLoading ? <Loader2 className="animate-spin" size={14} /> : <span>↩</span>}
                                            {isRtl ? 'إرجاع' : 'Return'}
                                        </button>
                                        <button
                                            onClick={() => confirmThen(() => handleSafetyManagerAction('ESCALATE_DEPT'), isRtl ? 'توجيه للقسم' : 'Route to Dept', isRtl ? 'سيتم توجيه التذكرة للقسم المختار.' : 'Ticket will be routed to the selected department.', 'warning')}
                                            disabled={actionLoading || !targetDepartmentId}
                                            className="bg-blue-600 text-white p-2 rounded-xl text-xs font-bold transition-all hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
                                        >
                                            {actionLoading ? <Loader2 className="animate-spin" size={14} /> : <span>↗</span>}
                                            {isRtl ? 'توجيه' : 'Route'}
                                        </button>
                                        <button
                                            onClick={() => handleCloseRequest('SAFETY_MANAGER')}
                                            disabled={actionLoading}
                                            className="bg-emerald-600 text-white p-2 rounded-xl text-xs font-bold disabled:opacity-50 transition-all hover:bg-emerald-700 flex items-center justify-center gap-1.5"
                                        >
                                            {actionLoading ? <Loader2 className="animate-spin" size={14} /> : <span>✓</span>}
                                            {isRtl ? 'إغلاق التذكرة' : 'Close Ticket'}
                                        </button>
                                    </div>
                                </div>
);
};

