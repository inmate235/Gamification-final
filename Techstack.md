# Next.js Full-Stack Tech Stack — New Project Template

A universal blueprint for scaffolding modern Next.js projects. Covers the full technology stack, architecture patterns, and tooling decisions. Pick and choose the layers you need per project.

---

## Core Framework & Runtime

| Layer | Technology | Version | Notes |
|---|---|---|---|
| Framework | Next.js (App Router) | ^16.2 | Webpack build (not Turbopack for prod). Turbopack enabled for dev. |
| React | React | ^19.2 | React 19 with RSC support |
| Language | TypeScript | ^5 | Strict mode, `moduleResolution: "bundler"` |
| Runtime | Node.js | >=20.9.0 | Required by Next.js 16 |
| Package Manager | npm | >=10.0.0 | No pnpm/yarn |

### next.config.ts Highlights

- **Velite integration**: Content build runs before dev/build via programmatic import
- **Security headers**: HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy
- **Agent discovery** (optional): RFC 8288 Link headers on homepage (api-catalog, llms.txt, agent-skills, MCP server-card)
- **Redirects**: www -> apex domain, legacy path redirects
- **optimizePackageImports**: Lucide + Phosphor icons for tree-shaking

---

## Styling & Design System

| Layer | Technology | Notes |
|---|---|---|
| CSS Framework | Tailwind CSS 4 | `@tailwindcss/postcss` plugin, no config file |
| Component Library | shadcn/ui (new-york style) | `components.json` with custom registries (ReactBits, MagicUI, shadcn-map) |
| Utility | `class-variance-authority` (CVA) | Variant-based component styling |
| Utility | `clsx` + `tailwind-merge` | `cn()` helper in `src/lib/utils.ts` |
| Animation CSS | `tw-animate-css` | Tailwind animation utilities |
| Typography Plugin | `@tailwindcss/typography` | Prose styling for MDX/blog content |
| Dark Mode | `next-themes` | `.dark` class variant via `@custom-variant dark` |

### Fonts

| Slot | Loading Method | Notes |
|---|---|---|
| Display/headlines | Self-hosted woff2 | `@font-face` in globals.css, `font-display: swap`, weights 100-900 |
| Body text | Self-hosted woff2 | `@font-face` in globals.css, `font-display: swap`, weights 200-900 |
| Monospace/pixel accent | `geist` npm package via `next/font` | Variable font, CSS class utility |

### Design Tokens (globals.css)

- **Color system**: OKLCH color space for both light and dark themes
- **Brand colors**: Define 4-6 core brand colors as CSS custom properties
- **Custom CSS**: Anti-banding noise overlay, OKLCH gradient utilities, section layout helpers
- **Prose theme**: Custom `prose-{project}` typography theme for MDX blog content

---

## Animation & Motion

| Library | Purpose | Notes |
|---|---|---|
| Framer Motion (`framer-motion` / `motion`) | ^12.38 | Declarative React animations, layout transitions, scroll triggers |
| GSAP | ^3.14 | Complex timelines, ScrollTrigger, performant DOM animations |
| `use-scramble` | ^2.2 | Text scramble/glitch effect |

All animations respect `prefers-reduced-motion` with fallbacks.

---

## Icons

| Library | Notes |
|---|---|
| `@phosphor-icons/react` | Primary icon set (^2.1) |
| `lucide-react` | Secondary icon set (^0.483), also used by shadcn/ui |
| `@radix-ui/react-icons` | Radix primitives icons |

---

## Content & CMS

| Layer | Technology | Notes |
|---|---|---|
| Content Engine | Velite | ^0.3.1, MDX-based SSG content |
| Content Root | `content/` | Folder-structured MDX files |
| Output | `.velite/` | Typed content imports via `#site/content` path alias |
| Code Highlighting | `rehype-pretty-code` + `shiki` | GitHub Dark/Light themes, line highlighting |
| TOC Extraction | `@stefanprobst/rehype-extract-toc` | Auto table-of-contents from headings |
| Heading Links | `rehype-autolink-headings` + `rehype-slug` | Anchor links appended to headings |

### Content Collections

Velite collections are defined in `velite.config.ts`. Each collection:

- Matches a glob pattern including locale-prefixed subdirectories
- Auto-detects locale from `sourcePath`
- Generates `permalink`, `translationKey`, and `sourceHash`
- Shares a base schema (title, slug, description, dates, authors, cover, tags, draft, body) extended per collection type

---

## Internationalization (i18n)

| Aspect | Implementation |
|---|---|
| Locales | Configurable — default + additional locales (e.g. `en`, `nl`, `de`) |
| Strategy | Path-based (`/en/...`, `/nl/...`, `/de/...`) |
| Middleware | `src/proxy.ts` — locale detection from URL segment or Accept-Language header |
| Provider | `I18nProvider` context with `useI18n()` hook |
| Dictionaries | `src/i18n/dictionaries.ts` — static translation object per locale |
| SEO | `localizedAlternates()` for hreflang, `localeDateCodes` for date formatting |
| Auto-translation | `scripts/translate-content.mjs` — LLM-powered sync via OpenRouter, tracks sourceHash to detect stale translations |

---

## Maps (Optional)

| Library | Notes |
|---|---|
| `leaflet` | Core map engine |
| `react-leaflet` | React bindings (v5) |
| `leaflet-draw` | Drawing tools on map |
| `leaflet.fullscreen` | Fullscreen control |
| `leaflet.markercluster` | Marker clustering |
| `react-leaflet-markercluster` | React wrapper for clustering |

Override Leaflet styles in `@layer base` in `globals.css` to match the design system.

---

## Analytics & Tracking

