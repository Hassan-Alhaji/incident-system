import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogOut, Clock } from 'lucide-react';

// Inactivity timeout: 30 minutes
const INACTIVITY_MS = 30 * 60 * 1000;
// Warn the user 60 seconds before auto-logout
const WARNING_BEFORE_MS = 60 * 1000;

const SessionTimeoutManager = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const doLogout = useCallback(() => {
    setShowWarning(false);
    logout();
    navigate('/login', { replace: true });
  }, [logout, navigate]);

  const resetTimers = useCallback(() => {
    if (!user) return;

    // Cancel existing timers
    if (timerRef.current) clearTimeout(timerRef.current);
    if (warnTimerRef.current) clearTimeout(warnTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    setShowWarning(false);
    setCountdown(60);

    // Show warning at (INACTIVITY_MS - WARNING_BEFORE_MS)
    warnTimerRef.current = setTimeout(() => {
      setShowWarning(true);
      setCountdown(60);
      countdownRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            if (countdownRef.current) clearInterval(countdownRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, INACTIVITY_MS - WARNING_BEFORE_MS);

    // Auto-logout after full inactivity period
    timerRef.current = setTimeout(() => {
      doLogout();
    }, INACTIVITY_MS);
  }, [user, doLogout]);

  useEffect(() => {
    if (!user) return;

    const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];
    const handleActivity = () => resetTimers();

    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, handleActivity, { passive: true }));
    resetTimers();

    return () => {
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, handleActivity));
      if (timerRef.current) clearTimeout(timerRef.current);
      if (warnTimerRef.current) clearTimeout(warnTimerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [user, resetTimers]);

  if (!showWarning) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-4 p-6 text-center animate-in zoom-in-95">
        <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Clock className="text-amber-600" size={28} />
        </div>
        <h2 className="text-lg font-bold text-slate-900 mb-1">
          انتهت صلاحية الجلسة قريباً
        </h2>
        <p className="text-sm text-slate-500 mb-1">Session Expiring Soon</p>
        <p className="text-3xl font-bold text-amber-600 my-4">{countdown}s</p>
        <p className="text-sm text-slate-600 mb-6">
          سيتم تسجيل خروجك تلقائياً بسبب عدم النشاط.
          <br />
          <span className="text-slate-400">You will be logged out due to inactivity.</span>
        </p>
        <div className="flex gap-3">
          <button
            onClick={resetTimers}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
          >
            أنا هنا — I'm still here
          </button>
          <button
            onClick={doLogout}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 transition-colors text-sm font-medium"
          >
            <LogOut size={14} />
            خروج
          </button>
        </div>
      </div>
    </div>
  );
};

export default SessionTimeoutManager;
