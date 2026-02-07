const nodemailer = require('nodemailer');

async function testConfig() {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: 'al3ren0@gmail.com',
            pass: 'bnpt gzmb xifj tdfa'
        }
    });

    try {
        console.log('Verifying SMTP config...');
        await transporter.verify();
        console.log('SMTP Config is VALID!');

        console.log('Sending test email...');
        const info = await transporter.sendMail({
            from: 'al3ren0@gmail.com',
            to: 'al3ren0@gmail.com',
            subject: 'Test Email from Antigravity',
            text: 'It works!'
        });
        console.log('Email sent:', info.messageId);
    } catch (err) {
        console.error('SMTP Failed:', err);
    }
}

testConfig();
