import { useState, useEffect, useCallback, useRef } from "react";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const DIMENSIONS = [
  { id: "security",     label: "Security",                     weight: 1.4, icon: "🔐", desc: "Credentials, HTTPS, auth patterns, CVEs" },
  { id: "deps",         label: "Dependencies & Packages",      weight: 1.2, icon: "📦", desc: "EOL packages, CVEs, SBOM, lifecycle" },
  { id: "infra",        label: "Infrastructure & Runtime",     weight: 1.1, icon: "☁️", desc: "IaC, health endpoints, observability, containers" },
  { id: "compliance",   label: "Compliance & Data (GDPR)",     weight: 1.2, icon: "⚖️", desc: "Data encryption, DSAR workflows, retention policies" },
  { id: "operability",  label: "Operability (CI/CD / DR)",     weight: 1.3, icon: "🔄", desc: "CI/CD pipeline, disaster recovery, bus factor" },
  { id: "architecture", label: "Architecture",                 weight: 1.0, icon: "🏗️", desc: "Layer separation, coupling, modularity" },
  { id: "codequality",  label: "Code Quality",                 weight: 1.0, icon: "💻", desc: "Test coverage, cyclomatic complexity, duplication" },
];

const TECH_MULTIPLIERS = {
  "ASP.NET WebForms": 1.6,
  "Legacy / Mixed":   1.5,
  ".NET Framework":   1.3,
  ".NET / C#":        1.0,
  "Java / Spring":    1.0,
  "Node.js":          0.9,
  "Python":           0.9,
  "Modern Cloud":     0.7,
};

const DEFAULT_SCORES = { security: null, deps: null, infra: null, compliance: null, operability: null, architecture: null, codequality: null };

const SEED_CUSTOMERS = [
  {
    id: "beh-001",
    name: "BehandlerBooking",
    org: "PensionDanmark",
    contact: "Morten Jokumsen",
    tech: ".NET / C#",
    age: 6,
    users: 500,
    integrations: 18,
    hosting: "Azure",
    concerns: "Identity provider approaching EOL, IaC significantly out of date, .NET 8 must be upgraded to .NET 10 before Nov 2026. Dependency lifecycle behind ~15 months.",
    notes: "Stable, well-architected platform. Core architecture is a genuine strength — modular monolith, zero dependency cycles. No rebuild needed. Targeted modernisation of natural-drift layers.",
    type: "existing",
    scores: { security: 5.0, deps: 4.0, infra: 5.0, compliance: 5.4, operability: 5.1, architecture: 7.7, codequality: 5.4 },
    findings: {
      security: "Hardcoded secrets in repo, known CVEs in packages, strong JWT auth foundation",
      deps: "~15 months behind on packages, EOL identity provider (IdentityServer 4), critical CVEs",
      infra: "IaC significantly out of date, Terraform and Kubernetes lifecycle overdue",
      compliance: "Strong PII tagging + Roslyn analyser, data retention gaps, DSAR workflows incomplete",
      operability: "Credible CI/CD, rollback and DR procedures need strengthening",
      architecture: "Clean onion architecture, zero dependency cycles, 68-project solution",
      codequality: "Low complexity in production code, thin test and documentation coverage",
    },
  },
  {
    id: "escrm-001",
    name: "ESCRM / IDS.EBSTCRM",
    org: "Erhvervshus Network",
    contact: "Jannike Kristine Mogensen",
    tech: "ASP.NET WebForms",
    age: 12,
    users: 300,
    integrations: 6,
    hosting: "On-premise",
    concerns: "Live credentials committed to source code (6 categories). Plain-text passwords in DB. CPR numbers unencrypted. Zero tests. Bus factor 1 — 91.5% of commits from one person.",
    notes: "Critical state across all 7 dimensions. Immediate intervention required. WebForms monolith blocks all modernisation. System exit risk 40% within 2 years.",
    type: "existing",
    scores: { security: 2.8, deps: 3.8, infra: 2.4, compliance: 4.2, operability: 1.9, architecture: 4.2, codequality: 2.5 },
    findings: {
      security: "Azure AD client secret + 2 SQL passwords + Google Maps key committed in Web.config. Plain-text password comparison in SQLDB.cs",
      deps: ".NET 4.0 ServerService EOL Jan 2016, Microsoft.Graph v4 EOL, CVE-2024-21319, 3 untracked local DLLs",
      infra: "No Docker, no IaC, no CI/CD YAML, debug=true in prod, no /health endpoint, WSLog only",
      compliance: "CPR numbers unencrypted, DES-cipher with 56-bit key + hardcoded IV, no DSAR workflow",
      operability: "Manual CI/CD, deployment errors swallowed silently, 0 git tags on 212 commits, no CHANGELOG",
      architecture: "God-class SQLDB.cs (13k+ LOC), skip-layer violations, WebForms tight UI/data coupling",
      codequality: "CCN 211 hotspot, 0% test coverage, 17.5% code duplication, 644 ASPX pages",
    },
  },
  {
    id: "semco-001",
    name: "Semco Portfolio",
    org: "Semco Maritime",
    contact: "Portfolio Owner",
    tech: "Java / Spring",
    age: 9,
    users: 150,
    integrations: 10,
    hosting: "Hybrid",
    concerns: "All 3 projects have single-developer dependencies. WindMultiplikator hotspots at 2.4/10. Hardcoded passwords across repos. No SBOM. Technical debt doubles feature delivery time.",
    notes: "Active development. Research shows 15× more defects and 2× longer delivery time in unhealthy code. Every sprint compounds the overhead.",
    type: "existing",
    scores: { security: 4.5, deps: 4.8, infra: 4.5, compliance: 5.0, operability: 4.2, architecture: 5.5, codequality: 3.8 },
    findings: {
      security: "Hardcoded passwords in all 3 repos, no SBOM, untracked third-party dependencies",
      deps: "WindMultiplikator: several dependencies untracked, no vulnerability scanning pipeline",
      infra: "No build-before-merge model, no continuous health monitoring",
      compliance: "Basic compliance present, no formalized retention policies",
      operability: "SemCompletion strategic decision pending (sustain/revamp/sunset), no CODEOWNERS",
      architecture: "Fabrication Certificates: critical knowledge concentration risk",
      codequality: "WindMultiplikator code health 2.4/10, SemCompletion 17% duplication",
    },
  },
];

// ─── TCO ENGINE ──────────────────────────────────────────────────────────────

