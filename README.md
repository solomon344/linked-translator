# LinkedIn Translator — Setup Guide

## Project Structure
```
linkedin-translator/
├── manifest.json       ← Chrome extension manifest
├── popup.html          ← Extension popup UI
├── popup.js            ← Popup logic
├── content.js          ← Injected into LinkedIn pages
├── content.css         ← Styles for LinkedIn injections
├── background.js       ← Service worker
├── server.js           ← Express backend (deploy to Hetzner)
├── package.json
└── icons/              ← Add icon16.png, icon48.png, icon128.png
```

---

## Step 1: Set Up the Backend

### On your Hetzner VPS (via Dokploy):

1. Create a new service in Dokploy
2. Set these environment variables:
   - `OPENROUTER_API_KEY` = your OpenRouter key
   - `DODO_WEBHOOK_SECRET` = from Dodo dashboard
   - `PORT` = 3000 (or whatever Dokploy assigns)

3. Deploy the backend files (everything except manifest, popup, content, background)

4. Note your public URL, e.g. `https://api.your-domain.com`

---

## Step 2: Configure the Extension

Replace these placeholders in the code:

**In `popup.js` and `background.js`:**
```js
const DODO_PAYMENT_URL = 'https://checkout.dodopayments.com/buy/YOUR_PRODUCT_ID';
```

**In `popup.js` and `content.js`:**
```js
const API_BASE = 'https://your-api.your-domain.com';
```

---

## Step 3: Set Up Dodo Payments

1. Go to your Dodo dashboard
2. Create a product: "LinkedIn Translator — Unlimited"
   - Price: $5 one-time
3. Copy the product checkout URL → paste into `DODO_PAYMENT_URL`
4. Set up webhook pointing to: `https://your-api.your-domain.com/webhook/dodo`
5. Copy webhook secret → set as `DODO_WEBHOOK_SECRET` env var

---

## Step 4: Add Email for License Delivery

In `server.js`, find:
```js
// TODO: email the license key to event.data.customer.email
```

Hook up Resend (recommended, free tier):
```js
import { Resend } from 'resend';
const resend = new Resend(process.env.RESEND_API_KEY);

await resend.emails.send({
  from: 'LinkedIn Translator <noreply@your-domain.com>',
  to: event.data.customer.email,
  subject: 'Your LinkedIn Translator License Key',
  text: `Your license key: ${licenseKey}\n\nOpen the extension, click "Already paid?" and enter this key.`
});
```

---

## Step 5: Add Icons

Create 3 icon files in the `icons/` folder:
- `icon16.png` — 16×16px
- `icon48.png` — 48×48px  
- `icon128.png` — 128×128px

Use a 📰 emoji or newspaper icon as the base.

---

## Step 6: Load Extension in Chrome

1. Open Chrome → go to `chrome://extensions`
2. Enable **Developer Mode** (top right toggle)
3. Click **Load unpacked**
4. Select the `linkedin-translator` folder
5. Pin the extension → go to LinkedIn → find a cringe post

---

## Step 7: Publish (optional)

To distribute properly:
1. Create a `.zip` of the extension folder
2. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
3. Pay the one-time $5 developer fee
4. Submit for review (~1-3 days)

**Faster option:** Share the `.zip` directly. Users load it as unpacked.

---

## Production To-Do

- [ ] Move license storage from in-memory Set → SQLite or Postgres
- [ ] Add rate limiting to `/translate` (e.g. express-rate-limit)
- [ ] Set up proper CORS origin restriction
- [ ] Hook up email delivery (Resend)
- [ ] Add icon files
- [ ] Replace all placeholder URLs
