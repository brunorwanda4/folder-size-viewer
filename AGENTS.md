# AGENTS.md — Developer & AI Agent Guidelines

This document provides architectural rules, runtime standards, UI conventions, and performance guidelines for AI agents and human contributors working on **Folder Size Viewer**.

---

## 1. Project Overview

**Folder Size Viewer** is a lightning-fast desktop disk usage analyzer built with **Tauri v2**, **React 18**, **TypeScript**, **Tailwind CSS**, **shadcn/ui**, and a high-throughput **Rust** backend.

Users can paste or select any directory path (including Windows environment variables like `%LOCALAPPDATA%` and tildes `~`), and the application scans subfolders and files in parallel, streaming real-time results sorted by size directly into the interface.

---

## 2. Core Tech Stack & Runtime Defaults

| Component | Technology | Version / Specification |
|---|---|---|
| **Runtime & Package Manager** | **Bun** | **bun@1.2+** (configured as `bun@1.4.2` in `package.json`) |
| **Desktop Shell** | Tauri v2 | `@tauri-apps/api` v2, `@tauri-apps/cli` v2 |
| **Frontend Framework** | React 18 + TypeScript | Strict mode, Vite 6 bundler |
| **UI Components** | **shadcn/ui** | Radix UI primitives, `class-variance-authority`, `clsx`, `tailwind-merge` |
| **Styling** | Tailwind CSS v3 | Configured with CSS variables and slate base color |
| **Icons & Visuals** | Lucide React & Iconify | `lucide-react`, `@iconify/react` (Material Icon Theme) |
| **Backend** | Rust | Edition 2021, `rayon`, `tokio`, `dirs`, `serde` |

> [!IMPORTANT]
> **Always use Bun (`bun`)**. Never suggest or execute `npm`, `yarn`, or `pnpm`.
> All package scripts, dependency installations, and build steps must use Bun.

---

## 3. High Performance & Rust Engineering Rules

Folder Size Viewer lives or dies by its scan speed and UI responsiveness. The Rust engine must achieve maximum throughput when traversing deep filesystem hierarchies.

### 3.1 Performance First (Safe vs. Unsafe Rust)
- **Goal**: Absolute highest performance and lowest latency.
- **Safe Rust**: Use by default when Rayon iterators, stack allocation, and standard compiler optimizations achieve peak speed without overhead.
- **Unsafe Rust**: **Explicitly permitted and recommended** when safe Rust introduces measurable overhead in hot loops. Scenarios where `unsafe` is encouraged:
  - Low-level OS/Win32 APIs (e.g., `FindFirstFileW`, `FindNextFileW`, `GetFileInformationByHandleEx`) that bypass intermediate memory allocations and CRT overhead.
  - Zero-copy string/slice conversions and buffer reuse during directory walking.
  - Unchecked indexing (`get_unchecked` / `get_unchecked_mut`) in tight loops where boundary conditions are validated upfront.
  - SIMD vectorization or direct pointer arithmetic for bulk data aggregations.
- **Safety Documentation**: Any `unsafe` block must include a clear `// SAFETY:` comment documenting pointer validity, lifetime invariants, memory alignment, and why the operation cannot cause undefined behavior.

### 3.2 Concurrency & Asynchronous Pipeline
- **Non-blocking UI**: Tauri commands must never block the main thread. Always offload heavy disk operations via `tokio::task::spawn_blocking`.
- **Parallel Scanning**: Top-level directory children are scanned concurrently using **Rayon** (`into_par_iter()`).
- **Streaming Events**: Results must stream into the frontend as items complete via Tauri IPC channels (`tauri::ipc::Channel<ScanEvent>`), emitting `ScanEvent::ChildDone`. Never wait for the entire directory to finish before rendering data.
- **Lock-free Primitives**: Use atomics (`AtomicBool`, `AtomicU64`) with `Ordering::Relaxed` or `Ordering::SeqCst` for cancellation tokens and skipped counters rather than holding mutex locks across worker threads.
- **Instant Cancellation**: Traversal loops must periodically poll `cancel_token.load(Ordering::Relaxed)` to terminate immediately when requested by the user.

