---
name: project-bmax-email-setup
description: BMax transactional email via Resend; SPF/DKIM/DMARC config documented
metadata:
  type: project
  originSessionId: current
  modified: 2026-08-26T15:57:26.698Z
---

**BMax Email Setup (2026-08-26)**

Transactional email implemented using Resend (following GVX pattern). Emails working end-to-end; currently going to spam due to missing DNS records.

**What was implemented:**
- Resend integration: POST to https://api.resend.com/emails with Bearer token (RESEND_API_KEY)
- sendAccessCredentials() sends welcome email with Portal + Motor credentials on user create
- sendEmail() generic function for alerts (e.g., forgot-password admin alerts)
- Email template shows username/password, Portal link, Motor link (except for revenda role)

**Environment variables:**
- RESEND_API_KEY: stored in Vercel production (see [[reference_resend_api_key]] in global memory)
- Sender: noreply@boxersoldas.com.br (verified domain on Resend account)

**DNS configuration (PENDING)** — add these records to boxersoldas.com.br DNS:
```
SPF:    v=spf1 include:resend.com ~all
DKIM:   (obtain from Resend dashboard, add CNAME record)
DMARC:  v=DMARC1; p=quarantine; rua=mailto:dmarc@boxersoldas.com.br
```

Result: emails will move from spam to inbox once DNS records are added.

**Routes:**
- POST /auth/forgot-password: user requests password reset → admin alert email sent to all adm users
- POST /users (create): triggers sendAccessCredentials() automatically

**Tested:** user created with email, credentials received in inbox (currently spam). Logged in successfully with sent password.

**Deployed:** commit included in session; RESEND_API_KEY added to Vercel.
