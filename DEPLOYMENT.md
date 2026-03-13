# Production Deployment Guide

Step-by-step setup for deploying Hackathon Evaluator to **Vercel** with **Supabase**.

---

## 1. Supabase Setup

### 1.1 Create a project

1. Go to [supabase.com](https://supabase.com) → **New Project**
2. Choose organization, name the project, set a database password (save it)
3. Select region and create

### 1.2 Run migrations

1. In Supabase Dashboard → **SQL Editor** → **New query**
2. Run each migration file **in order**:
   - `supabase/migrations/20240313000000_initial_schema.sql`
   - `supabase/migrations/20240313000001_judging_criteria_default.sql`
   - `supabase/migrations/20240313000002_last_evaluated_at.sql`

Or paste all three files’ contents into one query and run.

### 1.3 Enable Google Auth

1. **Authentication** → **Providers** → **Google**
2. Turn **Enable Sign in with Google** ON
3. Create OAuth credentials in [Google Cloud Console](https://console.cloud.google.com/):
   - APIs & Services → Credentials → Create OAuth 2.0 Client ID
   - Application type: **Web application**
   - Authorized redirect URIs: `https://<your-project-ref>.supabase.co/auth/v1/callback`
   - Copy **Client ID** and **Client Secret**
4. Paste Client ID and Client Secret into Supabase Google provider
5. Save

### 1.4 Get API keys

1. **Project Settings** (gear icon) → **API**
2. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## 2. Vercel Setup

### 2.1 Deploy the project

1. Go to [vercel.com](https://vercel.com) → **Add New** → **Project**
2. Import your GitHub repo
3. Framework preset: **Next.js** (auto-detected)
4. Click **Deploy** (first deploy can fail until env vars are set)

### 2.2 Add environment variables

1. **Project** → **Settings** → **Environment Variables**
2. Add each variable below for **Production** (and Preview/Development if needed)

| Variable | Value | Notes |
|----------|-------|-------|
| `GEMINI_API_KEY` | Your key | [Google AI Studio](https://aistudio.google.com/apikey) |
| `OPENAI_API_KEY` | Your key | [OpenAI Platform](https://platform.openai.com/api-keys) |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxx.supabase.co` | From Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` | From Supabase → Settings → API |
| `NEXT_PUBLIC_APP_URL` | `https://your-app.vercel.app` | **Required for share links.** Set to your production URL so share links use it instead of preview deployment URLs. |

**Optional (Drive folders):**

| Variable | Value | Notes |
|----------|-------|-------|
| `GOOGLE_SERVICE_ACCOUNT_JSON` | `{"type":"service_account",...}` | Full JSON string of service account key |
| `GOOGLE_DRIVE_API_KEY` | Your key | Fallback for public folders only |

**For `GOOGLE_SERVICE_ACCOUNT_JSON`:**

- Paste the **entire** JSON from the service account key file
- In Vercel, use a single-line value or the multi-line editor
- No extra quotes around the JSON

### 2.3 Configure auth redirect URL in Supabase (critical – prevents localhost redirects)

1. Supabase → **Authentication** → **URL Configuration**
2. **Site URL**: `https://your-app.vercel.app` (must be production URL, not localhost)
3. **Redirect URLs**: add:
   - `https://your-app.vercel.app/**`
   - `https://your-app.vercel.app/auth/callback`
4. Save

If Site URL or Redirect URLs point to localhost, sign-in and share links will redirect to localhost instead of production.

### 2.4 Redeploy

1. Vercel → **Deployments** → **⋯** on latest → **Redeploy**
2. Or push a new commit to trigger a deploy

---

## 3. Checklist

- [ ] Supabase project created
- [ ] All 3 migrations run in SQL Editor
- [ ] Google Auth enabled and configured
- [ ] `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel
- [ ] `GEMINI_API_KEY` or `OPENAI_API_KEY` in Vercel
- [ ] `NEXT_PUBLIC_APP_URL` set to your Vercel URL
- [ ] Supabase Site URL and Redirect URLs updated
- [ ] Redeployed after adding env vars

---

## 4. Drive folder access (optional)

If you want to evaluate Drive folders:

1. [Google Cloud Console](https://console.cloud.google.com/) → IAM & Admin → Service Accounts
2. Create service account → Create key → JSON
3. Download and copy the full JSON
4. Add `GOOGLE_SERVICE_ACCOUNT_JSON` in Vercel (paste the JSON)
5. Instruct participants to share their Drive folder with the service account email (e.g. `xxx@project.iam.gserviceaccount.com`) as **Viewer**

---

## 5. Troubleshooting

| Issue | Fix |
|-------|-----|
| "Unauthorized" on API calls | Check Supabase URL and anon key; ensure user is signed in |
| "Failed to create share link" | Ensure Supabase env vars are set and redeploy |
| Google sign-in fails | Verify redirect URL in Supabase matches your Vercel URL |
| Drive folders return empty | Use `GOOGLE_SERVICE_ACCOUNT_JSON`; participants must share folder with service account email |
| Share page 404 | Share link format: `https://your-app.vercel.app/share/<slug>` |
