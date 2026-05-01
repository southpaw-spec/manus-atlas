# Manus Atlas Tool — Deployment Guide

The working v1 of the homepage tool. From this folder to a live, working manusatlas.com in about 45 minutes.

## What's in this folder

- `index.html` — the entire frontend (HTML + CSS + JS in one file)
- `api/generate.js` — Vercel serverless function that proxies to the Anthropic API
- `vercel.json` — deployment config
- `package.json` — Node project metadata

## Architecture, in one paragraph

The browser loads `index.html` from Vercel. When the user submits the form, the frontend `POST`s to `/api/generate`. Vercel routes that to `api/generate.js`, which holds your Anthropic API key as an environment variable, calls Claude Sonnet 4.6 with the engine prompt, and returns the result. The frontend renders it. The user's API key is NEVER in the browser. This is the right architecture for production.

## Step-by-step deployment

### Step 1 — Get an Anthropic API key (5 minutes)

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Sign up or log in
3. Click "API Keys" in the left sidebar
4. Click "Create Key"
5. Name it "Manus Atlas Production"
6. Copy the key immediately — you can't see it again

7. Click "Plans & Billing" and load $20 in credits to start. That's enough for ~5,000 tool runs at this prompt size.

### Step 2 — Get a Vercel account (5 minutes)

