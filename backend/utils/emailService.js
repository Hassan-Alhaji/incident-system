const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER, // Use environment variables
        pass: process.env.EMAIL_PASS
    }
});

const sendOTP = async (email, otp) => {
    try {
        console.log(`[Email Service] Attempting to send OTP to ${email}...`);

        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
            throw new Error('Email credentials are missing in environment variables.');
        }

        const mailOptions = {
            from: '"Incident Portal" <' + process.env.EMAIL_USER + '>',
            to: email,
            subject: 'Your Login Code',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f4f4f4;">
                    <div style="max-width: 500px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                        <h2 style="color: #059669; text-align: center;">Incident Portal Login</h2>
                        <p style="font-size: 16px; color: #374151;">Use the following code to log in:</p>
                        <div style="background-color: #ecfdf5; padding: 15px; text-align: center; border-radius: 8px; margin: 20px 0;">
                            <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #047857;">${otp}</span>
                        </div>
                        <p style="font-size: 14px; color: #6b7280; text-align: center;">This code will expire in 10 minutes.</p>
                    </div>
                </div>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`[Email Service] Email sent successfully: ${info.messageId}`);
        return true;
    } catch (error) {
        console.error('[Email Service] Error sending email:', error.message);
        return false;
    }
};

module.exports = { sendOTP };