| Tool | Integration |
|---|---|
| Microsoft Clarity | `@microsoft/clarity` npm package, `NEXT_PUBLIC_CLARITY_PROJECT_ID` |
| Google Analytics | gtag.js via dynamic script injection, `NEXT_PUBLIC_GA_MEASUREMENT_ID` |
| Consent | Cookie opt-out model — analytics on by default, respects saved preferences |

### Cookie Consent System

- `src/lib/cookies.ts` — `CookieConsent` interface, localStorage-backed, opt-out for analytics
- `src/lib/tracking.ts` — `bootstrapAnalytics()`, `syncAnalyticsFromConsent()`, consent mode defaults
- `src/components/global/CookieBanner.tsx` — UI for managing preferences
- `src/components/global/AnalyticsBootstrap.tsx` — Client component that calls `bootstrapAnalytics()` on mount

---

## AI Agent Integration (Optional)

| Feature | Implementation |
|---|---|
| Agent Discovery | RFC 8288 Link headers in `next.config.ts` |
| llms.txt | `/llms.txt` and `/llms-full.txt` in `public/` |
| Content Negotiation | `proxy.ts` serves markdown for `Accept: text/markdown` requests |
| Agent Skills | `src/app/.well-known/agent-skills/` directory |
| API Catalog | `src/app/.well-known/api-catalog/` directory |
| MCP Server Card | `src/app/.well-known/mcp/` directory |
| WebMCP | `WebMCPProvider.tsx` — registers browser-side MCP tools via `navigator.modelContext` |
| Security | `public/.well-known/security.txt` |

---

## SEO & Metadata

| Feature | Implementation |
|---|---|
| Sitemap | `src/app/sitemap.ts` — dynamic, includes all content + localized alternates |
| RSS | `src/app/rss.xml/` route handler |
| robots.txt | `src/app/robots.txt/` route |
| Open Graph | Full OG metadata in root layout, per-locale `openGraphLocales` |
| Twitter Cards | `summary_large_image` with social image |
| Verification | Google Search Console + Bing webmaster via env vars |
| PWA | `public/manifest.json` |

---

## UI Components (shadcn/ui + Custom)

### shadcn/ui Components (src/components/ui/)

`button`, `card`, `command`, `dialog`, `dropdown-menu`, `input`, `input-group`, `separator`, `spinner`, `textarea`

### Custom UI Components

Animation-heavy visual components: `WavesBg`, `animated-underline-text`, `button-group`, `card-swap`, `line-shadow-text`, `map`, `meteors`, `pixel-logo-grid`, `place-autocomplete`, `scramble-text`, `scroll-based-velocity`, `spotlight-card`, `waves-background`

### Component Registry Sources

- Default: shadcn/ui
- `@react-bits` — reactbits.dev
- `@magicui` — magicui.design
- `@shadcn-map` — shadcn-map.vercel.app

---

## Project Structure Template

```
project-root/
├── content/                    # Velite MDX content
│   ├── {collection-a}/         # Primary content type (default locale)
│   ├── {collection-b}/         # Secondary content type (default locale)
│   └── {locale}/               # Translated content per locale
│       ├── {collection-a}/
│       └── {collection-b}/
├── docs/                       # Project documentation
├── public/
│   ├── .well-known/            # security.txt
│   ├── assets/                 # Images, social images
│   ├── fonts/                  # Self-hosted web fonts (woff2)
│   ├── static/                 # Velite-processed assets
│   ├── llms.txt                # Agent discovery markdown (optional)
│   ├── llms-full.txt           # Full agent discovery (optional)
│   └── manifest.json           # PWA manifest
├── scripts/
│   └── translate-content.mjs   # LLM-powered i18n sync
├── src/
│   ├── app/
│   │   ├── .well-known/        # Agent skills, API catalog, MCP (optional)
│   │   ├── [locale]/           # Localized pages (i18n routing)
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   └── {feature}/      # Feature-specific routes
│   │   ├── blog/               # Blog routes (if using Velite content)
│   │   ├── globals.css         # Tailwind + design tokens + prose theme
│   │   ├── layout.tsx          # Root layout (fonts, providers, metadata)
│   │   ├── not-found.tsx
│   │   ├── sitemap.ts
│   │   ├── robots.txt/
│   │   └── rss.xml/
│   ├── components/
│   │   ├── {feature}/          # Feature-specific components
│   │   ├── global/             # Shared global (CookieBanner, AnalyticsBootstrap, WebMCPProvider, LanguageSelector)
│   │   ├── home/               # Homepage components
│   │   ├── ui/                 # Reusable UI primitives (shadcn + custom)
│   │   └── test/               # Experimental/test components
│   ├── i18n/
│   │   ├── config.ts           # Locales, helpers, URL utilities
│   │   ├── dictionaries.ts     # Static translation strings
│   │   ├── seo.ts              # SEO helpers per locale
│   │   └── I18nProvider.tsx    # React context provider
│   ├── lib/
│   │   ├── utils.ts            # cn() helper
│   │   ├── content.ts          # Post filtering, finding, sorting
│   │   ├── cookies.ts          # Cookie consent management
│   │   └── tracking.ts         # Analytics bootstrap + consent sync
│   └── proxy.ts                # Middleware: i18n redirects + markdown content negotiation
├── velite.config.ts            # Content collections + MDX plugins
├── components.json             # shadcn/ui configuration
├── next.config.ts              # Next.js config (headers, redirects, Velite hook)
├── nixpacks.toml               # Coolify deployment config
├── tsconfig.json               # TypeScript config with path aliases
├── postcss.config.mjs          # Tailwind PostCSS plugin
└── eslint.config.mjs           # Flat ESLint config (Next.js core-web-vitals + TS)
```

---

## Path Aliases (tsconfig.json)

| Alias | Target |
|---|---|
| `@/*` | `./src/*` |
| `#site/content` | `./.velite` |

---

