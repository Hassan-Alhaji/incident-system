const nodemailer = require('nodemailer');
const axios = require('axios');

// Default sender address
const SENDER_EMAIL = process.env.EMAIL_FROM || 'hse-noreply@saudimotorsport.com';
const PORTAL_URL = process.env.PORTAL_BASE_URL || 'https://hsedev.saudimotorsport.com';

// Cache Microsoft Graph token
let cachedGraphToken = null;
let graphTokenExpiresAt = 0;

/**
 * Obtain Microsoft Graph Access Token using Client Credentials
 */
async function getGraphToken() {
    const { MICROSOFT_TENANT_ID, MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET } = process.env;
    if (!MICROSOFT_TENANT_ID || !MICROSOFT_CLIENT_ID || !MICROSOFT_CLIENT_SECRET) {
        return null;
    }

    const now = Date.now();
    if (cachedGraphToken && graphTokenExpiresAt > now + 60000) {
        return cachedGraphToken;
    }

    try {
        const tokenRes = await axios.post(
            `https://login.microsoftonline.com/${MICROSOFT_TENANT_ID}/oauth2/v2.0/token`,
            new URLSearchParams({
                grant_type: 'client_credentials',
                client_id: MICROSOFT_CLIENT_ID,
                client_secret: MICROSOFT_CLIENT_SECRET,
                scope: 'https://graph.microsoft.com/.default'
            }),
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 8000 }
        );

        cachedGraphToken = tokenRes.data.access_token;
        const expiresInSec = tokenRes.data.expires_in || 3599;
        graphTokenExpiresAt = now + (expiresInSec * 1000);
        return cachedGraphToken;
    } catch (err) {
        console.error('[Email Service] Failed to obtain Graph API token:', err.response?.data || err.message);
        return null;
    }
}

/**
 * Fallback SMTP Transporter (if configured)
 */
let smtpTransporter = null;
if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    smtpTransporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST || 'smtp.office365.com',
        port: parseInt(process.env.EMAIL_PORT || '587', 10),
        secure: false,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        },
        tls: { rejectUnauthorized: false }
    });
}

/**
 * Core dispatch function: tries Microsoft Graph first, falls back to SMTP
 */
async function sendEmailCore({ to, subject, html, text }) {
    const recipients = Array.isArray(to) ? to : [to];
    const validRecipients = recipients
        .map(e => (typeof e === 'string' ? e.trim() : ''))
        .filter(e => e && e.includes('@'));

    if (validRecipients.length === 0) {
        console.warn('[Email Service] No valid recipients provided for email.');
        return false;
    }

    // Attempt 1: Microsoft Graph API
    const token = await getGraphToken();
    if (token) {
        try {
            const payload = {
                message: {
                    subject: subject,
                    body: {
                        contentType: html ? 'HTML' : 'Text',
                        content: html || text || ''
                    },
                    toRecipients: validRecipients.map(addr => ({ emailAddress: { address: addr } }))
                },
                saveToSentItems: false
            };

            const graphRes = await axios.post(
                `https://graph.microsoft.com/v1.0/users/${SENDER_EMAIL}/sendMail`,
                payload,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 10000
                }
            );

            console.log(`[Email Service] Sent via Microsoft Graph to [${validRecipients.join(', ')}] (Status: ${graphRes.status})`);
            return true;
        } catch (err) {
            console.error('[Email Service] Graph send error:', err.response?.data || err.message);
            // continue to fallback
        }
    }

    // Attempt 2: SMTP Fallback
    if (smtpTransporter) {
        try {
            const info = await smtpTransporter.sendMail({
                from: `"Saudi Motorsport — HSE Incident System" <${SENDER_EMAIL}>`,
                to: validRecipients.join(', '),
                subject: subject,
                html: html,
                text: text
            });
            console.log(`[Email Service] Sent via SMTP to [${validRecipients.join(', ')}] (MessageId: ${info.messageId})`);
            return true;
        } catch (err) {
            console.error('[Email Service] SMTP send error:', err.message);
        }
    }

    console.warn('[Email Service] Could not send email (neither Graph nor SMTP succeeded).');
    return false;
}

/**
 * Standard Email Shell Template with Saudi Motorsport Styling
 */
function wrapBrandedEmailTemplate({ preheader, headerTitle, contentHtml, footerNote }) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${headerTitle || 'Saudi Motorsport HSE'}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.5;">
  ${preheader ? `<span style="display: none; font-size: 1px; color: #f1f5f9; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">${preheader}</span>` : ''}
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f1f5f9; padding: 30px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(15, 23, 42, 0.08); border: 1px solid #e2e8f0;">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); padding: 30px 25px; text-align: center;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="center">
                    <p style="margin: 0; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: #bae6fd;">
                      Saudi Motorsport Company
                    </p>
                    <h1 style="margin: 6px 0 0; font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: -0.2px;">
                      HSE Incident Management Portal
                    </h1>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 32px 28px;">
              ${contentHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 25px; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #64748b; line-height: 1.6;">
                ${footerNote || 'This is an automated notification sent by Saudi Motorsport HSE Incident Management System.'}
              </p>
              <p style="margin: 8px 0 0; font-size: 11px; color: #94a3b8;">
                &copy; ${new Date().getFullYear()} Saudi Motorsport Company (SMC). All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
}

