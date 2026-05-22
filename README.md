# Mjølner AI Modernization Engine

Platform health assessment tool for existing and prospective customers — from intake dialog to health check, AI-generated report, prioritised opportunities, and TCO analysis.

## Deploy to Vercel (5 minutes)

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_ORG/mjolner-engine.git
git push -u origin main
```

### 2. Deploy on Vercel
1. Go to [vercel.com](https://vercel.com) → New Project
2. Import your GitHub repository
3. Add environment variable:
   - **Name:** `ANTHROPIC_API_KEY`
   - **Value:** your Anthropic API key (from [console.anthropic.com](https://console.anthropic.com))
4. Click Deploy

That's it. You'll get a URL like `mjolner-engine.vercel.app`.

## Local development

```bash
npm install
```

Create `.env.local`:
```
ANTHROPIC_API_KEY=sk-ant-...
```

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

## Structure

```
mjolner-engine/
├── api/
│   └── report.js          # Vercel serverless function (Anthropic proxy)
├── src/
│   ├── main.jsx            # React entry + localStorage polyfill
│   └── App.jsx             # Full application
├── index.html
├── vite.config.js
├── vercel.json
└── package.json
```

## Features

- **5-step workflow:** Dialog → Health Check → AI Report → Opportunities → TCO
- **7-dimension scoring** with weighted health score
- **AI report generation** via Claude Sonnet (executive summary, findings, roadmap)
- **TCO engine** based on Mjølner empirical methodology (tech multipliers, hidden cost layers)
- **Opportunity prioritisation:** Projects → Managed Service → Consultants
- **Persistent storage** via localStorage (data survives page refresh)
- **Multi-customer** management with add/delete

## Adding your Anthropic API key

The AI report generation requires an Anthropic API key. Get one at [console.anthropic.com](https://console.anthropic.com).

On Vercel: Settings → Environment Variables → Add `ANTHROPIC_API_KEY`
