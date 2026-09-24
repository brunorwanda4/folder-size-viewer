'use client';

import { useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';

export interface ScreenshotProps {
  src: string;
  alt: string;
  caption?: string;
  className?: string;
}

export function Screenshot({ src, alt, caption, className = '' }: ScreenshotProps) {
  const [hasError, setHasError] = useState(false);

  return (
    <figure className={`my-6 flex flex-col items-center w-full ${className}`}>
      <div className="w-full overflow-hidden rounded-xl border border-fd-border bg-fd-card/60 shadow-sm transition-all hover:border-fd-border/80">
        {hasError || !src ? (
          <div className="flex min-h-64 flex-col items-center justify-center gap-3 p-8 text-center bg-fd-muted/30">
            <div className="rounded-full bg-fd-muted p-3.5 text-fd-muted-foreground ring-1 ring-fd-border">
              <ImageIcon className="size-6 stroke-[1.75]" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-fd-foreground">
                Screenshot: {alt}
              </p>
              {src && (
                <p className="text-xs font-mono text-fd-muted-foreground/75">
                  {src}
                </p>
              )}
            </div>
            <span className="inline-flex items-center rounded-md bg-sky-500/10 px-2 py-0.5 text-[11px] font-medium text-sky-600 dark:text-sky-400">
              Placeholder Box
            </span>
          </div>
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={src}
            alt={alt}
            onError={() => setHasError(true)}
            className="w-full h-auto object-cover block"
            loading="lazy"
          />
        )}
      </div>
      {caption && (
        <figcaption className="mt-2.5 text-center text-xs text-fd-muted-foreground">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