function computeTCO(customer) {
  const { age = 5, users = 100, integrations = 5, tech = ".NET / C#", scores } = customer;
  const avgScore = computeAvgScore(scores);
  if (avgScore === null) return null;

  const techMult = TECH_MULTIPLIERS[tech] || 1.0;
  const healthMult = Math.max(0.3, (10 - avgScore) / 10); // worse health = higher cost
  const ageMult = 1 + Math.max(0, (age - 5) * 0.07);
  const integMult = 1 + integrations * 0.04;
  const userScale = Math.max(0.5, Math.log10(Math.max(10, users)) / 2);

  // Base annual costs (DKK) derived from Mjølner empirical ranges
  const base = {
    dev:        1_500_000,
    infra:        600_000,
    support:      400_000,
    security:     200_000,
    integrations: 300_000,
    users:        200_000,
    indirect:     500_000,
  };

  // Score-weighted per dimension
  const secMult   = scores.security   !== null ? Math.max(0.5, (10 - scores.security)   / 5) : 1;
  const depsMult  = scores.deps       !== null ? Math.max(0.5, (10 - scores.deps)        / 6) : 1;
  const infraMult = scores.infra      !== null ? Math.max(0.5, (10 - scores.infra)       / 6) : 1;
  const opMult    = scores.operability!== null ? Math.max(0.5, (10 - scores.operability) / 5) : 1;

  const dev        = Math.round(base.dev        * healthMult * techMult * ageMult * userScale);
  const infra      = Math.round(base.infra      * infraMult  * techMult * userScale);
  const support    = Math.round(base.support    * opMult     * userScale);
  const security   = Math.round(base.security   * secMult    * techMult);
  const ints       = Math.round(base.integrations * integMult * healthMult);
  const usersCost  = Math.round(base.users      * healthMult * userScale);
  const indirect   = Math.round(base.indirect   * healthMult * techMult * userScale);

  const total = dev + infra + support + security + ints + usersCost + indirect;

  // Reported vs real TCO gap (key Mjølner insight)
  const reportedFactor = tech === "ASP.NET WebForms" || tech === "Legacy / Mixed" ? 0.12 : 0.18;
  const reported = Math.round(total * reportedFactor);
  const tcoFactor = +(total / Math.max(reported, 1)).toFixed(1);

  // Productivity loss (UX / inefficiency cost) — 45 min/day × DKK 350/hr × 220 days
  const prodLoss = Math.round(users * 0.75 * 350 * 220 * healthMult * 0.15);

  // Modernisation ROI
  const healthyStateCost = Math.round(total * 0.5);
  const annualSavings    = total - healthyStateCost;
  const modernisationInvestment = computeModernisationCost(customer, avgScore);

  return {
    categories: { dev, infra, support, security, integrations: ints, users: usersCost, indirect },
    total,
    reported,
    tcoFactor,
    prodLoss,
    annualSavings,
    modernisationInvestment,
    paybackMonths: modernisationInvestment > 0 ? Math.round((modernisationInvestment / annualSavings) * 12) : null,
    roiPct: modernisationInvestment > 0 ? Math.round((annualSavings * 3 - modernisationInvestment) / modernisationInvestment * 100) : null,
  };
}

function computeModernisationCost(customer, avgScore) {
  const { tech = ".NET / C#", integrations = 5 } = customer;
  const techMult = TECH_MULTIPLIERS[tech] || 1.0;
  if (avgScore === null) return 0;
  const base = avgScore < 3 ? 2_500_000 : avgScore < 5 ? 1_500_000 : avgScore < 7 ? 800_000 : 400_000;
  return Math.round(base * techMult * (1 + integrations * 0.02));
}

function computeWeightedScore(scores) {
  let totalWeight = 0, weightedSum = 0;
  for (const dim of DIMENSIONS) {
    const v = scores[dim.id];
    if (v !== null && v !== undefined) {
      weightedSum += v * dim.weight;
      totalWeight += dim.weight;
    }
  }
  return totalWeight > 0 ? +(weightedSum / totalWeight).toFixed(1) : null;
}

function computeAvgScore(scores) {
  const vals = Object.values(scores).filter(v => v !== null && v !== undefined);
  return vals.length ? +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : null;
}

// ─── OPPORTUNITY ENGINE ───────────────────────────────────────────────────────

