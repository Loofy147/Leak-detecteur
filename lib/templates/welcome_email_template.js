/**
 * @fileoverview This module contains the template function for generating the welcome email HTML.
 */

/**
 * Generates the HTML content for the welcome email.
 * This email is sent to users after they have made a payment and prompts them
 * to connect their bank account to begin the transaction analysis.
 * @param {string} auditId - The unique identifier for the audit session.
 * @param {string} appUrl - The base URL of the application, used to construct the bank connection link.
 * @returns {string} The complete HTML content of the welcome email as a string.
 */
export function generateWelcomeEmailHtml(auditId, appUrl) {
  const connectUrl = `${appUrl}/connect-bank?audit_id=${auditId}`;

  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: #dc2626;
      color: white;
      padding: 10px;
      text-align: center;
      border-top-left-radius: 8px;
      border-top-right-radius: 8px;
    }
    h1 { font-size: 24px; }
    .content {
      padding: 30px;
      border: 1px solid #e5e7eb;
    }
    .button {
      display: inline-block;
      background-color: #dc2626;
      color: white;
      padding: 12px 24px;
      text-decoration: none;
      border-radius: 5px;
      font-weight: bold;
      margin: 20px 0;
    }
    .footer {
      margin-top: 20px;
      text-align: center;
      color: #6b7280;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Welcome to LeakDetector</h1>
  </div>
  <div class="content">
    <h2>Payment Received - Let's Find Some Leaks!</h2>
    <p>Thanks for your payment. The next step is to securely connect your company's bank account or credit card statements so we can begin the analysis.</p>
    <p>Our system will scan 12 months of transactions to identify recurring subscriptions and find potential waste.</p>
    <p>Click the button below to connect your account via Plaid (bank-level security):</p>
    <a href="${connectUrl}" class="button">Securely Connect Your Bank</a>
    <p>After you connect, the analysis will begin automatically. Your report will be emailed to you within 24 hours.</p>
    <p>If you have any questions, please reply to this email.</p>
  </div>
  <div class="footer">
    <p>LeakDetector</p>
  </div>
</body>
</html>
  `;
}