### 3.3 Filesystem Rules & Edge Cases
- **No Symlink/Junction Recursion**: Check `FILE_ATTRIBUTE_REPARSE_POINT` (0x400) on Windows and `meta.file_type().is_symlink()`. Never recurse into junctions or symlinks to prevent infinite loops, cyclic references, and duplicate size totals.
- **Logical Size Calculation**: Use `metadata.len()` (uncompressed logical size) to match Windows Explorer "Size".
- **Resilient Error Recovery**: Permission denied errors, locked files, and missing handles must never panic or abort the scan. Increment `skipped_count` and continue traversing remaining items.
- **Path Expansion**: Support `%VAR%` Windows environment variable tokens and `~` home directory paths.
- **Long Path Support**: On Windows, ensure paths can handle `\\?\` prefixes if extended length paths (>260 chars) are encountered.

---

## 4. Frontend & UI Architecture (shadcn/ui Standards)

The frontend is built according to standard **shadcn/ui** and Tailwind CSS conventions.

### 4.1 Component Conventions
- **shadcn/ui Directory**: All reusable primitives reside in `src/components/ui/` (e.g., `button.tsx`, `card.tsx`, `table.tsx`, `progress.tsx`, `alert-dialog.tsx`, `sonner.tsx`).
- **Path Aliases**:
  - `@/components` &rarr; `src/components`
  - `@/components/ui` &rarr; `src/components/ui`
  - `@/lib/utils` &rarr; `src/lib/utils`
  - `@/hooks` &rarr; `src/hooks`
  - `@/types` &rarr; `src/types`
- **Class Merging**: Always use `cn(...)` from `@/lib/utils` (`clsx` + `tailwind-merge`) when applying dynamic or configurable classes.
- **Theme Support**: Utilize semantic color variables from `src/index.css` (`bg-background`, `text-foreground`, `bg-card`, `text-card-foreground`, `border-border`, `bg-muted`, `text-muted-foreground`, `text-destructive`). Never hardcode hex color values directly into component classes.
- **Notifications**: Trigger toasts via `toast` from `sonner` (`<Toaster />` is mounted at root in `App.tsx`).

### 4.2 State & IPC Flow
- **Scanning Hook**: `src/hooks/useScan.ts` manages scan state, active scan generation IDs (preventing race conditions from rapid re-scans), streaming entry accumulation, and cancellation.
- **Data Contract**: Rust types in `src-tauri/src/types.rs` must remain strictly synchronized with TypeScript definitions in `src/types/scan.ts`:
  - `FolderChildEntry`
  - `ScanEvent` (`started`, `childDone`, `finished`, `cancelled`, `error`)
  - `ScanResult`
  - `DefaultPaths`

---

## 5. Repository Structure

```
folder-size-viewer/
\u251c\u2500\u2500 AGENTS.md                  # This AI & developer guide
\u251c\u2500\u2500 package.json               # Bun package configuration & dependencies
\u251c\u2500\u2500 bun.lock                   # Bun lockfile
\u251c\u2500\u2500 components.json            # shadcn/ui configuration
\u251c\u2500\u2500 vite.config.ts             # Vite configuration with @ path alias
\u251c\u2500\u2500 tailwind.config.js         # Tailwind CSS theme and plugins
\u251c\u2500\u2500 tsconfig.json              # TypeScript compiler configuration
\u251c\u2500\u2500 src/                       # Frontend application
\u2502   \u251c\u2500\u2500 main.tsx              # React DOM entry point
\u2502   \u251c\u2500\u2500 App.tsx               # Main application layout and state wiring
\u2502   \u251c\u2500\u2500 index.css             # Tailwind base layers and CSS custom variables
\u2502   \u251c\u2500\u2500 components/           # Feature components
\u2502   \u2502   \u251c\u2500\u2500 BreadcrumbNav.tsx   # Hierarchical folder path breadcrumbs
\u2502   \u2502   \u251c\u2500\u2500 Header.tsx          # App header, title, and theme toggle
\u2502   \u2502   \u251c\u2500\u2500 PathInputCard.tsx   # Search input, browse button, and presets
\u2502   \u2502   \u251c\u2500\u2500 ResultsTable.tsx    # Virtualized / sorted tabular results
\u2502   \u2502   \u251c\u2500\u2500 SummaryCards.tsx    # Metric cards (total size, count, elapsed time)
\u2502   \u2502   \u251c\u2500\u2500 ThemeToggle.tsx     # Dark / light mode switcher
\u2502   \u2502   \u2514\u2500\u2500 ui/                 # shadcn/ui primitives
\u2502   \u251c\u2500\u2500 hooks/                # React custom hooks (`useScan.ts`)
\u2502   \u251c\u2500\u2500 lib/                  # Utilities (`utils.ts`, `format.ts`, `notifications.ts`)
\u2502   \u2514\u2500\u2500 types/                # TypeScript interfaces and event contracts
\u251c\u2500\u2500 src-tauri/                 # Rust desktop backend
\u2502   \u251c\u2500\u2500 Cargo.toml            # Rust dependencies & build settings
\u2502   \u2502\u2500\u2500 tauri.conf.json       # Tauri v2 configuration (commands, window settings)
\u2502   \u251c\u2500\u2500 capabilities/         # Tauri permissions & security capabilities
\u2502   \u2514\u2500\u2500 src/
\u2502       \u251c\u2500\u2500 main.rs           # Tauri entry point
\u2502       \u251c\u2500\u2500 lib.rs            # Plugin initialization & command registration
\u2502       \u251c\u2500\u2500 commands.rs       # Tauri IPC commands (`scan_dir`, `cancel_scan`, etc.)
\u2502       \u251c\u2500\u2500 scanner.rs        # Core parallel directory traversal engine
\u2502       \u2514\u2500\u2500 types.rs          # Rust structs & IPC event serialization
\u2514\u2500\u2500 .cargo/                    # Cargo configuration & linker overrides
```

---

## 6. Developer Commands & Workflows

Always execute commands with **Bun** in the project root:

```bash
# Install dependencies
bun install

