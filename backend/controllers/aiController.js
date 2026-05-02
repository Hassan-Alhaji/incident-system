const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'dummy_key_until_configured');

// ── Helper: detect quota / rate-limit errors ──────────────────────────────────
const isQuotaError = (err) => {
    const msg = (err?.message || '').toLowerCase();
    const status = err?.status || err?.code || err?.response?.status;
    return (
        status === 429 ||
        msg.includes('quota') ||
        msg.includes('rate limit') ||
        msg.includes('resource_exhausted') ||
        msg.includes('too many requests') ||
        msg.includes('429')
    );
};

// ── Helper: retry with exponential backoff for rate limits ─────────────────────
const retryWithBackoff = async (fn, maxRetries = 3) => {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (err) {
            if (isQuotaError(err) && attempt < maxRetries) {
                const delay = Math.pow(2, attempt) * 1500; // 1.5s, 3s, 6s
                console.log(`[AI] Rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})...`);
                await new Promise(r => setTimeout(r, delay));
            } else {
                throw err;
            }
        }
    }
};

const AI_QUOTA_MSG = 'الذكاء الاصطناعي غير متاح مؤقتاً (تجاوز الحصة). يرجى المحاولة بعد دقيقة. / AI temporarily unavailable (rate limited). Please try again in a minute.';
const AI_NO_KEY_MSG = 'مفتاح الذكاء الاصطناعي غير مهيأ. / GEMINI_API_KEY is not configured.';


// ── enhanceText ───────────────────────────────────────────────────────────────
const enhanceText = async (req, res) => {
    try {
        const { text, context, type } = req.body;

        if (!process.env.GEMINI_API_KEY) {
            return res.status(400).json({ unavailable: true, message: AI_NO_KEY_MSG });
        }
        if (!text) {
            return res.status(400).json({ message: 'Text is required for enhancement.' });
        }

        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        let prompt = '';
        if (type === 'RCA_DRAFT') {
            prompt = `أنت خبير ومحقق في مجال السلامة والصحة المهنية (HSE Expert). 
يوجد حادث بهذه التفاصيل: "${context}". 
بناءً على ذلك، قام المسؤول بكتابة ملاحظات مبدئية عن السبب: "${text}".
المطلوب: أعد صياغة هذه الملاحظات بشكل احترافي جداً وصياغة رسمية لتقرير تحليل السبب الجذري (RCA)، مع التركيز على إصلاح النظام وليس إلقاء اللوم على الأفراد. يجب أن يكون الرد باللغة العربية، ومباشر بدون مقدمات أو خاتمة.`;
        } else if (type === 'CONTROLLER_ASSIGN_NOTES') {
            prompt = `أنت مدير قسم السلامة (HSE Controller).
يوجد حادث بهذه التفاصيل: "${context}".
أنت الآن تقوم بتوجيه هذا الحادث إلى قسم معين لكي يقوموا باللازم.
المطلوب: أعد صياغة هذه الملاحظة المبدئية: "${text}" لتصبح "توجيهات رسمية وواضحة" للقسم المعني. 
تنبيه هام: لا تطلب منهم عمل تحليل سبب جذري (RCA). اطلب منهم فقط اتخاذ الإجراءات التصحيحية وخطط العمل المناسبة.
الرد باللغة العربية، ومباشر بدون مقدمات.`;
        } else if (type === 'CONTROLLER_REVIEW_NOTES') {
            prompt = `أنت مدير قسم السلامة (HSE Controller).
تراجع الآن رد قسم معين وخطة عملهم بخصوص الحادث: "${context}".
المطلوب: أعد صياغة هذه الملاحظات المبدئية: "${text}" لتصبح تقييماً احترافياً ورسمياً لرد القسم. الرد باللغة العربية ومباشر.`;
        } else if (type === 'CONTROLLER_CLOSURE_NOTES') {
            prompt = `أنت مدير قسم السلامة (HSE Controller).
تريد إغلاق هذا التقرير أو تصعيده للإدارة العليا. الحادث: "${context}".
المطلوب: أعد صياغة هذه الملاحظة: "${text}" لتكون "ملاحظات ختامية وتوصيات نهائية رسمية" للحادث. الرد باللغة العربية ومباشر.`;
        } else if (type === 'HSE_NOTES') {
            prompt = `أنت خبير ومحقق في مجال السلامة والصحة المهنية (HSE Expert). 
قام المراقب بكتابة هذه الملاحظات السريعة: "${text}".
المطلوب: أعد صياغة هذه الملاحظات لتصبح لغة تقرير احترافية ورسمية لاستخدامها كملاحظات ختامية للحادث. يجب أن يكون الرد باللغة العربية، ومباشر بدون مقدمات.`;
        } else if (type === 'ACTION_PLAN') {
            prompt = `أنت خبير في السلامة والصحة المهنية (HSE Expert). 
يوجد حادث بهذه التفاصيل: "${context}".
قام ممثل القسم بكتابة خطة عمل مقترحة: "${text}".
المطلوب: أعد صياغة خطة العمل لتكون احترافية، قابلة للقياس، واضحة ومباشرة. يجب أن يكون الرد باللغة العربية ومباشراً بدون مقدمات.`;
        } else {
            prompt = `أعد صياغة النص التالي ليكون أكثر احترافية ورسمية ومناسب لبيئة العمل (HSE): "${text}". الرد باللغة العربية ومباشر.`;
        }

        const result = await retryWithBackoff(() => model.generateContent(prompt));
        const enhancedText = result.response.text().trim();
        res.json({ enhancedText });

    } catch (error) {
        console.error('AI Enhance Error:', error?.message || error);
        if (isQuotaError(error)) {
            return res.status(503).json({ unavailable: true, message: AI_QUOTA_MSG });
        }
        res.status(500).json({ message: `AI Error: ${error?.message || 'Unknown error'}` });
    }
};

