import * as React from "react";
import MultipleSelector, { type Option } from "@/components/ui/multiselect";
import { Badge } from "@/components/ui/badge";
import { FileCode, Filter, X } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

const PRESET_OPTIONS: Option[] = [
  { label: "PDF Documents (.pdf)", value: "pdf" },
  { label: "Text Files (.txt)", value: "txt" },
  { label: "Markdown (.md)", value: "md" },
  { label: "Word Documents (.docx, .doc)", value: "docx,doc" },
  { label: "Excel Spreadsheets (.xlsx, .csv)", value: "xlsx,csv,xls" },
  { label: "PowerPoint (.pptx, .ppt)", value: "pptx,ppt" },
  {
    label: "Code & Scripts (.js, .ts, .py, .rs, .json...)",
    value: "js,ts,tsx,jsx,py,rs,go,java,c,cpp,h,json,html,css,sql,sh",
  },
  { label: "Images (.png, .jpg, .svg, .webp...)", value: "png,jpg,jpeg,svg,webp,gif" },
  { label: "Audio (.mp3, .wav, .flac...)", value: "mp3,wav,flac,m4a,aac" },
  { label: "Video (.mp4, .mkv, .mov...)", value: "mp4,mkv,mov,webm,avi" },
  { label: "Archives (.zip, .rar, .7z, .tar...)", value: "zip,rar,7z,tar,gz" },
];

interface SearchExtensionFilterProps {
  extensions: string[];
  onChange: (extensions: string[]) => void;
}

export function SearchExtensionFilter({
  extensions,
  onChange,
}: SearchExtensionFilterProps) {
  const [open, setOpen] = React.useState(false);
  const [selectedOptions, setSelectedOptions] = React.useState<Option[]>([]);

  // Sync internal options when external extensions change
  React.useEffect(() => {
    if (extensions.length === 0) {
      setSelectedOptions([]);
      return;
    }

    // Try matching existing presets or create custom tags
    const activeExts = new Set(extensions.map((e) => e.toLowerCase()));
    const matched: Option[] = [];
    const usedExts = new Set<string>();

    for (const opt of PRESET_OPTIONS) {
      const optExts = opt.value.split(",").map((e) => e.trim().toLowerCase());
      if (optExts.length > 0 && optExts.every((e) => activeExts.has(e))) {
        matched.push(opt);
        optExts.forEach((e) => usedExts.add(e));
      }
    }

    // Any remaining active extensions become custom tags
    for (const ext of activeExts) {
      if (!usedExts.has(ext)) {
        matched.push({
          label: `.${ext}`,
          value: ext,
        });
      }
    }

    setSelectedOptions(matched);
  }, [extensions]);

  const handleSelectorChange = (options: Option[]) => {
    setSelectedOptions(options);
    const exts = new Set<string>();
    for (const opt of options) {
      const parts = opt.value.split(",");
      for (const p of parts) {
        const clean = p.trim().replace(/^\./, "").toLowerCase();
        if (clean) exts.add(clean);
      }
    }
    onChange(Array.from(exts));
  };

  const handleRemoveSingle = (extToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(extensions.filter((e) => e !== extToRemove));
  };

  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`h-7 px-2.5 text-xs gap-1.5 border ${
            extensions.length > 0
              ? "bg-primary/10 border-primary/40 text-primary hover:bg-primary/15"
              : "bg-muted/60 text-muted-foreground hover:text-foreground"
          }`}
        >
          <FileCode className="h-3.5 w-3.5 shrink-0" />
          <span>
            {extensions.length === 0
              ? "Document Types & Exts"
              : extensions.length === 1
              ? `.${extensions[0]}`
              : `${extensions.length} exts`}
          </span>

          {extensions.length > 0 && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClearAll}
              onKeyDown={(ev) => {
                if (ev.key === "Enter") handleClearAll(ev as unknown as React.MouseEvent);
              }}
              className="ml-0.5 rounded-full p-0.5 hover:bg-primary/20 text-primary"
              title="Clear extension filter"
            >
              <X className="h-3 w-3" />
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[340px] sm:w-[400px] p-3 text-xs" align="start">
        <div className="space-y-3">
          <div className="flex items-center justify-between pb-1 border-b">
            <div className="flex items-center gap-1.5 font-medium text-foreground">
              <Filter className="h-3.5 w-3.5 text-primary" />
              <span>Filter by Document Type or Extension</span>
            </div>
            {extensions.length > 0 && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-[11px] text-muted-foreground hover:text-destructive transition-colors"
              >
                Clear all
              </button>
            )}
          </div>

          <div>
            <p className="text-[11px] text-muted-foreground mb-1.5">
              Choose preset types (e.g. PDF, Text) or type any custom extension
              (e.g. <code className="bg-muted px-1 rounded">log</code>,{" "}
              <code className="bg-muted px-1 rounded">rs</code>,{" "}
              <code className="bg-muted px-1 rounded">epub</code>) and press Enter:
            </p>
            <MultipleSelector
              value={selectedOptions}
              onChange={handleSelectorChange}
              defaultOptions={PRESET_OPTIONS}
              placeholder="Select types or type custom extension..."
              creatable={true}
              emptyIndicator={
                <p className="text-center text-xs text-muted-foreground py-2">
                  Press Enter to add custom extension
                </p>
              }
              className="text-xs min-h-[34px] border-input"
              badgeClassName="text-[11px] bg-secondary text-secondary-foreground"
            />
          </div>

          {/* Quick presets pill shortcuts */}
          <div className="pt-1">
            <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block mb-1.5">
              Quick Shortcuts
            </span>
            <div className="flex flex-wrap gap-1">
              {[
                { label: "PDF only", exts: ["pdf"] },
                { label: "PDF & Text", exts: ["pdf", "txt", "md"] },
                { label: "Word & Docs", exts: ["docx", "doc", "pdf", "odt"] },
                { label: "Code", exts: ["js", "ts", "py", "rs", "json", "html"] },
                { label: "Images", exts: ["png", "jpg", "jpeg", "svg", "webp"] },
              ].map((shortcut) => {
                const isSelected =
                  shortcut.exts.length === extensions.length &&
                  shortcut.exts.every((e) => extensions.includes(e));

                return (
                  <button
                    key={shortcut.label}
                    type="button"
                    onClick={() => onChange(shortcut.exts)}
                    className={`px-2 py-0.5 rounded text-[11px] border transition-colors ${
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground border-transparent"
                    }`}
                  >
                    {shortcut.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active extensions preview */}
          {extensions.length > 0 && (
            <div className="pt-2 border-t flex flex-wrap items-center gap-1">
              <span className="text-[10px] text-muted-foreground mr-1">Active:</span>
              {extensions.map((ext) => (
                <Badge
                  key={ext}
                  variant="secondary"
                  className="text-[10px] h-5 px-1.5 font-mono gap-1"
                >
                  .{ext}
                  <X
                    className="h-2.5 w-2.5 cursor-pointer hover:text-destructive"
                    onClick={(e) => handleRemoveSingle(ext, e)}
                  />
                </Badge>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
