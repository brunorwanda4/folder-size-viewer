import Link from 'next/link';
import { ArrowLeft, FileQuestion } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-fd-muted text-fd-muted-foreground ring-1 ring-fd-border shadow-xs">
        <FileQuestion className="size-7 stroke-[1.5]" />
      </div>
      <h1 className="mt-6 text-3xl font-bold tracking-tight text-fd-foreground sm:text-4xl">
        Page Not Found
      </h1>
      <p className="mt-3 max-w-md text-sm text-fd-muted-foreground sm:text-base">
        The documentation page or resource you are looking for does not exist, was moved, or had its URL updated.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/docs"
          className="inline-flex items-center gap-2 rounded-lg bg-fd-primary px-4 py-2.5 text-sm font-medium text-fd-primary-foreground shadow-xs transition-colors hover:bg-fd-primary/90"
        >
          <ArrowLeft className="size-4" />
          <span>Back to Documentation</span>
        </Link>
        <Link
          href="/"
          className="inline-flex items-center rounded-lg border border-fd-border bg-fd-card px-4 py-2.5 text-sm font-medium text-fd-foreground shadow-xs transition-colors hover:bg-fd-accent"
        >
          Home Page
        </Link>
      </div>
    </div>
  );
}
