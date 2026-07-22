const nodemailer = require('nodemailer');

// Gmail SMTP — smtp.gmail.com:587 (STARTTLS)
// EMAIL_USER   = Gmail address (e.g. al3ren0@gmail.com)
// EMAIL_PASS   = Gmail App Password (16-char, no spaces)
// EMAIL_FROM   = the display address
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,          // STARTTLS
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    tls: {
        rejectUnauthorized: true
    }
});

const FROM_ADDRESS = process.env.EMAIL_FROM || process.env.EMAIL_USER;

const sendOTP = async (email, otp) => {
    try {
        console.log(`[Email Service] Attempting to send OTP to ${email}...`);

        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
            console.warn('[Email Service] Email credentials missing — skipping send.');
            return false;
        }

        const mailOptions = {
            from: `"Saudi Motorsport — Incident Portal" <${FROM_ADDRESS}>`,
            to: email,
            subject: 'رمز تسجيل الدخول — Login Verification Code',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f4f4f4; direction: ltr;">
                    <div style="max-width: 500px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                        <div style="text-align: center; margin-bottom: 20px;">
                            <h2 style="color: #15803d; margin: 0;">Saudi Motorsport</h2>
                            <p style="color: #6b7280; margin: 4px 0 0;">Incident Management Portal</p>
                        </div>
                        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
                        <p style="font-size: 16px; color: #374151;">Use the following one-time code to log in. It will expire in <strong>5 minutes</strong>.</p>
                        <div style="background-color: #f0fdf4; border: 2px dashed #86efac; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
                            <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #15803d;">${otp}</span>
                        </div>
                        <p style="font-size: 13px; color: #9ca3af; text-align: center;">
                            If you did not request this code, please ignore this email.<br>
                            لم تطلب هذا الرمز؟ يمكنك تجاهل هذا البريد الإلكتروني.
                        </p>
                        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
                        <p style="font-size: 12px; color: #d1d5db; text-align: center;">
                            This is an automated message — please do not reply.<br>
                            هذه رسالة آلية — لا ترد عليها.
                        </p>
                    </div>
                </div>
            `
        };

        // 10-second timeout — Office 365 can be slightly slower than Gmail
        const sendWithTimeout = Promise.race([
            transporter.sendMail(mailOptions),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Email timeout after 10s')), 10000))
        ]);

        const info = await sendWithTimeout;
        console.log(`[Email Service] OTP sent to ${email} — MessageId: ${info.messageId}`);
        return true;
    } catch (error) {
        console.error('[Email Service] Error sending email:', error.message);
        return false;
    }
};

module.exports = { sendOTP };