function generateOpportunities(customer) {
  const { scores, tech, name, integrations = 5 } = customer;
  const weighted = computeWeightedScore(scores);
  if (weighted === null) return [];

  const opps = [];

  // ① PROJECTS (highest priority)
  if (scores.security !== null && scores.security < 5.5) {
    const critical = scores.security < 3.5;
    opps.push({
      priority: 1, type: "project", urgency: critical ? "critical" : "high",
      title: critical ? "Emergency Security Remediation" : "Security Hardening Sprint",
      timeline: critical ? "0–2 weeks" : "0–6 weeks",
      effort: critical ? "3–6 weeks" : "6–12 weeks",
      valueMin: critical ? 200 : 80,  valueMax: critical ? 600 : 200,  currency: "DKK k",
      rationale: critical
        ? `Live credentials committed to source code, plain-text passwords, and unauthenticated endpoints represent active business risk today. Immediate credential rotation, Key Vault migration, and password hashing are non-negotiable first steps before any other work proceeds.`
        : `Security posture has meaningful gaps: credential hygiene, dependency CVEs, and authentication hardening. A focused sprint addresses the highest-severity items and reduces risk profile significantly.`,
      deliverables: critical
        ? ["Credential rotation (all environments)", "Azure Key Vault / secrets manager", "Password hashing (bcrypt/Argon2)", "ASMX endpoint auth", "CVE-critical package updates"]
        : ["Credential audit and rotation", "Key Vault integration", "Dependency vulnerability patching", "Security test coverage"],
      tags: ["Security", "Sprint", critical ? "Week 1–2" : "Month 1"],
    });
  }

  if (scores.deps !== null && scores.deps < 5.5) {
    opps.push({
      priority: 2, type: "project", urgency: scores.deps < 3.5 ? "high" : "medium",
      title: ".NET & Dependency Lifecycle Modernisation",
      timeline: "1–4 months",
      effort: "2–4 months",
      valueMin: 150, valueMax: 500, currency: "DKK k",
      rationale: `Several dependencies have reached end-of-support or are approaching end-of-life, increasing future upgrade complexity. Research shows every 6 months of deferred dependency updates roughly doubles the remediation effort. Establishing SBOM and vulnerability scanning creates a sustainable governance baseline.`,
      deliverables: [".NET version upgrade (to LTS)", "EOL package elimination", "CVE remediation", "SBOM generation", "Vulnerability scanning pipeline", "Package governance policy"],
      tags: ["Dependencies", "Packages", ".NET", "1–4 months"],
    });
  }

  if (scores.operability !== null && scores.operability < 5) {
    opps.push({
      priority: 3, type: "project", urgency: scores.operability < 3 ? "high" : "medium",
      title: "CI/CD Pipeline & Disaster Recovery Maturity",
      timeline: "1–3 months",
      effort: "6–10 weeks",
      valueMin: 100, valueMax: 350, currency: "DKK k",
      rationale: `${scores.operability < 3 ? "Manual deployments swallow errors silently, and disaster recovery has never been tested. Bus factor risk is critical — a single person leaving halts operations." : "Rollback and disaster recovery procedures need formalisation. Build-before-merge model not yet established."} Establishing proper CI/CD, DR runbooks, and knowledge transfer protects business continuity.`,
      deliverables: ["CI/CD pipeline (build-before-merge)", "Automated deployment gates", "DR documentation + restore testing", "Backup validation schedule", "CODEOWNERS / knowledge transfer"],
      tags: ["CI/CD", "DR", "Governance", "1–3 months"],
    });
  }

  if (scores.infra !== null && scores.infra < 5.5) {
    opps.push({
      priority: 4, type: "project", urgency: "medium",
      title: "Infrastructure Modernisation (IaC / Kubernetes)",
      timeline: "2–5 months",
      effort: "8–16 weeks",
      valueMin: 250, valueMax: 700, currency: "DKK k",
      rationale: `Infrastructure-as-code is significantly out of date, and Kubernetes lifecycle requires upgrade. Containerisation and health endpoint implementation improve observability and enable reliable automated deployments. Running on unmanaged infrastructure accrues compounding risk.`,
      deliverables: ["Terraform modernisation", "Kubernetes lifecycle upgrade", "Container hardening", "Health endpoints + readiness probes", "Observability stack (Serilog / OpenTelemetry)", "Backup resilience"],
      tags: ["IaC", "Kubernetes", "Terraform", "2–5 months"],
    });
  }

  if (scores.compliance !== null && scores.compliance < 5.5) {
    opps.push({
      priority: 5, type: "project", urgency: scores.compliance < 4 ? "high" : "medium",
      title: "GDPR Compliance Hardening",
      timeline: "1–3 months",
      effort: "4–8 weeks",
      valueMin: 80, valueMax: 250, currency: "DKK k",
      rationale: `${scores.compliance < 4 ? "CPR numbers are stored unencrypted and processed with a broken DES cipher. This is a direct GDPR Article 32 violation with potential fines." : "Data retention policies, DSAR workflows, and deletion schedules need formalisation to meet GDPR maturity standards."}`,
      deliverables: ["Field-level encryption for PII/CPR (AES-256)", "DES → AES migration", "DSAR workflow implementation", "Retention policy enforcement", "Data access audit trail"],
      tags: ["GDPR", "Compliance", "Data", "1–3 months"],
    });
  }

  if (scores.architecture !== null && scores.architecture < 4.5 && tech === "ASP.NET WebForms") {
    opps.push({
      priority: 6, type: "project", urgency: "strategic",
      title: "Strategic Architecture Modernisation (WebForms → API + React)",
      timeline: "9–18 months",
      effort: "12–24 months",
      valueMin: 1_500, valueMax: 6_000, currency: "DKK k",
      rationale: `The WebForms monolith fundamentally limits all modernisation pathways. Feature delivery is 2× slower than in healthy codebases, with 15× more defects. A phased API extraction + React frontend migration eliminates the architectural ceiling while preserving business logic. Recommended as a Board-level strategic decision.`,
      deliverables: ["API layer extraction (REST/GraphQL)", "React frontend (component library)", "Data migration strategy", "Phased module-by-module migration", "Integration contract testing"],
      tags: ["Strategic", "React", "API", "Architecture", "9–18 months"],
    });
  }

  // ② MANAGED SERVICE (second priority)
  const msMin = weighted < 4 ? 70 : weighted < 6 ? 45 : 30;
  const msMax = weighted < 4 ? 130 : weighted < 6 ? 80 : 55;
  opps.push({
    priority: 10, type: "managed-service", urgency: "ongoing",
    title: "Platform Managed Service",
    timeline: "Ongoing / monthly",
    effort: "Continuous",
    valueMin: msMin, valueMax: msMax, currency: "DKK k/month",
    rationale: `Mjølner assumes full operational responsibility for ${name}'s platform: 24/7 monitoring, proactive patching, incident response, quarterly health reviews, and dependency lifecycle management. Frees the client's internal team entirely for feature development and business value. SLA-backed.`,
    deliverables: [
      "SLA-backed uptime and incident response",
      "Proactive dependency patching",
      "Monthly health check reports",
      "Quarterly modernisation reviews",
      `${integrations > 8 ? "Integration monitoring (" + integrations + " integrations)" : "Integration health monitoring"}`,
      "On-call engineering support",
    ],
    tags: ["Managed Service", "SLA", "Ongoing", "Monthly"],
  });

  // ③ CONSULTANTS (third priority)
  const consCount = weighted < 4 ? "3–5" : weighted < 6 ? "2–3" : "1–2";
  const consRate = "1,200–1,800";
  opps.push({
    priority: 20, type: "consultants", urgency: "flexible",
    title: `${weighted < 4 ? "Senior Technical Team Augmentation" : "Specialist Consultant Support"}`,
    timeline: "From 1 month",
    effort: "Flexible capacity",
    valueMin: weighted < 4 ? 1_200 : 600, valueMax: weighted < 4 ? 3_600 : 1_800, currency: "DKK k/year",
    rationale: `${weighted < 4
      ? `Bus factor risk and critical technical debt require immediate knowledge injection. Mjølner embeds ${consCount} senior .NET engineers alongside the client team for structured remediation, knowledge transfer, and pair programming. Addresses the single-developer dependency risk directly.`
      : `Mjølner consultants provide specialist capacity for modernisation initiatives, peak periods, and knowledge transfer. Flexible scale-up/down with no recruitment overhead.`}`,
    deliverables: [
      `${consCount} Mjølner senior engineers (embedded or remote)`,
      `Daily rate approx. DKK ${consRate}`,
      "Technology specialisations: .NET, Azure, Security, DevOps",
      "Weekly progress reporting to client leadership",
      "Knowledge transfer included",
    ],
    tags: ["Consultants", "Team augmentation", "Flexible", consCount + " engineers"],
  });

  return opps.sort((a, b) => a.priority - b.priority);
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function fmt(n) {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("en-DK").format(n);
}

function scoreColor(v) {
  if (v === null || v === undefined) return "#94a3b8";
  if (v < 4) return "#ef4444";
  if (v < 7) return "#f59e0b";
  return "#22c55e";
}

function scoreLabel(v) {
  if (v === null || v === undefined) return "Not set";
  if (v < 4) return "Critical";
  if (v < 7) return "Amber";
  return "Healthy";
}

function urgencyColor(u) {
  const map = { critical: "#ef4444", high: "#f97316", medium: "#f59e0b", strategic: "#8b5cf6", ongoing: "#3b82f6", flexible: "#22c55e" };
  return map[u] || "#94a3b8";
}

function typeColor(t) {
  return t === "project" ? "#2a7fff" : t === "managed-service" ? "#00b4a2" : "#f59e0b";
}

function typeLabel(t) {
  return t === "project" ? "① Project" : t === "managed-service" ? "② Managed Service" : "③ Consultants";
}

// ─── AI REPORT GENERATION ────────────────────────────────────────────────────

async function generateAIReport(customer, tco, opportunities) {
  const weighted = computeWeightedScore(customer.scores);
  const dimLines = DIMENSIONS.map(d => {
    const v = customer.scores[d.id];
    return `- ${d.label}: ${v !== null ? v + "/10 (" + scoreLabel(v) + ")" : "not assessed"} — ${customer.findings?.[d.id] || ""}`;
  }).join("\n");

  const oppLines = opportunities.slice(0, 5).map((o, i) =>
    `${i + 1}. [${typeLabel(o.type)}] ${o.title} — ${o.valueMin}–${o.valueMax} ${o.currency} | ${o.timeline}`
  ).join("\n");

  const tcoLines = tco ? `
- Reported/perceived annual IT cost: DKK ${fmt(tco.reported)}
- Estimated true annual TCO: DKK ${fmt(tco.total)}
- TCO multiplier: ${tco.tcoFactor}× (actual vs perceived)
- Annual productivity loss (UX/inefficiency): DKK ${fmt(tco.prodLoss)}
- Post-modernisation annual savings: DKK ${fmt(tco.annualSavings)}
- Modernisation investment: DKK ${fmt(tco.modernisationInvestment)}
- Payback period: ${tco.paybackMonths} months
- 3-year ROI: ${tco.roiPct}%` : "TCO not computed";

  const prompt = `You are a senior technical advisor at Mjølner Informatics, a Danish IT consultancy specialising in platform modernisation. Write a concise, professional Platform Health Report for the following customer assessment. The tone is direct, evidence-based, and constructive — not alarmist, not overly positive. Use specific numbers and findings. Structure exactly as shown below. Max 450 words total.

CUSTOMER: ${customer.name} (${customer.org})
TECHNOLOGY: ${customer.tech}, ${customer.age} years old, ${customer.users} users, ${customer.integrations} integrations, ${customer.hosting}
OVERALL WEIGHTED HEALTH SCORE: ${weighted}/10 (${scoreLabel(weighted)})

DIMENSION SCORES:
${dimLines}

TCO ANALYSIS:
${tcoLines}

TOP OPPORTUNITIES:
${oppLines}

CUSTOMER CONTEXT:
${customer.concerns}
${customer.notes}

Write the report in this exact structure (use these headers verbatim):

## Executive Summary
[2-3 sentences: overall state, key strength, key risk]

## What Is Working Well
[3-4 bullet points — genuine strengths with specific evidence]

## Critical Areas Requiring Attention
[3-5 bullet points — specific findings with concrete risk language, reference actual scores and findings above]

## TCO Assessment
[3-4 sentences covering: perceived vs true cost, where cost accumulates, productivity impact]

## Recommended Path Forward
[Phase 1 / Phase 2 / Phase 3 structure, concise, actionable, realistic timelines]

## What This Does NOT Require
[1-2 sentences: clarify scope — e.g. "This platform does not require a full rebuild"]`;

  const response = await fetch("https://gateway.ai.vercel.dev/v1/messages", {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await response.json();
  return data.content?.[0]?.text || "Report generation failed. Please try again.";
}

// ─── STYLES ───────────────────────────────────────────────────────────────────

const S = {
  app: {
    fontFamily: "'DM Sans', system-ui, sans-serif",
    color: "var(--color-text-primary)",
    background: "transparent",
    display: "flex",
    flexDirection: "column",
    minHeight: "700px",
    fontSize: "14px",
  },
  topbar: {
    display: "flex", alignItems: "center", gap: "12px",
    padding: "0 20px", height: "52px",
    borderBottom: "0.5px solid var(--color-border-tertiary)",
    background: "var(--color-background-primary)",
    flexShrink: 0,
  },
  logo: { fontSize: "16px", fontWeight: 600, letterSpacing: "-0.3px", color: "#2a7fff" },
  logoSub: { fontSize: "12px", color: "var(--color-text-secondary)", marginLeft: "8px", fontWeight: 400 },
  steps: { display: "flex", alignItems: "center", gap: "4px", flex: 1, justifyContent: "center" },
  step: (active, done) => ({
    display: "flex", alignItems: "center", gap: "6px",
    padding: "5px 11px", borderRadius: "20px", fontSize: "12px", fontWeight: 500,
    cursor: "pointer", transition: "all .15s",
    background: active ? "#2a7fff" : "transparent",
    color: active ? "#fff" : done ? "#00b4a2" : "var(--color-text-secondary)",
    border: "none",
  }),
  stepNum: (active, done) => ({
    width: "18px", height: "18px", borderRadius: "50%", display: "flex",
    alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: 700,
    background: active ? "rgba(255,255,255,0.25)" : done ? "#00b4a2" : "var(--color-background-secondary)",
    color: active ? "#fff" : done ? "#fff" : "var(--color-text-secondary)",
    flexShrink: 0,
  }),
  sep: { width: "16px", height: "0.5px", background: "var(--color-border-tertiary)", flexShrink: 0 },
  body: { display: "flex", flex: 1, overflow: "hidden", minHeight: 0 },
  sidebar: {
    width: "210px", flexShrink: 0,
    borderRight: "0.5px solid var(--color-border-tertiary)",
    background: "var(--color-background-primary)",
    display: "flex", flexDirection: "column",
    overflowY: "auto",
  },
  sidebarInner: { padding: "14px 12px", display: "flex", flexDirection: "column", gap: "6px", flex: 1 },
  sidebarLabel: {
    fontSize: "10px", fontWeight: 700, textTransform: "uppercase",
    letterSpacing: "0.8px", color: "var(--color-text-secondary)",
    padding: "2px 2px 8px",
  },
  customerCard: (selected) => ({
    padding: "9px 11px", borderRadius: "8px", cursor: "pointer", transition: "all .12s",
    border: selected ? "0.5px solid #2a7fff" : "0.5px solid var(--color-border-tertiary)",
    background: selected ? "color-mix(in srgb, #2a7fff 8%, var(--color-background-primary))" : "var(--color-background-primary)",
  }),
  cardName: { fontSize: "13px", fontWeight: 500, marginBottom: "1px" },
  cardOrg: { fontSize: "11px", color: "var(--color-text-secondary)" },
  badge: (color) => ({
    display: "inline-block", fontSize: "10px", fontWeight: 600,
    padding: "2px 7px", borderRadius: "10px", marginTop: "5px",
    background: color + "18", color: color,
  }),
  addBtn: {
    padding: "7px 11px", borderRadius: "7px", fontSize: "12px", cursor: "pointer",
    border: "0.5px dashed var(--color-border-secondary)", background: "transparent",
    color: "var(--color-text-secondary)", fontFamily: "inherit", marginTop: "4px",
    transition: "all .15s",
  },
  content: { flex: 1, overflowY: "auto", padding: "20px 24px", minWidth: 0 },
  sectionTitle: {
    fontSize: "11px", fontWeight: 700, textTransform: "uppercase",
    letterSpacing: "0.7px", color: "var(--color-text-secondary)",
    paddingBottom: "10px", borderBottom: "0.5px solid var(--color-border-tertiary)",
    marginBottom: "14px",
  },
  formGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" },
  formGroup: { display: "flex", flexDirection: "column", gap: "4px" },
  label: { fontSize: "11px", fontWeight: 600, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.4px" },
  input: {
    background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)",
    borderRadius: "6px", padding: "7px 9px", fontFamily: "inherit", fontSize: "13px",
    color: "var(--color-text-primary)", outline: "none",
  },
  textarea: {
    background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)",
    borderRadius: "6px", padding: "7px 9px", fontFamily: "inherit", fontSize: "13px",
    color: "var(--color-text-primary)", outline: "none", resize: "vertical", minHeight: "72px",
  },
  btnRow: { display: "flex", gap: "8px", justifyContent: "flex-end", paddingTop: "8px" },
  btn: (primary) => ({
    padding: "7px 18px", borderRadius: "7px", fontSize: "13px", fontWeight: 600,
    cursor: "pointer", fontFamily: "inherit", transition: "all .12s",
    background: primary ? "#2a7fff" : "transparent",
    color: primary ? "#fff" : "var(--color-text-secondary)",
    border: primary ? "none" : "0.5px solid var(--color-border-secondary)",
  }),
  dimGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(195px, 1fr))", gap: "10px", marginBottom: "14px" },
  dimCard: {
    background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)",
    borderRadius: "8px", padding: "11px 12px", display: "flex", flexDirection: "column", gap: "7px",
  },
  scoreInput: {
    width: "52px", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "4px",
    padding: "3px 5px", fontSize: "13px", fontFamily: "'DM Mono', monospace",
    background: "var(--color-background-primary)", color: "var(--color-text-primary)", textAlign: "center",
  },
  tcoGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "10px", marginBottom: "14px" },
  tcoCard: {
    background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)",
    borderRadius: "8px", padding: "11px 13px",
  },
  tcoLabel: { fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--color-text-secondary)", marginBottom: "4px" },
  tcoValue: { fontSize: "18px", fontWeight: 700, fontFamily: "'DM Mono', monospace" },
  tcoSub: { fontSize: "11px", color: "var(--color-text-secondary)", marginTop: "2px" },
  oppCard: {
    border: "0.5px solid var(--color-border-tertiary)", borderRadius: "9px",
    background: "var(--color-background-primary)", overflow: "hidden", marginBottom: "8px",
  },
  oppHeader: { display: "flex", alignItems: "center", gap: "10px", padding: "11px 14px", cursor: "pointer" },
  oppBody: { padding: "0 14px 13px", borderTop: "0.5px solid var(--color-border-tertiary)" },
  tag: {
    fontSize: "10px", fontWeight: 500, padding: "2px 7px", borderRadius: "4px",
    background: "var(--color-background-secondary)", color: "var(--color-text-secondary)",
    border: "0.5px solid var(--color-border-tertiary)",
  },
  reportBlock: {
    background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)",
    borderRadius: "8px", padding: "16px",
  },
  reportPre: {
    fontFamily: "inherit", fontSize: "13px", whiteSpace: "pre-wrap",
    color: "var(--color-text-primary)", lineHeight: 1.65,
  },
  spinner: {
    display: "inline-block", width: "14px", height: "14px",
    border: "2px solid var(--color-border-tertiary)", borderTopColor: "#2a7fff",
    borderRadius: "50", animation: "spin 0.7s linear infinite",
  },
};

