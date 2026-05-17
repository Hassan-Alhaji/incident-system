import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, Bot, Sparkles, Loader2, ChevronRight, ChevronLeft } from 'lucide-react';

interface AIChatSidebarProps {
    data: any;
    applied: { from: string; to: string };
    isOpen: boolean;
    onClose: () => void;
}

const AIChatSidebar: React.FC<AIChatSidebarProps> = ({ data, applied, isOpen, onClose }) => {
    const { t, i18n } = useTranslation();
    const isRtl = i18n.language === 'ar';
    const [aiInput, setAiInput] = useState('');
    const [aiLoading, setAiLoading] = useState(false);
    const [aiHistory, setAiHistory] = useState<{ role: 'user' | 'ai'; text: string }[]>([]);
    const chatEndRef = useRef<HTMLDivElement>(null);

    const handleAiSend = async () => {
        if (!aiInput.trim() || aiLoading) return;
        const userMsg = aiInput.trim();
        setAiInput('');
        setAiHistory(h => [...h, { role: 'user', text: userMsg }]);
        setAiLoading(true);
        try {
            const api = (await import('../../utils/api')).default;
            const res = await api.post('/ai/analytics-chat', {
                question: userMsg,
                context: JSON.stringify(data),
                dateFrom: applied.from,
                dateTo: applied.to,
            });
            setAiHistory(h => [...h, { role: 'ai', text: res.data.answer }]);
        } catch (err: any) {
            const status = err.response?.status;
            const errData = err.response?.data;
            if (status === 503 || errData?.unavailable) {
                setAiHistory(h => [...h, {
                    role: 'ai',
                    text: isRtl
                        ? '⚠️ الذكاء الاصطناعي غير متاح مؤقتاً بسبب تجاوز الحصة المجانية. يرجى المحاولة لاحقاً.'
                        : '⚠️ AI is temporarily unavailable (free quota exceeded). Please try again later.'
                }]);
            } else {
                setAiHistory(h => [...h, { role: 'ai', text: t('analytics.ai.error', '⚠️ Sorry, could not get a response. Please try again.') }]);
            }
        } finally {
            setAiLoading(false);
            setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        }
    };

    return (
        <>
            <div className={`fixed top-0 ltr:right-0 rtl:left-0 h-full w-full sm:w-96 max-w-[100vw] bg-slate-50 ltr:border-l rtl:border-r border-slate-200 shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : (isRtl ? '-translate-x-full' : 'translate-x-full')} flex flex-col`}>
                <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-violet-600 to-indigo-600 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                            <Bot size={18} className="text-white" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-white leading-tight">{t('analytics.ai.title', 'HSE AI Assistant')}</h3>
                            <p className="text-[10px] text-violet-200">{t('analytics.ai.subtitle', 'Ask anything about your safety data')}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-full bg-black/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-black/20 transition-all">
                        {isRtl ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    {aiHistory.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-center text-slate-400">
                            <Sparkles size={32} className="mb-3 text-violet-300" />
                            <p className="text-sm font-semibold">{t('analytics.ai.welcome', 'Ask me about your HSE statistics!')}</p>
                            <div className="mt-5 flex flex-wrap gap-2 justify-center">
                                {[
                                    t('analytics.ai.q1', 'What is the top incident type?'),
                                    t('analytics.ai.q2', 'Which department has the most delays?'),
                                    t('analytics.ai.q3', 'How is our RCI score?')
                                ].map(q => (
                                    <button key={q} onClick={() => setAiInput(q)}
                                        className="text-[11px] bg-white border border-violet-200 text-violet-700 px-3 py-1.5 rounded-full hover:bg-violet-50 transition-all shadow-sm">
                                        {q}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    {aiHistory.map((m, i) => (
                        <div key={i} className={`flex gap-3 ${m.role === 'user' ? (isRtl ? 'justify-start' : 'justify-end') : (isRtl ? 'justify-end flex-row-reverse' : 'justify-start')}`}>
                            {m.role === 'ai' && <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-sm"><Bot size={16} className="text-white" /></div>}
                            <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                                m.role === 'user'
                                    ? `bg-blue-600 text-white ${isRtl ? 'rounded-tl-sm' : 'rounded-tr-sm'} shadow-md`
                                    : `bg-white border border-slate-200 text-slate-700 ${isRtl ? 'rounded-tr-sm' : 'rounded-tl-sm'} shadow-sm`
                            }`}>
                                {m.text}
                            </div>
                        </div>
                    ))}
                    {aiLoading && (
                        <div className={`flex gap-3 ${isRtl ? 'justify-end flex-row-reverse' : 'justify-start'}`}>
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-sm"><Bot size={16} className="text-white" /></div>
                            <div className={`bg-white border border-slate-200 px-4 py-2.5 rounded-2xl ${isRtl ? 'rounded-tr-sm' : 'rounded-tl-sm'} shadow-sm`}>
                                <Loader2 size={16} className="animate-spin text-violet-500" />
                            </div>
                        </div>
                    )}
                    <div ref={chatEndRef} />
                </div>

                <div className="p-4 bg-white border-t border-slate-200 shrink-0">
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1 focus-within:ring-2 focus-within:ring-violet-400 transition-all">
                        <input
                            value={aiInput} onChange={e => setAiInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAiSend()}
                            placeholder={t('analytics.ai.placeholder', 'Ask about incidents, trends...')}
                            className="flex-1 text-sm bg-transparent px-2 py-2 focus:outline-none"
                        />
                        <button
                            onClick={handleAiSend} disabled={!aiInput.trim() || aiLoading}
                            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                                !aiInput.trim() || aiLoading ? 'bg-slate-200 text-slate-400' : 'bg-violet-600 text-white hover:bg-violet-700 shadow-md'
                            }`}
                        >
                            <Send size={16} className={isRtl ? 'rotate-180' : ''} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Backdrop for mobile */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 sm:hidden"
                    onClick={onClose}
                />
            )}
        </>
    );
};

export default AIChatSidebar;
