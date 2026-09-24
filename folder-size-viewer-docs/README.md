# Folder Size Viewer — Documentation Site

Modern, fast, and lightweight documentation website for **Folder Size Viewer**, built with **Next.js (App Router)**, **Fumadocs**, **TypeScript**, and **Tailwind CSS v4**.

Designed to match the clean **shadcn/ui** aesthetic with neutral palettes, subtle borders, rounded corners, responsive sidebar navigation, dark/light mode toggle, and instant Orama full-text search.

---

## 🚀 Quick Start

Ensure you have [Bun](https://bun.sh) (or Node.js v20+) installed.

### 1. Install Dependencies
```bash
bun install
```

### 2. Start Development Server
```bash
bun run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. Build for Production
```bash
bun run build
```

### 4. Run Linter & Typechecks
```bash
bun run lint
bun run types:check
```

---

## ⚙️ Configuration & Repository Placeholder

All GitHub URLs, repository names, and edit links are defined in a **single configuration file**:

📁 [`lib/site-config.ts`](./lib/site-config.ts)

```ts
export const GITHUB_USERNAME = '<your-username>';
export const REPO_NAME = 'folder-size-viewer';
export const REPO_URL = `https://github.com/${GITHUB_USERNAME}/${REPO_NAME}`;
```

To update the GitHub repository URL across the entire documentation site, simply replace `<your-username>` in `lib/site-config.ts`. No URLs are hard-coded in markdown or components.

---

## 🖼️ Screenshot Images & Placeholder Component

The documentation includes a reusable `<Screenshot src alt caption />` MDX component. When an image file is absent from `public/images/`, it automatically displays a clean neutral placeholder box (`Screenshot: <alt>`) instead of a broken image.

To add actual screenshots, place the following images in the `public/images/` directory:

| Screenshot File Name | Document Page | Description |
| :--- | :--- | :--- |
| `public/images/main-window.png` | Landing Page & Scanning | Main window displaying streaming scan results with percentage bars |
| `public/images/cards-view.png` | Views | Cards view layout displaying directory badges and Material icons |
| `public/images/charts.png` | Charts | Top folders bar chart and file type distribution breakdown |
| `public/images/search.png` | Instant Search | Tantivy search dialog with scope and search mode selectors |
| `public/images/settings.png` | Search Settings | Index settings dialog with included paths and exclusions |

---

## ☁️ Deployment Guides

### Target 1: Vercel (Recommended Default)
This site is fully optimized for Vercel out of the box with zero additional configuration required:
1. Push your repository to GitHub.
2. Import the project into your Vercel Dashboard.
3. Set the **Root Directory** to `folder-size-viewer-docs`.
4. Vercel will automatically detect Next.js and run `bun run build` or `npm run build`.

### Target 2: Netlify
To deploy on Netlify:
1. Connect your repository on Netlify.
2. Set the base directory to `folder-size-viewer-docs`.
3. Set the build command to `bun run build` (or `npm run build`).
4. Set the publish directory to `.next`.
5. Ensure the `@netlify/plugin-nextjs` plugin is enabled.

### Target 3: Cloudflare Pages
1. Select Next.js template in Cloudflare Pages.
2. Set root directory to `folder-size-viewer-docs`.
3. Use Next-on-Pages or Edge runtime if targeting worker execution.

### Target 4: GitHub Pages (Static Export)
If deploying strictly to GitHub Pages as a static export:
1. In `next.config.mjs`, add `output: 'export'`.
2. Configure a GitHub Actions workflow to run `bun run build` and publish the generated `out/` directory.

---

## 📁 Directory Structure

```
folder-size-viewer-docs/
├── app/
│   ├── (home)/              # Landing page (hero, mockup, 6-card grid, 3-step strip)
│   ├── api/search/          # Orama full-text search API endpoint
│   ├── docs/[[...slug]]/    # Dynamic docs routing with automatic /docs redirect
│   ├── layout.tsx           # Root layout with metadata and Inter font
│   ├── not-found.tsx        # Custom 404 page
│   ├── sitemap.ts           # Dynamic XML sitemap generator
│   ├── robots.ts            # Dynamic robots.txt
│   └── global.css           # Tailwind CSS v4 & Fumadocs theme configuration
├── components/
│   ├── mdx.tsx              # MDX components registration
│   ├── screenshot.tsx       # Reusable <Screenshot /> component with fallback box
│   └── footer.tsx           # Custom documentation & site footer
├── content/
│   └── docs/                # MDX content tree organized with meta.json files
│       ├── getting-started/ # Introduction, Installation, Quick Start
│       ├── using-the-app/   # Scanning, Views, Charts, Filters, Shortcuts
│       ├── search/          # Tantivy Overview, Indexing, Syntax, Settings
│       ├── concepts/        # Size Calculation, Skipped Items, Privacy
│       ├── help/            # Troubleshooting, FAQ
│       ├── development/     # Architecture, Local Dev, Installer, Contributing
│       └── changelog.mdx    # Release history
├── lib/
│   ├── site-config.ts       # Centralized site and repository configuration
│   ├── shared.ts            # Shared Fumadocs metadata utilities
│   └── source.ts            # Content collections loader
├── public/
│   ├── images/              # Screenshot images directory
│   └── icon.svg             # Application folder icon
└── package.json
```

---

## 📄 License
This documentation and Folder Size Viewer are licensed under the [MIT License](https://opensource.org/licenses/MIT).
