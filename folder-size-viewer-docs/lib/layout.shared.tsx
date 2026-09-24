import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { siteConfig } from './site-config';
import { Folder } from 'lucide-react';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <span className="flex items-center gap-2.5 font-semibold tracking-tight text-fd-foreground hover:opacity-90 transition-opacity">
          <span className="flex size-7 items-center justify-center rounded-lg bg-sky-500/10 text-sky-500 border border-sky-500/20 shadow-xs">
            <Folder className="size-4 fill-sky-500/20 stroke-[2]" />
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