// ── analyticsChat ─────────────────────────────────────────────────────────────
const analyticsChat = async (req, res) => {
    try {
        const { question, query, context, stats, dateFrom, dateTo } = req.body;
        const userQuestion = question || query || '';
        let rawContext = context || stats || '{}';

        if (!process.env.GEMINI_API_KEY) {
            return res.status(400).json({ unavailable: true, message: AI_NO_KEY_MSG });
        }

        // Trim context to avoid token overflow
        let parsedCtx = {};
        try {
            const full = typeof rawContext === 'string' ? JSON.parse(rawContext) : rawContext;
            parsedCtx = {
                totalTickets:            full.totalTickets,
                openCount:               full.openCount,
                daysSinceLastLTI:        full.daysSinceLastLTI,
                overdueActionPlansCount: full.overdueActionPlansCount,
                leading:                 full.leading,
                lagging:                 full.lagging,
                compliance:              full.compliance,
                departmentHeatmap:       full.departmentHeatmap?.slice(0, 8),
                paretoTypes:             full.paretoTypes?.slice(0, 6),
                topOverdueDepartments:   full.topOverdueDepartments?.slice(0, 5),
                reportingCulture:        full.reportingCulture ? {
                    rci:        full.reportingCulture.rci,
                    level:      full.reportingCulture.level,
                    components: full.reportingCulture.components,
                } : undefined,
            };
        } catch { parsedCtx = {}; }

        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        const prompt = `You are an expert HSE (Health, Safety & Environment) data analyst.
Period: ${dateFrom || 'all time'} → ${dateTo || 'today'}

Analytics Summary:
${JSON.stringify(parsedCtx, null, 2)}

Question: "${userQuestion}"

Respond concisely with bullet points. Reply in the same language as the question.`;

        const result = await retryWithBackoff(() => model.generateContent(prompt));
        const answer = result.response.text();
        res.json({ answer, reply: answer });

    } catch (error) {
        console.error('AI Analytics Chat Error:', error?.message || error);
        if (isQuotaError(error)) {
            return res.status(503).json({ unavailable: true, message: AI_QUOTA_MSG });
        }
        res.status(500).json({ message: `AI Error: ${error?.message || 'Unknown error'}` });
    }
};

module.exports = { enhanceText, analyticsChat };

