const nodemailer = require('nodemailer');

class EmailService {
    constructor() {
        // Check if credentials are configured
        if (!process.env.GMAIL_USERNAME || !process.env.GMAIL_APP_PASSWORD) {
            console.warn('⚠️  Email credentials not configured. Email notifications will not work.');
            this.transporter = null;
            return;
        }

        this.transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: false, // true for 465, false for other ports
            auth: {
                user: process.env.GMAIL_USERNAME,
                pass: process.env.GMAIL_APP_PASSWORD
            },
            tls: {
                // Do not fail on invalid certs
                rejectUnauthorized: false
            }
        });

        console.log('📧 Email service initialized for:', process.env.GMAIL_USERNAME);
    }

    /**
     * Generate HTML email body for pre-processing claims
     * @param {Object} claimsData - Claims grouped by program
     * @param {Object} summary - Summary statistics
     * @returns {string} HTML email body
     */
    generatePreProcessingEmail(claimsData, summary) {
        const programTables = Object.keys(claimsData).sort().map(program => {
            const claims = claimsData[program];

            return `
                <div style="margin-bottom: 30px;">
                    <h3 style="color: #1f2937; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #4f46e5;">
                        ${program} (${claims.length} claim${claims.length !== 1 ? 's' : ''})
                    </h3>
                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px;">
                        <thead>
                            <tr style="background-color: #4f46e5; color: white;">
                                <th style="padding: 10px 8px; text-align: left; border: 1px solid #4338ca; font-weight: 600; font-size: 12px;">Claim ID</th>
                                <th style="padding: 10px 8px; text-align: left; border: 1px solid #4338ca; font-weight: 600; font-size: 12px;">Program</th>
                                <th style="padding: 10px 8px; text-align: left; border: 1px solid #4338ca; font-weight: 600; font-size: 12px;">Customer</th>
                                <th style="padding: 10px 8px; text-align: center; border: 1px solid #4338ca; font-weight: 600; font-size: 12px;">Type</th>
                                <th style="padding: 10px 8px; text-align: left; border: 1px solid #4338ca; font-weight: 600; font-size: 12px;">Status</th>
                                <th style="padding: 10px 8px; text-align: center; border: 1px solid #4338ca; font-weight: 600; font-size: 12px;">Created</th>
                                <th style="padding: 10px 8px; text-align: center; border: 1px solid #4338ca; font-weight: 600; font-size: 12px;">Age</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${claims.map((claim, idx) => `
                                <tr style="background-color: ${idx % 2 === 0 ? '#f9fafb' : 'white'};">
                                    <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong style="color: #4f46e5;">${claim.claimId}</strong></td>
                                    <td style="padding: 8px; border: 1px solid #e5e7eb; color: #6b7280; font-size: 11px;">${claim.program || program}</td>
                                    <td style="padding: 8px; border: 1px solid #e5e7eb; color: #374151;">${claim.customer || 'N/A'}</td>
                                    <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: center;">
                                        <span style="display: inline-block; padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; white-space: nowrap;
                                            ${claim.claimType === 'Theft & Loss' ? 'background-color: #fee2e2; color: #991b1b;' :
                                              claim.claimType === 'Same-Day Replacement' ? 'background-color: #f3e8ff; color: #6b21a8;' :
                                              'background-color: #dbeafe; color: #1e40af;'}">
                                            ${claim.claimType === 'Theft & Loss' ? 'T&L' : claim.claimType === 'Regular AE' ? 'AE' : 'Same-Day'}
                                        </span>
                                    </td>
                                    <td style="padding: 8px; border: 1px solid #e5e7eb; color: #374151; font-size: 12px;">${claim.status360}</td>
                                    <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 12px;">${claim.createdDate || 'N/A'}</td>
                                    <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: center;">
                                        <span style="display: inline-block; padding: 3px 10px; border-radius: 12px; font-weight: 700; font-size: 13px;
                                            ${claim.daysSinceCreated > 7 ? 'background-color: #fee2e2; color: #991b1b;' :
                                              claim.daysSinceCreated > 3 ? 'background-color: #fef3c7; color: #92400e;' :
                                              'background-color: #dcfce7; color: #166534;'}">
                                            ${claim.daysSinceCreated !== null ? claim.daysSinceCreated : '-'}
                                        </span>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }).join('');

        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
             line-height: 1.6; color: #333; max-width: 1200px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">

    <!-- Header -->
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                padding: 30px;
                border-radius: 8px 8px 0 0;
                text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 600;">
            📋 Pre-Processing Claims Notification
        </h1>
        <p style="color: rgba(255, 255, 255, 0.9); margin: 10px 0 0 0; font-size: 14px;">
            Advance Exchange Dashboard - Action Required
        </p>
    </div>

    <!-- Summary Section -->
    <div style="background-color: white; padding: 15px 20px; border-left: 4px solid #4f46e5; margin-bottom: 15px;">
        <div style="display: flex; align-items: center; gap: 20px; flex-wrap: wrap;">
            <h2 style="color: #1f2937; margin: 0; font-size: 16px; font-weight: 600;">Summary:</h2>
            <div style="display: flex; gap: 15px; flex-wrap: wrap;">
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="font-size: 20px; font-weight: 700; color: #4f46e5;">${summary.totalClaims}</span>
                    <span style="font-size: 13px; color: #6b7280;">Claims</span>
                </div>
                <div style="width: 1px; height: 20px; background-color: #e5e7eb;"></div>
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="font-size: 20px; font-weight: 700; color: #15803d;">${summary.totalPrograms}</span>
                    <span style="font-size: 13px; color: #6b7280;">Programs</span>
                </div>
                ${summary.theftAndLoss > 0 ? `
                <div style="width: 1px; height: 20px; background-color: #e5e7eb;"></div>
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="font-size: 20px; font-weight: 700; color: #991b1b;">${summary.theftAndLoss}</span>
                    <span style="font-size: 13px; color: #6b7280;">T&L</span>
                </div>
                ` : ''}
                <div style="width: 1px; height: 20px; background-color: #e5e7eb;"></div>
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="font-size: 20px; font-weight: 700; color: #1e40af;">${summary.regularAE || 0}</span>
                    <span style="font-size: 13px; color: #6b7280;">Regular AE</span>
                </div>
            </div>
        </div>
    </div>

    <!-- Claims by Program -->
    <div style="background-color: white; padding: 25px; border-radius: 0 0 8px 8px;">
        <h2 style="color: #1f2937; margin-top: 0; font-size: 20px; margin-bottom: 20px;">Claims by Program</h2>
        ${programTables}
    </div>

    <!-- Footer -->
    <div style="margin-top: 20px; padding: 20px; text-align: center; color: #6b7280; font-size: 12px;">
        <p style="margin: 5px 0;">This is an automated notification from the Advance Exchange Dashboard</p>
        <p style="margin: 5px 0;">Generated on: ${new Date().toLocaleString('en-US', {
            month: 'short',
            day: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        })}</p>
        <p style="margin: 10px 0 5px 0;">
            <a href="http://localhost:3000" style="color: #4f46e5; text-decoration: none;">Open Dashboard</a>
        </p>
    </div>

</body>
</html>
        `;
    }

    /**
     * Send pre-processing claims notification email
     * @param {Object} claimsData - Claims grouped by program
     * @param {string} recipients - Comma-separated email addresses
     * @returns {Promise} Email send result
     */
    async sendPreProcessingNotification(claimsData, recipients) {
        // Check if email is configured
        if (!this.transporter) {
            throw new Error('Email service not configured. Please check SMTP credentials in .env file.');
        }

        try {
            // Calculate summary
            const allClaims = Object.values(claimsData).flat();
            const summary = {
                totalClaims: allClaims.length,
                totalPrograms: Object.keys(claimsData).length,
                theftAndLoss: allClaims.filter(c => c.claimType === 'Theft & Loss').length,
                regularAE: allClaims.filter(c => c.claimType === 'Regular AE').length,
                sameDay: allClaims.filter(c => c.claimType === 'Same-Day Replacement').length
            };

            const htmlBody = this.generatePreProcessingEmail(claimsData, summary);
            const textBody = this.generateTextVersion(claimsData, summary);

            const mailOptions = {
                from: {
                    name: 'Advance Exchange Dashboard',
                    address: process.env.NOTIFICATION_FROM_EMAIL
                },
                to: recipients,
                subject: `🚨 Pre-Processing Claims Alert: ${summary.totalClaims} claim${summary.totalClaims !== 1 ? 's' : ''} requiring attention`,
                html: htmlBody,
                text: textBody
            };

            console.log('📧 Attempting to send email to:', recipients);
            const info = await this.transporter.sendMail(mailOptions);
            console.log('✅ Email sent successfully! Message ID:', info.messageId);
            return { success: true, messageId: info.messageId };

        } catch (error) {
            console.error('❌ Email sending failed:', error.message);

            // Provide helpful error messages
            let userMessage = error.message;
            if (error.message.includes('Username and Password not accepted')) {
                userMessage = 'Gmail authentication failed. The app password may be expired or invalid.\n\n' +
                             'Please:\n' +
                             '1. Create a new app password at: https://myaccount.google.com/apppasswords\n' +
                             '2. Update .env file with the new password\n' +
                             '3. Restart the server\n\n' +
                             'See FIX_EMAIL_AUTH.md for detailed instructions.';
            } else if (error.message.includes('ENOTFOUND') || error.message.includes('ETIMEDOUT')) {
                userMessage = 'Cannot connect to email server. Please check your internet connection.';
            }

            const enhancedError = new Error(userMessage);
            enhancedError.originalError = error;
            throw enhancedError;
        }
    }

    /**
     * Generate plain text version of email
     */
    generateTextVersion(claimsData, summary) {
        let text = `PRE-PROCESSING CLAIMS NOTIFICATION\n`;
        text += `Advance Exchange Dashboard - Action Required\n`;
        text += `${'='.repeat(60)}\n\n`;
        text += `SUMMARY\n`;
        text += `Total Claims: ${summary.totalClaims}\n`;
        text += `Programs: ${summary.totalPrograms}\n`;
        text += `Theft & Loss: ${summary.theftAndLoss}\n`;
        text += `Regular AE: ${summary.regularAE}\n\n`;

        Object.keys(claimsData).sort().forEach(program => {
            const claims = claimsData[program];
            text += `\n${program.toUpperCase()} (${claims.length} claims)\n`;
            text += `${'-'.repeat(60)}\n`;
            claims.forEach(claim => {
                text += `  • ${claim.claimId} | ${claim.claimType} | ${claim.status360} | Age: ${claim.daysSinceCreated} days\n`;
            });
        });

        text += `\n\nGenerated: ${new Date().toLocaleString()}\n`;
        text += `Dashboard: http://localhost:3000\n`;

        return text;
    }

    /**
     * Test email configuration
     */
    async testConnection() {
        try {
            await this.transporter.verify();
            console.log('✅ Email service is ready to send emails');
            return true;
        } catch (error) {
            console.error('❌ Email service configuration error:', error);
            return false;
        }
    }
}

module.exports = new EmailService();
