# Hackathon Evaluator

A modern, responsive React + Next.js dashboard to evaluate hackathon projects from a CSV file using AI. Features a stunning Hyperspeed WebGL hero section, ShinyText animations, and a streamlined dark-mode interface.

![Hackathon Evaluator](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?style=flat-square&logo=tailwind-css)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?style=flat-square&logo=typescript)

## ✨ Features

### Core Functionality
- **Google Sign-in** — Sign in with Google to save and share evaluations
- **API Key Setup** — Use Gemini or OpenAI; store API key in localStorage via Settings
- **CSV Upload** — Drag-and-drop or click to upload submissions with validated headers
- **Automated Evaluation** — Process all projects with AI using custom judging criteria
- **Google Drive Integration** — Supports multiple links (folders for presentation, coding, docs). Fetches content from shared Google Docs. For folders: use `GOOGLE_SERVICE_ACCOUNT_JSON`; participants must share their folder with the service account email (API key returns empty for shared folders)
- **Dashboard** — Searchable, sortable table with Project Title, Score, and Status
- **Evaluation List** — View all evaluations with uploader attribution; switch between or create new ones
- **Detail View** — Side-by-side comparison of original submission and AI critique
- **Export** — Download evaluated results as CSV, Excel, or PDF
- **Share Results** — Generate a shareable link anyone can use to view evaluation results (no login required)

### UI/UX
- **Hyperspeed Hero** — WebGL-powered animated road with car lights and distortion effects
- **ShinyText** — Animated gradient text on headings (Upload Submissions, No projects yet)
- **Dark Mode** — Sleek dark theme throughout
- **Smooth Animations** — Fade, slide, and scale transitions on key sections
- **Glow Effects** — Primary-colored glow on empty state heading

### Judging Criteria (default total: 100, professional hackathon style)
- Problem Definition & Clarity (12 pts)
- Innovation & Uniqueness (14 pts)
- Technical Execution (18 pts)
- AI Integration (18 pts)
- User Impact & Value (14 pts)
- Completeness & Polish (2 pts)
- Demo Presentation (drive link) (8 pts) — No link = 0; link not accessible = max 2; accessible + content aligns = full marks
- Presentation & Communication (8 pts)
- Scalability & Viability (6 pts)

## 🛠 Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Next.js 14, React 18 |
| Styling | Tailwind CSS v3, shadcn/ui |
| AI | Gemini or OpenAI |
| CSV | PapaParse |
| Animation | Motion, Three.js, Postprocessing |

## 📋 Prerequisites

- **Node.js 18+** (required for Next.js)
- API keys configured via environment variables (never exposed to the client)

## 🚀 Getting Started

```bash
# Clone the repository
git clone https://github.com/utkarshsingx/Hackathon-Evaluator.git
cd Hackathon-Evaluator

# Install dependencies
npm install

# Configure API keys (copy .env.example to .env.local)
cp .env.example .env.local
# Edit .env.local and add your keys

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🔐 Environment Variables

API keys are **server-side only** and never sent to the browser. Configure in Vercel or locally:

| Variable | Description |
|----------|-------------|
| `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com/apikey) key for Gemini |
| `OPENAI_API_KEY` | [OpenAI Platform](https://platform.openai.com/api-keys) key |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | **Recommended for Drive folders.** Full JSON string of a [Google service account key](https://console.cloud.google.com/iam-admin/serviceaccounts). Participants must share their Drive folder with the service account email (e.g. `xxx@project.iam.gserviceaccount.com`). API key alone returns empty for shared folders. |
| `GOOGLE_DRIVE_API_KEY` | Optional fallback. API key with Drive API enabled; only works for public folders. |
| `NEXT_PUBLIC_SUPABASE_URL` | [Supabase](https://supabase.com) project URL (for auth and data storage) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `NEXT_PUBLIC_APP_URL` | Optional. Your app URL for share links (defaults to Vercel URL or localhost) |

**Supabase setup:** Create a project at [supabase.com](https://supabase.com), enable Google Auth in Authentication → Providers, and run the migration in `supabase/migrations/20240313000000_initial_schema.sql` via the SQL Editor.

**Drive folder access (service account):** In [Google Cloud Console](https://console.cloud.google.com/) → IAM & Admin → Service Accounts → Create → Create key (JSON). Paste the full JSON as `GOOGLE_SERVICE_ACCOUNT_JSON`. Instruct participants to share their Drive folder with the service account email (e.g. `xxx@project.iam.gserviceaccount.com`) as Viewer.

**Vercel:** Project Settings → Environment Variables → Add all keys above

## 📁 CSV Format

Your CSV must include these headers (exact match or supported alternates like "Email Address" for "Email", "Number" for "Phone Number"):

| Column | Required |
|--------|----------|
| Timestamp | ✓ |
| Email | ✓ |
| Phone Number | ✓ |
| Project Title | ✓ |
| What real-world problem are you solving? | ✓ |
| Who is this problem for? (Profession / domain / user type) | ✓ |
| How does your solution use AI? | ✓ |
| What AI Tools / Platforms have you used | ✓ |
| How does your solution help the user? (example-time saved, cost reduced, effort reduced, revenue increased) | ✓ |
| Please share GOOGLE DRIVE link having your project demo video, files and images | ✓ |
| Explain your solution in detail (For ex. what you did, why is this useful) | ✓ |
| What was the biggest challenge you faced during this hackathon? | ✓ |
| Score and Reason | optional |

See `sample-submissions.csv` for a template.

## 📂 Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── evaluate/           # AI evaluation
│   │   ├── evaluations/        # CRUD for evaluations
│   │   ├── share/[slug]/      # Public share by slug
│   │   └── auth/callback/     # OAuth callback
│   ├── share/[slug]/page.tsx  # Public share page
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── ui/               # shadcn/ui components
│   ├── dashboard.tsx     # Main dashboard
│   ├── AuthButton.tsx    # Google sign-in/out
│   ├── AuthGuard.tsx     # Auth-gated content
│   ├── EvaluationList.tsx # List of evaluations
│   ├── ShareButton.tsx   # Copy share link
│   ├── HeroSection.tsx   # Hero with Hyperspeed
│   ├── Hyperspeed.tsx   # WebGL road animation
│   ├── ShinyText.tsx    # Animated gradient text
│   ├── theme-provider.tsx
│   └── theme-toggle.tsx
├── lib/
│   ├── supabase/        # Supabase client (browser, server, middleware)
│   ├── ai.ts            # AI API (Gemini + OpenAI)
│   ├── csv.ts           # CSV parsing & export
│   ├── drive.ts         # Google Drive/Docs content fetch
│   ├── types.ts         # TypeScript types
│   └── utils.ts         # Utilities
└── supabase/
    └── migrations/      # Database schema
```

## 📜 Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

## 📄 License

MIT
