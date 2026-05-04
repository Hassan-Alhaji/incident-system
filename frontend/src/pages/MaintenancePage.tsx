import { useTranslation } from 'react-i18next';
import { ShieldCheck, Wrench, Clock, Mail, Globe } from 'lucide-react';

const MaintenancePage = () => {
  const { i18n } = useTranslation();
  const isArabic = i18n.language.startsWith('ar');

  const toggleLang = () => {
    const next = isArabic ? 'en' : 'ar';
    i18n.changeLanguage(next);
    document.dir = next === 'ar' ? 'rtl' : 'ltr';
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 40%, #0f172a 100%)',
      }}
    >
      {/* Animated background blobs */}
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl animate-pulse" />
      <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      <div className="absolute top-1/3 left-1/4 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />

      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `radial-gradient(circle, #ffffff 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }}
      />

      {/* Language toggle */}
      <button
        onClick={toggleLang}
        className="absolute top-5 ltr:right-5 rtl:left-5 z-10 h-8 px-3 rounded-lg bg-white/5 backdrop-blur-sm border border-white/10 text-slate-400 hover:text-white text-xs font-semibold flex items-center gap-1.5 hover:bg-white/10 transition-all"
      >
        <Globe size={13} />
        {isArabic ? 'EN' : 'AR'}
      </button>

      {/* Main card */}
      <div className="relative z-10 w-full max-w-lg mx-4" dir={isArabic ? 'rtl' : 'ltr'}>
        {/* Top icon section */}
        <div className="text-center mb-6">
          <div className="relative inline-flex items-center justify-center">
            <div className="w-28 h-28 rounded-3xl bg-gradient-to-br from-amber-500/20 to-amber-600/5 border border-amber-500/20 flex items-center justify-center backdrop-blur-sm shadow-2xl shadow-amber-500/10">
              <div className="relative">
                <Wrench size={48} className="text-amber-400" style={{ animation: 'spin 8s linear infinite' }} />
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center border-2 border-slate-900">
                  <Clock size={10} className="text-slate-900" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Glass card */}
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
          {/* Title */}
          <h1 className="text-3xl font-black text-center text-white mb-2 tracking-tight">
            {isArabic ? 'المنصة تحت الصيانة' : 'Under Maintenance'}
          </h1>
          <p className="text-slate-400 text-center text-sm mb-8 leading-relaxed">
            {isArabic
              ? 'نعمل على تحسين المنصة لتقديم تجربة أفضل. سنعود قريباً بإذن الله.'
              : "We're working on improving the platform to serve you better. We'll be back shortly."}
          </p>

          {/* Status bars */}
          <div className="space-y-3 mb-8">
            {[
              {
                icon: <ShieldCheck size={14} />,
                en: 'System upgrade in progress',
                ar: 'جاري ترقية النظام',
                color: 'text-blue-400',
                bg: 'bg-blue-500/10 border-blue-500/20',
                barColor: 'bg-blue-500',
              },
              {
                icon: <Clock size={14} />,
                en: 'Estimated downtime: Minimal',
                ar: 'الوقت المتوقع: قريباً',
                color: 'text-amber-400',
                bg: 'bg-amber-500/10 border-amber-500/20',
                barColor: 'bg-amber-500',
              },
            ].map((item, i) => (
              <div key={i} className={`flex items-center gap-3 p-3.5 rounded-xl border ${item.bg}`}>
                <div className={`${item.color}`}>{item.icon}</div>
                <span className={`text-sm font-medium ${item.color}`}>
                  {isArabic ? item.ar : item.en}
                </span>
                <div className="ltr:ml-auto rtl:mr-auto flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 ${item.barColor} rounded-full animate-pulse`} />
                </div>
              </div>
            ))}
          </div>

          {/* Divider */}
          <div className="border-t border-white/5 my-6" />

          {/* Contact section */}
          <div className="text-center">
            <p className="text-slate-500 text-xs font-medium mb-3 uppercase tracking-wider">
              {isArabic ? 'للتواصل والاستفسارات' : 'Need Assistance?'}
            </p>
            <a
              href="mailto:safety@saudimotorsport.com"
              className="inline-flex items-center gap-2.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl px-5 py-3 transition-all group"
            >
              <div className="w-8 h-8 bg-emerald-500/15 rounded-lg flex items-center justify-center group-hover:bg-emerald-500/25 transition-colors">
                <Mail size={15} className="text-emerald-400" />
              </div>
              <div className="text-left ltr:text-left rtl:text-right">
                <p className="text-white text-sm font-bold" dir="ltr">safety@saudimotorsport.com</p>
                <p className="text-slate-500 text-[10px] font-medium">
                  {isArabic ? 'فريق السلامة والصحة المهنية' : 'HSE Safety Team'}
                </p>
              </div>
            </a>
          </div>
        </div>

        {/* Footer branding */}
        <div className="text-center mt-6 space-y-1.5">
          <div className="flex items-center justify-center gap-2">
            <div className="w-5 h-5 bg-blue-600 rounded-md flex items-center justify-center">
              <ShieldCheck size={11} className="text-white" />
            </div>
            <span className="text-slate-500 text-xs font-bold">SMC Incident Reporting</span>
          </div>
          <p className="text-slate-600 text-[10px]">HSE Management Platform</p>
        </div>
      </div>

      {/* CSS for wrench rotation animation */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          25% { transform: rotate(15deg); }
          50% { transform: rotate(0deg); }
          75% { transform: rotate(-15deg); }
          100% { transform: rotate(0deg); }
        }
      `}</style>
    </div>
  );
};

export default MaintenancePage;
