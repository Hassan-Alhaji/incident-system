import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle, Globe, Mail, Loader2,
  UserPlus, LogIn, Phone, Lightbulb, ArrowLeft, CheckCircle2,
} from 'lucide-react';
import api from '../utils/api';
import { getRandomSafetyTip } from '../utils/safetyTips';

const Login = () => {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'email' | 'otp' | 'register' | 'pending'>('email');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [testCode, setTestCode] = useState('');

  const [regFirstName, setRegFirstName] = useState('');
  const [regFatherName, setRegFatherName] = useState('');
  const [regLastName, setRegLastName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regMobile, setRegMobile] = useState('');
  const [regDepartment, setRegDepartment] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  const isArabic = i18n.language.startsWith('ar');
  const currentLang: 'ar' | 'en' = isArabic ? 'ar' : 'en';

  const [safetyTip, setSafetyTip] = useState(() => getRandomSafetyTip(currentLang));
  const [tipFade, setTipFade] = useState(true);

  useEffect(() => { if (user) navigate('/dashboard'); }, [user, navigate]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const rotateTip = useCallback(() => {
    setTipFade(false);
    setTimeout(() => { setSafetyTip(getRandomSafetyTip(currentLang)); setTipFade(true); }, 400);
  }, [currentLang]);

  useEffect(() => {
    const interval = setInterval(rotateTip, 12000);
    return () => clearInterval(interval);
  }, [rotateTip]);

  useEffect(() => { setSafetyTip(getRandomSafetyTip(currentLang)); }, [currentLang]);

  const toggleLang = () => {
    const next = isArabic ? 'en' : 'ar';
    i18n.changeLanguage(next);
    document.dir = next === 'ar' ? 'rtl' : 'ltr';
  };

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const response = await api.post('/auth/otp/request', { email });
      if (response.data.testCode) setTestCode(response.data.testCode);
      setStep('otp');
      setCountdown(60);
    } catch (err: any) {
      const errorCode = err.response?.data?.code;
      if (errorCode && t(`login.errors.${errorCode}`) !== `login.errors.${errorCode}`) {
        setError(t(`login.errors.${errorCode}`));
      } else {
        setError(err.response?.data?.message || t('login.errors.GENERIC_ERROR'));
      }
    } finally { setLoading(false); }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await api.post('/auth/otp/verify', { email, otp });
      const { token, ...userData } = res.data;
      login(token, userData);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || t('oc.login.invalidCode'));
    } finally { setLoading(false); }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!termsAccepted) {
      setError(isArabic
        ? 'يجب الموافقة على الشروط والأحكام للمتابعة'
        : 'You must accept the Terms & Conditions to continue');
      return;
    }
    const englishRegex = /^[A-Za-z\s]+$/;
    if (!englishRegex.test(regFirstName) || !englishRegex.test(regFatherName) || !englishRegex.test(regLastName)) {
      setError(t('errors.namesEnglishOnly', 'Names must be in English'));
      return;
    }
    setLoading(true);
    try {
      const response = await api.post('/auth/register', {
        firstName: regFirstName.trim(),
        fatherName: regFatherName.trim(),
        lastName: regLastName.trim(),
        department: regDepartment.trim(),
        email: regEmail.trim(),
        mobile: regMobile.trim(),
      });
      if (response.data.testCode) setTestCode(response.data.testCode);
      setStep('pending');
    } catch (err: any) {
      setError(err.response?.data?.message || t('oc.register.error'));
    } finally { setLoading(false); }
  };

  const handleBypassLogin = async (targetEmail: string) => {
    setError(''); setLoading(true);
    try {
      const response = await api.post('/auth/otp/request', { email: targetEmail });
      const bypassCode = response.data.testCode;
      if (bypassCode) {
        const res = await api.post('/auth/otp/verify', { email: targetEmail, otp: bypassCode });
        const { token, ...userData } = res.data;
        login(token, userData);
        navigate('/dashboard');
      } else {
        setEmail(targetEmail);
        setStep('otp');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Bypass login failed');
    } finally { setLoading(false); }
  };

  const inputClass =
    'w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 ' +
    'placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-400 ' +
    'transition-all focus:bg-white';

  return (
    <div className="min-h-screen flex relative">

      {/* ── Language toggle ── */}
      <button
        onClick={toggleLang}
        className="absolute top-4 ltr:right-4 rtl:left-4 z-20 h-8 px-3 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 hover:bg-white/15 transition-all lg:text-slate-500 lg:bg-white lg:border-slate-200 lg:text-slate-600 lg:hover:bg-slate-50 lg:hover:text-blue-600"
      >
        <Globe size={13} />
        {isArabic ? 'EN' : 'AR'}
      </button>

      {/* ── Left brand panel (desktop) ── */}
      <div 
        className="hidden lg:flex lg:w-5/12 xl:w-[45%] bg-slate-900 flex-col justify-between p-10 xl:p-14 relative overflow-hidden flex-shrink-0"
        style={{ backgroundImage: 'url(/assets/safety_bg.png)', backgroundSize: 'cover', backgroundPosition: 'center' }}
      >
        <div className="absolute inset-0 bg-slate-900/80 mix-blend-multiply pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent pointer-events-none" />
        
        {/* Decorative blobs */}
        <div className="absolute -top-32 -right-32 w-80 h-80 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-16 w-64 h-64 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top logo */}
        <div className="relative flex items-center gap-3">
          <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center shadow-lg p-1.5 flex-shrink-0">
            <img
              src="/smc-logo.png"
              alt="Saudi Motorsport"
              className="w-full h-full object-contain"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-tight">Saudi Motorsport</p>
            <p className="text-slate-400 text-[10px] font-medium tracking-wider uppercase">HSE Incident Platform</p>
          </div>
        </div>

        {/* Headline */}
        <div className="relative">
          <p className="text-blue-400 text-xs font-bold tracking-widest uppercase mb-4">
            {isArabic ? 'السلامة أولاً' : 'Safety First'}
          </p>
          <h2 className="text-4xl xl:text-[2.75rem] font-black text-white leading-[1.12] mb-5">
            {isArabic ? (
              <>السلامة هي<br /><span className="text-blue-400">مسؤولية الجميع</span></>
            ) : (
              <>Safety is<br />Everyone's<br /><span className="text-blue-400">Responsibility</span></>
            )}
          </h2>
          <p className="text-slate-300 text-sm leading-relaxed max-w-[22rem]">
            {isArabic 
              ? 'أبلغ عن الحوادث بشكل أسرع، وحقق بذكاء، وعزز ثقافة السلامة — كل ذلك في منصة واحدة.' 
              : 'Report incidents faster, investigate smarter, and drive lasting safety improvements — all in one platform.'}
          </p>

          {/* Stats row */}
          <div className="flex gap-5 mt-8">
            {[
              { label: isArabic ? 'أنواع البلاغات' : 'Incident Types', value: '6+' },
              { label: isArabic ? 'مراحل الاعتماد' : 'Workflow Stages', value: '7' },
              { label: isArabic ? 'ثنائي اللغة' : 'Bilingual', value: 'AR/EN' },
            ].map(stat => (
              <div key={stat.label}>
                <p className="text-2xl font-black text-white leading-none">{stat.value}</p>
                <p className="text-slate-500 text-[10px] font-medium mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Safety tip card */}
        <div
          onClick={rotateTip}
          className="relative bg-slate-800/60 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-5 cursor-pointer group hover:bg-slate-800/80 transition-all"
        >
          <div className="flex items-center gap-2 mb-2.5">
            <div className="w-6 h-6 bg-amber-500/15 rounded-lg flex items-center justify-center">
              <Lightbulb size={13} className="text-amber-400" />
            </div>
            <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
              {isArabic ? 'نصيحة توعوية' : 'Safety Tip'}
            </p>
            <span className="ltr:ml-auto rtl:mr-auto text-[9px] text-slate-600 group-hover:text-slate-500 transition-colors">
              {isArabic ? 'انقر للتغيير' : 'click to rotate'}
            </span>
          </div>
          <p
            className={`text-slate-300 text-sm leading-relaxed transition-opacity duration-300 ${tipFade ? 'opacity-100' : 'opacity-0'}`}
            dir={isArabic ? 'rtl' : 'ltr'}
          >
            {safetyTip}
          </p>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex-1 flex flex-col items-center justify-center bg-white px-6 py-12 lg:px-12">
        <div className="w-full max-w-[22rem]">

          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-10">
            <div className="w-24 h-24 mx-auto flex items-center justify-center mb-3">
              <img
                src="/smc-logo.png"
                alt="Saudi Motorsport"
                className="w-full h-full object-contain"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
            <h1 className="text-xl font-black text-slate-900">Saudi Motorsport</h1>
            <p className="text-slate-500 text-sm mt-1">HSE Incident Platform</p>
          </div>

          {/* ── Email step ── */}
          {step === 'email' && (
            <>
              <div className="mb-8" dir={isArabic ? 'rtl' : 'ltr'}>
                <h2 className="text-2xl font-black text-slate-900">{isArabic ? 'مرحباً بعودتك' : 'Welcome back'}</h2>
                <p className="text-slate-500 text-sm mt-1">{isArabic ? 'أدخل بريدك الإلكتروني لاستلام رمز الدخول.' : 'Enter your email to receive a sign-in code.'}</p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-5 flex items-center gap-2.5">
                  <AlertTriangle className="text-red-500 flex-shrink-0" size={15} />
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
              )}

              <form onSubmit={handleRequestOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide" dir={isArabic ? 'rtl' : 'ltr'}>
                    {isArabic ? 'البريد الإلكتروني' : 'Email Address'}
                  </label>
                  <div className="relative">
                    <Mail size={15} className="absolute ltr:left-3.5 rtl:right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email" value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t('login.emailPlaceholder')}
                      className={`${inputClass} ltr:pl-10 rtl:pr-10`}
                      required dir="ltr"
                    />
                  </div>
                </div>
                <button
                  type="submit" disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold py-2.5 rounded-xl transition-all shadow-sm shadow-blue-600/20 disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                >
                  {loading ? <Loader2 className="animate-spin" size={17} /> : <LogIn size={16} />}
                  {loading ? t('login.sendingCode') : t('login.sendCode')}
                </button>
              </form>

              <div className="mt-7 pt-6 border-t border-slate-100 text-center">
                <p className="text-slate-500 text-xs mb-3">{t('oc.register.noAccount')}</p>
                <button
                  onClick={() => { setStep('register'); setError(''); }}
                  className="w-full border border-blue-200 text-blue-600 hover:bg-blue-50 font-semibold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 text-sm"
                >
                  <UserPlus size={15} />
                  {t('oc.register.createAccount')}
                </button>
              </div>

              {/* DEV BYPASS SECTION - EASILY REMOVABLE */}
              <div className="mt-8 pt-6 border-t border-dashed border-slate-200">
                <p className="text-center text-[10px] font-bold text-slate-400 mb-3 uppercase tracking-wider">Dev Login Bypass</p>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {[
                    { label: 'المبلغ', email: 'reporter@test.com', icon: UserPlus },
                    { label: 'الكنترولر', email: 'c@test.com', icon: Lightbulb },
                    { label: 'المالية', email: 'Fin_rep@test.com', icon: Globe },
                    { label: 'HR', email: 'HR_rep@test.com', icon: UserPlus },
                    { label: 'IT', email: 'IT_rep@test.com', icon: Phone },
                    { label: 'المشتريات', email: 'Pre_rep@test.com', icon: LogIn },
                    { label: 'HSE Mgr', email: 'asamman@saudimotorsport.com', icon: AlertTriangle },
                  ].map(role => (
                    <button
                      key={role.email}
                      type="button"
                      disabled={loading}
                      onClick={() => handleBypassLogin(role.email)}
                      className="flex flex-col items-center justify-center gap-1.5 p-2 bg-slate-50 border border-slate-200 rounded-xl hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 transition-all text-slate-500 text-[10px] text-center disabled:opacity-50"
                    >
                      <role.icon size={16} />
                      <span className="font-medium leading-tight">{role.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── OTP step ── */}
          {step === 'otp' && (
            <>
              <button
                onClick={() => { setStep('email'); setOtp(''); setError(''); setTestCode(''); }}
                className="flex items-center gap-1.5 text-slate-400 hover:text-slate-700 text-xs font-medium mb-7 transition-colors group" dir={isArabic ? 'rtl' : 'ltr'}
              >
                <ArrowLeft size={13} className={`transition-transform ${isArabic ? 'group-hover:translate-x-0.5 rotate-180' : 'group-hover:-translate-x-0.5'}`} />
                {isArabic ? 'رجوع' : 'Back'}
              </button>

              <div className="mb-8" dir={isArabic ? 'rtl' : 'ltr'}>
                <h2 className="text-2xl font-black text-slate-900">{isArabic ? 'تحقق من بريدك الإلكتروني' : 'Check your email'}</h2>
                <p className="text-slate-500 text-sm mt-1.5">
                  {isArabic ? 'أرسلنا رمزاً مكوناً من 6 أرقام إلى' : 'We sent a 6-digit code to'}{' '}
                  <span className="font-semibold text-slate-700" dir="ltr">{email}</span>
                </p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-5 flex items-center gap-2.5">
                  <AlertTriangle className="text-red-500 flex-shrink-0" size={15} />
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
              )}

              {testCode && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5 text-center">
                  <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wider mb-1.5">
                    {isArabic ? 'وضع التطوير — الرمز الخاص بك' : 'Dev Mode — Your Code'}
                  </p>
                  <p className="text-3xl font-black font-mono text-blue-600 tracking-[0.35em]">{testCode}</p>
                </div>
              )}

              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide" dir={isArabic ? 'rtl' : 'ltr'}>
                    {isArabic ? 'رمز التحقق' : 'Verification Code'}
                  </label>
                  <input
                    type="text" inputMode="numeric" value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 text-center text-2xl tracking-[0.35em] font-mono placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-400 transition-all focus:bg-white"
                    maxLength={6} required dir="ltr"
                  />
                </div>
                <button
                  type="submit" disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl transition-all shadow-sm shadow-blue-600/20 disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                >
                  {loading && <Loader2 className="animate-spin" size={17} />}
                  {loading ? t('login.verifying') : t('login.verifyLogin')}
                </button>

                <div className="flex justify-between text-xs text-slate-500 pt-1">
                  <button
                    type="button"
                    onClick={() => { setStep('email'); setOtp(''); setError(''); setTestCode(''); }}
                    className="hover:text-slate-800 transition-colors"
                  >
                    {t('login.tryDifferentEmail')}
                  </button>
                  {countdown > 0 ? (
                    <span>{t('login.resendIn')} {countdown}s</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleRequestOtp({ preventDefault: () => {} } as any)}
                      className="text-blue-600 hover:text-blue-700 font-semibold transition-colors"
                    >
                      {t('login.resendCode')}
                    </button>
                  )}
                </div>
              </form>
            </>
          )}

          {/* ── Register step ── */}
          {step === 'register' && (
            <>
              <button
                onClick={() => { setStep('email'); setError(''); }}
                className="flex items-center gap-1.5 text-slate-400 hover:text-slate-700 text-xs font-medium mb-7 transition-colors group" dir={isArabic ? 'rtl' : 'ltr'}
              >
                <ArrowLeft size={13} className={`transition-transform ${isArabic ? 'group-hover:translate-x-0.5 rotate-180' : 'group-hover:-translate-x-0.5'}`} />
                {isArabic ? 'العودة لتسجيل الدخول' : 'Back to sign in'}
              </button>

              <div className="mb-7" dir={isArabic ? 'rtl' : 'ltr'}>
                <h2 className="text-2xl font-black text-slate-900">{isArabic ? 'إنشاء حساب جديد' : 'Create account'}</h2>
                <p className="text-slate-500 text-sm mt-1">{isArabic ? 'قم بالتسجيل للإبلاغ عن حوادث Off-Circuit.' : 'Register to report off-circuit incidents.'}</p>
                <p className="text-amber-600 text-xs mt-2 font-medium">
                  {isArabic ? '⚠ يجب إدخال الأسماء باللغة الإنجليزية' : '⚠ All fields must be in English'}
                </p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-5 flex items-center gap-2.5">
                  <AlertTriangle className="text-red-500 flex-shrink-0" size={15} />
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
              )}

              <form onSubmit={handleRegister} className="space-y-3.5" dir="ltr">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div dir={isArabic ? 'rtl' : 'ltr'}>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                      {isArabic ? 'الاسم الأول *' : 'First Name *'}
                    </label>
                    <input
                      type="text" value={regFirstName}
                      onChange={(e) => setRegFirstName(e.target.value)}
                      placeholder="John" className={inputClass} required dir="ltr"
                    />
                  </div>
                  <div dir={isArabic ? 'rtl' : 'ltr'}>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                      {isArabic ? 'اسم الأب *' : 'Father Name *'}
                    </label>
                    <input
                      type="text" value={regFatherName}
                      onChange={(e) => setRegFatherName(e.target.value)}
                      placeholder="William" className={inputClass} required dir="ltr"
                    />
                  </div>
                  <div dir={isArabic ? 'rtl' : 'ltr'}>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                      {isArabic ? 'الاسم الأخير *' : 'Last Name *'}
                    </label>
                    <input
                      type="text" value={regLastName}
                      onChange={(e) => setRegLastName(e.target.value)}
                      placeholder="Doe" className={inputClass} required dir="ltr"
                    />
                  </div>
                </div>
                <div dir={isArabic ? 'rtl' : 'ltr'}>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                    {isArabic ? 'القسم *' : 'Department *'}
                  </label>
                  <input
                    type="text" value={regDepartment}
                    onChange={(e) => setRegDepartment(e.target.value)}
                    placeholder="e.g. IT, HSE, HR" className={inputClass} required dir="ltr"
                  />
                </div>
                <div dir={isArabic ? 'rtl' : 'ltr'}>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                    {isArabic ? 'البريد الإلكتروني *' : 'Email Address *'}
                  </label>
                  <div className="relative">
                    <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email" value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="name@company.com"
                      className={`${inputClass} pl-10`} required dir="ltr"
                    />
                  </div>
                </div>
                <div dir={isArabic ? 'rtl' : 'ltr'}>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                    {isArabic ? 'رقم الجوال *' : 'Mobile Number *'}
                  </label>
                  <div className="relative">
                    <Phone size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="tel" value={regMobile}
                      onChange={(e) => setRegMobile(e.target.value.replace(/[^0-9+]/g, ''))}
                      placeholder="+966 5XX XXX XXX"
                      className={`${inputClass} pl-10`} required dir="ltr" inputMode="numeric"
                    />
                  </div>
                </div>
                {/* Terms & Conditions acceptance */}
                <div className="pt-2" dir={isArabic ? 'rtl' : 'ltr'}>
                  <label className="flex items-start gap-2.5 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={termsAccepted}
                      onChange={(e) => setTermsAccepted(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500/30 cursor-pointer flex-shrink-0"
                    />
                    <span className="text-xs text-slate-600 leading-relaxed select-none">
                      {isArabic ? 'لقد قرأت وأوافق على ' : 'I have read and agree to the '}
                      <button
                        type="button"
                        onClick={() => setShowTerms(true)}
                        className="text-blue-600 hover:text-blue-700 font-bold underline underline-offset-2"
                      >
                        {isArabic ? 'الشروط والأحكام' : 'Terms & Conditions'}
                      </button>
                      {isArabic ? ' الخاصة بشركة المحركات السعودية.' : ' of Saudi Motorsport Company.'}
                    </span>
                  </label>
                </div>

                <button
                  type="submit" disabled={loading || !termsAccepted}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl transition-all shadow-sm shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm mt-1"
                >
                  {loading ? <Loader2 className="animate-spin" size={17} /> : <UserPlus size={16} />}
                  {loading ? (isArabic ? 'جاري الإنشاء...' : 'Creating Account…') : (isArabic ? 'إنشاء حساب' : 'Create Account')}
                </button>
              </form>
            </>
          )}

          {/* Terms & Conditions Modal */}
          {showTerms && (
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center p-4"
              style={{ background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)' }}
              onClick={() => setShowTerms(false)}
            >
              <div
                className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                onClick={(e) => e.stopPropagation()}
                dir={isArabic ? 'rtl' : 'ltr'}
              >
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-white flex items-start justify-between gap-3 flex-shrink-0">
                  <div>
                    <h3 className="text-lg font-black text-slate-900">
                      {isArabic ? 'الشروط والأحكام' : 'Terms & Conditions'}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {isArabic ? 'منصة الأمن والسلامة — شركة المحركات السعودية' : 'HSE Platform — Saudi Motorsport Company'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowTerms(false)}
                    className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all flex items-center justify-center flex-shrink-0"
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </div>

                {/* Body — scrollable */}
                <div className="overflow-y-auto px-6 py-5 space-y-5 text-sm text-slate-700 leading-relaxed">
                  {/* Arabic block */}
                  <section dir="rtl" className="text-right">
                    <h4 className="font-black text-slate-900 mb-2 text-base">📋 الشروط والأحكام</h4>
                    <p className="text-xs text-slate-500 mb-3">آخر تحديث: {new Date().getFullYear()}</p>

                    <p className="mb-3">
                      مرحباً بك في منصة الأمن والسلامة التابعة لشركة المحركات السعودية. باستخدامك لهذه المنصة، فإنك توافق على الشروط والأحكام التالية:
                    </p>

                    <div className="space-y-3">
                      <div>
                        <p className="font-bold text-slate-900">1. السرية وحماية المعلومات</p>
                        <ul className="list-disc pr-5 mt-1 space-y-1 text-xs">
                          <li>تلتزم بالحفاظ على سرية جميع البيانات والمعلومات التي تطّلع عليها من خلال المنصة.</li>
                          <li>لا يجوز مشاركة بيانات الدخول (البريد الإلكتروني، رمز التحقق) مع أي شخص آخر.</li>
                          <li>يُحظر الإفصاح عن تفاصيل التذاكر أو الحوادث لأي جهة غير مخوّلة داخل أو خارج الشركة.</li>
                          <li>أي إخلال بالسرية قد يُعرّضك للمساءلة القانونية والتأديبية وفقاً للأنظمة المعمول بها في المملكة العربية السعودية.</li>
                        </ul>
                      </div>

                      <div>
                        <p className="font-bold text-slate-900">2. صحة البيانات والمسؤولية</p>
                        <ul className="list-disc pr-5 mt-1 space-y-1 text-xs">
                          <li>تلتزم بتقديم بيانات صحيحة ودقيقة وكاملة عند التسجيل وعند رفع البلاغات.</li>
                          <li>أنت المسؤول الوحيد عن صحة المعلومات التي تُدخلها في المنصة.</li>
                          <li>تقديم بيانات غير صحيحة أو مضلّلة أو بلاغات كاذبة قد يُعرّضك لإجراءات تأديبية وقانونية.</li>
                          <li>تتعهد بتحديث بياناتك الشخصية فور أي تغيير (الجوال، البريد، القسم).</li>
                        </ul>
                      </div>

                      <div>
                        <p className="font-bold text-slate-900">3. إخلاء المسؤولية</p>
                        <ul className="list-disc pr-5 mt-1 space-y-1 text-xs">
                          <li>لا تتحمل <strong>شركة المحركات السعودية</strong> أي مسؤولية عن عدم صحة البيانات المُدخَلة من قِبل المستخدمين.</li>
                          <li>الشركة غير مسؤولة عن أي أضرار مباشرة أو غير مباشرة ناتجة عن بلاغات غير صحيحة أو ناقصة.</li>
                          <li>تُقدَّم المنصة "كما هي" دون ضمانات صريحة أو ضمنية تتعلق بدقة المحتوى المُقدَّم من المستخدمين.</li>
                          <li>قرارات الإغلاق والمخالفات تستند إلى البيانات المُقدَّمة، والشركة غير ملزمة بالتحقق المستقل من كل بلاغ.</li>
                        </ul>
                      </div>

                      <div>
                        <p className="font-bold text-slate-900">4. الاستخدام المقبول</p>
                        <ul className="list-disc pr-5 mt-1 space-y-1 text-xs">
                          <li>تُستخدم المنصة حصراً لأغراض الإبلاغ عن قضايا الأمن والسلامة والبيئة (HSE).</li>
                          <li>يُحظر استخدام المنصة لأي غرض غير مشروع أو يتعارض مع سياسات الشركة.</li>
                          <li>يُحظر إساءة استخدام النظام، أو محاولة الوصول غير المصرّح به، أو تعطيل الخدمة.</li>
                          <li>قد يؤدي مخالفة هذه الشروط إلى تعليق أو إلغاء حسابك دون إشعار مسبق.</li>
                        </ul>
                      </div>

                      <div>
                        <p className="font-bold text-slate-900">5. حماية البيانات الشخصية</p>
                        <ul className="list-disc pr-5 mt-1 space-y-1 text-xs">
                          <li>تُجمَع بياناتك الشخصية لأغراض إدارة الأمن والسلامة فقط.</li>
                          <li>لن تُشارَك بياناتك مع أي طرف ثالث إلا بموجب التزام قانوني أو نظامي.</li>
                          <li>تُحفظ البيانات وفقاً لأفضل ممارسات الأمن السيبراني ونظام حماية البيانات الشخصية في المملكة العربية السعودية.</li>
                        </ul>
                      </div>

                      <div>
                        <p className="font-bold text-slate-900">6. التعديلات</p>
                        <p className="text-xs mt-1">
                          تحتفظ شركة المحركات السعودية بحق تعديل هذه الشروط في أي وقت. استمرار استخدامك للمنصة بعد التعديل يُعتبر موافقةً ضمنية على الشروط المُحدَّثة.
                        </p>
                      </div>

                      <div>
                        <p className="font-bold text-slate-900">7. الموافقة</p>
                        <p className="text-xs mt-1">
                          بالنقر على "أوافق على الشروط والأحكام" وإكمال التسجيل، فإنك تُقرّ بأنك قد قرأت هذه الشروط وفهمتها ووافقت على الالتزام بها.
                        </p>
                      </div>
                    </div>
                  </section>

                  <div className="border-t border-slate-200" />

                  {/* English block */}
                  <section dir="ltr" className="text-left">
                    <h4 className="font-black text-slate-900 mb-2 text-base">📋 Terms & Conditions</h4>
                    <p className="text-xs text-slate-500 mb-3">Last updated: {new Date().getFullYear()}</p>

                    <p className="mb-3">
                      Welcome to the HSE Platform of Saudi Motorsport Company. By using this platform, you agree to the following Terms & Conditions:
                    </p>

                    <div className="space-y-3">
                      <div>
                        <p className="font-bold text-slate-900">1. Confidentiality & Information Protection</p>
                        <ul className="list-disc pl-5 mt-1 space-y-1 text-xs">
                          <li>You commit to maintaining the confidentiality of all data and information accessed through this platform.</li>
                          <li>Login credentials (email, verification code) must not be shared with any other person.</li>
                          <li>Disclosing ticket or incident details to any unauthorized party — inside or outside the company — is strictly prohibited.</li>
                          <li>Any breach of confidentiality may expose you to legal and disciplinary action under the laws of the Kingdom of Saudi Arabia.</li>
                        </ul>
                      </div>

                      <div>
                        <p className="font-bold text-slate-900">2. Data Accuracy & Responsibility</p>
                        <ul className="list-disc pl-5 mt-1 space-y-1 text-xs">
                          <li>You commit to providing accurate, truthful, and complete information during registration and when submitting reports.</li>
                          <li>You are solely responsible for the accuracy of the information you enter into the platform.</li>
                          <li>Submitting inaccurate, misleading, or false reports may result in disciplinary and legal action.</li>
                          <li>You agree to update your personal information promptly upon any change (mobile, email, department).</li>
                        </ul>
                      </div>

                      <div>
                        <p className="font-bold text-slate-900">3. Disclaimer of Liability</p>
                        <ul className="list-disc pl-5 mt-1 space-y-1 text-xs">
                          <li><strong>Saudi Motorsport Company</strong> bears no responsibility for the accuracy of data entered by users.</li>
                          <li>The Company is not liable for any direct or indirect damages resulting from incorrect or incomplete reports.</li>
                          <li>The platform is provided "as is" without express or implied warranties regarding the accuracy of user-submitted content.</li>
                          <li>Closure and violation decisions are based on the data provided; the Company is not obligated to independently verify every report.</li>
                        </ul>
                      </div>

                      <div>
                        <p className="font-bold text-slate-900">4. Acceptable Use</p>
                        <ul className="list-disc pl-5 mt-1 space-y-1 text-xs">
                          <li>The platform is used exclusively for reporting Health, Safety, and Environment (HSE) matters.</li>
                          <li>Use of the platform for any unlawful purpose or in violation of company policies is prohibited.</li>
                          <li>Misuse of the system, unauthorized access attempts, or service disruption is prohibited.</li>
                          <li>Violation of these terms may result in suspension or termination of your account without prior notice.</li>
                        </ul>
                      </div>

                      <div>
                        <p className="font-bold text-slate-900">5. Personal Data Protection</p>
                        <ul className="list-disc pl-5 mt-1 space-y-1 text-xs">
                          <li>Your personal data is collected solely for HSE management purposes.</li>
                          <li>Your data will not be shared with any third party except as required by law or regulation.</li>
                          <li>Data is stored in accordance with cybersecurity best practices and the Personal Data Protection Law of the Kingdom of Saudi Arabia.</li>
                        </ul>
                      </div>

                      <div>
                        <p className="font-bold text-slate-900">6. Modifications</p>
                        <p className="text-xs mt-1">
                          Saudi Motorsport Company reserves the right to modify these terms at any time. Your continued use of the platform after any modification constitutes implicit acceptance of the updated terms.
                        </p>
                      </div>

                      <div>
                        <p className="font-bold text-slate-900">7. Acceptance</p>
                        <p className="text-xs mt-1">
                          By clicking "I agree to the Terms & Conditions" and completing registration, you acknowledge that you have read, understood, and agreed to be bound by these terms.
                        </p>
                      </div>
                    </div>
                  </section>
                </div>

                {/* Footer */}
                <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowTerms(false)}
                    className="px-4 py-2 text-sm font-bold text-slate-600 hover:text-slate-800 transition-colors"
                  >
                    {isArabic ? 'إغلاق' : 'Close'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setTermsAccepted(true); setShowTerms(false); }}
                    className="px-5 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm shadow-blue-500/30 transition-all flex items-center gap-2"
                  >
                    <CheckCircle2 size={15} />
                    {isArabic ? 'أوافق' : 'I Agree'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Pending activation step ── */}
          {step === 'pending' && (
            <div className="text-center" dir={isArabic ? 'rtl' : 'ltr'}>
              <div className="w-16 h-16 bg-emerald-50 rounded-2xl mx-auto flex items-center justify-center mb-5">
                <CheckCircle2 className="text-emerald-500" size={32} />
              </div>
              <h2 className="text-2xl font-black text-slate-900 mb-2">{isArabic ? 'تم إنشاء الحساب!' : 'Account Created!'}</h2>
              <p className="text-slate-500 text-sm leading-relaxed mb-2">
                {isArabic ? 'حسابك في انتظار التفعيل.' : 'Your account is pending activation.'}
              </p>
              <p className="text-slate-400 text-sm mb-8">
                {isArabic ? 'سيقوم مسؤول النظام بمراجعة حسابك وتفعيله. ستتمكن من تسجيل الدخول بمجرد الموافقة.' : 'An administrator will review and activate your account. You\'ll be able to sign in once approved.'}
              </p>
              <button
                onClick={() => { setStep('email'); setError(''); }}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl transition-all shadow-sm shadow-blue-600/20 flex items-center justify-center gap-2 text-sm"
              >
                <LogIn size={16} />
                {isArabic ? 'العودة لتسجيل الدخول' : 'Back to Sign In'}
              </button>
            </div>
          )}

          {/* Mobile safety tip */}
          <div
            onClick={rotateTip}
            className="lg:hidden mt-8 bg-amber-50 border border-amber-100 rounded-2xl p-4 cursor-pointer"
          >
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb size={13} className="text-amber-500 flex-shrink-0" />
              <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Safety Tip</p>
            </div>
            <p
              className={`text-sm text-amber-900 leading-relaxed transition-opacity duration-300 ${tipFade ? 'opacity-100' : 'opacity-0'}`}
              dir={isArabic ? 'rtl' : 'ltr'}
            >
              {safetyTip}
            </p>
          </div>

          <p className="text-center text-slate-400 text-xs mt-8">
            SMC HSE Department · All rights reserved
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
