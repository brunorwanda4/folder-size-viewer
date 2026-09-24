/**
 * Single source of truth for repository and site configuration.
 */
export const GITHUB_USERNAME = 'brunorwanda4';
export const REPO_NAME = 'folder-size-viewer';
export const REPO_URL = `https://github.com/${GITHUB_USERNAME}/${REPO_NAME}`;

export const siteConfig = {
  name: 'Folder Size Viewer',
  title: 'Folder Size Viewer — Disk Usage & Instant Local File Search',
  tagline: 'See what is using your disk space, and find any file in milliseconds.',
  description:
    'A lightweight Windows-first desktop app built with Tauri v2, React, and Tantivy to visualize disk usage and find any file in milliseconds. 100% local, read-only, and safe.',
  url: 'https://folder-size-viewer.vercel.app',
  githubUsername: GITHUB_USERNAME,
  repoName: REPO_NAME,
  repoUrl: REPO_URL,
  docsBranch: 'main',
  docsPath: 'folder-size-viewer-docs/content/docs',
  get editBaseUrl() {
    return `${this.repoUrl}/blob/${this.docsBranch}/${this.docsPath}`;
  },
  links: {
    github: REPO_URL,
    releases: `${REPO_URL}/releases`,
    issues: `${REPO_URL}/issues`,
    docs: '/docs',
    gettingStarted: '/docs/getting-started',
  },
} as const;