// ─── COMPONENTS ───────────────────────────────────────────────────────────────

function ScoreBar({ value, height = 5 }) {
  return (
    <div style={{ height, background: "var(--color-border-tertiary)", borderRadius: 3, overflow: "hidden", flex: 1 }}>
      <div style={{ height: "100%", width: value ? `${value * 10}%` : "0%", background: scoreColor(value), transition: "width .4s, background .3s", borderRadius: 3 }} />
    </div>
  );
}

function Badge({ label, color }) {
  return <span style={S.badge(color)}>{label}</span>;
}

function OverallScoreBanner({ scores, tech }) {
  const weighted = computeWeightedScore(scores);
  const col = scoreColor(weighted);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "16px", background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "10px", padding: "14px 18px", marginBottom: "16px" }}>
      <div>
        <div style={{ fontSize: "32px", fontWeight: 700, fontFamily: "'DM Mono', monospace", color: col, lineHeight: 1 }}>
          {weighted !== null ? weighted + "/10" : "—"}
        </div>
        <div style={{ fontSize: "11px", fontWeight: 700, color: col, marginTop: "2px", textTransform: "uppercase", letterSpacing: "0.5px" }}>{scoreLabel(weighted)}</div>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ height: "10px", background: "var(--color-border-tertiary)", borderRadius: "5px", overflow: "hidden", marginBottom: "6px" }}>
          <div style={{ height: "100%", width: weighted ? `${weighted * 10}%` : "0%", background: col, transition: "width .5s", borderRadius: "5px" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "var(--color-text-secondary)" }}>
          <span>0 — Critical</span><span>4 — Amber</span><span>7 — Healthy</span><span>10</span>
        </div>
      </div>
      <div style={{ fontSize: "12px", color: "var(--color-text-secondary)", textAlign: "right", lineHeight: 1.5 }}>
        <div>Weighted score</div>
        <div style={{ fontSize: "11px", opacity: 0.7 }}>Tech: {tech}</div>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────