/**
 * 1. Send OTP Login Code
 */
const sendOTP = async (email, otp) => {
    const html = wrapBrandedEmailTemplate({
        preheader: `Your verification code is ${otp}`,
        headerTitle: 'Login Verification Code',
        contentHtml: `
          <h2 style="margin: 0 0 12px; font-size: 18px; color: #0f172a; font-weight: 700;">
            Verification Code
          </h2>
          <p style="margin: 0 0 20px; font-size: 14px; color: #475569;">
            Use the following one-time verification code to complete your login into the HSE Incident Portal. This code is valid for <strong>5 minutes</strong>.
          </p>
          <div style="background-color: #f0fdf4; border: 2px dashed #86efac; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0;">
            <span style="font-size: 34px; font-weight: 800; letter-spacing: 10px; color: #15803d; font-family: monospace;">
              ${otp}
            </span>
          </div>
          <p style="margin: 0; font-size: 13px; color: #94a3b8; text-align: center;">
            If you did not request this verification code, please disregard this email.
          </p>
        `
    });

    return await sendEmailCore({
        to: email,
        subject: `Login Verification Code — ${otp}`,
        html: html,
        text: `Your HSE Portal login code is: ${otp}. Valid for 5 minutes.`
    });
};

/**
 * 2. Send Department Assignment Notification
 * (Notifies newly assigned Manager or Representative)
 */
const sendDepartmentAssignmentNotification = async ({ to, recipientName, role, departmentName }) => {
    if (!to) return false;

    const isManager = role === 'DEP_MANAGER';
    const roleTitle = isManager ? 'Department Manager' : 'Department Representative';

    const contentHtml = `
      <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px;">
        <p style="margin: 0; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #2563eb;">
          Official Role Assignment
        </p>
        <h2 style="margin: 4px 0 0; font-size: 18px; color: #1e3a8a; font-weight: 700;">
          Assigned as ${roleTitle}
        </h2>
      </div>

      <p style="margin: 0 0 14px; font-size: 15px; color: #1e293b;">
        Dear <strong>${recipientName || 'Team Member'}</strong>,
      </p>
      <p style="margin: 0 0 16px; font-size: 14px; color: #475569; line-height: 1.6;">
        You have been officially registered as a <strong>${roleTitle}</strong> for <strong>${departmentName || 'your Department'}</strong> within the Saudi Motorsport HSE Incident Management Platform.
      </p>
      <p style="margin: 0 0 24px; font-size: 14px; color: #475569; line-height: 1.6;">
        In this role, you will receive notifications for incident tickets assigned to your department, participate in root cause analyses (RCA), and submit action plans to maintain our rigorous safety standards.
      </p>

      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px 20px; margin-bottom: 28px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="4" border="0" style="font-size: 13px;">
          <tr>
            <td style="color: #64748b; width: 140px; font-weight: 600;">Department:</td>
            <td style="color: #0f172a; font-weight: 700;">${departmentName || 'N/A'}</td>
          </tr>
          <tr>
            <td style="color: #64748b; font-weight: 600;">Assigned Role:</td>
            <td style="color: #0284c7; font-weight: 700;">${roleTitle}</td>
          </tr>
          <tr>
            <td style="color: #64748b; font-weight: 600;">Account Email:</td>
            <td style="color: #0f172a; font-family: monospace;">${to}</td>
          </tr>
        </table>
      </div>

      <div style="text-align: center; margin: 30px 0 15px;">
        <a href="${PORTAL_URL}" style="background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); color: #ffffff; text-decoration: none; padding: 13px 32px; font-weight: 700; font-size: 14px; border-radius: 10px; display: inline-block; box-shadow: 0 4px 12px rgba(2, 132, 199, 0.25);">
          Access HSE Portal &rarr;
        </a>
      </div>
    `;

    const html = wrapBrandedEmailTemplate({
        preheader: `You have been assigned as ${roleTitle} for ${departmentName}`,
        headerTitle: `Department Assignment — ${roleTitle}`,
        contentHtml
    });

    return await sendEmailCore({
        to: to,
        subject: `Role Assignment: ${roleTitle} — ${departmentName}`,
        html: html,
        text: `You have been assigned as ${roleTitle} for ${departmentName} on the Saudi Motorsport HSE Incident Platform. Access the portal at ${PORTAL_URL}`
    });
};

