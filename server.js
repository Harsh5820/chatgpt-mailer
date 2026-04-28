const express = require('express');
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;
const resumePath = path.join(__dirname, 'assets', 'Resume.pdf');

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
  'I hope you are doing well.',
  '',
  `My name is ${senderName}, and I am currently working at Jio Platforms Limited with over 2 years of experience. I am reaching out to express my interest in Software Engineer opportunities at your organization.`,
  '',
  'I have hands-on experience in building scalable applications and working across the full development lifecycle.',
  '',
  'Please find my resume attached for your review. I would appreciate the opportunity to discuss how my profile aligns with your requirements.',
  '',
  'LinkedIn: www.linkedin.com/in/harsh-dubey-584a781a9',
  'GitHub: https://github.com/Harsh5820',
  'Contact: 9321628051 / 8461876435',
  '',
  'Looking forward to your response.',
  '',
  `${senderName}`,
].join('\n');

const html = `
  <p>Hi ${company},</p>
  <p>I hope you are doing well.</p>

  <p>
    My name is <b>${senderName}</b>, and I am currently working at Jio Platforms Limited with over 2 years of experience in software development.
    I am reaching out to express my interest in <b>Software Engineer</b> opportunities at your organization.
  </p>

  <p>
    I have hands-on experience in building scalable applications and working across the full development lifecycle.
  </p>

  <p>
    Please find my resume attached for your review. I would appreciate the opportunity to discuss how my profile aligns with your requirements.
  </p>

  <p>
    <b>LinkedIn:</b> <a href="https://www.linkedin.com/in/harsh-dubey-584a781a9">Profile</a><br/>
    <b>GitHub:</b> <a href="https://github.com/Harsh5820">Harsh5820</a><br/>
    <b>Contact:</b> 9321628051 / 8461876435
  </p>

  <p>
    Looking forward to your response.<br/>
    ${senderName}
  </p>

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

  const invalid = recipients.filter((email) => !isValidEmail(email));
  if (invalid.length > 0) {
    return res.status(400).json({ error: `Invalid emails: ${invalid.join(', ')}` });
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

  const results = [];

  try {
    for (const [index, email] of recipients.entries()) {
      const info = await transporter.sendMail(composeMessage({ email }));
      results.push({ email, messageId: info.messageId, accepted: info.accepted });

      if (index < recipients.length - 1) {
        const delayMs = 30000 + Math.floor(Math.random() * 15000);
        await sleep(delayMs);
      }
    }

    res.json({
      message: 'Emails sent successfully.',
      sentCount: results.length,
      results,
      resumePath,
      antiSpamChecklist: [
        'Configure SPF for your sending domain.',
        'Configure DKIM signing in your SMTP provider.',
        'Publish DMARC policy for your domain.',
        'Keep volume low and personalized (already applied).',
      ],
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send one or more emails.', detail: error.message, results });
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
