import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import Image from 'next/image';
import { siteConfig } from './site-config';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <span className="flex items-center gap-2.5 font-semibold tracking-tight text-fd-foreground hover:opacity-90 transition-opacity">
          <span className="flex size-7 items-center justify-center rounded-lg bg-fd-card border border-fd-border shadow-xs overflow-hidden p-0.5">
            <Image
              src="/logo.png"
              alt={`${siteConfig.name} logo`}
              width={24}
              height={24}
              className="size-full object-contain rounded-md"
              priority
            />
          </span>
          <span>{siteConfig.name}</span>
        </span>
      ),
    },
    links: [
      {
        text: 'Docs',
        url: '/docs',
        active: 'nested-url',
      },
      {
        text: 'Releases',
        url: siteConfig.links.releases,
        external: true,
      },
    ],
    githubUrl: siteConfig.repoUrl,
  };
}
