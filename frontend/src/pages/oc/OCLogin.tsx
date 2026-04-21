import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Globe, Mail, ShieldCheck, Loader2, UserPlus, LogIn, User, Phone } from 'lucide-react';
import api from '../../utils/api';

const OCLogin = () => {
 const { login, user } = useAuth();
 const navigate = useNavigate();
 const { t, i18n } = useTranslation();
 const [email, setEmail] = useState('');
 const [otp, setOtp] = useState('');
 const [step, setStep] = useState<'email' | 'otp' | 'register' | 'pending'>('email');
 const [loading, setLoading] = useState(false);
 const [error, setError] = useState('');
 const [success, setSuccess] = useState('');
 const [countdown, setCountdown] = useState(0);
 const [testCode, setTestCode] = useState('');

 // Registration fields
 const [regFirstName, setRegFirstName] = useState('');
 const [regLastName, setRegLastName] = useState('');
 const [regEmail, setRegEmail] = useState('');
 const [regMobile, setRegMobile] = useState('');

 useEffect(() => {
 if (user) navigate('/oc/dashboard');
 }, [user, navigate]);

 useEffect(() => {
 if (countdown > 0) {
 const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
 return () => clearTimeout(timer);
 }
 }, [countdown]);

 const toggleLang = () => {
 const next = i18n.language.startsWith('ar') ? 'en' : 'ar';
 i18n.changeLanguage(next);
 document.dir = next === 'ar' ? 'rtl' : 'ltr';
 };

 const handleRequestOtp = async (e: React.FormEvent) => {
 e.preventDefault();
 setError('');
 setSuccess('');
 setLoading(true);
 try {
 const response = await api.post('/auth/otp/request', { email });
 if (response.data.testCode) {
 setTestCode(response.data.testCode);
 }
 setStep('otp');
 setCountdown(60);
 } catch (err: any) {
 const errorCode = err.response?.data?.code;
 if (errorCode && t(`login.errors.${errorCode}`) !== `login.errors.${errorCode}`) {
 setError(t(`login.errors.${errorCode}`));
 } else {
 setError(err.response?.data?.message || t('login.errors.GENERIC_ERROR'));
 }
 } finally {
 setLoading(false);
 }
 };

 const handleVerifyOtp = async (e: React.FormEvent) => {
 e.preventDefault();
 setError('');
 setLoading(true);
 try {
 const res = await api.post('/auth/otp/verify', { email, otp });
 const { token, ...userData } = res.data;
 login(token, userData);
 navigate('/oc/dashboard');
 } catch (err: any) {
 setError(err.response?.data?.message || t('oc.login.invalidCode'));
 } finally {
 setLoading(false);
 }
 };

 const handleRegister = async (e: React.FormEvent) => {
 e.preventDefault();
 setError('');
 setSuccess('');

 // English-only name validation
 const englishRegex = /^[A-Za-z\s]+$/;
 if (!englishRegex.test(regFirstName) || !englishRegex.test(regLastName)) {
 setError('Names must be in English letters only.');
 return;
 }

 setLoading(true);
 try {
 const response = await api.post('/auth/register', {
 firstName: regFirstName.trim(),
 lastName: regLastName.trim(),
 email: regEmail.trim(),
 mobile: regMobile.trim()
 });

 if (response.data.testCode) {
 setTestCode(response.data.testCode);
 }

 // Show pending activation message
 setStep('pending');
 setSuccess('');
 } catch (err: any) {
 setError(err.response?.data?.message || t('oc.register.error'));
 } finally {
 setLoading(false);
 }
 };

 const isArabic = i18n.language.startsWith('ar');

 return (
 <div className="min-h-screen bg-[#f0f2f5] flex items-center justify-center p-4">
 {/* Language Toggle */}
 <button onClick={toggleLang}
 className="absolute top-4 right-4 p-2 rounded-lg bg-white border border-gray-200 text-gray-800 hover:text-blue-500 transition-all z-10">
 <Globe size={18} />
 </button>

 <div className="w-full max-w-sm">
 {/* Logo/Brand */}
 <div className="text-center mb-8">
 <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-lg shadow-blue-600/20">
 <ShieldCheck className="text-white" size={32} />
 </div>
 <h1 className="text-2xl font-bold text-gray-900">{t('oc.login.title')}</h1>
 <p className="text-gray-500 text-sm mt-1">{t('oc.login.subtitle')}</p>
 </div>

 {/* Login/Register Card */}
 <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
 {error && (
 <div className="bg-red-500/10 border border-red-500/30 rounded-xl shadow-sm p-3 mb-4 flex items-center gap-2">
 <AlertTriangle className="text-red-400 flex-shrink-0" size={16} />
 <p className="text-red-400 text-base">{error}</p>
 </div>
 )}
 {success && (
 <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl shadow-sm p-3 mb-4 flex items-center gap-2">
 <ShieldCheck className="text-emerald-400 flex-shrink-0" size={16} />
 <p className="text-emerald-400 text-base">{success}</p>
 </div>
 )}

 {step === 'email' ? (
 <>
 <form onSubmit={handleRequestOtp} className="space-y-4">
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-2">
 <Mail size={13} className="inline mr-1 mb-0.5" />
 {t('login.emailLabel')}
 </label>
 <input
 type="email"
 value={email}
 onChange={(e) => setEmail(e.target.value)}
 placeholder={t('login.emailPlaceholder')}
 className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all text-sm shadow-sm"
 required
 dir="ltr"
 />
 </div>
 <button type="submit" disabled={loading}
 className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-all shadow-sm disabled:opacity-50 flex items-center justify-center gap-2 text-sm">
 {loading ? <Loader2 className="animate-spin" size={20} /> : <LogIn size={18} />}
 {loading ? t('login.sendingCode') : t('login.sendCode')}
 </button>
 </form>

 {/* Register Link */}
 <div className="mt-5 pt-5 border-t border-gray-200 text-center">
 <p className="text-gray-500 text-sm mb-3">{t('oc.register.noAccount')}</p>
 <button
 onClick={() => { setStep('register'); setError(''); setSuccess(''); }}
 className="w-full border border-blue-600/40 text-blue-500 hover:bg-blue-600/10 font-semibold py-2.5 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 text-base"
 >
 <UserPlus size={16} />
 {t('oc.register.createAccount')}
 </button>
 </div>
 </>
 ) : step === 'register' ? (
 <>
 <div className="text-center mb-4">
 <div className="w-10 h-10 bg-blue-600/10 rounded-xl shadow-sm mx-auto flex items-center justify-center mb-2">
 <UserPlus className="text-blue-500" size={22} />
 </div>
 <h3 className="text-gray-800 font-semibold text-lg">Create Account</h3>
 <p className="text-gray-600 text-sm mt-1">Register to report off-circuit incidents</p>
 <p className="text-amber-500 text-[10px] mt-1">⚠ All fields must be in English</p>
 </div>

 <form onSubmit={handleRegister} className="space-y-3" dir="ltr">
 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="block text-base font-medium text-gray-800 mb-1">
 First Name *
 </label>
 <input
 type="text"
 value={regFirstName}
 onChange={(e) => setRegFirstName(e.target.value)}
 placeholder="John"
 className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600/50 focus:border-blue-600 transition-all text-base"
 required
 dir="ltr"
 />
 </div>
 <div>
 <label className="block text-base font-medium text-gray-800 mb-1">
 Last Name *
 </label>
 <input
 type="text"
 value={regLastName}
 onChange={(e) => setRegLastName(e.target.value)}
 placeholder="Doe"
 className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600/50 focus:border-blue-600 transition-all text-base"
 required
 dir="ltr"
 />
 </div>
 </div>

 <div>
 <label className="block text-base font-medium text-gray-800 mb-1">
 <Mail size={12} className="inline mr-1 mb-0.5" />
 Email Address *
 </label>
 <input
 type="email"
 value={regEmail}
 onChange={(e) => setRegEmail(e.target.value)}
 placeholder="name@company.com"
 className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600/50 focus:border-blue-600 transition-all text-base"
 required
 dir="ltr"
 />
 </div>

 <div>
 <label className="block text-base font-medium text-gray-800 mb-1">
 <Phone size={12} className="inline mr-1 mb-0.5" />
 Mobile Number *
 </label>
 <input
 type="tel"
 value={regMobile}
 onChange={(e) => setRegMobile(e.target.value)}
 placeholder="+966 5XX XXX XXX"
 className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600/50 focus:border-blue-600 transition-all text-base"
 dir="ltr"
 required
 />
 </div>

 <button type="submit" disabled={loading}
 className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-all shadow-sm disabled:opacity-50 flex items-center justify-center gap-2 text-sm mt-2">
 {loading ? <Loader2 className="animate-spin" size={20} /> : <UserPlus size={18} />}
 {loading ? 'Creating Account...' : 'Create Account'}
 </button>
 </form>

 {/* Back to login */}
 <div className="mt-4 pt-4 border-t border-gray-200 text-center">
 <button
 onClick={() => { setStep('email'); setError(''); setSuccess(''); }}
 className="text-gray-800 hover:text-blue-500 text-base transition-colors flex items-center justify-center gap-1 mx-auto"
 >
 <LogIn size={14} />
 {t('oc.register.haveAccount')}
 </button>
 </div>
 </>
 ) : step === 'pending' ? (
 <div className="text-center py-4">
 <div className="w-16 h-16 bg-blue-600/10 rounded-2xl mx-auto flex items-center justify-center mb-4">
 <ShieldCheck className="text-blue-500" size={32} />
 </div>
 <h3 className="text-gray-900 font-bold text-lg mb-2">Account Created!</h3>
 <p className="text-gray-500 text-sm mb-4">
 Your account is pending activation.<br/>
 An administrator will review and activate your account.
 </p>
 <p className="text-gray-500 text-base mb-6">
 You will be able to login once your account is approved.
 </p>
 <button
 onClick={() => { setStep('email'); setError(''); setSuccess(''); }}
 className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 text-sm"
 >
 <LogIn size={16} />
 Back to Login
 </button>
 </div>
 ) : (
 <form onSubmit={handleVerifyOtp} className="space-y-4">
 <p className="text-gray-500 text-sm text-center mb-2">
 {t('login.sentTo')} <span className="text-blue-600 font-medium" dir="ltr">{email}</span>
 </p>

 {/* ⚠️ TEST MODE: Show OTP on screen — remove after testing */}
 {testCode && (
 <div className="bg-blue-600/10 border border-blue-600/30 rounded-xl shadow-sm p-3 text-center">
 <p className="text-[10px] font-semibold text-blue-600 mb-1">🔧 Test Mode — Code:</p>
 <p className="text-2xl font-mono font-bold text-blue-500 tracking-[0.3em]">{testCode}</p>
 </div>
 )}

 <div>
 <label className="block text-base font-medium text-gray-800 mb-2">{t('login.verificationCode')}</label>
 <input
 type="text"
 value={otp}
 onChange={(e) => setOtp(e.target.value)}
 placeholder="000000"
 className="w-full bg-white border border-gray-200 rounded-xl shadow-sm px-4 py-3 text-gray-800 text-center text-2xl tracking-[0.4em] font-mono placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600/50 focus:border-blue-600 transition-all"
 maxLength={6}
 required
 dir="ltr"
 />
 </div>
 <button type="submit" disabled={loading}
 className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-all shadow-sm disabled:opacity-50 flex items-center justify-center gap-2 text-sm">
 {loading ? <Loader2 className="animate-spin" size={20} /> : null}
 {loading ? t('login.verifying') : t('login.verifyLogin')}
 </button>
 <div className="flex justify-between text-base">
 <button type="button" onClick={() => { setStep('email'); setOtp(''); setError(''); setTestCode(''); }}
 className="text-gray-800 hover:text-blue-500 transition-colors">
 {t('login.tryDifferentEmail')}
 </button>
 {countdown > 0 ? (
 <span className="text-gray-800">{t('login.resendIn')} {countdown}s</span>
 ) : (
 <button type="button" onClick={() => { handleRequestOtp({ preventDefault: () => {} } as any); }}
 className="text-blue-500 hover:text-amber-300 transition-colors">
 {t('login.resendCode')}
 </button>
 )}
 </div>
 </form>
 )}
 </div>

 <p className="text-center text-gray-400 text-xs mt-6">
 SMC HSE Department — Off-Circuit Incident System
 </p>
 </div>
 </div>
 );
};

export default OCLogin;
