import React from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Loader2, Send, Bell } from 'lucide-react';
import { HazardIcon, HAZARD_CATEGORIES } from '../HazardIcons';

export const ControllerSubmittedPanel = ({ 
    isController, ticket, t, isRtl, 
    newType, setNewType, typeChangeReason, setTypeChangeReason, 
    severityLevel, setSeverityLevel, 
    hazardCategory, setHazardCategory, 
    classificationType, setClassificationType,
    delegateRcaToDept, setDelegateRcaToDept,
    controllerNotes, setControllerNotes, 
    rcaCause, setRcaCause, rcaWhy, setRcaWhy, 
    rcaRootCause, setRcaRootCause, rcaCategory, setRcaCategory, 
    rcaPreventiveActions, setRcaPreventiveActions, 
    targetDepartmentId, setTargetDepartmentId, 
    departments, serviceProviders, selectedServiceProviderId, setSelectedServiceProviderId, 
    confirmThen, handleControllerAction, actionLoading, hasEmployeeInjury, oc, notifyHr, setNotifyHr 
}: any) => {
    const injuriesCount = (() => {
        try { return oc?.injuredPersons ? JSON.parse(oc.injuredPersons).length : 0; } catch { return 0; }
    })();
    const attachmentsCount = ticket.attachments?.length || 0;
    const currentClassification = classificationType || 'SAFETY';

    return (
        <div className="space-y-4">
            {/* Quick Context Summary */}
            <div className="bg-gradient-to-br from-slate-50 to-blue-50/40 border border-slate-200 rounded-xl p-3 space-y-2">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                    {isRtl ? '📋 ملخص سريع للبلاغ' : '📋 Quick Report Context'}
                </p>
                <div className="flex flex-wrap gap-2 text-[11px]">
                    <span className="bg-white border border-slate-200 rounded-full px-2.5 py-0.5 font-semibold text-slate-700">
                        {isRtl ? 'النوع: ' : 'Type: '}{t(`oc.incidentTypes.${ticket.type}`, ticket.type)}
                    </span>
                    <span className={`rounded-full px-2.5 py-0.5 font-semibold border ${injuriesCount > 0 ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-white border-slate-200 text-slate-500'}`}>
                        {isRtl ? `إصابات: ${injuriesCount}` : `Injuries: ${injuriesCount}`}
                    </span>
                    <span className="bg-white border border-slate-200 rounded-full px-2.5 py-0.5 font-semibold text-slate-700">
                        {isRtl ? `مرفقات: ${attachmentsCount}` : `Attachments: ${attachmentsCount}`}
                    </span>
                    {oc?.isLateReport && (
                        <span className="bg-amber-50 border border-amber-200 text-amber-700 rounded-full px-2.5 py-0.5 font-semibold">
                            {isRtl ? '⏰ بلاغ متأخر' : '⏰ Late Report'}
                        </span>
                    )}
                </div>
                {oc?.whatHappened && (
                    <div className="mt-2 text-xs">
                        <p className="font-semibold text-slate-600 mb-1">
                            {isRtl ? 'وصف الحادث:' : 'Incident Description:'}
                        </p>
                        <div className="p-2.5 bg-white border border-slate-200 rounded-lg text-slate-700 whitespace-pre-wrap leading-relaxed max-h-36 overflow-y-auto shadow-sm">
                            {oc.whatHappened}
                        </div>
                    </div>
                )}
            </div>

            {/* 1. Incident Types (6 items) */}
            <div className="p-4 bg-white border border-gray-200 rounded-xl space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                        <span>🏷️</span>
                        <span>{isRtl ? 'أنواع الحوادث (Incident Types)' : 'Incident Types'}</span>
                        <span className="text-red-500">*</span>
                    </p>
                    <span className="text-[10px] text-gray-400 font-medium">
                        {isRtl ? 'اختر تصنيف نوع الحادث الأنسب' : 'Select appropriate incident type'}
                    </span>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                        { value: 'UNSAFE_CONDITION', labelEn: 'Unsafe Condition', labelAr: 'حالة غير آمنة', icon: '⚠️', color: 'text-amber-700', bg: 'bg-amber-50/70', border: 'border-amber-300' },
                        { value: 'UNSAFE_ACT', labelEn: 'Unsafe Act', labelAr: 'تصرف غير آمن', icon: '🚷', color: 'text-orange-700', bg: 'bg-orange-50/70', border: 'border-orange-300' },
                        { value: 'NEAR_MISS', labelEn: 'Near Miss', labelAr: 'حادث وشيك', icon: '🎯', color: 'text-yellow-700', bg: 'bg-yellow-50/70', border: 'border-yellow-300' },
                        { value: 'ACCIDENT', labelEn: 'Accident', labelAr: 'حادث', icon: '💥', color: 'text-rose-700', bg: 'bg-rose-50/70', border: 'border-rose-300' },
                        { value: 'PROPERTY_DAMAGE', labelEn: 'Property Danger', labelAr: 'خطر على الممتلكات', icon: '🏢', color: 'text-slate-700', bg: 'bg-slate-50/70', border: 'border-slate-300' },
                        { value: 'INJURY', labelEn: 'Injury', labelAr: 'إصابة', icon: '🤕', color: 'text-red-700', bg: 'bg-red-50/70', border: 'border-red-300' },
                    ].map(type => {
                        const isSelected = (newType || ticket.type) === type.value;
                        const isDisabledByInjury = ticket.hasInjury === true && type.value !== 'INJURY';
                        return (
                            <button
                                key={type.value}
                                type="button"
                                onClick={() => !isDisabledByInjury && setNewType(type.value)}
                                disabled={isDisabledByInjury}
                                className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border-2 transition-all text-center
                                    ${isSelected
                                        ? `${type.border} ${type.bg} shadow-md scale-[1.02] ring-2 ring-blue-500/20`
                                        : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'}
                                    ${isDisabledByInjury ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                            >
                                <span className="text-2xl">{type.icon}</span>
                                <span className={`text-xs sm:text-sm font-bold leading-tight ${isSelected ? type.color : 'text-gray-700'}`}>
                                    {isRtl ? type.labelAr : type.labelEn}
                                </span>
                                <span className="text-[10px] text-gray-400 hidden sm:inline">
                                    {isRtl ? type.labelEn : type.labelAr}
                                </span>
                            </button>
                        );
                    })}
                </div>
                {ticket.hasInjury && (
                    <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2.5 font-medium flex items-center gap-2">
                        <span>⚠️</span>
                        <span>{isRtl ? 'تم تثبيت النوع على "إصابة" لوجود مصابين في البلاغ.' : 'Incident type is locked to "Injury" because injured persons are reported.'}</span>
                    </p>
                )}
            </div>

            {/* 2. Severity Classification */}
            <div className="p-4 bg-white border border-gray-200 rounded-xl space-y-3 shadow-sm">
                <p className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                    <span>📊</span>
                    <span>{isRtl ? 'درجة الخطورة (Severity Level)' : 'Severity Level'}</span>
                    <span className="text-red-500">*</span>
                </p>
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
                                className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border-2 transition-all text-center
                                    ${isSelected
                                        ? `${sev.activeBorder} ${sev.bg} shadow-md scale-105 ring-2 ring-emerald-500/20`
                                        : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'}
                                    cursor-pointer`}
                            >
                                <span className="text-2xl">{sev.icon}</span>
                                <span className={`text-xs sm:text-sm font-bold leading-tight ${isSelected ? sev.color : 'text-gray-700'}`}>
                                    {isRtl ? sev.labelAr : sev.labelEn}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* 3. Safety vs Security Classification Tabs & Hazards */}
            <div className="p-4 bg-white border border-gray-200 rounded-xl space-y-3 shadow-sm">
                <p className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                    <span>🛡️</span>
                    <span>{isRtl ? 'تصنيف المخاطر (Hazard Classification)' : 'Hazard Classification'}</span>
                </p>
                
                {/* Switch between Safety and Security */}
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
                    <button
                        type="button"
                        onClick={() => setClassificationType && setClassificationType('SAFETY')}
                        className={`py-2.5 px-3 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2
                            ${currentClassification === 'SAFETY' 
                                ? 'bg-white text-emerald-700 shadow-sm border border-emerald-200' 
                                : 'text-slate-600 hover:text-slate-900'}`}
                    >
                        <span>🦺</span>
                        <span>{isRtl ? '1- تصنيف السلامة (Safety)' : '1- Safety Classification'}</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setClassificationType && setClassificationType('SECURITY')}
                        className={`py-2.5 px-3 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2
                            ${currentClassification === 'SECURITY' 
                                ? 'bg-white text-indigo-700 shadow-sm border border-indigo-200' 
                                : 'text-slate-600 hover:text-slate-900'}`}
                    >
                        <span>🔒</span>
                        <span>{isRtl ? '2- تصنيف الأمن (Security)' : '2- Security Classification'}</span>
                    </button>
                </div>

                {/* Sub-hazard categories based on active tab */}
                <div className="pt-2">
                    <p className="text-[11px] text-gray-500 mb-2">
                        {currentClassification === 'SAFETY' 
                            ? (isRtl ? 'اختر تصنيفات السلامة المنطبقة:' : 'Select applicable Safety categories:') 
                            : (isRtl ? 'اختر تصنيفات الأمن المنطبقة:' : 'Select applicable Security categories:')}
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {(currentClassification === 'SAFETY' ? [
                            { value: 'Physical Hazards', labelAr: 'مخاطر فيزيائية', labelEn: 'Physical Hazards' },
                            { value: 'Ergonomic Hazards', labelAr: 'مخاطر هندسة بشرية', labelEn: 'Ergonomic Hazards' },
                            { value: 'Chemical Hazards', labelAr: 'مخاطر كيميائية', labelEn: 'Chemical Hazards' },
                            { value: 'Biological Hazards', labelAr: 'مخاطر بيولوجية', labelEn: 'Biological Hazards' },
                            { value: 'Psychosocial Hazards', labelAr: 'مخاطر نفسية-اجتماعية', labelEn: 'Psychosocial Hazards' },
                            { value: 'Safety Hazards', labelAr: 'مخاطر السلامة', labelEn: 'Safety Hazards' },
                            { value: 'Environmental Hazards', labelAr: 'مخاطر بيئية', labelEn: 'Environmental Hazards' },
                        ] : [
                            { value: 'Theft', labelAr: 'سرقة', labelEn: 'Theft' },
                            { value: 'Unauthorized Access', labelAr: 'دخول غير مصرح', labelEn: 'Unauthorized Access' },
                            { value: 'Damage', labelAr: 'تلف / تخريب', labelEn: 'Damage' },
                            { value: 'Misbehavior', labelAr: 'سوء سلوك', labelEn: 'Misbehavior' },
                            { value: 'Force Access', labelAr: 'دخول بالقوة', labelEn: 'Force Access' },
                        ]).map(cat => {
                            const isSelected = Array.isArray(hazardCategory) && hazardCategory.includes(cat.value);
                            return (
                                <button
                                    key={cat.value}
                                    type="button"
                                    onClick={() => setHazardCategory((prev: string[]) => prev.includes(cat.value) ? prev.filter((v: string) => v !== cat.value) : [...prev, cat.value])}
                                    className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border-2 transition-all text-center
                                        ${isSelected
                                            ? 'border-amber-500 bg-amber-50 shadow-md scale-105 ring-2 ring-amber-400/20'
                                            : 'border-gray-200 bg-white hover:border-amber-300 hover:bg-amber-50/40'}
                                        cursor-pointer`}
                                >
                                    <HazardIcon category={cat.value} className="w-10 h-10 mb-0.5" />
                                    <span className={`text-xs font-bold leading-tight ${isSelected ? 'text-amber-800' : 'text-gray-700'}`}>
                                        {isRtl ? cat.labelAr : cat.labelEn}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* 4. GOSI Question when Injury exists */}
            {(ticket.hasInjury || injuriesCount > 0 || (newType || ticket.type) === 'INJURY') && (
                <div className="bg-gradient-to-br from-red-50 to-orange-50/50 border-2 border-red-200 rounded-xl p-4 space-y-3 shadow-sm">
                    <div className="flex items-start gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0 font-bold text-base">
                            🏥
                        </div>
                        <div>
                            <p className="text-sm font-bold text-red-900 leading-snug">
                                {isRtl 
                                    ? 'هل تستدعي هذه الإصابة إبلاغ الموارد البشرية (HR) لرفع تقرير التأمينات الاجتماعية (GOSI)؟' 
                                    : 'Does this injury require notifying HR to file a GOSI report?'}
                            </p>
                            <p className="text-xs text-red-700 opacity-90 mt-0.5">
                                {isRtl 
                                    ? 'إذا كانت الإجابة (نعم)، سيتم إشعار ممثل الموارد البشرية (HR) لتسجيل وتوثيق بيانات تقرير التأمينات. إذا كانت (لا)، يستكمل البلاغ مساره بدون HR.' 
                                    : 'If Yes, HR will be notified to record GOSI report details. If No, the ticket continues directly without HR.'}
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        <button
                            type="button"
                            onClick={() => setNotifyHr(true)}
                            className={`p-3 rounded-xl border-2 text-xs sm:text-sm font-bold text-center transition-all flex items-center justify-center gap-2
                                ${notifyHr === true 
                                    ? 'border-red-500 bg-red-600 text-white shadow-md scale-[1.02]' 
                                    : 'border-red-200 bg-white text-red-800 hover:bg-red-50'}`}
                        >
                            <span>✅</span>
                            <span>{isRtl ? 'نعم، تستدعي إبلاغ الموارد البشرية (HR)' : 'Yes, Notify HR for GOSI'}</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setNotifyHr(false)}
                            className={`p-3 rounded-xl border-2 text-xs sm:text-sm font-bold text-center transition-all flex items-center justify-center gap-2
                                ${notifyHr === false 
                                    ? 'border-slate-600 bg-slate-700 text-white shadow-md scale-[1.02]' 
                                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}`}
                        >
                            <span>❌</span>
                            <span>{isRtl ? 'لا، لا تستدعي إبلاغ HR (بدون تأمينات)' : 'No, Skip HR (No GOSI)'}</span>
                        </button>
                    </div>

                    {notifyHr === undefined && (
                        <p className="text-[11px] font-bold text-red-600 bg-white/80 border border-red-200 rounded-lg p-2 text-center">
                            {isRtl ? '⚠️ يرجى تحديد هل تستدعي الإصابة إشعار HR أم لا للمتابعة' : '⚠️ Please select whether HR notification is required to proceed'}
                        </p>
                    )}
                </div>
            )}

            {/* 5. Root Cause Analysis (RCA) — Flexible Workflow (Conditional Based on Standard HSE Matrix) */}
            {(() => {
                const effectiveType = newType || ticket.type;
                const hasInjuryCase = ticket.hasInjury || injuriesCount > 0 || effectiveType === 'INJURY' || notifyHr === true;
                const isRcaRequired = Boolean(
                    severityLevel === 'MAJOR' ||
                    hasInjuryCase ||
                    (severityLevel === 'SIGNIFICANT' && ['INJURY', 'ACCIDENT', 'PROPERTY_DAMAGE', 'SECURITY', 'SECURITY_BREACH'].includes(effectiveType)) ||
                    (currentClassification === 'SECURITY' && ['SIGNIFICANT', 'MAJOR'].includes(severityLevel))
                );

                if (!isRcaRequired) {
                    return (
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-start gap-3 shadow-sm">
                            <span className="text-xl">💡</span>
                            <div>
                                <h4 className="text-xs font-bold text-slate-800">
                                    {isRtl ? 'تحليل السبب الجذري (RCA) غير مطلوب لهذه الحالة' : 'Root Cause Analysis (RCA) Not Required'}
                                </h4>
                                <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                                    {isRtl 
                                        ? 'نظراً لأن البلاغ مصنف كحالة بسيطة / روتينية، لا يلزم إجراء RCA وسيتم توجيهه مباشرة للقسم لتنفيذ خطط العمل.' 
                                        : 'As this incident is classified as routine / minor, RCA is not required and will proceed directly with action plans.'}
                                </p>
                            </div>
                        </div>
                    );
                }

                return (
                    <div className="bg-gradient-to-br from-amber-50 to-orange-50/40 border border-amber-200 rounded-xl p-4 space-y-3 shadow-sm">
                        <div className="flex items-start justify-between border-b border-amber-200/70 pb-2">
                            <div className="flex items-center gap-2">
                                <span className="text-lg">📋</span>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h4 className="text-sm font-black text-amber-900">
                                            {isRtl ? 'تحليل السبب الجذري (Root Cause Analysis - RCA)' : 'Root Cause Analysis (RCA)'}
                                        </h4>
                                        <span className="text-[10px] bg-amber-200 text-amber-900 font-bold px-2 py-0.5 rounded-full">
                                            {isRtl ? 'إلزامي لهذا البلاغ' : 'Required for this incident'}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-amber-700 mt-0.5">
                                        {isRtl 
                                            ? 'يمكنك كتابة الـ RCA الآن بنفسك، أو تفويضه وتصعيده لممثل القسم المختص ليكتبه بنفسه.' 
                                            : 'You can write the RCA directly now, or delegate it to the Department Representative.'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* RCA Delegation Toggle */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                            <button
                                type="button"
                                onClick={() => setDelegateRcaToDept && setDelegateRcaToDept(false)}
                                className={`p-3 rounded-xl border-2 text-xs sm:text-sm font-bold text-center transition-all flex items-center justify-center gap-2
                                    ${!delegateRcaToDept 
                                        ? 'border-amber-500 bg-amber-500 text-white shadow-md scale-[1.01]' 
                                        : 'border-amber-200 bg-white text-amber-900 hover:bg-amber-50'}`}
                            >
                                <span>✍️</span>
                                <span>{isRtl ? 'كتابة الـ RCA الآن (من الكنترولر)' : 'Write RCA Now (By Controller)'}</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setDelegateRcaToDept && setDelegateRcaToDept(true)}
                                className={`p-3 rounded-xl border-2 text-xs sm:text-sm font-bold text-center transition-all flex items-center justify-center gap-2
                                    ${delegateRcaToDept 
                                        ? 'border-indigo-600 bg-indigo-600 text-white shadow-md scale-[1.01]' 
                                        : 'border-indigo-200 bg-white text-indigo-900 hover:bg-indigo-50'}`}
                            >
                                <span>🏢</span>
                                <span>{isRtl ? 'تفويض الـ RCA لممثل القسم' : 'Delegate RCA to Department Rep'}</span>
                            </button>
                        </div>

                        {/* Direct RCA Form vs Delegated Notice */}
                        {!delegateRcaToDept ? (
                            <div className="space-y-3 pt-2">
                                {[
                                    { num: 1, label: isRtl ? '1. الأسباب المباشرة' : '1. Immediate Causes', value: rcaCause, setter: setRcaCause },
                                    { num: 2, label: isRtl ? '2. الأسباب الكامنة (لماذا حدث؟)' : '2. Underlying Causes (Why?)', value: rcaWhy, setter: setRcaWhy },
                                    { num: 3, label: isRtl ? '3. السبب الجذري' : '3. Root Cause', value: rcaRootCause, setter: setRcaRootCause },
                                    { num: 4, label: isRtl ? '4. الإجراءات التصحيحية المقترحة' : '4. Corrective Actions', value: rcaCategory, setter: setRcaCategory },
                                    { num: 5, label: isRtl ? '5. الإجراءات الوقائية المقترحة' : '5. Preventive Actions', value: rcaPreventiveActions, setter: setRcaPreventiveActions },
                                ].map(f => (
                                    <div key={f.num} className="space-y-1">
                                        <label className="text-xs font-bold text-slate-700 block">
                                            {f.label} <span className="text-red-500">*</span>
                                        </label>
                                        <textarea
                                            value={f.value}
                                            onChange={e => f.setter(e.target.value)}
                                            rows={4}
                                            placeholder={isRtl ? 'اكتب إجابتك بالتفصيل...' : 'Write your answer in detail...'}
                                            className="w-full text-sm border border-amber-200 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-amber-400 focus:border-amber-400 transition-all shadow-sm"
                                        />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3.5 mt-2 space-y-1.5">
                                <p className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                                    <span>ℹ️</span>
                                    <span>{isRtl ? 'تم تفويض كتابة الـ RCA لممثل القسم' : 'RCA Delegated to Department'}</span>
                                </p>
                                <p className="text-xs text-indigo-700 leading-relaxed">
                                    {isRtl 
                                        ? 'سيُطلب من ممثل القسم المختار تعبئة حقول تحليل السبب الجذري الـ 5 كاملة بالإضافة إلى خطط العمل الفورية وقصيرة المدى قبل إرسال رده للمراجعة.' 
                                        : 'The selected Department Representative will be required to fill all 5 RCA fields alongside immediate and short-term action plans before submitting response.'}
                                </p>
                            </div>
                        )}
                    </div>
                );
            })()}

            {/* 6. Route to Department & Service Provider */}
            <div className="p-4 bg-white border border-gray-200 rounded-xl space-y-3 shadow-sm">
                <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1.5">
                        {t('ticketActions.routeToDept', 'Route to Department')} <span className="text-red-500">*</span>
                    </label>
                    <select 
                        id="targetDepartmentId" 
                        name="targetDepartmentId" 
                        value={targetDepartmentId} 
                        onChange={e => setTargetDepartmentId(e.target.value)} 
                        className="w-full p-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white"
                    >
                        <option value="">{t('ticketActions.selectDept', 'Select Department')}</option>
                        {departments.map((d: any) => (
                            <option key={d.id} value={d.id}>{isRtl && d.nameAr ? d.nameAr : d.name}</option>
                        ))}
                    </select>
                </div>

                <div className="pt-2 border-t border-gray-100">
                    <div className="flex items-center gap-1.5 mb-1.5">
                        <label className="text-xs font-bold text-gray-700">{isRtl ? 'مزود الخدمة المستهدف' : 'Target Service Provider'}</label>
                        <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-semibold">{isRtl ? 'اختياري' : 'Optional'}</span>
                    </div>
                    <select 
                        value={selectedServiceProviderId || ''} 
                        onChange={e => setSelectedServiceProviderId(e.target.value)} 
                        className="w-full p-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white"
                    >
                        <option value="">{isRtl ? 'بدون مزود خدمة (N/A)' : 'No Service Provider (N/A)'}</option>
                        {serviceProviders?.map((sp: any) => (
                            <option key={sp.id} value={sp.id}>{isRtl ? (sp.nameAr || sp.name) : sp.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Controller Routing Notes */}
            <div className="p-4 bg-white border border-gray-200 rounded-xl space-y-2 shadow-sm">
                <label className="text-xs font-bold text-gray-700 block">
                    {isRtl ? 'ملاحظات التوجيه / سبب الإرجاع للمبلّغ' : 'Routing Notes / Return Reason'} <span className="text-red-500">*</span>
                </label>
                <textarea 
                    id="controllerNotes" 
                    name="controllerNotes" 
                    placeholder={isRtl ? 'اكتب تعليمات وتوجيهات للقسم المختص، أو سبب إرجاع التذكرة للمبلّغ...' : 'Write instructions for department or return reason...'} 
                    value={controllerNotes} 
                    onChange={e => setControllerNotes(e.target.value)} 
                    className="w-full p-3 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-y min-h-[90px]" 
                    rows={3} 
                />
            </div>

            {/* Action Buttons */}
            {(() => {
                const effectiveType = newType || ticket.type;
                const hasInjuryCase = ticket.hasInjury || injuriesCount > 0 || effectiveType === 'INJURY';
                const isGosiUnanswered = hasInjuryCase && (notifyHr === undefined || notifyHr === null);

                const isRcaRequired = Boolean(
                    severityLevel === 'MAJOR' ||
                    hasInjuryCase ||
                    (severityLevel === 'SIGNIFICANT' && ['INJURY', 'ACCIDENT', 'PROPERTY_DAMAGE', 'SECURITY', 'SECURITY_BREACH'].includes(effectiveType)) ||
                    (currentClassification === 'SECURITY' && ['SIGNIFICANT', 'MAJOR'].includes(severityLevel))
                );

                const isDirectRcaIncomplete = isRcaRequired && !delegateRcaToDept && (!rcaCause || !rcaWhy || !rcaRootCause || !rcaCategory || !rcaPreventiveActions);

                const canAssign = Boolean(
                    severityLevel && 
                    targetDepartmentId && 
                    controllerNotes.trim() && 
                    !isGosiUnanswered && 
                    !isDirectRcaIncomplete
                );

                return (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                        <button
                            onClick={() => confirmThen(() => handleControllerAction('RETURN_REPORTER'), isRtl ? 'إرجاع إلى المبلّغ' : 'Return to Reporter', isRtl ? `ستُرجع التذكرة للمبلّغ.\nالملاحظات: "${controllerNotes}"` : `Ticket returned to reporter.\nNotes: "${controllerNotes}"`, 'danger')}
                            disabled={actionLoading || !controllerNotes.trim()}
                            className="bg-red-50 border border-red-200 text-red-700 py-3 px-3 rounded-xl text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:bg-red-100 flex items-center justify-center gap-1.5 shadow-sm"
                        >
                            {actionLoading ? <Loader2 className="animate-spin" size={14} /> : <span>↩</span>}
                            {t('ticketActions.return', 'إرجاع للمبلّغ')}
                        </button>
                        <button
                            onClick={() => { 
                                if (!canAssign) return; 
                                const deptName = departments.find((d: any) => d.id === targetDepartmentId)?.name || targetDepartmentId; 
                                confirmThen(() => handleControllerAction('ASSIGN'), isRtl ? 'توجيه التذكرة' : 'Route Ticket', isRtl ? `سيتم التوجيه إلى "${deptName}" بتصنيف خطورة "${severityLevel}".` : `Routing to "${deptName}" with severity "${severityLevel}".`, 'primary'); 
                            }}
                            disabled={actionLoading || !canAssign}
                            className="bg-blue-600 text-white py-3 px-3 rounded-xl text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:bg-blue-700 flex items-center justify-center gap-1.5 shadow-sm"
                        >
                            {actionLoading ? <Loader2 className="animate-spin" size={14} /> : <span>✓</span>}
                            {t('ticketActions.assign', 'توجيه للقسم')}
                        </button>
                    </div>
                );
            })()}
        </div>
    );
};


export const HrPanel = ({
    isHrRep,
    ticket,
    t,
    isRtl,
    hrNotes,
    setHrNotes,
    handleHrAction,
    actionLoading,
    injuredPersonsGosi = [],
    setInjuredPersonsGosi,
    singleGosiSubmitted,
    setSingleGosiSubmitted,
    singleGosiEmployeeId,
    setSingleGosiEmployeeId,
    singleGosiReportDate,
    setSingleGosiReportDate,
    singleGosiReportNumber,
    setSingleGosiReportNumber,
    singleGosiNoReason,
    setSingleGosiNoReason
}: any) => {
    const [isEditing, setIsEditing] = React.useState(false);
    const oc = ticket.offCircuitReport || {};
    const isSubmitted = !!oc.hrFilledBy && !isEditing;

    let injuredPersons: any[] = [];
    try {
        injuredPersons = typeof oc.injuredPersons === 'string' ? JSON.parse(oc.injuredPersons) : (oc.injuredPersons || []);
    } catch {
        injuredPersons = [];
    }
    const employees = injuredPersons.filter((p: any) => p.type === 'EMPLOYEE' || p.affiliate === 'Employee');

    if (isSubmitted) {
        return (
            <div className="space-y-4 bg-teal-50/80 border border-teal-200 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between border-b border-teal-200/80 pb-3">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 bg-teal-600 text-white rounded-xl flex items-center justify-center shadow-sm">
                            <Check size={20} />
                        </div>
                        <div>
                            <h4 className="font-black text-teal-900 text-base">{isRtl ? 'تم تسجيل بلاغ التأمينات (GOSI)' : 'GOSI Data Submitted'}</h4>
                            <p className="text-[11px] text-teal-700">{oc.hrFilledBy} • {oc.hrFilledAt ? new Date(oc.hrFilledAt).toLocaleDateString() : ''}</p>
                        </div>
                    </div>
                    {isHrRep && (
                        <button
                            type="button"
                            onClick={() => setIsEditing(true)}
                            className="px-3 py-1.5 bg-white border border-teal-300 hover:bg-teal-100/60 text-teal-800 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                        >
                            <span>✏️</span>
                            <span>{isRtl ? 'تعديل البيانات' : 'Edit GOSI Data'}</span>
                        </button>
                    )}
                </div>

                {/* Submitted Summary Cards */}
                {employees.length > 0 ? (
                    <div className="space-y-2.5">
                        {employees.map((emp: any, idx: number) => (
                            <div key={idx} className="bg-white border border-teal-100 rounded-xl p-3.5 space-y-2 text-xs shadow-sm">
                                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                    <span className="font-bold text-slate-800 text-sm">👤 {emp.name || (isRtl ? `موظف #${idx + 1}` : `Employee #${idx + 1}`)}</span>
                                    {emp.gosiEmployeeId && <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono font-bold">{isRtl ? 'الرقم:' : 'ID:'} {emp.gosiEmployeeId}</span>}
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-slate-600">
                                    <div>
                                        <span className="text-slate-400 block text-[10px] uppercase font-bold">{isRtl ? 'حالة التبليغ' : 'GOSI Status'}</span>
                                        <span className={`font-bold ${emp.gosiSubmitted ? 'text-emerald-600' : 'text-red-600'}`}>
                                            {emp.gosiSubmitted ? (isRtl ? '✓ تم التبليغ' : '✓ Submitted') : (isRtl ? '✕ لم يتم التبليغ' : '✕ Not Submitted')}
                                        </span>
                                    </div>
                                    {emp.gosiSubmitted ? (
                                        <>
                                            <div>
                                                <span className="text-slate-400 block text-[10px] uppercase font-bold">{isRtl ? 'رقم البلاغ' : 'GOSI Number'}</span>
                                                <span className="font-mono font-bold text-slate-800">{emp.gosiReportNumber || '—'}</span>
                                            </div>
                                            <div className="col-span-2">
                                                <span className="text-slate-400 block text-[10px] uppercase font-bold">{isRtl ? 'تاريخ البلاغ' : 'Report Date'}</span>
                                                <span className="font-bold text-slate-800">{emp.gosiReportDate ? new Date(emp.gosiReportDate).toLocaleDateString() : '—'}</span>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="col-span-2">
                                            <span className="text-slate-400 block text-[10px] uppercase font-bold">{isRtl ? 'السبب' : 'Reason'}</span>
                                            <span className="text-red-700 font-medium">{emp.gosiNoReason || '—'}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="bg-white border border-teal-100 rounded-xl p-4 space-y-2 text-xs shadow-sm">
                        <div className="grid grid-cols-2 gap-3 text-slate-600">
                            <div>
                                <span className="text-slate-400 block text-[10px] uppercase font-bold">{isRtl ? 'حالة التبليغ في GOSI' : 'GOSI Status'}</span>
                                <span className={`font-bold text-sm ${oc.gosiSubmitted ? 'text-emerald-600' : 'text-red-600'}`}>
                                    {oc.gosiSubmitted ? (isRtl ? '✓ تم التبليغ' : '✓ Submitted') : (isRtl ? '✕ لم يتم التبليغ' : '✕ Not Submitted')}
                                </span>
                            </div>
                            {oc.gosiEmployeeId && (
                                <div>
                                    <span className="text-slate-400 block text-[10px] uppercase font-bold">{isRtl ? 'الرقم الوظيفي' : 'Employee ID'}</span>
                                    <span className="font-mono font-bold text-slate-800">{oc.gosiEmployeeId}</span>
                                </div>
                            )}
                            {oc.gosiSubmitted ? (
                                <>
                                    <div>
                                        <span className="text-slate-400 block text-[10px] uppercase font-bold">{isRtl ? 'رقم بلاغ التأمينات' : 'GOSI Report No.'}</span>
                                        <span className="font-mono font-black text-slate-800 text-sm">{oc.gosiReportNumber || '—'}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 block text-[10px] uppercase font-bold">{isRtl ? 'تاريخ البلاغ' : 'Report Date'}</span>
                                        <span className="font-bold text-slate-800">{oc.gosiReportDate ? new Date(oc.gosiReportDate).toLocaleDateString() : '—'}</span>
                                    </div>
                                </>
                            ) : (
                                <div className="col-span-2">
                                    <span className="text-slate-400 block text-[10px] uppercase font-bold">{isRtl ? 'سبب عدم التبليغ' : 'Reason for Not Reporting'}</span>
                                    <span className="text-red-700 font-medium">{oc.gosiNoReason || '—'}</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {oc.hrNotes && (
                    <div className="bg-white/90 border border-teal-100 rounded-xl p-3 text-xs">
                        <span className="text-teal-800 block text-[10px] uppercase font-bold mb-1">{isRtl ? 'ملاحظات الموارد البشرية' : 'HR Notes'}</span>
                        <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">{oc.hrNotes}</p>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-4 bg-gradient-to-br from-teal-50 via-white to-blue-50/30 border-2 border-teal-300 rounded-2xl p-5 shadow-md">
            <div className="border-b border-teal-200 pb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center shadow-sm">
                        <span>🏥</span>
                    </div>
                    <div>
                        <h3 className="text-base font-black text-teal-900 leading-tight">
                            {isRtl ? 'بيانات بلاغ التأمينات الاجتماعية (GOSI)' : 'GOSI Incident Reporting Form'}
                        </h3>
                        <p className="text-[11px] text-teal-700 font-medium">
                            {isRtl ? 'يرجى تسجيل تفاصيل البلاغ لدى التأمينات أو ذكر سبب عدم التبليغ' : 'Enter GOSI report details or specify reason if not reported'}
                        </p>
                    </div>
                </div>
                {isEditing && (
                    <button
                        type="button"
                        onClick={() => setIsEditing(false)}
                        className="text-xs text-slate-500 hover:text-slate-800 font-bold px-2 py-1 bg-white border border-slate-200 rounded-lg"
                    >
                        {isRtl ? 'إلغاء' : 'Cancel'}
                    </button>
                )}
            </div>

            {/* 1. Multiple Employees Case */}
            {employees.length > 0 ? (
                <div className="space-y-4">
                    <p className="text-xs font-bold text-teal-800">
                        {isRtl ? `قائمة الموظفين المصابين (${employees.length})` : `Injured Employees (${employees.length})`}
                    </p>
                    {employees.map((emp: any, idx: number) => {
                        const pg = injuredPersonsGosi[idx] || {
                            gosiEmployeeId: emp.gosiEmployeeId || '',
                            gosiSubmitted: emp.gosiSubmitted,
                            gosiReportDate: emp.gosiReportDate ? new Date(emp.gosiReportDate).toISOString().slice(0, 10) : '',
                            gosiReportNumber: emp.gosiReportNumber || '',
                            gosiNoReason: emp.gosiNoReason || ''
                        };

                        const updateEmpGosi = (field: string, val: any) => {
                            if (!setInjuredPersonsGosi) return;
                            const updated = [...(injuredPersonsGosi.length > 0 ? injuredPersonsGosi : employees.map((e: any) => ({
                                gosiEmployeeId: e.gosiEmployeeId || '',
                                gosiSubmitted: e.gosiSubmitted,
                                gosiReportDate: e.gosiReportDate ? new Date(e.gosiReportDate).toISOString().slice(0, 10) : '',
                                gosiReportNumber: e.gosiReportNumber || '',
                                gosiNoReason: e.gosiNoReason || ''
                            })))];
                            updated[idx] = { ...updated[idx], [field]: val };
                            setInjuredPersonsGosi(updated);
                        };

                        return (
                            <div key={idx} className="bg-white border border-teal-200 rounded-xl p-4 space-y-3 shadow-sm">
                                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="w-6 h-6 rounded-md bg-teal-100 text-teal-800 font-bold text-xs flex items-center justify-center">{idx + 1}</span>
                                        <span className="font-bold text-slate-800 text-sm">{emp.name || (isRtl ? `موظف #${idx + 1}` : `Employee #${idx + 1}`)}</span>
                                    </div>
                                    {emp.dept && <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-semibold">{emp.dept}</span>}
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                                        {isRtl ? 'الرقم الوظيفي للموظف' : 'Employee ID'} <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        placeholder={isRtl ? 'مثال: SMC-10492' : 'e.g. SMC-10492'}
                                        value={pg.gosiEmployeeId || ''}
                                        onChange={(e) => updateEmpGosi('gosiEmployeeId', e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 font-mono focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all outline-none"
                                        dir="ltr"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-[11px] font-bold text-slate-600">
                                        {isRtl ? 'هل تم إبلاغ التأمينات الاجتماعية (GOSI)؟' : 'Was GOSI notified?'} <span className="text-red-500">*</span>
                                    </label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => updateEmpGosi('gosiSubmitted', true)}
                                            className={`py-2 px-3 rounded-xl border-2 text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                                                pg.gosiSubmitted === true
                                                    ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-sm'
                                                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                                            }`}
                                        >
                                            <span>✅</span>
                                            <span>{isRtl ? 'نعم، تم التبليغ' : 'Yes, Reported'}</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => updateEmpGosi('gosiSubmitted', false)}
                                            className={`py-2 px-3 rounded-xl border-2 text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                                                pg.gosiSubmitted === false
                                                    ? 'bg-rose-50 border-rose-500 text-rose-800 shadow-sm'
                                                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                                            }`}
                                        >
                                            <span>❌</span>
                                            <span>{isRtl ? 'لا، لم يتم التبليغ' : 'No, Not Reported'}</span>
                                        </button>
                                    </div>
                                </div>

                                {pg.gosiSubmitted === true && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-slate-100 bg-emerald-50/40 p-3 rounded-xl">
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-600 mb-1">
                                                {isRtl ? 'تاريخ بلاغ التأمينات' : 'GOSI Report Date'} <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="date"
                                                value={pg.gosiReportDate || ''}
                                                onChange={(e) => updateEmpGosi('gosiReportDate', e.target.value)}
                                                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-800 focus:ring-2 focus:ring-teal-500 outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-600 mb-1">
                                                {isRtl ? 'رقم بلاغ التأمينات (GOSI No.)' : 'GOSI Report Number'} <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                placeholder={isRtl ? 'مثال: GOSI-2026-9812' : 'e.g. GOSI-2026-9812'}
                                                value={pg.gosiReportNumber || ''}
                                                onChange={(e) => updateEmpGosi('gosiReportNumber', e.target.value)}
                                                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-800 font-mono font-bold focus:ring-2 focus:ring-teal-500 outline-none"
                                                dir="ltr"
                                            />
                                        </div>
                                    </div>
                                )}

                                {pg.gosiSubmitted === false && (
                                    <div className="pt-2 border-t border-slate-100 bg-rose-50/40 p-3 rounded-xl">
                                        <label className="block text-[10px] font-bold text-slate-600 mb-1">
                                            {isRtl ? 'سبب عدم التبليغ في التأمينات' : 'Reason for Not Reporting'} <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            placeholder={isRtl ? 'اكتب سبب عدم إبلاغ التأمينات...' : 'Provide the reason...'}
                                            value={pg.gosiNoReason || ''}
                                            onChange={(e) => updateEmpGosi('gosiNoReason', e.target.value)}
                                            className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-800 focus:ring-2 focus:ring-rose-400 outline-none"
                                        />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            ) : (
                /* 2. General Injury Single Form */
                <div className="bg-white border border-teal-200 rounded-xl p-4 space-y-3.5 shadow-sm">
                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                            {isRtl ? 'الرقم الوظيفي للموظف (إن وُجد)' : 'Employee ID (If applicable)'}
                        </label>
                        <input
                            type="text"
                            placeholder={isRtl ? 'مثال: SMC-10492' : 'e.g. SMC-10492'}
                            value={singleGosiEmployeeId || ''}
                            onChange={(e) => setSingleGosiEmployeeId && setSingleGosiEmployeeId(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 font-mono focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all outline-none"
                            dir="ltr"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="block text-xs font-bold text-slate-700">
                            {isRtl ? 'هل تم إبلاغ التأمينات الاجتماعية (GOSI) عن الحادث؟' : 'Was this incident reported to GOSI?'} <span className="text-red-500">*</span>
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => setSingleGosiSubmitted && setSingleGosiSubmitted(true)}
                                className={`py-2.5 px-3 rounded-xl border-2 text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                                    singleGosiSubmitted === true
                                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-sm'
                                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                                }`}
                            >
                                <span>✅</span>
                                <span>{isRtl ? 'نعم، تم التبليغ في التأمينات' : 'Yes, Reported to GOSI'}</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setSingleGosiSubmitted && setSingleGosiSubmitted(false)}
                                className={`py-2.5 px-3 rounded-xl border-2 text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                                    singleGosiSubmitted === false
                                        ? 'bg-rose-50 border-rose-500 text-rose-800 shadow-sm'
                                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                                }`}
                            >
                                <span>❌</span>
                                <span>{isRtl ? 'لا، لم يتم التبليغ' : 'No, Not Reported'}</span>
                            </button>
                        </div>
                    </div>

                    {singleGosiSubmitted === true && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-100 bg-emerald-50/40 p-3.5 rounded-xl">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    {isRtl ? 'تاريخ بلاغ التأمينات' : 'GOSI Report Date'} <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="date"
                                    value={singleGosiReportDate || ''}
                                    onChange={(e) => setSingleGosiReportDate && setSingleGosiReportDate(e.target.value)}
                                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-teal-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    {isRtl ? 'رقم بلاغ التأمينات (GOSI Report Number)' : 'GOSI Report Number'} <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    placeholder={isRtl ? 'مثال: 9812401' : 'e.g. 9812401'}
                                    value={singleGosiReportNumber || ''}
                                    onChange={(e) => setSingleGosiReportNumber && setSingleGosiReportNumber(e.target.value)}
                                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 font-mono font-bold focus:ring-2 focus:ring-teal-500 outline-none"
                                    dir="ltr"
                                />
                            </div>
                        </div>
                    )}

                    {singleGosiSubmitted === false && (
                        <div className="pt-3 border-t border-slate-100 bg-rose-50/40 p-3.5 rounded-xl">
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                                {isRtl ? 'سبب عدم التبليغ في التأمينات' : 'Reason for Not Reporting'} <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                placeholder={isRtl ? 'اكتب سبب عدم إبلاغ التأمينات (مثال: إصابة طفيفة لا تستدعي، مقاول خارجي...)' : 'Provide reason (e.g. minor first aid, third-party contractor...)'}
                                value={singleGosiNoReason || ''}
                                onChange={(e) => setSingleGosiNoReason && setSingleGosiNoReason(e.target.value)}
                                className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-rose-400 outline-none"
                            />
                        </div>
                    )}
                </div>
            )}

            {/* HR Notes */}
            <div className="space-y-1.5">
                <label className="block text-xs font-bold text-teal-900">
                    {isRtl ? 'ملاحظات وتوصيات الموارد البشرية' : 'HR Notes & Comments'}
                </label>
                <textarea
                    placeholder={isRtl ? 'أدخل أي ملاحظات إدارية أو متابعة إضافية من قِبل HR...' : 'Enter any HR follow-up comments...'}
                    value={hrNotes}
                    onChange={(e) => setHrNotes(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all outline-none resize-y min-h-[80px]"
                />
            </div>

            {/* Submit Button */}
            <button
                type="button"
                onClick={handleHrAction}
                disabled={actionLoading}
                className="w-full bg-teal-600 hover:bg-teal-700 text-white py-3 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-md shadow-teal-600/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
                {actionLoading ? <Loader2 className="animate-spin" size={17} /> : <Check size={17} />} 
                <span>{isRtl ? '💾 حفظ وإرسال بيانات التأمينات (GOSI)' : 'Save & Submit GOSI Details'}</span>
            </button>
        </div>
    );
};


export const DepartmentPanel = ({ 
    isDepRep, ticket, t, isRtl, handleDepartmentAction, actionLoading,
    rcaCause, setRcaCause, rcaWhy, setRcaWhy, rcaRootCause, setRcaRootCause, rcaCategory, setRcaCategory, rcaPreventiveActions, setRcaPreventiveActions
}: any) => {
    const oc = ticket?.offCircuitReport;
    const rcaNeeded = oc?.rcaDelegatedToDept || (oc?.rcaRequired && !oc?.rcaCompleted);

    return (
        <div className="space-y-4 bg-white p-4 border border-slate-200 shadow-sm rounded-xl">
            {rcaNeeded && (
                <div className="bg-gradient-to-br from-amber-50 to-orange-50/50 border-2 border-amber-300 rounded-xl p-4 space-y-3">
                    <div className="flex items-start gap-2.5 pb-2 border-b border-amber-200">
                        <span className="text-xl">📋</span>
                        <div>
                            <h4 className="text-sm font-black text-amber-900">
                                {isRtl ? 'تحليل السبب الجذري (Root Cause Analysis - RCA)' : 'Root Cause Analysis (RCA)'}
                            </h4>
                            <p className="text-xs text-amber-800 mt-0.5">
                                {isRtl 
                                    ? 'تم تفويض كتابة الـ RCA لقسمكم من قِبل الكنترولر. يرجى تعبئة الحقول الـ 5 كاملة بدقة.' 
                                    : 'The Controller has requested your department to complete the 5 RCA fields.'}
                            </p>
                        </div>
                    </div>

                    <div className="space-y-3 pt-1">
                        {[
                            { num: 1, label: isRtl ? '1. الأسباب المباشرة' : '1. Immediate Causes', value: rcaCause, setter: setRcaCause },
                            { num: 2, label: isRtl ? '2. الأسباب الكامنة (لماذا حدث؟)' : '2. Underlying Causes (Why?)', value: rcaWhy, setter: setRcaWhy },
                            { num: 3, label: isRtl ? '3. السبب الجذري' : '3. Root Cause', value: rcaRootCause, setter: setRcaRootCause },
                            { num: 4, label: isRtl ? '4. الإجراءات التصحيحية المقترحة' : '4. Corrective Actions', value: rcaCategory, setter: setRcaCategory },
                            { num: 5, label: isRtl ? '5. الإجراءات الوقائية المقترحة' : '5. Preventive Actions', value: rcaPreventiveActions, setter: setRcaPreventiveActions },
                        ].map(f => (
                            <div key={f.num} className="space-y-1">
                                <label className="text-xs font-bold text-slate-700 block">
                                    {f.label} <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    value={f.value}
                                    onChange={e => f.setter(e.target.value)}
                                    rows={4}
                                    placeholder={isRtl ? 'اكتب إجابتك بالتفصيل (مطلوب)...' : 'Write detailed answer (required)...'}
                                    className="w-full text-sm border border-amber-200 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-amber-400 focus:border-amber-400 transition-all shadow-sm"
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <p className="text-xs text-slate-500 italic text-center leading-relaxed">
                {t('ticketDetail.completeFields', 'تأكد من إضافة خطط العمل المطلوبة قبل إرسال الرد للمراجعة.')}
            </p>
            <button 
                onClick={handleDepartmentAction} 
                disabled={actionLoading} 
                className="w-full bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
            >
                {actionLoading ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />} 
                {t('ticketDetail.submitResponse', 'إرسال الرد وخطط العمل للمراجعة')}
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