/**
 * 3. Send Incident Notification to Department (Manager + Representatives)
 */
const sendDepartmentIncidentNotification = async ({ recipients, ticket, departmentName }) => {
    if (!recipients || recipients.length === 0) return false;

    const ticketNo = ticket.ticketNo || ticket.ticketNumber || `#${ticket.id}`;
    const title = ticket.title || ticket.incidentType || 'Safety Incident';
    const severity = (ticket.severityLevel || ticket.severity || 'MEDIUM').toUpperCase();
    const location = ticket.location || ticket.locationDescription || ticket.locationAddress || 'Circuit Venue';
    const ticketUrl = `${PORTAL_URL}/tickets/${ticket.id}`;

    // Severity styling
    let severityBg = '#fef3c7';
    let severityColor = '#b45309';
    let severityBorder = '#fde68a';
    if (['HIGH', 'CRITICAL'].includes(severity)) {
        severityBg = '#fee2e2';
        severityColor = '#b91c1c';
        severityBorder = '#fca5a5';
    } else if (['LOW', 'MINOR'].includes(severity)) {
        severityBg = '#dcfce7';
        severityColor = '#15803d';
        severityBorder = '#86efac';
    }

    const contentHtml = `
      <div style="background-color: #fff1f2; border-left: 4px solid #e11d48; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px;">
        <p style="margin: 0; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #be123c;">
          Action Required &bull; HSE Department Assignment
        </p>
        <h2 style="margin: 4px 0 0; font-size: 18px; color: #881337; font-weight: 800;">
          New Incident Assigned to ${departmentName || 'Your Department'}
        </h2>
      </div>

      <p style="margin: 0 0 14px; font-size: 15px; color: #1e293b;">
        Dear Department Team,
      </p>
      <p style="margin: 0 0 20px; font-size: 14px; color: #475569; line-height: 1.6;">
        A new safety incident ticket <strong>${ticketNo}</strong> has been routed to your department for immediate review and corrective action planning by the HSE Safety Department. Please review the details below and respond at your earliest convenience.
      </p>

      <!-- Incident Card -->
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 22px; margin-bottom: 28px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="6" border="0" style="font-size: 13px;">
          <tr>
            <td style="color: #64748b; width: 130px; font-weight: 600;">Ticket Number:</td>
            <td style="color: #0f172a; font-weight: 800; font-family: monospace; font-size: 14px;">${ticketNo}</td>
          </tr>
          <tr>
            <td style="color: #64748b; font-weight: 600;">Incident Title:</td>
            <td style="color: #0f172a; font-weight: 700;">${title}</td>
          </tr>
          <tr>
            <td style="color: #64748b; font-weight: 600;">Severity Level:</td>
            <td>
              <span style="background-color: ${severityBg}; color: ${severityColor}; border: 1px solid ${severityBorder}; padding: 3px 10px; border-radius: 9999px; font-weight: 800; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">
                ${severity}
              </span>
            </td>
          </tr>
          <tr>
            <td style="color: #64748b; font-weight: 600;">Location:</td>
            <td style="color: #334155;">${location}</td>
          </tr>
          <tr>
            <td style="color: #64748b; font-weight: 600;">Assigned Dept:</td>
            <td style="color: #0284c7; font-weight: 700;">${departmentName || 'N/A'}</td>
          </tr>
        </table>
      </div>

      <div style="text-align: center; margin: 30px 0 15px;">
        <a href="${ticketUrl}" style="background: linear-gradient(135deg, #e11d48 0%, #be123c 100%); color: #ffffff; text-decoration: none; padding: 13px 34px; font-weight: 700; font-size: 14px; border-radius: 10px; display: inline-block; box-shadow: 0 4px 14px rgba(225, 29, 72, 0.25);">
          View &amp; Respond to Incident &rarr;
        </a>
      </div>

      <p style="margin: 20px 0 0; font-size: 12px; color: #94a3b8; text-align: center;">
        Direct Link: <a href="${ticketUrl}" style="color: #0284c7; text-decoration: underline;">${ticketUrl}</a>
      </p>
    `;

    const html = wrapBrandedEmailTemplate({
        preheader: `[ACTION REQUIRED] Incident ${ticketNo} assigned to ${departmentName}`,
        headerTitle: `Incident Notification — ${ticketNo}`,
        contentHtml
    });

    return await sendEmailCore({
        to: recipients,
        subject: `[HSE Alert] Incident ${ticketNo} Assigned to ${departmentName} — Action Required`,
        html: html,
        text: `Incident ${ticketNo} (${title}) has been assigned to ${departmentName}. Severity: ${severity}. View at: ${ticketUrl}`
    });
};

module.exports = {
    sendOTP,
    sendDepartmentAssignmentNotification,
    sendDepartmentIncidentNotification,
    sendEmailCore
};
