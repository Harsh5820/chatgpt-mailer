const express = require('express');
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;
const resumePath = process.env.RESUME_FILE_PATH || path.join(__dirname, 'assets', 'resume.pdf');

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const splitEmails = (raw) =>
  raw
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

const isValidEmail = (email) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function buildTransporter() {
  const {
    SMTP_HOST,
    SMTP_PORT = 587,
    SMTP_SECURE = 'false',
    SMTP_USER,
    SMTP_PASS,
  } = process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    throw new Error('SMTP_HOST, SMTP_USER, and SMTP_PASS are required in environment variables.');
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: SMTP_SECURE === 'true',
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
    pool: true,
    maxConnections: 1,
    maxMessages: 20,
  });
}

function composeMessage({ email }) {
  const senderName = process.env.SENDER_NAME || 'Your Name';
  const position = process.env.TARGET_ROLE || 'open role';
  const company = process.env.GREETING_NAME || 'Recruiter';

  const subject = `Application for ${position} - ${senderName}`;
  const text = [
    `Hi ${company},`,
    '',
    `I hope you are doing well. I am ${senderName}, and I am interested in opportunities at your company.`,
    'I have attached my resume for your review.',
    '',
    'Thank you for your time.',
    `${senderName}`,
  ].join('\n');

  const html = `
    <p>Hi ${company},</p>
    <p>I hope you are doing well. I am ${senderName}, and I am interested in opportunities at your company.</p>
    <p>I have attached my resume for your review.</p>
    <p>Thank you for your time.<br/>${senderName}</p>
    <hr/>
    <p style="color:#666;font-size:12px;">Sent to: ${email}</p>
  `;

  return {
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to: email,
    subject,
    text,
    html,
    headers: {
      'X-Auto-Response-Suppress': 'OOF, AutoReply',
      'List-Unsubscribe': `<mailto:${process.env.MAIL_FROM || process.env.SMTP_USER}?subject=unsubscribe>`,
    },
    attachments: [
      {
        filename: path.basename(resumePath),
        path: resumePath,
        contentType: 'application/pdf',
      },
    ],
  };
}

app.post('/send-mails', async (req, res) => {
  const { recruiterEmails } = req.body;

  if (!fs.existsSync(resumePath)) {
    return res.status(500).json({
      error: `Resume file not found at ${resumePath}. Add your PDF to this path before deploying.`,
    });
  }

  if (!recruiterEmails) {
    return res.status(400).json({ error: 'Recruiter emails are required.' });
  }

  const recipients = splitEmails(recruiterEmails);
  if (recipients.length === 0) {
    return res.status(400).json({ error: 'At least one recruiter email is required.' });
  }

  let transporter;
  try {
    transporter = buildTransporter();
    await transporter.verify();
  } catch (error) {
    return res.status(500).json({
      error: 'SMTP configuration failed. Check env vars and credentials.',
      detail: error.message,
    });
  }

  const sent = [];
  const failed = [];

  try {
    for (const [index, email] of recipients.entries()) {
      if (!isValidEmail(email)) {
        failed.push({ email, error: 'Invalid email format. Skipped.' });
      } else {
        try {
          const info = await transporter.sendMail(composeMessage({ email }));
          sent.push({ email, messageId: info.messageId, accepted: info.accepted });
        } catch (error) {
          failed.push({ email, error: error.message });
        }
      }

      if (index < recipients.length - 1) {
        const delayMs = 30000 + Math.floor(Math.random() * 15000);
        await sleep(delayMs);
      }
    }

    const statusCode = failed.length === 0 ? 200 : 207;
    res.status(statusCode).json({
      message:
        failed.length === 0
          ? 'Emails sent successfully.'
          : 'Processing completed. Some emails failed but remaining recipients were processed.',
      totalRecipients: recipients.length,
      sentCount: sent.length,
      failedCount: failed.length,
      sent,
      failed,
      resumePath,
      antiSpamChecklist: [
        'Configure SPF for your sending domain.',
        'Configure DKIM signing in your SMTP provider.',
        'Publish DMARC policy for your domain.',
        'Keep volume low and personalized (already applied).',
      ],
    });
  } finally {
    if (transporter) {
      transporter.close();
    }
  }
});

app.get('/health', (_, res) => {
  res.json({ ok: true });
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
