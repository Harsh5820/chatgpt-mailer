# Recruiter Mailer (Express + Nodemailer + Vercel)

Single-page Express app to send your resume PDF to comma-separated recruiter emails.

## Updated flow (Vercel/serverless friendly)

- You **do not upload** a file from the UI.
- Put your PDF directly in the repo at `assets/resume.pdf`.
- UI accepts only comma-separated recruiter emails.
- Backend attaches that repo PDF when sending.

## Features

- Email-only single-page form.
- Sends one message per recipient.
- 30-45 second delay between recipients.
- Uses Nodemailer SMTP credentials from env vars.

## Important anti-spam notes

No app can *guarantee* inbox delivery. To improve deliverability:

1. Set SPF for your domain.
2. Enable DKIM signing in your SMTP provider.
3. Publish DMARC policy.
4. Keep low daily volume and personalize content.
5. Avoid URL shorteners, spammy language, and heavy formatting.

## Setup

1. Add your resume PDF to `assets/resume.pdf`.
2. Configure `.env`.

```bash
cp .env.example .env
npm install
npm start
```

Open `http://localhost:3000`.

## Deploy to Vercel

1. Push code to GitHub (including `assets/resume.pdf` if acceptable for your project).
2. Import project in Vercel.
3. Add env vars from `.env.example` in Vercel project settings.
4. Deploy.

## API

`POST /send-mails` with JSON or URL-encoded body:

- `recruiterEmails` (required, comma separated)