export default function App() {
  const [customers, setCustomers] = useState([]);
  const [curId, setCurId] = useState(null);
  const [step, setStep] = useState(1);
  const [report, setReport] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [expandedOpps, setExpandedOpps] = useState({});
  const [newCustomerMode, setNewCustomerMode] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const storageLoaded = useRef(false);

  // Load from persistent storage
  useEffect(() => {
    (async () => {
      try {
        const result = await window.storage.get("mjolner_customers");
        const loaded = result ? JSON.parse(result.value) : SEED_CUSTOMERS;
        setCustomers(loaded);
        setCurId(loaded[0]?.id);
      } catch {
        setCustomers(SEED_CUSTOMERS);
        setCurId(SEED_CUSTOMERS[0]?.id);
      }
      storageLoaded.current = true;
    })();
  }, []);

  // Auto-save on changes
  useEffect(() => {
    if (!storageLoaded.current || customers.length === 0) return;
    const t = setTimeout(async () => {
      try {
        await window.storage.set("mjolner_customers", JSON.stringify(customers));
        setSaveStatus("Saved");
        setTimeout(() => setSaveStatus(""), 1500);
      } catch { setSaveStatus("Save error"); }
    }, 800);
    return () => clearTimeout(t);
  }, [customers]);

  const cur = customers.find(c => c.id === curId);

  const updateCur = useCallback((patch) => {
    setCustomers(cs => cs.map(c => c.id === curId ? { ...c, ...patch } : c));
  }, [curId]);

  const updateScore = useCallback((dimId, val) => {
    setCustomers(cs => cs.map(c => c.id === curId
      ? { ...c, scores: { ...c.scores, [dimId]: val === "" ? null : parseFloat(val) } }
      : c));
  }, [curId]);

  const updateFinding = useCallback((dimId, val) => {
    setCustomers(cs => cs.map(c => c.id === curId
      ? { ...c, findings: { ...(c.findings || {}), [dimId]: val } }
      : c));
  }, [curId]);

  const addCustomer = useCallback(() => {
    const id = "cust-" + Date.now();
    const newC = {
      id, name: "New Customer", org: "", contact: "", tech: ".NET / C#",
      age: null, users: null, integrations: null, hosting: "Azure",
      concerns: "", notes: "", type: "new",
      scores: { ...DEFAULT_SCORES }, findings: {},
    };
    setCustomers(cs => [...cs, newC]);
    setCurId(id);
    setStep(1);
    setReport("");
    setNewCustomerMode(true);
  }, []);

  const deleteCustomer = useCallback(() => {
    if (customers.length <= 1) return;
    setCustomers(cs => {
      const remaining = cs.filter(c => c.id !== curId);
      setCurId(remaining[0]?.id);
      return remaining;
    });
  }, [curId, customers.length]);

  const handleGenerate = useCallback(async () => {
    if (!cur) return;
    setStep(3);
    setReportLoading(true);
    setReport("");
    try {
      const tco = computeTCO(cur);
      const opps = generateOpportunities(cur);
      const text = await generateAIReport(cur, tco, opps);
      setReport(text);
    } catch (e) {
      setReport("Error generating report: " + e.message);
    } finally {
      setReportLoading(false);
    }
  }, [cur]);

  const toggleOpp = useCallback((id) => {
    setExpandedOpps(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  if (!cur) return <div style={{ padding: "40px", color: "var(--color-text-secondary)", textAlign: "center" }}>Loading...</div>;

  const tco = computeTCO(cur);
  const opportunities = generateOpportunities(cur);
  const weighted = computeWeightedScore(cur.scores);

  const customerTypeBadge = cur.type === "existing"
    ? <Badge label="Existing" color="#00b4a2" />
    : cur.type === "new" ? <Badge label="New" color="#2a7fff" />
    : weighted !== null && weighted < 4 ? <Badge label={`Critical ${weighted}/10`} color="#ef4444" />
    : weighted !== null ? <Badge label={`Score ${weighted}/10`} color="#f59e0b" />
    : <Badge label="New" color="#2a7fff" />;

  return (
    <div style={S.app}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadein { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:none; } }
        .mjcard:hover { border-color: #2a7fff !important; }
        .mjbtn:hover { opacity: 0.85; }
        .mjinput:focus { border-color: #2a7fff !important; outline: none; }
        .mjlink { color: #2a7fff; text-decoration: none; }
        .mjlink:hover { text-decoration: underline; }
        .report-md h2 { font-size:14px; font-weight:700; margin:14px 0 6px; color:#2a7fff; }
        .report-md ul { padding-left:18px; margin:4px 0 10px; }
        .report-md li { margin-bottom:3px; font-size:13px; line-height:1.55; }
        .report-md p  { font-size:13px; line-height:1.65; margin-bottom:8px; }
        .report-md strong { font-weight:600; }
      `}</style>

      {/* TOP BAR */}
      <div style={S.topbar}>
        <div style={S.logo}>Mjølner <span style={S.logoSub}>AI Modernization Engine</span></div>
        <div style={S.steps}>
          {[["1","Dialog"],["2","Health Check"],["3","Report"],["4","Opportunities"],["5","TCO"]].map(([n, label], i) => {
            const num = parseInt(n);
            const active = step === num;
            const done = step > num;
            return (
              <div key={n} style={{ display: "flex", alignItems: "center" }}>
                {i > 0 && <div style={S.sep} />}
                <button style={S.step(active, done)} onClick={() => setStep(num)} className="mjbtn">
                  <span style={S.stepNum(active, done)}>{done ? "✓" : n}</span>
                  {label}
                </button>
              </div>
            );
          })}
        </div>
        {saveStatus && <div style={{ fontSize: "11px", color: "#00b4a2", fontWeight: 600 }}>{saveStatus}</div>}
      </div>

      <div style={S.body}>
        {/* SIDEBAR */}
        <div style={S.sidebar}>
          <div style={S.sidebarInner}>
            <div style={S.sidebarLabel}>Customers</div>
            {customers.map(c => {
              const ws = computeWeightedScore(c.scores);
              const col = scoreColor(ws);
              const selected = c.id === curId;
              return (
                <div key={c.id} style={S.customerCard(selected)} className="mjcard"
                  onClick={() => { setCurId(c.id); setReport(""); setStep(1); }}>
                  <div style={S.cardName}>{c.name}</div>
                  <div style={S.cardOrg}>{c.org || "—"}</div>
                  <div style={{ marginTop: "4px" }}>
                    {ws !== null
                      ? <span style={S.badge(col)}>{ws}/10 {scoreLabel(ws)}</span>
                      : <span style={S.badge("#94a3b8")}>Not scored</span>}
                  </div>
                </div>
              );
            })}
            <button style={S.addBtn} className="mjbtn" onClick={addCustomer}>+ Add customer</button>
          </div>
        </div>

        {/* MAIN CONTENT */}
        <div style={S.content}>

          {/* ── STEP 1: DIALOG ── */}
          {step === 1 && (
            <div style={{ animation: "fadein .2s" }}>
              <div style={S.sectionTitle}>Customer Context & Intake</div>
              <div style={S.formGrid}>
                {[
                  ["Customer name", "name", "text", "e.g. PensionDanmark"],
                  ["Organisation", "org", "text", "e.g. Insurance group"],
                  ["Primary contact", "contact", "text", "Name and title"],
                  ["System age (years)", "age", "number", "e.g. 8"],
                  ["No. of users", "users", "number", "e.g. 300"],
                  ["No. of integrations", "integrations", "number", "e.g. 12"],
                ].map(([label, field, type, placeholder]) => (
                  <div key={field} style={S.formGroup}>
                    <label style={S.label}>{label}</label>
                    <input style={S.input} className="mjinput" type={type} placeholder={placeholder}
                      value={cur[field] ?? ""}
                      onChange={e => updateCur({ [field]: e.target.value })} />
                  </div>
                ))}
                <div style={S.formGroup}>
                  <label style={S.label}>Primary technology</label>
                  <select style={S.input} className="mjinput" value={cur.tech} onChange={e => updateCur({ tech: e.target.value })}>
                    {Object.keys(TECH_MULTIPLIERS).map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div style={S.formGroup}>
                  <label style={S.label}>Hosting</label>
                  <select style={S.input} className="mjinput" value={cur.hosting} onChange={e => updateCur({ hosting: e.target.value })}>
                    {["Azure", "AWS", "GCP", "On-premise", "Hybrid", "Unknown"].map(h => <option key={h}>{h}</option>)}
                  </select>
                </div>
                <div style={{ ...S.formGroup, gridColumn: "1 / -1" }}>
                  <label style={S.label}>Customer's primary concerns (verbatim from meeting)</label>
                  <textarea style={S.textarea} className="mjinput" value={cur.concerns}
                    onChange={e => updateCur({ concerns: e.target.value })}
                    placeholder="What did the customer say? What keeps them up at night?" />
                </div>
                <div style={{ ...S.formGroup, gridColumn: "1 / -1" }}>
                  <label style={S.label}>Internal Mjølner notes</label>
                  <textarea style={S.textarea} className="mjinput" value={cur.notes}
                    onChange={e => updateCur({ notes: e.target.value })}
                    placeholder="Context, relationship history, strategic observations..." />
                </div>
              </div>
              <div style={{ ...S.btnRow, justifyContent: "space-between" }}>
                <button style={{ ...S.btn(false), color: "#ef4444", borderColor: "#ef444440" }} className="mjbtn"
                  onClick={deleteCustomer}>Delete customer</button>
                <button style={S.btn(true)} className="mjbtn" onClick={() => setStep(2)}>Go to Health Check →</button>
              </div>
            </div>
          )}

          {/* ── STEP 2: HEALTH CHECK ── */}
          {step === 2 && (
            <div style={{ animation: "fadein .2s" }}>
              <div style={S.sectionTitle}>Platform Health Assessment — 7 dimensions</div>
              <OverallScoreBanner scores={cur.scores} tech={cur.tech} />
              <div style={S.dimGrid}>
                {DIMENSIONS.map(dim => {
                  const v = cur.scores[dim.id];
                  const col = scoreColor(v);
                  return (
                    <div key={dim.id} style={S.dimCard}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <div style={{ fontSize: "12px", fontWeight: 600, marginBottom: "1px" }}>{dim.icon} {dim.label}</div>
                          <div style={{ fontSize: "10px", color: "var(--color-text-secondary)", lineHeight: 1.3 }}>{dim.desc}</div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "2px", flexShrink: 0, marginLeft: "8px" }}>
                          <input style={{ ...S.scoreInput, color: col }} className="mjinput"
                            type="number" min="0" max="10" step="0.1" placeholder="0–10"
                            value={v ?? ""}
                            onChange={e => updateScore(dim.id, e.target.value)} />
                          <div style={{ fontSize: "9px", fontWeight: 600, color: col, textTransform: "uppercase", letterSpacing: "0.4px" }}>{scoreLabel(v)}</div>
                        </div>
                      </div>
                      <ScoreBar value={v} />
                      <input style={{ ...S.input, fontSize: "11px", padding: "4px 7px" }} className="mjinput"
                        type="text" placeholder="Key finding (optional)"
                        value={cur.findings?.[dim.id] ?? ""}
                        onChange={e => updateFinding(dim.id, e.target.value)} />
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <div style={{ fontSize: "10px", color: "var(--color-text-secondary)" }}>Weight: {dim.weight}×</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={S.btnRow}>
                <button style={S.btn(false)} className="mjbtn" onClick={() => setStep(1)}>← Back</button>
                <button style={S.btn(false)} className="mjbtn" onClick={() => setStep(5)}>View TCO</button>
                <button style={S.btn(true)} className="mjbtn" onClick={handleGenerate}>Generate AI report + opportunities →</button>
              </div>
            </div>
          )}

          {/* ── STEP 3: REPORT ── */}
          {step === 3 && (
            <div style={{ animation: "fadein .2s" }}>
              <div style={S.sectionTitle}>AI-Generated Platform Health Report</div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px", justifyContent: "space-between" }}>
                <div style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>
                  {cur.name} — {cur.org} — {new Date().toLocaleDateString("en-GB")}
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  {reportLoading || <button style={S.btn(false)} className="mjbtn"
                    onClick={() => navigator.clipboard.writeText(report).catch(() => {})}>Copy report</button>}
                  <button style={S.btn(false)} className="mjbtn" onClick={handleGenerate}>Regenerate</button>
                </div>
              </div>
              {reportLoading
                ? <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "30px 0", color: "var(--color-text-secondary)" }}>
                    <div style={{ ...S.spinner, borderRadius: "50%" }} />
                    <span style={{ fontSize: "13px" }}>Generating report with Claude AI...</span>
                  </div>
                : report
                  ? <div style={S.reportBlock}><div className="report-md" dangerouslySetInnerHTML={{ __html: report
                      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
                      .replace(/^- (.+)$/gm, '<li>$1</li>')
                      .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
                      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                      .replace(/\n\n/g, '</p><p>')
                      .replace(/^(?!<[hup])(.+)$/gm, '<p>$1</p>')
                    }} /></div>
                  : <div style={{ padding: "30px 0", color: "var(--color-text-secondary)", fontSize: "13px" }}>
                      Complete the health check scores and click "Generate" to produce an AI-powered executive report.
                    </div>}
              <div style={S.btnRow}>
                <button style={S.btn(false)} className="mjbtn" onClick={() => setStep(2)}>← Edit scores</button>
                <button style={S.btn(true)} className="mjbtn" onClick={() => setStep(4)}>View opportunities →</button>
              </div>
            </div>
          )}

          {/* ── STEP 4: OPPORTUNITIES ── */}
          {step === 4 && (
            <div style={{ animation: "fadein .2s" }}>
              <div style={S.sectionTitle}>Prioritised Opportunities</div>
              <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
                {[["project", "#2a7fff", "① Projects (primary)"], ["managed-service", "#00b4a2", "② Managed Service"], ["consultants", "#f59e0b", "③ Consultants"]].map(([type, col, label]) => (
                  <span key={type} style={{ ...S.badge(col), fontSize: "11px" }}>{label}</span>
                ))}
                <span style={{ marginLeft: "auto", fontSize: "11px", color: "var(--color-text-secondary)", alignSelf: "center" }}>
                  {opportunities.filter(o => o.type === "project").length} projects · 1 managed service · 1 consultants
                </span>
              </div>

              {opportunities.length === 0
                ? <div style={{ color: "var(--color-text-secondary)", fontSize: "13px", padding: "20px 0" }}>Complete health check scores to generate opportunities.</div>
                : opportunities.map((opp, i) => {
                  const expanded = expandedOpps[i];
                  const tc = typeColor(opp.type);
                  return (
                    <div key={i} style={S.oppCard} className="mjcard">
                      <div style={S.oppHeader} onClick={() => toggleOpp(i)}>
                        <div style={{ width: "22px", height: "22px", borderRadius: "50%", background: tc + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: 700, color: tc, flexShrink: 0 }}>{i + 1}</div>
                        <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontSize: "10px", fontWeight: 700, color: tc, textTransform: "uppercase", letterSpacing: "0.4px", whiteSpace: "nowrap" }}>{typeLabel(opp.type)}</span>
                            <span style={{ fontSize: "10px", padding: "1px 6px", borderRadius: "10px", background: urgencyColor(opp.urgency) + "20", color: urgencyColor(opp.urgency), fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.3px" }}>{opp.urgency}</span>
                          </div>
                          <span style={{ fontSize: "13px", fontWeight: 600, marginTop: "1px" }}>{opp.title}</span>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <div style={{ fontSize: "13px", fontWeight: 700, fontFamily: "'DM Mono', monospace", color: "#00b4a2" }}>{opp.valueMin}–{opp.valueMax}</div>
                          <div style={{ fontSize: "10px", color: "var(--color-text-secondary)" }}>{opp.currency}</div>
                        </div>
                        <div style={{ fontSize: "12px", color: "var(--color-text-secondary)", marginLeft: "4px" }}>{expanded ? "▲" : "▼"}</div>
                      </div>
                      {expanded && (
                        <div style={S.oppBody}>
                          <div style={{ display: "flex", gap: "16px", padding: "10px 0 8px", flexWrap: "wrap" }}>
                            {[["Timeline", opp.timeline], ["Effort", opp.effort]].map(([k, v]) => (
                              <div key={k}><div style={{ fontSize: "10px", color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.4px" }}>{k}</div><div style={{ fontSize: "12px", fontWeight: 600 }}>{v}</div></div>
                            ))}
                          </div>
                          <p style={{ fontSize: "12px", color: "var(--color-text-secondary)", lineHeight: 1.6, margin: "0 0 10px" }}>{opp.rationale}</p>
                          <div style={{ marginBottom: "10px" }}>
                            <div style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px", color: "var(--color-text-secondary)", marginBottom: "5px" }}>Deliverables</div>
                            <ul style={{ paddingLeft: "16px", margin: 0 }}>
                              {opp.deliverables.map((d, j) => <li key={j} style={{ fontSize: "12px", lineHeight: 1.5, marginBottom: "2px" }}>{d}</li>)}
                            </ul>
                          </div>
                          <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
                            {opp.tags.map(t => <span key={t} style={S.tag}>{t}</span>)}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

              <div style={S.btnRow}>
                <button style={S.btn(false)} className="mjbtn" onClick={() => setStep(3)}>← Report</button>
                <button style={S.btn(false)} className="mjbtn" onClick={() => setStep(5)}>View TCO analysis →</button>
              </div>
            </div>
          )}

          {/* ── STEP 5: TCO ── */}
          {step === 5 && (
            <div style={{ animation: "fadein .2s" }}>
              <div style={S.sectionTitle}>Total Cost of Ownership Analysis</div>
              {!tco
                ? <div style={{ color: "var(--color-text-secondary)", fontSize: "13px", padding: "20px 0" }}>Complete at least one health check score to compute TCO.</div>
                : <>
                  {/* Key metrics */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "10px", marginBottom: "16px" }}>
                    {[
                      { label: "True Annual TCO", value: "DKK " + fmt(tco.total), sub: "Estimated actual cost", color: "#ef4444" },
                      { label: "Reported / Perceived", value: "DKK " + fmt(tco.reported), sub: "What client thinks it costs", color: "#94a3b8" },
                      { label: "TCO Multiplier", value: tco.tcoFactor + "×", sub: "Actual vs perceived", color: "#f59e0b" },
                      { label: "Productivity Loss", value: "DKK " + fmt(tco.prodLoss), sub: "UX / inefficiency cost / yr", color: "#f97316" },
                      { label: "Post-Modernisation", value: "DKK " + fmt(tco.modernisationInvestment), sub: "Modernisation investment", color: "#2a7fff" },
                      { label: "Annual Savings", value: "DKK " + fmt(tco.annualSavings), sub: "After modernisation", color: "#22c55e" },
                      { label: "Payback Period", value: tco.paybackMonths ? tco.paybackMonths + " months" : "—", sub: "Investment recovery", color: "#00b4a2" },
                      { label: "3-Year ROI", value: tco.roiPct !== null ? tco.roiPct + "%" : "—", sub: "Return on investment", color: "#8b5cf6" },
                    ].map(({ label, value, sub, color }) => (
                      <div key={label} style={S.tcoCard}>
                        <div style={S.tcoLabel}>{label}</div>
                        <div style={{ ...S.tcoValue, color }}>{value}</div>
                        <div style={S.tcoSub}>{sub}</div>
                      </div>
                    ))}
                  </div>

                  {/* Cost breakdown */}
                  <div style={S.sectionTitle}>Annual cost breakdown</div>
                  <div style={{ background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "8px", padding: "14px 16px", marginBottom: "14px" }}>
                    {Object.entries({
                      "Development & maintenance": tco.categories.dev,
                      "Infrastructure & runtime": tco.categories.infra,
                      "Support & operations": tco.categories.support,
                      "Security & compliance": tco.categories.security,
                      "Integrations": tco.categories.integrations,
                      "User productivity cost": tco.categories.users,
                      "Indirect (shadow) costs": tco.categories.indirect,
                    }).map(([label, val]) => {
                      const pct = Math.round(val / tco.total * 100);
                      return (
                        <div key={label} style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                          <span style={{ fontSize: "12px", minWidth: "200px", color: "var(--color-text-secondary)" }}>{label}</span>
                          <div style={{ flex: 1, height: "7px", background: "var(--color-border-tertiary)", borderRadius: "4px", overflow: "hidden" }}>
                            <div style={{ height: "100%", width: pct + "%", background: "#2a7fff", borderRadius: "4px", transition: "width .5s" }} />
                          </div>
                          <span style={{ fontSize: "12px", fontFamily: "'DM Mono', monospace", minWidth: "95px", textAlign: "right" }}>DKK {fmt(val)}</span>
                          <span style={{ fontSize: "11px", color: "var(--color-text-secondary)", minWidth: "32px", textAlign: "right" }}>{pct}%</span>
                        </div>
                      );
                    })}
                    <div style={{ borderTop: "0.5px solid var(--color-border-tertiary)", paddingTop: "8px", marginTop: "4px", display: "flex", justifyContent: "flex-end", gap: "12px" }}>
                      <span style={{ fontSize: "12px", fontWeight: 600 }}>Total</span>
                      <span style={{ fontSize: "13px", fontWeight: 700, fontFamily: "'DM Mono', monospace", color: "#ef4444" }}>DKK {fmt(tco.total)}</span>
                    </div>
                  </div>

                  {/* Context note */}
                  <div style={{ background: "color-mix(in srgb, #2a7fff 8%, var(--color-background-primary))", border: "0.5px solid #2a7fff40", borderRadius: "8px", padding: "12px 14px", fontSize: "12px", lineHeight: 1.6, color: "var(--color-text-secondary)", marginBottom: "14px" }}>
                    <strong style={{ color: "var(--color-text-primary)" }}>Mjølner TCO methodology:</strong> Estimates are derived from empirical ranges across WebForms-based, integration-rich, multi-organisation setups. For {cur.tech} platforms aged {cur.age || "?"} years, the actual TCO is typically {tco.tcoFactor}× the reported direct IT cost — because development overhead, integration maintenance, user productivity loss, and shadow costs are rarely included in the "IT budget" figure. Use the accompanying Excel workbook to validate against your own numbers.
                  </div>

                  <div style={S.btnRow}>
                    <button style={S.btn(false)} className="mjbtn" onClick={() => setStep(4)}>← Opportunities</button>
                    <button style={S.btn(false)} className="mjbtn" onClick={() => setStep(2)}>Edit scores</button>
                    <button style={S.btn(true)} className="mjbtn" onClick={handleGenerate}>Regenerate full report →</button>
                  </div>
                </>}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
