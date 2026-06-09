# Deploying the AI Outreach Automation Platform

This guide walks you through deploying the AI Outreach Automation Platform to **Vercel** for the frontend/API and setting up **Supabase** for the database and authentication.

---

## Prerequisites

- A [GitHub](https://github.com) account.
- A [Vercel](https://vercel.com) account.
- A [Supabase](https://supabase.com) account.
- API keys for **OpenRouter** (AI content generation) and optionally **Resend** (for sending emails via API) or a **Gmail App Password** (for sending via SMTP).

---

## Step 1: Set Up the Supabase Database

1. **Create a New Project:**
   - Log in to the [Supabase Dashboard](https://supabase.com/dashboard) and create a new project.
   - Note down your **Database Password**.

2. **Run Database Migrations:**
   We have 3 migration files located under `supabase/migrations/` that need to be run to set up the schema (tables, triggers, policies):
   - [001_initial_schema.sql](file:///c:/PROSMART%20NEW%20PROJECT%201/ai-outreach-platform/supabase/migrations/001_initial_schema.sql)
   - [002_lead_messages.sql](file:///c:/PROSMART%20NEW%20PROJECT%201/ai-outreach-platform/supabase/migrations/002_lead_messages.sql)
   - [003_queue_columns.sql](file:///c:/PROSMART%20NEW%20PROJECT%201/ai-outreach-platform/supabase/migrations/003_queue_columns.sql)

   *Choose one of the two ways below to apply them:*

   ### Option A: SQL Editor (Easiest)
   - In the Supabase Dashboard, click on **SQL Editor** in the left sidebar.
   - Click **New query**.
   - Copy the contents of `001_initial_schema.sql` and paste it into the editor, then click **Run**.
   - Create another **New query**, paste `002_lead_messages.sql`, and click **Run**.
   - Create a final **New query**, paste `003_queue_columns.sql`, and click **Run**.

   ### Option B: Supabase CLI (Advanced)
   - Log in using CLI: `supabase login`
   - Link your project: `supabase link --project-ref <your-project-id>`
   - Push migration files: `supabase db push`

3. **Configure Authentication Redirects:**
   - Go to **Auth Settings** -> **Redirect URLs** in your Supabase project dashboard.
   - Add your Vercel production URL redirect endpoint:
     `https://<your-vercel-domain>.vercel.app/auth/callback`

---

## Step 2: Push Code to GitHub

Make sure all your changes are committed and pushed to a remote GitHub repository:

```bash
git add .
git commit -m "Configure environment variables and error handling for Vercel deployment"
git branch -M main
git remote add origin https://github.com/your-username/your-repo-name.git
git push -u origin main
```

---

## Step 3: Deploy to Vercel

1. **Import the Repository:**
   - Go to the [Vercel Dashboard](https://vercel.com/dashboard) and click **Add New** -> **Project**.
   - Import your GitHub repository.

2. **Configure Environment Variables:**
   Expand the **Environment Variables** section and add the variables from your `.env.local`. Copy the keys and values exactly:

   | Variable Key | Suggested Production Value / Source |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon public API key |
   | `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key (private) |
   | `OPENROUTER_API_KEY` | Your OpenRouter API key |
   | `OPENROUTER_MODEL` | `openai/gpt-4o-mini` (or your choice) |
   | `RESEND_API_KEY` | Your Resend API key (if using Resend) |
   | `RESEND_FROM_EMAIL` | The verified email address in Resend |
   | `RESEND_FROM_NAME` | Your Outreach sender display name |
   | `GMAIL_USER` | Your Gmail address (if using Gmail SMTP) |
   | `GMAIL_APP_PASSWORD` | Your Gmail App Password (if using Gmail SMTP) |
   | `SENDER_JOB_TITLE` | Your Title (e.g. `Founder`) |
   | `SENDER_COMPANY` | Your Company Name |
   | `SENDER_PHONE` | Your Phone Number |
   | `NEXT_PUBLIC_APP_URL` | `https://<your-vercel-domain>.vercel.app` |
   | `NEXT_PUBLIC_EMAIL_DAILY_LIMIT` | Daily email limit (e.g. `450`) |

   > [!IMPORTANT]
   > Ensure `NEXT_PUBLIC_APP_URL` uses your actual Vercel domain (e.g., `https://ai-outreach-platform.vercel.app`) rather than `http://localhost:3000`.

3. **Deploy:**
   - Leave the build settings as default (Vercel automatically detects Next.js).
   - Click **Deploy**. Vercel will build the project in 1-2 minutes.

---

## Step 4: Verify Deployment

1. Visit the deployed application URL.
2. Sign up / log in to your account.
3. Test creating a campaign, generating emails with AI, and sending emails to ensure the database integrations and OpenRouter/Gmail APIs work correctly.
