import Link from 'next/link';
import Image from 'next/image';
import {
  HardDrive,
  LayoutGrid,
  BarChart3,
  Search,
  ShieldCheck,
  Lock,
  ArrowRight,
  FolderSearch,
  Sparkles,
  Play,
  Download,
} from 'lucide-react';
import { siteConfig } from '@/lib/site-config';
import { Screenshot } from '@/components/screenshot';
import { Footer } from '@/components/footer';
import { GithubIcon } from '@/components/icons';

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-16 md:pt-20 md:pb-24">
        {/* Subtle decorative glow */}
        <div className="pointer-events-none absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80">
          <div className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-sky-500/20 to-teal-400/20 opacity-30 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]" />
        </div>

        <div className="container mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 text-center">

          <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl md:text-7xl text-fd-foreground">
            Folder Size Viewer
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-fd-muted-foreground max-w-2xl mx-auto leading-relaxed">
            See what is using your disk space, and find any file in milliseconds.
          </p>

          {/* Action buttons */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <a
              href={siteConfig.links.downloadExe}
              className="inline-flex items-center gap-2 rounded-xl bg-fd-primary px-6 py-3 text-sm font-semibold text-fd-primary-foreground shadow-sm hover:bg-fd-primary/90 transition-all active:scale-[0.98]"
            >
              <Download className="size-4" />
              <span>Download for Windows</span>
            </a>
            <Link
              href="/docs"
              className="inline-flex items-center gap-2 rounded-xl border border-fd-border bg-fd-card px-6 py-3 text-sm font-semibold text-fd-foreground shadow-sm hover:bg-fd-accent transition-all active:scale-[0.98]"
            >
              <span>Documentation</span>
              <ArrowRight className="size-4" />
            </Link>
            <a
              href={siteConfig.repoUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-fd-border bg-fd-card px-6 py-3 text-sm font-semibold text-fd-foreground shadow-sm hover:bg-fd-accent transition-all active:scale-[0.98]"
            >
              <GithubIcon className="size-4" />
              <span>GitHub</span>
            </a>
          </div>

          {/* Mockup Preview / Screenshot Area */}
          <div className="mt-14 max-w-4xl mx-auto">
            <div className="rounded-2xl border border-fd-border bg-fd-card/70 p-2 shadow-2xl backdrop-blur-sm sm:p-3">
              {/* Window Header */}
              <div className="flex items-center justify-between border-b border-fd-border/70 pb-2.5 px-3 mb-3 text-xs text-fd-muted-foreground">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <span className="size-3 rounded-full bg-red-400/80 inline-block" />
                    <span className="size-3 rounded-full bg-amber-400/80 inline-block" />
                    <span className="size-3 rounded-full bg-emerald-400/80 inline-block" />
                  </div>
                  <div className="ml-2 flex items-center gap-1.5 hidden sm:flex">
                    <Image
                      src="/logo.png"
                      alt=""
                      width={16}
                      height={16}
                      className="size-4 rounded-xs object-contain"
                    />
                    <span className="font-mono font-medium text-fd-foreground/80">
                      Folder Size Viewer — C:\Users\Projects
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1 rounded bg-sky-500/10 px-2 py-0.5 text-[11px] font-medium text-sky-600 dark:text-sky-400">
                    Live Stream: Complete
                  </span>
                </div>
              </div>

              {/* App UI Visual Mockup */}
              <div className="rounded-xl border border-fd-border/80 bg-fd-background p-4 sm:p-6 text-left">
                {/* Search / Path bar strip */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pb-5 border-b border-fd-border/60">
                  <div className="flex flex-1 items-center gap-2 rounded-lg border border-fd-border bg-fd-muted/30 px-3 py-2 text-xs sm:text-sm font-mono text-fd-foreground">
                    <FolderSearch className="size-4 text-sky-500 shrink-0" />
                    <span className="truncate">C:\Users\Developer\Projects</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg bg-sky-500 px-3 py-2 text-xs font-semibold text-white shadow-xs">
                      Rescan
                    </span>
                    <span className="rounded-lg border border-fd-border bg-fd-card px-3 py-2 text-xs font-medium text-fd-foreground">
                      Cards View
                    </span>
                  </div>
                </div>

                {/* Breadcrumbs and Stats */}
                <div className="flex flex-wrap items-center justify-between gap-2 py-3 text-xs text-fd-muted-foreground border-b border-fd-border/40">
                  <div className="flex items-center gap-1.5 font-medium">
                    <span>This PC</span>
                    <span>/</span>
                    <span>C:</span>
                    <span>/</span>
                    <span>Users</span>
                    <span>/</span>
                    <span>Developer</span>
                    <span>/</span>
                    <span className="text-fd-foreground font-semibold">Projects</span>
                  </div>
                  <div className="font-mono text-[11px]">
                    48.6 GB total • 18,420 files • 0 skipped
                  </div>
                </div>

                {/* Items rows with percent bars */}
                <div className="divide-y divide-fd-border/40 pt-2 space-y-2">
                  {[
                    { name: 'node_modules', size: '18.4 GB', pct: 37.8, files: '84,200 files', color: 'bg-sky-500' },
                    { name: 'target', size: '14.2 GB', pct: 29.2, files: '12,310 files', color: 'bg-teal-500' },
                    { name: 'videos', size: '8.5 GB', pct: 17.5, files: '48 files', color: 'bg-indigo-500' },
                    { name: 'assets', size: '4.1 GB', pct: 8.4, files: '1,420 files', color: 'bg-emerald-500' },
                    { name: 'backups', size: '3.4 GB', pct: 7.1, files: '16 files', color: 'bg-amber-500' },
                  ].map((item) => (
                    <div key={item.name} className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs sm:text-sm">
                      <div className="flex items-center gap-2 min-w-44">
                        <span className="size-2 rounded-full bg-sky-500/70" />
                        <span className="font-medium text-fd-foreground">{item.name}</span>
                        <span className="text-[11px] text-fd-muted-foreground">({item.files})</span>
                      </div>
                      <div className="flex items-center gap-3 flex-1 max-w-md">
                        <div className="w-full bg-fd-muted rounded-full h-2 overflow-hidden">
                          <div className={`h-full ${item.color} rounded-full`} style={{ width: `${item.pct}%` }} />
                        </div>
                        <span className="text-xs font-mono text-fd-muted-foreground w-12 text-right">{item.pct}%</span>
                      </div>
                      <div className="font-mono font-semibold text-fd-foreground text-right sm:min-w-20">
                        {item.size}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Reusable Screenshot placeholder verification */}
              <div className="mt-4 px-2">
                <Screenshot
                  src="/images/main-window.png"
                  alt="Folder Size Viewer Main Window"
                  caption="High-density table scan view with live streaming percentage bars"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Grid (6 Cards with Lucide Icons) */}
      <section className="py-16 md:py-24 border-t border-fd-border bg-fd-muted/20">
        <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <p className="mt-2 text-3xl font-bold tracking-tight text-fd-foreground sm:text-4xl">
              Everything you need to inspect and clean your storage
            </p>
            <p className="mt-4 text-base text-fd-muted-foreground">
              Designed for speed, clarity, and safety on Windows. No complicated menus or cloud requirements.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Card 1: Disk usage */}
            <div className="rounded-2xl border border-fd-border bg-fd-card p-6 shadow-xs hover:border-fd-border/80 transition-all">
              <div className="flex size-11 items-center justify-center rounded-xl bg-sky-500/10 text-sky-500 border border-sky-500/20 mb-5">
                <HardDrive className="size-5 stroke-[2]" />
              </div>
              <h3 className="text-lg font-semibold text-fd-foreground">
                Disk usage analysis
              </h3>
              <p className="mt-2 text-sm text-fd-muted-foreground leading-relaxed">
                Paste or browse any folder path, including shortcuts like <code className="font-mono text-xs text-sky-600 dark:text-sky-400">%LOCALAPPDATA%</code>, <code className="font-mono text-xs text-sky-600 dark:text-sky-400">%USERPROFILE%</code>, or <code className="font-mono text-xs text-sky-600 dark:text-sky-400">~</code>. Results stream in live, sorted largest first with percentage bars.
              </p>
            </div>

            {/* Card 2: Table and Cards views */}
            <div className="rounded-2xl border border-fd-border bg-fd-card p-6 shadow-xs hover:border-fd-border/80 transition-all">
              <div className="flex size-11 items-center justify-center rounded-xl bg-teal-500/10 text-teal-500 border border-teal-500/20 mb-5">
                <LayoutGrid className="size-5 stroke-[2]" />
              </div>
              <h3 className="text-lg font-semibold text-fd-foreground">
                Table & Cards views
              </h3>
              <p className="mt-2 text-sm text-fd-muted-foreground leading-relaxed">
                Switch seamlessly between a high-density tabular view and responsive visual cards. Enjoy Material Icon Theme icons for instant file type recognition and drill down with breadcrumbs.
              </p>
            </div>

            {/* Card 3: Charts */}
            <div className="rounded-2xl border border-fd-border bg-fd-card p-6 shadow-xs hover:border-fd-border/80 transition-all">
              <div className="flex size-11 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 mb-5">
                <BarChart3 className="size-5 stroke-[2]" />
              </div>
              <h3 className="text-lg font-semibold text-fd-foreground">
                Visual storage charts
              </h3>
              <p className="mt-2 text-sm text-fd-muted-foreground leading-relaxed">
                Identify space hogs at a glance. View top folders by size with automatic &ldquo;Others&rdquo; grouping and analyze storage distributions categorized across 10 file types.
              </p>
            </div>

            {/* Card 4: Instant search */}
            <div className="rounded-2xl border border-fd-border bg-fd-card p-6 shadow-xs hover:border-fd-border/80 transition-all">
              <div className="flex size-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 mb-5">
                <Search className="size-5 stroke-[2]" />
              </div>
              <h3 className="text-lg font-semibold text-fd-foreground">
                Instant full-text search
              </h3>
              <p className="mt-2 text-sm text-fd-muted-foreground leading-relaxed">
                Powered by the Tantivy search engine in Rust. Press <kbd className="font-mono text-xs rounded border border-fd-border px-1 py-0.5">Ctrl+K</kbd> to search file names and textual contents across drives or within the current folder in milliseconds.
              </p>
            </div>

            {/* Card 5: Private and local */}
            <div className="rounded-2xl border border-fd-border bg-fd-card p-6 shadow-xs hover:border-fd-border/80 transition-all">
              <div className="flex size-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 mb-5">
                <ShieldCheck className="size-5 stroke-[2]" />
              </div>
              <h3 className="text-lg font-semibold text-fd-foreground">
                100% private & local
              </h3>
              <p className="mt-2 text-sm text-fd-muted-foreground leading-relaxed">
                Everything stays on your computer. Zero telemetry, zero analytics, zero external network calls. Your search index is stored securely in your local AppData directory.
              </p>
            </div>

            {/* Card 6: Read-only and safe */}
            <div className="rounded-2xl border border-fd-border bg-fd-card p-6 shadow-xs hover:border-fd-border/80 transition-all">
              <div className="flex size-11 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20 mb-5">
                <Lock className="size-5 stroke-[2]" />
              </div>
              <h3 className="text-lg font-semibold text-fd-foreground">
                Read-only & safe by design
              </h3>
              <p className="mt-2 text-sm text-fd-muted-foreground leading-relaxed">
                Folder Size Viewer never deletes or modifies your files. Symlinks and NTFS junctions are safely skipped to avoid loops, and protected system files are handled without crashes.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* "How it works" 3-step strip */}
      <section className="py-16 md:py-24 border-t border-fd-border">
        <div className="container mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <p className="mt-2 text-3xl font-bold tracking-tight text-fd-foreground sm:text-4xl">
              How it works in three simple steps
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Step 1 */}
            <div className="flex flex-col items-center text-center p-6 rounded-2xl border border-fd-border bg-fd-card shadow-xs">
              <div className="flex size-12 items-center justify-center rounded-full bg-sky-500 text-white font-bold text-lg mb-5 shadow-xs">
                1
              </div>
              <h3 className="text-lg font-semibold text-fd-foreground">
                Paste a folder
              </h3>
              <p className="mt-2 text-sm text-fd-muted-foreground leading-relaxed">
                Browse with the native dialog or paste any path or variable (<code className="font-mono text-xs">%USERPROFILE%</code>, <code className="font-mono text-xs">%LOCALAPPDATA%</code>, or <code className="font-mono text-xs">~</code>).
              </p>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col items-center text-center p-6 rounded-2xl border border-fd-border bg-fd-card shadow-xs">
              <div className="flex size-12 items-center justify-center rounded-full bg-sky-500 text-white font-bold text-lg mb-5 shadow-xs">
                2
              </div>
              <h3 className="text-lg font-semibold text-fd-foreground">
                Scan live
              </h3>
              <p className="mt-2 text-sm text-fd-muted-foreground leading-relaxed">
                Watch sizes and file counts stream in live with asynchronous multithreaded scanning. Cancel or pause anytime with zero lag.
              </p>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col items-center text-center p-6 rounded-2xl border border-fd-border bg-fd-card shadow-xs">
              <div className="flex size-12 items-center justify-center rounded-full bg-sky-500 text-white font-bold text-lg mb-5 shadow-xs">
                3
              </div>
              <h3 className="text-lg font-semibold text-fd-foreground">
                Find what is big
              </h3>
              <p className="mt-2 text-sm text-fd-muted-foreground leading-relaxed">
                Drill down using breadcrumbs, analyze visual charts, or jump directly to large files and text queries using Tantivy instant search.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Quick CTA */}
      <section className="py-14 border-t border-fd-border bg-fd-muted/30">
        <div className="container mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-fd-foreground sm:text-3xl">
            Ready to explore the documentation?
          </h2>
          <p className="mt-3 text-sm sm:text-base text-fd-muted-foreground max-w-xl mx-auto">
            Get started with installation, scanning guides, search query syntax, and Tauri development architecture.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
            <a
              href={siteConfig.links.downloadExe}
              className="inline-flex items-center gap-2 rounded-xl bg-fd-primary px-5 py-2.5 text-sm font-semibold text-fd-primary-foreground shadow-xs hover:bg-fd-primary/90 transition-all"
            >
              <Download className="size-4" />
              <span>Download (.exe)</span>
            </a>
            <Link
              href="/docs/getting-started"
              className="inline-flex items-center gap-2 rounded-xl border border-fd-border bg-fd-card px-5 py-2.5 text-sm font-medium text-fd-foreground shadow-xs hover:bg-fd-accent transition-all"
            >
              <span>Explore Docs</span>
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/docs/getting-started/quick-start"
              className="inline-flex items-center gap-2 rounded-xl border border-fd-border bg-fd-card px-5 py-2.5 text-sm font-medium text-fd-foreground shadow-xs hover:bg-fd-accent transition-all"
            >
              <Play className="size-3.5 fill-current" />
              <span>5-Step Quick Start</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
}