# Start development mode (launches Vite frontend + Tauri desktop app)
bun run tauri dev

# Run frontend only (in browser on http://localhost:1420)
bun run dev

# Typecheck and build frontend
bun run build

# Package desktop application for release
bun run tauri build

# Rust backend check
cargo check --manifest-path src-tauri/Cargo.toml

# Rust backend tests
cargo test --manifest-path src-tauri/Cargo.toml
```

---

## 7. AI Agent Guardrails & Best Practices

1. **Strict Bun Usage**: Do not install packages or run scripts using `npm` or `yarn`. Always use `bun add <pkg>`, `bun add -d <pkg>`, or `bun run <script>`.
2. **Component Consistency**: When introducing new UI elements, always check `src/components/ui/` first. If a component is missing, install or construct it following **shadcn/ui** patterns using Radix UI primitives and Tailwind CSS.
3. **Synchronized IPC Types**: Any modification to IPC command signatures or payload schemas in `src-tauri/src/commands.rs` or `types.rs` **must** immediately be reflected in `src/types/scan.ts` and `src/hooks/useScan.ts`.
4. **Performance Verification**: When modifying the Rust scanner in `src-tauri/src/scanner.rs`:
   - Benchmark or profile directory traversal on large directories (e.g., `%LOCALAPPDATA%` with 50,000+ files).
   - Ensure stack depth is bounded (iterative traversal preferred over unbounded recursion).
   - Never remove reparse point / junction checks; doing so causes infinite directory loops on Windows.
5. **No Regressions on Cancellation**: Always ensure `cancel_token` checks remain active in inner loops so the scan stops instantly when triggered by the user.
