import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen, ArrowLeft, ArrowRight, ShieldCheck, AlertTriangle,
  FileText, CheckCircle2, Users, Search, HelpCircle,
  Clock, MapPin, Camera, ClipboardList, Send, Printer,
  ChevronDown, ChevronUp, LifeBuoy, Flame, CheckCircle,
  ExternalLink, UserCheck, Sliders, Eye
} from 'lucide-react';

const UserGuide = () => {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const isArabic = i18n.language.startsWith('ar');

  const [activeTab, setActiveTab] = useState<'overview' | 'roles' | 'wizard' | 'workflow' | 'investigation' | 'faq'>('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const handlePrint = () => {
    window.print();
  };

  // Content Strings
  const content = {
    ar: {
      title: 'دليل مستخدم منصة السلامة وإدارة الحوادث (HSE)',
      subtitle: 'دليل شامل وتفاعلي يوضح كيفية استخدام النظام، رفع البلاغات، إدارة التحقيقات، ومتابعة الإجراءات التصحيحية.',
      backToDashboard: 'العودة للوحة القيادة',
      printGuide: 'طباعة الدليل',
      searchPlaceholder: 'ابحث في مواضيع الدليل (مثال: رفع بلاغ، كنترولر، تحقيق)...',
      tabs: {
        overview: 'نظرة عامة',
        roles: 'الأدوار والصلاحيات',
        wizard: 'خطوات رفع بلاغ',
        workflow: 'دورة حياة البلاغ',
        investigation: 'التحقيق والإجراءات (CAPA)',
        faq: 'الأسئلة الشائعة',
      },
      overview: {
        heading: 'نظرة عامة على المنصة',
        desc: 'منصة إدارة الحوادث والصحة والسلامة والبيئة (HSE Incident Management Platform) التابعة لشركة المحركات السعودية (SMC) هي النظام الرقمي الموحد للإبلاغ الفوري، تتبع المخاطر، إجراء التحقيقات الشاملة، وضمان اتخاذ الإجراءات التصحيحية والوقائية لجميع العمليات داخل وخارج الحلبة.',
        pillarsTitle: 'الأهداف الرئيسية للمنصة',
        pillars: [
          {
            title: 'سرعة الاستجابة والتبليغ',
            desc: 'تمكين الموظفين والمارشال وفرق العمل الميدانية من تسجيل أي ملاحظة أو حادث فور حدوثه بدقة مدعومة بالموقع الجغرافي والصور.',
            icon: Flame,
            color: 'text-amber-600 bg-amber-50 border-amber-200'
          },
          {
            title: 'الحوكمة وسير العمل المحكم',
            desc: 'تمر كل تذكرة بمسار اعتماد محدد يبدأ من مراقب السلامة (Controller) وحتى مدير السلامة وممثلي الأقسام المعنية.',
            icon: ShieldCheck,
            color: 'text-blue-600 bg-blue-50 border-blue-200'
          },
          {
            title: 'التحقيق وتحليل الأسباب الجذرية (RCA)',
            desc: 'أدوات مدمجة لتحليل الأسباب المباشرة وغير المباشرة لمنع تكرار الحوادث.',
            icon: Search,
            color: 'text-purple-600 bg-purple-50 border-purple-200'
          },
          {
            title: 'خطط العمل والأدلة التوثيقية',
            desc: 'إلزام الجهات المنفذة برفع صور وأدلة الإنجاز قبل الموافقة على إغلاق أي تذكرة أو إجراء تصحيحي.',
            icon: CheckCircle2,
            color: 'text-emerald-600 bg-emerald-50 border-emerald-200'
          }
        ],
        severityTitle: 'مستويات الخطورة المعتمدة (Severity Levels)',
        severities: [
          { level: 'منخفض (Low / Minor)', color: 'bg-emerald-100 text-emerald-800 border-emerald-300', time: 'خلال 48 ساعة', desc: 'ملاحظات غير حرجة، انسكابات بسيطة، أو مخالفات بدون إصابات أو أضرار مباشرة.' },
          { level: 'متوسط (Medium / Moderate)', color: 'bg-yellow-100 text-yellow-800 border-yellow-300', time: 'خلال 24 ساعة', desc: 'حوادث كادت أن تقع (Near Miss)، أضرار مادية محدودة، أو مخاطر بيئية طفيفة.' },
          { level: 'عالي (High / Major)', color: 'bg-orange-100 text-orange-800 border-orange-300', time: 'خلال 4 ساعات', desc: 'إصابات تستدعي إسعافات أولية، تعطل جزئي في العمليات، أو مخالفات جسيمة للسلامة.' },
          { level: 'حرج (Critical)', color: 'bg-red-100 text-red-800 border-red-300', time: 'استجابة فورية (ساعة واحدة)', desc: 'إصابات خطيرة أو نقل للمستشفى، حرائق، توقف كامل للعمليات، أو تهديد مباشر للأرواح.' },
        ]
      },
      roles: {
        heading: 'الأدوار والمسؤوليات (Roles & Responsibilities)',
        desc: 'يحدد النظام صلاحيات وواجهات مخصصة لكل دور لضمان الفصل بين الإبلاغ، والمراجعة، والتنفيذ، والاعتماد النهائي.',
        list: [
          {
            role: 'المبلّغ (Reporter / OC Reporter)',
            badge: 'ميداني / إداري',
            badgeColor: 'bg-blue-100 text-blue-800',
            responsibilities: [
              'تسجيل وتوثيق الحوادث والمخاطر والملاحظات الميدانية فور وقوعها.',
              'تحديد الموقع على الخريطة بدقة وإرفاق الصور أو مقاطع الفيديو كأدلة.',
              'متابعة حالة البلاغ والتواصل عبر سجل الملاحظات في التذكرة.'
            ]
          },
          {
            role: 'مراقب السلامة (HSE Controller)',
            badge: 'نقطة المراجعة الأولى',
            badgeColor: 'bg-amber-100 text-amber-800',
            responsibilities: [
              'استقبال البلاغات الجديدة والتحقق من صحتها واكتمال بياناتها.',
              'تعديل تصنيف الخطورة وتحديد القسم المسؤول (Operations, IT, HR, Finance, etc.).',
              'إمكانية إغلاق البلاغات البسيطة والملاحظات المباشرة فور حلها.',
              'إحالة البلاغات ذات الخطورة العالية للتحقيق أو لمدير السلامة.'
            ]
          },
          {
            role: 'مدير السلامة (Safety Manager)',
            badge: 'الاعتماد النهائي',
            badgeColor: 'bg-purple-100 text-purple-800',
            responsibilities: [
              'مراجعة نتائج تحقيقات الأسباب الجذرية (RCA).',
              'اعتماد خطط العمل والإجراءات التصحيحية المرفوعة من الأقسام.',
              'الموافقة النهائية على إغلاق التذاكر الكبرى والتصعيد عند اللزوم.',
              'الاطلاع على لوحة التحليلات والإحصائيات العامة (Analytics).'
            ]
          },
          {
            role: 'ممثلو الأقسام (Department Reps: HR, Finance, Ops, Procurement, IT)',
            badge: 'الجهات المنفذة',
            badgeColor: 'bg-emerald-100 text-emerald-800',
            responsibilities: [
              'استلام التذاكر والإجراءات المعينة لقسمهم.',
              'تنفيذ متطلبات التذكرة ورفع صور وأدلة التنفيذ (Evidence Upload).',
              'إرسال إشعار اكتمال الإجراء للسلامة للموافقة على الإغلاق.'
            ]
          },
          {
            role: 'مدير النظام (Administrator)',
            badge: 'إدارة النظام',
            badgeColor: 'bg-slate-100 text-slate-800',
            responsibilities: [
              'إدارة حسابات المستخدمين وصلاحياتهم وتعيين الأقسام.',
              'تفعيل وضع الصيانة (Maintenance Mode) وإدارة الإعدادات العامة.',
              'الوصول الكامل لجميع التذاكر وسجلات التدقيق (Audit Logs).'
            ]
          }
        ]
      },
      wizard: {
        heading: 'دليل رفع بلاغ جديد خطوة بخطوة',
        desc: 'صُمم معالج رفع البلاغات (New Ticket Wizard) ليكون سهلاً وسريعاً ويعمل حتى في ظروف الاتصال الضعيف.',
        steps: [
          {
            step: '1',
            title: 'نوع البلاغ والمعلومات الأساسية',
            desc: 'اختر نوع البلاغ (حادث Incident، حادث كاد أن يقع Near Miss، ملاحظة سلامة Observation، إصابة Injury). حدد التاريخ والوقت بدقة.',
            icon: ClipboardList
          },
          {
            step: '2',
            title: 'تحديد الموقع الجغرافي',
            desc: 'يمكنك استخدام زر (تحديد موقعي الحالي) لتحديد إحداثيات GPS تلقائياً، أو النقر على الخريطة لتحديد مكان الحدث، واختيار المنطقة والمنشأة.',
            icon: MapPin
          },
          {
            step: '3',
            title: 'تصنيف المخاطر والوصف',
            desc: 'حدد تصنيف الخطر (مخاطر فيزيائية، كيميائية، بيولوجية، بيئية، أمن وسلامة...) واكتب وصفاً واضحاً وموجزاً لما حدث والأضرار المحتملة.',
            icon: AlertTriangle
          },
          {
            step: '4',
            title: 'المرفقات والأدلة المصورة',
            desc: 'التقط صوراً مباشرة من كاميرا الجوال أو ارفع المستندات والملفات الداعمة (يدعم الصور والـ PDF حتى 15MB).',
            icon: Camera
          },
          {
            step: '5',
            title: 'المراجعة والإرسال',
            desc: 'راجع ملخص التذكرة، ثم انقر على (إرسال البلاغ). سيتم إنشاء رقم تذكرة فوري بصيغة (INC-2026-XXXXX) وإشعار المعنيين فوراً.',
            icon: Send
          }
        ]
      },
      workflow: {
        heading: 'مراحل ودورة حياة التذكرة (Ticket Lifecycle)',
        desc: 'تتحرك التذكرة في النظام عبر مسار محدد وفقاً للإجراءات المتخذة ومستوى الخطورة:',
        stages: [
          { name: 'جديدة (Submitted)', color: 'border-blue-500 bg-blue-50/50', desc: 'تم رفع البلاغ وبانتظار مراجعة مراقب السلامة (HSE Controller).' },
          { name: 'قيد المراجعة (Under Review)', color: 'border-amber-500 bg-amber-50/50', desc: 'الكنترولر يفحص التفاصيل ويحدد الخطورة ويعين القسم المسؤول أو المحقق.' },
          { name: 'قيد التحقيق / الإجراء (In Action / Investigation)', color: 'border-purple-500 bg-purple-50/50', desc: 'القسم المعني ينفذ خطة التصحيح أو فريق السلامة يجري تحليل الأسباب الجذرية (RCA).' },
          { name: 'بانتظار الاعتماد (Pending Approval)', color: 'border-indigo-500 bg-indigo-50/50', desc: 'تم رفع أدلة الحل وإرسال التذكرة للاعتماد النهائي من مدير السلامة.' },
          { name: 'مغلقة (Closed)', color: 'border-emerald-500 bg-emerald-50/50', desc: 'تم اعتماد الحل بنجاح وإغلاق التذكرة وتوثيقها في الأرشيف والإحصائيات.' }
        ]
      },
      investigation: {
        heading: 'التحقيق وتحليل الأسباب الجذرية (RCA & CAPA)',
        desc: 'يحتوي النظام على قسم مخصص لإدارة التحقيقات المتقدمة للحوادث الكبرى لضمان استيفاء معايير الجودة والسلامة الدولية.',
        rcaItems: [
          { title: 'تحليل الأسباب المباشرة (Direct Causes)', desc: 'السلوكيات غير الآمنة أو الظروف البيئية والميكانيكية التي أدت مباشرة للحدث.' },
          { title: 'تحليل الأسباب الجذرية (Root Causes)', desc: 'دراسة الخلل في الأنظمة أو التدريب أو الصيانة أو الإجراءات الوقائية.' },
          { title: 'خطة الإجراءات التصحيحية والوقائية (CAPA)', desc: 'تحديد مهام واضحة ومحددة بجهة مسؤولة وتاريخ إنجاز نهائي لمنع تكرار الحادث.' },
          { title: 'إلزامية إرفاق دليل الإنجاز (Evidence Mandatory)', desc: 'لا يمكن إغلاق أي إجراء تصحيحي دون إرفاق صور تثبت معالجة الخلل (قبل / بعد).' }
        ]
      },
      faq: {
        heading: 'الأسئلة الأكثر شيوعاً (FAQ)',
        desc: 'إجابات على أهم الاستفسارات التقنية والتشغيلية في المنصة:',
        items: [
          { q: 'كيف أسجل الدخول إذا كنت موظفاً في الشركة؟', a: 'يتم تسجيل الدخول المباشر بنقرة واحدة عبر حساب مايكروسوفت الرسمي (Sign in with Microsoft) بدون الحاجة لكلمة مرور منفصلة.' },
          { q: 'هل يمكنني الإبلاغ عن حادث أثناء انقطاع الإنترنت؟', a: 'نعم، المنصة تدعم وضع عدم الاتصال (Offline Mode) حيث يتم حفظ التذكرة محلياً في جهازك ومزامنتها تلقائياً بمجرد عودة الاتصال.' },
          { q: 'من يملك صلاحية إغلاق التذاكر؟', a: 'التذاكر البسيطة يمكن إغلاقها من مراقب السلامة (HSE Controller)، بينما الحوادث المتوسطة والحرجة تتطلب موافقة مدير السلامة (Safety Manager) أو مسؤول النظام (Admin).' },
          { q: 'كيف أتابع التذاكر الخاصة بقسمي فقط؟', a: 'ممثلو الأقسام تظهر لهم التذاكر المحالة لقسمهم تلقائياً في لوحة القيادة مع إشعارات فورية عند تعيين أي تذكرة جديدة.' },
          { q: 'كيف أقوم بطباعة تقرير الحادث الرسمي كـ PDF؟', a: 'من خلال فتح أي تذكرة، اضغط على زر (طباعة التقرير / Export PDF) بالأعلى ليتم توليد تقرير رسمي جاهز يحتوي على كافة التفاصيل والأدلة والخريطة.' },
          { q: 'ما هو معنى حقول بيانات المورد / المقاول في التذكرة؟', a: 'عند وقوع حادث يتعلق بموظف مقاول (Contractor)، يحتاج النظام لتوثيق بيانات الشركة المقاولة، وتتضمن ثلاثة جوانب: (1) ممثل المورد الرئيسي (Primary Representative): الشخص المسؤول من جهة الشركة المقاولة للتواصل (الاسم + الإيميل + الجوال)). (2) قسم الكفيل (Responsible Sponsoring Department): القسم الداخلي في المنظمة المسؤول عن هذا المورد. (3) ممثلو الشركة (Company Representatives): قائمة بممثلين إضافيين من نفس الشركة لتسهيل التواصل عند الحاجة.' }
        ]
      }
    },
    en: {
      title: 'HSE Incident Platform User Guide',
      subtitle: 'Comprehensive and interactive manual for incident reporting, investigation management, and corrective action workflows.',
      backToDashboard: 'Back to Dashboard',
      printGuide: 'Print Guide',
      searchPlaceholder: 'Search topics (e.g., submit report, controller, RCA, evidence)...',
      tabs: {
        overview: 'Overview',
        roles: 'Roles & Permissions',
        wizard: 'Reporting Wizard',
        workflow: 'Incident Workflow',
        investigation: 'RCA & CAPA',
        faq: 'FAQ',
      },
      overview: {
        heading: 'Platform Overview',
        desc: 'The Saudi Motorsport Company (SMC) HSE Incident Management Platform is the centralized digital solution for real-time hazard reporting, thorough investigation tracking, and verifiable corrective and preventive action implementation across all track and off-circuit operations.',
        pillarsTitle: 'Core Objectives',
        pillars: [
          {
            title: 'Rapid & Accurate Reporting',
            desc: 'Empowers marshals, contractors, and staff to capture hazards instantly with GPS geolocation and multimedia evidence.',
            icon: Flame,
            color: 'text-amber-600 bg-amber-50 border-amber-200'
          },
          {
            title: 'Rigorous Governance & Approvals',
            desc: 'Strict lifecycle tracking from triage by the HSE Controller to final sign-off by Safety Management.',
            icon: ShieldCheck,
            color: 'text-blue-600 bg-blue-50 border-blue-200'
          },
          {
            title: 'Root Cause Analysis (RCA)',
            desc: 'Integrated frameworks to isolate direct and root causes, eliminating recurrent risks.',
            icon: Search,
            color: 'text-purple-600 bg-purple-50 border-purple-200'
          },
          {
            title: 'Evidence-Backed Action Plans (CAPA)',
            desc: 'Mandatory photo/document proof before any corrective action or ticket can be resolved.',
            icon: CheckCircle2,
            color: 'text-emerald-600 bg-emerald-50 border-emerald-200'
          }
        ],
        severityTitle: 'Incident Severity Levels & Response Targets',
        severities: [
          { level: 'Low / Minor', color: 'bg-emerald-100 text-emerald-800 border-emerald-300', time: 'Within 48h', desc: 'Minor observations, small spills, non-critical hazards with zero injuries or material damage.' },
          { level: 'Medium / Moderate', color: 'bg-yellow-100 text-yellow-800 border-yellow-300', time: 'Within 24h', desc: 'Near misses, limited equipment damage, or moderate safety non-compliance.' },
          { level: 'High / Major', color: 'bg-orange-100 text-orange-800 border-orange-300', time: 'Within 4h', desc: 'First-aid injuries, temporary operational stoppage, or significant hazard exposure.' },
          { level: 'Critical', color: 'bg-red-100 text-red-800 border-red-300', time: 'Immediate (1 Hour)', desc: 'Hospitalization, major fire, total stoppage of activities, or immediate life threat.' },
        ]
      },
      roles: {
        heading: 'Roles & Responsibilities Matrix',
        desc: 'The platform provides role-tailored dashboards and permission controls to ensure segregation of duties:',
        list: [
          {
            role: 'Reporter (OC Reporter)',
            badge: 'Field / General Staff',
            badgeColor: 'bg-blue-100 text-blue-800',
            responsibilities: [
              'Promptly submit incidents, hazards, and near-misses with accurate facts.',
              'Tag exact map locations and upload supporting photos or videos.',
              'Track report progression and communicate via incident logs.'
            ]
          },
          {
            role: 'HSE Controller',
            badge: 'Triage & First Review',
            badgeColor: 'bg-amber-100 text-amber-800',
            responsibilities: [
              'Validate new tickets, adjust severity ratings, and categorize hazards.',
              'Assign responsible departments (Operations, IT, HR, Finance, Procurement, etc.).',
              'Quick-resolve and close minor observations directly.',
              'Escalate high-risk incidents for investigation.'
            ]
          },
          {
            role: 'Safety Manager',
            badge: 'Final Sign-off',
            badgeColor: 'bg-purple-100 text-purple-800',
            responsibilities: [
              'Review and approve Root Cause Analysis (RCA) findings.',
              'Approve action plans and verify closure evidence submitted by departments.',
              'Authorize final closure of major incidents and manage escalations.',
              'Monitor organization-wide analytics and performance KPIs.'
            ]
          },
          {
            role: 'Department Representatives (HR, Finance, Ops, IT, Procurement)',
            badge: 'Action Owners',
            badgeColor: 'bg-emerald-100 text-emerald-800',
            responsibilities: [
              'Receive tickets and tasks assigned to their specific department.',
              'Execute assigned corrective actions and upload mandatory resolution evidence.',
              'Notify HSE team once corrective actions are completed for approval.'
            ]
          },
          {
            role: 'Administrator',
            badge: 'System Governance',
            badgeColor: 'bg-slate-100 text-slate-800',
            responsibilities: [
              'Manage user accounts, roles, departments, and permission overrides.',
              'Toggle system maintenance mode and configure operational parameters.',
              'Full access to audit trails, system logs, and data exports.'
            ]
          }
        ]
      },
      wizard: {
        heading: 'Step-by-Step Reporting Guide',
        desc: 'The New Report Wizard is designed for fast, seamless submission even on mobile devices with low connectivity.',
        steps: [
          {
            step: '1',
            title: 'Incident Type & Time',
            desc: 'Select the classification (Incident, Near Miss, Safety Observation, Injury). Specify the exact date and occurrence time.',
            icon: ClipboardList
          },
          {
            step: '2',
            title: 'Geographic Location',
            desc: 'Click "Locate Me" for automatic GPS capture, or pick the exact spot on the interactive map with facility/zone details.',
            icon: MapPin
          },
          {
            step: '3',
            title: 'Hazard Classification & Description',
            desc: 'Choose hazard categories (Physical, Chemical, Biological, Ergonomic, Safety) and provide a concise, detailed narrative of what occurred.',
            icon: AlertTriangle
          },
          {
            step: '4',
            title: 'Photos & Attachments',
            desc: 'Attach photos taken directly from your camera or upload relevant documents (supports JPEG, PNG, PDF up to 15MB).',
            icon: Camera
          },
          {
            step: '5',
            title: 'Review & Submit',
            desc: 'Review summary details and press "Submit Incident". A unique reference ID (INC-2026-XXXXX) is generated and notifications are dispatched immediately.',
            icon: Send
          }
        ]
      },
      workflow: {
        heading: 'Incident Lifecycle & Workflow',
        desc: 'Every incident transitions through standardized stages based on risk level and action requirements:',
        stages: [
          { name: 'Submitted', color: 'border-blue-500 bg-blue-50/50', desc: 'Newly created ticket awaiting triage by the HSE Controller.' },
          { name: 'Under Review', color: 'border-amber-500 bg-amber-50/50', desc: 'Controller validates data, confirms severity, and assigns department or investigator.' },
          { name: 'In Action / Investigation', color: 'border-purple-500 bg-purple-50/50', desc: 'Assigned department executes corrective actions or safety team conducts RCA.' },
          { name: 'Pending Approval', color: 'border-indigo-500 bg-indigo-50/50', desc: 'Resolution evidence uploaded; awaiting formal review by Safety Management.' },
          { name: 'Closed', color: 'border-emerald-500 bg-emerald-50/50', desc: 'Fully approved, verified, and archived into safety records and analytics.' }
        ]
      },
      investigation: {
        heading: 'Root Cause Analysis (RCA) & CAPA',
        desc: 'Structured methodology for deep-dive investigation on high-risk and recurrent incidents:',
        rcaItems: [
          { title: 'Direct Causes', desc: 'Immediate substandard acts or unsafe workplace conditions triggering the event.' },
          { title: 'Root Causes (5-Whys / Ishikawa)', desc: 'Underlying organizational, procedural, training, or equipment design deficiencies.' },
          { title: 'CAPA Action Plans', desc: 'Assigned corrective actions with clear responsibilities, target dates, and deliverables.' },
          { title: 'Mandatory Evidence Verification', desc: 'Actions cannot be signed off without verifiable photo/document proof (Before & After).' }
        ]
      },
      faq: {
        heading: 'Frequently Asked Questions (FAQ)',
        desc: 'Quick answers to common operational and technical questions:',
        items: [
          { q: 'How do SMC employees log into the platform?', a: 'Employees log in with one click via Microsoft Single Sign-On (Sign in with Microsoft) using their official corporate credentials.' },
          { q: 'Can I submit reports without an internet connection?', a: 'Yes! The platform features Offline Mode. Reports created offline are stored safely on your device and automatically synced once connection is restored.' },
          { q: 'Who has authority to close tickets?', a: 'Minor tickets can be resolved by the HSE Controller. Moderate and Critical incidents require sign-off by the Safety Manager or System Administrator.' },
          { q: 'How do department representatives view their assigned tasks?', a: 'Department reps see their assigned tickets directly in their dashboard with instant badge indicators and email alerts.' },
          { q: 'How do I generate an official PDF Incident Report?', a: 'Open any incident ticket and click "Export PDF / Print Report" at the top to download a standardized, executive-ready report with full metadata and photos.' },
          { q: 'What do the Service Provider / Contractor fields mean on a ticket?', a: 'When an incident involves a contractor employee, the system captures three key data points: (1) Primary Representative — the main contact person from the contractor company (name, email, mobile). (2) Responsible Sponsoring Department — the internal SMC department that is responsible for / sponsors this contractor. (3) Company Representatives — a list of additional contacts from the same company for follow-up communications.' }
        ]
      }
    }
  };

  const tLang = isArabic ? content.ar : content.en;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-16" dir={isArabic ? 'rtl' : 'ltr'}>
      {/* ── Top Header Bar ── */}
      <header className="bg-slate-900 text-white sticky top-0 z-40 shadow-md">
        <div className="max-w-6xl mx-auto px-4 lg:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700 transition-all text-xs font-semibold"
            >
              {isArabic ? <ArrowRight size={15} /> : <ArrowLeft size={15} />}
              <span>{tLang.backToDashboard}</span>
            </button>
            <div className="h-5 w-px bg-slate-700 hidden sm:block" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm">
                <BookOpen size={16} />
              </div>
              <span className="font-bold text-sm text-white hidden sm:inline">
                {isArabic ? 'دليل المستخدم' : 'User Guide'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium border border-slate-700 transition-all shadow-sm"
              title={tLang.printGuide}
            >
              <Printer size={14} />
              <span className="hidden md:inline">{tLang.printGuide}</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero Section ── */}
      <section className="bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white py-10 px-4 lg:px-6 border-b border-slate-700/60 shadow-inner">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-400/30 text-blue-400 text-xs font-semibold uppercase tracking-wider mb-4">
            <ShieldCheck size={14} />
            <span>SMC HSE Incident Management Platform</span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-black text-white leading-tight mb-3">
            {tLang.title}
          </h1>
          <p className="text-slate-300 text-sm max-w-2xl mx-auto leading-relaxed">
            {tLang.subtitle}
          </p>

          {/* Quick Search */}
          <div className="mt-6 max-w-xl mx-auto relative">
            <Search className={`absolute ${isArabic ? 'right-3.5' : 'left-3.5'} top-1/2 -translate-y-1/2 text-slate-400`} size={16} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={tLang.searchPlaceholder}
              className={`w-full bg-slate-800/90 border border-slate-700 rounded-2xl py-3 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-400 transition-all ${isArabic ? 'pr-10 pl-4' : 'pl-10 pr-4'} shadow-lg`}
            />
          </div>
        </div>
      </section>

      {/* ── Navigation Tabs ── */}
      <div className="sticky top-16 z-30 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 lg:px-6 overflow-x-auto scrollbar-none">
          <div className="flex gap-2 py-2.5 min-w-max">
            {[
              { id: 'overview', label: tLang.tabs.overview, icon: ShieldCheck },
              { id: 'roles', label: tLang.tabs.roles, icon: Users },
              { id: 'wizard', label: tLang.tabs.wizard, icon: ClipboardList },
              { id: 'workflow', label: tLang.tabs.workflow, icon: Sliders },
              { id: 'investigation', label: tLang.tabs.investigation, icon: Search },
              { id: 'faq', label: tLang.tabs.faq, icon: HelpCircle },
            ].map(tab => {
              const active = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id as any); setSearchTerm(''); }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    active
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon size={15} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Tab Contents ── */}
      <main className="max-w-6xl mx-auto px-4 lg:px-6 mt-8">
        
        {/* 1. OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            <div className="bg-white rounded-2xl p-6 lg:p-8 border border-slate-200/80 shadow-sm">
              <h2 className="text-xl font-black text-slate-900 mb-3 flex items-center gap-2.5">
                <ShieldCheck className="text-blue-600" size={22} />
                <span>{tLang.overview.heading}</span>
              </h2>
              <p className="text-slate-600 text-sm leading-relaxed mb-6">
                {tLang.overview.desc}
              </p>

              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 border-b pb-2">
                {tLang.overview.pillarsTitle}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {tLang.overview.pillars.map((pillar, idx) => {
                  const Icon = pillar.icon;
                  return (
                    <div key={idx} className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:shadow-md transition-all flex items-start gap-3.5">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border ${pillar.color}`}>
                        <Icon size={20} />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm mb-1">{pillar.title}</h4>
                        <p className="text-xs text-slate-500 leading-relaxed">{pillar.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Severity Levels */}
            <div className="bg-white rounded-2xl p-6 lg:p-8 border border-slate-200/80 shadow-sm">
              <h3 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-2">
                <Flame className="text-amber-500" size={20} />
                <span>{tLang.overview.severityTitle}</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {tLang.overview.severities.map((sev, idx) => (
                  <div key={idx} className="p-4 rounded-xl border border-slate-200 bg-slate-50/40 hover:bg-white transition-all">
                    <div className="flex items-center justify-between mb-2">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-black border ${sev.color}`}>
                        {sev.level}
                      </span>
                      <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                        <Clock size={12} />
                        {sev.time}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">{sev.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 2. ROLES & RESPONSIBILITIES */}
        {activeTab === 'roles' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 lg:p-8 border border-slate-200/80 shadow-sm">
              <h2 className="text-xl font-black text-slate-900 mb-2 flex items-center gap-2.5">
                <Users className="text-blue-600" size={22} />
                <span>{tLang.roles.heading}</span>
              </h2>
              <p className="text-slate-500 text-sm mb-6 leading-relaxed">
                {tLang.roles.desc}
              </p>

              <div className="space-y-4">
                {tLang.roles.list.map((r, idx) => (
                  <div key={idx} className="border border-slate-200 rounded-2xl p-5 bg-slate-50/30 hover:bg-white hover:shadow-md transition-all">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <h3 className="font-bold text-slate-900 text-base">{r.role}</h3>
                      <span className={`text-[11px] font-bold px-3 py-1 rounded-full ${r.badgeColor}`}>
                        {r.badge}
                      </span>
                    </div>
                    <ul className="space-y-2">
                      {r.responsibilities.map((resp, rIdx) => (
                        <li key={rIdx} className="flex items-start gap-2.5 text-xs text-slate-600 leading-relaxed">
                          <CheckCircle className="text-emerald-500 flex-shrink-0 mt-0.5" size={14} />
                          <span>{resp}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 3. REPORTING WIZARD */}
        {activeTab === 'wizard' && (
          <div className="bg-white rounded-2xl p-6 lg:p-8 border border-slate-200/80 shadow-sm">
            <h2 className="text-xl font-black text-slate-900 mb-2 flex items-center gap-2.5">
              <ClipboardList className="text-blue-600" size={22} />
              <span>{tLang.wizard.heading}</span>
            </h2>
            <p className="text-slate-500 text-sm mb-8 leading-relaxed">
              {tLang.wizard.desc}
            </p>

            <div className="space-y-6 relative before:absolute before:inset-y-0 before:top-4 before:bottom-4 before:w-0.5 before:bg-blue-100 before:start-5 sm:before:start-6">
              {tLang.wizard.steps.map((st, idx) => {
                const Icon = st.icon;
                return (
                  <div key={idx} className="flex items-start gap-4 relative">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-blue-600 text-white font-black text-base flex items-center justify-center flex-shrink-0 shadow-md shadow-blue-600/30 z-10">
                      {st.step}
                    </div>
                    <div className="flex-1 bg-slate-50/70 border border-slate-200 rounded-2xl p-5 hover:bg-white hover:shadow-md transition-all">
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className="text-blue-600" size={17} />
                        <h3 className="font-bold text-slate-900 text-sm sm:text-base">{st.title}</h3>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{st.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 4. WORKFLOW & LIFECYCLE */}
        {activeTab === 'workflow' && (
          <div className="bg-white rounded-2xl p-6 lg:p-8 border border-slate-200/80 shadow-sm">
            <h2 className="text-xl font-black text-slate-900 mb-2 flex items-center gap-2.5">
              <Sliders className="text-blue-600" size={22} />
              <span>{tLang.workflow.heading}</span>
            </h2>
            <p className="text-slate-500 text-sm mb-8 leading-relaxed">
              {tLang.workflow.desc}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {tLang.workflow.stages.map((stage, idx) => (
                <div key={idx} className={`p-4 rounded-2xl border-2 ${stage.color} flex flex-col justify-between shadow-sm`}>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block mb-1">
                      {isArabic ? `المرحلة 0${idx + 1}` : `Stage 0${idx + 1}`}
                    </span>
                    <h3 className="font-bold text-slate-900 text-sm mb-2">{stage.name}</h3>
                    <p className="text-xs text-slate-600 leading-relaxed">{stage.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5. INVESTIGATION & CAPA */}
        {activeTab === 'investigation' && (
          <div className="bg-white rounded-2xl p-6 lg:p-8 border border-slate-200/80 shadow-sm">
            <h2 className="text-xl font-black text-slate-900 mb-2 flex items-center gap-2.5">
              <Search className="text-blue-600" size={22} />
              <span>{tLang.investigation.heading}</span>
            </h2>
            <p className="text-slate-500 text-sm mb-6 leading-relaxed">
              {tLang.investigation.desc}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tLang.investigation.rcaItems.map((item, idx) => (
                <div key={idx} className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:shadow-md transition-all">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs">
                      {idx + 1}
                    </div>
                    <h3 className="font-bold text-slate-900 text-sm">{item.title}</h3>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 6. FAQ */}
        {activeTab === 'faq' && (
          <div className="bg-white rounded-2xl p-6 lg:p-8 border border-slate-200/80 shadow-sm">
            <h2 className="text-xl font-black text-slate-900 mb-2 flex items-center gap-2.5">
              <HelpCircle className="text-blue-600" size={22} />
              <span>{tLang.faq.heading}</span>
            </h2>
            <p className="text-slate-500 text-sm mb-6 leading-relaxed">
              {tLang.faq.desc}
            </p>

            <div className="space-y-3">
              {tLang.faq.items.map((faq, idx) => {
                const isOpen = openFaq === idx;
                return (
                  <div key={idx} className="border border-slate-200 rounded-xl overflow-hidden transition-all">
                    <button
                      onClick={() => toggleFaq(idx)}
                      className="w-full p-4 text-start bg-slate-50/60 hover:bg-slate-100/70 flex items-center justify-between gap-3 transition-colors"
                    >
                      <span className="font-bold text-slate-900 text-sm">{faq.q}</span>
                      {isOpen ? <ChevronUp size={16} className="text-slate-500 flex-shrink-0" /> : <ChevronDown size={16} className="text-slate-500 flex-shrink-0" />}
                    </button>
                    {isOpen && (
                      <div className="p-4 bg-white border-t border-slate-100 text-xs sm:text-sm text-slate-600 leading-relaxed">
                        {faq.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </main>
    </div>
  );
};

export default UserGuide;
