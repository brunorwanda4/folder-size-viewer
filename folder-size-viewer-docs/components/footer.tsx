import Link from 'next/link';
import Image from 'next/image';
import { Heart } from 'lucide-react';
import { siteConfig } from '@/lib/site-config';
import { GithubIcon } from '@/components/icons';

export function Footer() {
  return (
    <footer className="border-t border-fd-border bg-fd-card/40 py-12 text-fd-muted-foreground transition-colors">
      <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          <div className="space-y-3 md:col-span-2">
            <div className="flex items-center gap-2.5 font-semibold text-fd-foreground">
              <span className="flex size-7 items-center justify-center rounded-lg bg-fd-card border border-fd-border shadow-xs overflow-hidden p-0.5">
                <Image
                  src="/logo.png"
                  alt={`${siteConfig.name} logo`}
                  width={24}
                  height={24}
                  className="size-full object-contain rounded-md"
                />
              </span>
              <span className="text-base tracking-tight">{siteConfig.name}</span>
            </div>
            <p className="max-w-sm text-sm text-fd-muted-foreground/90">
              {siteConfig.tagline} Lightweight, 100% offline, and built for Windows with Tauri v2.
            </p>
            <div className="pt-2 text-xs text-fd-muted-foreground/75">
              Released under the{' '}
              <a
                href={`${siteConfig.repoUrl}/blob/main/LICENSE`}
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-fd-foreground transition-colors"
              >
                MIT License
              </a>
              .
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-fd-foreground">
              Documentation
            </h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/docs/getting-started" className="hover:text-fd-foreground transition-colors">
                  Introduction
                </Link>
              </li>
              <li>
                <Link href="/docs/getting-started/installation" className="hover:text-fd-foreground transition-colors">
                  Installation
                </Link>
              </li>
              <li>
                <Link href="/docs/getting-started/quick-start" className="hover:text-fd-foreground transition-colors">
                  Quick Start
                </Link>
              </li>
              <li>
                <Link href="/docs/using-the-app/scanning-a-folder" className="hover:text-fd-foreground transition-colors">
                  Scanning
                </Link>
              </li>
              <li>
                <Link href="/docs/search/overview" className="hover:text-fd-foreground transition-colors">
                  Instant Search
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-fd-foreground">
              Community & Code
            </h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  href={siteConfig.repoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 hover:text-fd-foreground transition-colors"
                >
                  <GithubIcon className="size-3.5" />
                  <span>GitHub Repository</span>
                </a>
              </li>
              <li>
                <a
                  href={siteConfig.links.releases}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-fd-foreground transition-colors"
                >
                  Releases & Downloads
                </a>
              </li>
              <li>
                <a
                  href={siteConfig.links.issues}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-fd-foreground transition-colors"
                >
                  Report an Issue
                </a>
              </li>
              <li>
                <Link href="/docs/changelog" className="hover:text-fd-foreground transition-colors">
                  Changelog
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-fd-border/60 pt-6 text-xs text-fd-muted-foreground/80 sm:flex-row">
          <p>© {new Date().getFullYear()} {siteConfig.name}. Built with Next.js & Fumadocs.</p>
          <p className="flex items-center gap-1">
            Made with <Heart className="size-3 fill-red-500 text-red-500" /> for clean and fast desktops.
          </p>
        </div>
      </div>
    </footer>
  );
}
