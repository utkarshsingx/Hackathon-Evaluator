# Hackathon Evaluator

A modern, responsive React + Next.js dashboard to evaluate hackathon projects from a CSV file using AI. Features a stunning Hyperspeed WebGL hero section, ShinyText animations, and a streamlined dark-mode interface.

![Hackathon Evaluator](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?style=flat-square&logo=tailwind-css)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?style=flat-square&logo=typescript)

## ✨ Features

### Core Functionality
- **API Key Setup** — Securely store your API key in localStorage via the Settings button
- **CSV Upload** — Drag-and-drop or click to upload submissions with validated headers
- **Automated Evaluation** — Process all projects with AI using custom judging criteria
- **Dashboard** — Searchable, sortable table with Project Title, Score, and Status
- **Detail View** — Side-by-side comparison of original submission and AI critique
- **Export** — Download evaluated results as CSV

### UI/UX
- **Hyperspeed Hero** — WebGL-powered animated road with car lights and distortion effects
- **ShinyText** — Animated gradient text on headings (Upload Submissions, No projects yet)
- **Dark Mode** — Sleek dark theme throughout
- **Smooth Animations** — Fade, slide, and scale transitions on key sections
- **Glow Effects** — Primary-colored glow on empty state heading

### Judging Criteria
- Uniqueness (2 pts)
- Problem Solving (3 pts)
- Approach (2 pts)
- Resilience (3 pts)

## 🛠 Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Next.js 14, React 18 |
| Styling | Tailwind CSS v3, shadcn/ui |
| AI | Google Generative AI (Gemini) |
| CSV | PapaParse |
| Animation | Motion, Three.js, Postprocessing |

## 📋 Prerequisites

- **Node.js 18+** (required for Next.js)
- A [Google AI Studio API key](https://aistudio.google.com/apikey) (Gemini)

## 🚀 Getting Started

```bash
# Clone the repository
git clone https://github.com/utkarshsingx/Hackathon-Evaluator.git
cd hackathon-evaluator

# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📁 CSV Format

Your CSV must include these exact headers:

| Column | Description |
|--------|-------------|
| Timestamp | Submission timestamp |
| Email | Participant email |
| Phone Number | Contact number |
| Project Title | Name of the project |
| What real-world problem are you solving? | Problem statement |
| Who is this problem for? | Target audience |
| How does your solution use AI? | AI integration details |
| What AI Tools / Platforms have you used | Tools used |
| How does your solution help the user? | Value proposition |
| Demo Link | URL to demo |
| Detailed Explanation | Full description |
| Biggest Challenge | Main obstacle |

See `sample-submissions.csv` for a template.

## 📂 Project Structure

```
src/
├── app/
│   ├── api/evaluate/     # API route for evaluation
│   ├── globals.css       # Tailwind + design tokens
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── ui/               # shadcn/ui components
│   ├── dashboard.tsx     # Main dashboard
│   ├── HeroSection.tsx    # Hero with Hyperspeed
│   ├── Hyperspeed.tsx    # WebGL road animation
│   ├── ShinyText.tsx     # Animated gradient text
│   ├── theme-provider.tsx
│   └── theme-toggle.tsx
└── lib/
    ├── gemini.ts         # AI API service
    ├── csv.ts            # CSV parsing & export
    ├── types.ts          # TypeScript types
    └── utils.ts          # Utilities
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