1. Go to [vercel.com](https://vercel.com)
2. Sign up using your GitHub account (you'll want it for deploying)
3. Free tier is fine — we'll never need to pay until we're at significant scale

### Step 3 — Get the code into a GitHub repo (5 minutes)

Two options:

**Option A — Drag and drop deployment (no Git, fastest):**
1. Go to vercel.com/new
2. Click "Browse all templates" → "Other"
3. Choose "Deploy a static site"
4. Drag this entire `tool/` folder into the upload box
5. Click "Deploy"

**Option B — Via GitHub (better for ongoing edits):**
1. Create a new private repo on GitHub called `manus-atlas`
2. From your terminal, in the `tool/` directory:
   ```bash
   git init
   git add .
   git commit -m "Initial commit — v1 tool"
   git remote add origin git@github.com:YOUR_USERNAME/manus-atlas.git
   git push -u origin main
   ```
3. In Vercel, click "Import Project" → select your GitHub repo → Deploy

### Step 4 — Set the environment variable (3 minutes)

1. In Vercel, click on your project
2. Go to "Settings" → "Environment Variables"
3. Add a new variable:
   - **Name:** `ANTHROPIC_API_KEY`
   - **Value:** [paste the key from Step 1]
   - **Environments:** check Production, Preview, AND Development
4. Click "Save"
5. Go to "Deployments" → click the three dots on the latest deployment → "Redeploy" (this is needed because env vars don't apply to existing deploys)

### Step 5 — Test the tool on the *.vercel.app URL (5 minutes)

1. Vercel gave you a URL like `manus-atlas-abc123.vercel.app`
2. Open it in a browser
3. Fill in the form with your real role and three tasks
4. Hit submit
5. You should see five agents in ~5 seconds

If it works: continue to Step 6.

If it errors:
- Open browser DevTools → Console. Note the error.
- Most likely cause: env var not set or didn't redeploy. Go back to Step 4.
- Second most likely cause: API key is invalid. Test it: `curl https://api.anthropic.com/v1/messages -H "x-api-key: YOUR_KEY" -H "anthropic-version: 2023-06-01" -H "content-type: application/json" -d '{"model":"claude-sonnet-4-6","max_tokens":10,"messages":[{"role":"user","content":"hi"}]}'` — should return JSON, not a 401.

### Step 6 — Connect manusatlas.com to Vercel (10 minutes)

1. In Vercel, go to your project → "Settings" → "Domains"
2. Add `manusatlas.com` and `www.manusatlas.com`
3. Vercel will give you DNS records to set
4. Go to your domain registrar (Namecheap or Porkbun)
5. Set the DNS records exactly as Vercel specifies
6. Wait 5–60 minutes for DNS to propagate (usually <10 min)
7. Visit manusatlas.com — you should see the tool

### Step 7 — Set up Formspree for email capture (5 minutes)

1. Go to [formspree.io](https://formspree.io) and sign up (free tier covers 50 submissions/month, good for testing — upgrade to $10/mo when you launch)
2. Create a new form, name it "Manus Atlas Email Capture"
3. Copy the form endpoint URL (looks like `https://formspree.io/f/abc123xyz`)
4. Open `index.html`, search for `REPLACE_WITH_YOUR_FORMSPREE_ID`, and replace the entire URL with your endpoint
5. In Formspree, set the "thank you" redirect to `https://manusatlas.com` (or skip — frontend handles it)
6. In Formspree settings, enable "Forward to Beehiiv" or use Zapier to push captured emails into Beehiiv automatically

7. Push the change to GitHub (or re-drag-drop to Vercel) — Vercel auto-deploys

### Step 8 — End-to-end test (5 minutes)

1. Open manusatlas.com in incognito mode
2. Submit the form with a real role
3. See your result appear
4. Submit your email in the email capture
5. Check that the email lands in Formspree's dashboard
6. If using Beehiiv: check the email made it into Beehiiv too

If all that works, you have a deployed, working v1 of the tool. Total time: ~45 minutes.

## Editing the engine prompt

The prompt lives at the top of `api/generate.js` as a string constant called `SYSTEM_PROMPT`. To iterate:

1. Edit the prompt locally
2. Test by running `vercel dev` (you'll need `npm i -g vercel` first)
3. When happy, push to GitHub (or re-drag-drop to Vercel)
4. Vercel auto-deploys to production within ~30 seconds

**IMPORTANT:** Keep `04-engine-prompt-v1-1.md` in sync with the prompt in `generate.js`. They should always match. The .md file is your reference, the .js file is what runs.

## Cost estimates

| Phase | Tool uses/month | Anthropic cost | Vercel cost | Total |
|-------|-----------------|----------------|-------------|-------|
| Launch (month 1) | 1,000–3,000 | $20–60 | $0 | $20–60 |
| Growing (months 2–3) | 5,000–15,000 | $100–300 | $0 | $100–300 |
| Scaling (months 4+) | 20,000–50,000 | $400–1,000 | $20 | $420–1,020 |

Each tool generation costs roughly $0.02 in Anthropic API fees. If you're getting 10% of users to subscribe at $0 (free newsletter), and 1% of subscribers eventually monetize at $50/yr lifetime value, the unit economics are profitable from day one.

## Things to add in v2 (after launch)

These are deliberately NOT in v1. Don't build them now.

- **Rate limiting per IP.** v1 doesn't have it. Easy to add later via Upstash Redis or Vercel KV. Add when you see actual abuse, not before.
- **Result caching.** Same role+tasks should return same result without an API call. Saves money at scale. Add at month 2.
- **A/B testing the engine prompt.** Build this when you have enough volume to actually measure. Month 3+.
- **Save-result-by-link.** Each result gets a permanent shareable URL. Month 2 — increases share rate ~30%.
- **Multilingual support.** When you have non-English users requesting it. Probably month 6+.

## If something breaks at launch

1. Check Vercel's deployment logs — most issues show up there
2. Check Anthropic's API status at [status.anthropic.com](https://status.anthropic.com)
3. Check that env vars are still set correctly
4. If you can't figure it out in 15 minutes, post an Atlas pause on the homepage and email subscribers honestly. People forgive outages. They don't forgive cover-ups.

## Final note

This codebase is intentionally small. ~600 lines of HTML, ~150 lines of serverless JS. Everything you need to run a production tool. Don't over-engineer it.

Ship it. Iterate based on real users. The wealth is on the other side.
