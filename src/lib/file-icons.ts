import { addCollection } from "@iconify/react";
import iconsData from "@iconify-json/material-icon-theme/icons.json";

// Register the icon collection offline with fallback aliases
const collection = {
  ...iconsData,
  aliases: {
    ...iconsData.aliases,
    folder: { parent: "folder-base" },
    "folder-open": { parent: "folder-base-open" },
    file: { parent: "document" },
  },
};

addCollection(collection);

// Set of all valid icon identifiers (including aliases)
const validIconKeys = new Set([
  ...Object.keys(iconsData.icons || {}),
  ...Object.keys(iconsData.aliases || {}),
  "folder",
  "folder-open",
  "file",
]);

const folderMap: Record<string, string> = {
  src: "folder-src",
  source: "folder-src",
  node_modules: "folder-node",
  ".git": "folder-git",
  git: "folder-git",
  dist: "folder-dist",
  build: "folder-dist",
  out: "folder-dist",
  assets: "folder-images",
  images: "folder-images",
  img: "folder-images",
  docs: "folder-docs",
  doc: "folder-docs",
  documentation: "folder-docs",
  test: "folder-test",
  tests: "folder-test",
  __tests__: "folder-test",
  config: "folder-config",
  configs: "folder-config",
  configuration: "folder-config",
  public: "folder-public",
  lib: "folder-lib",
  components: "folder-components",
  packages: "folder-packages",
  pkg: "folder-packages",
  temp: "folder-temp",
  tmp: "folder-temp",
  logs: "folder-log",
  log: "folder-log",
  cache: "folder-temp",
  programs: "folder-app",
  program: "folder-app",
  windows: "folder-windows",
  microsoft: "folder-windows",
  docker: "folder-docker",
  app: "folder-app",
  apps: "folder-app",
  views: "folder-views",
  routes: "folder-routes",
  utils: "folder-utils",
  download: "folder-download",
  downloads: "folder-download",
  video: "folder-video",
  videos: "folder-video",
  audio: "folder-audio",
  music: "folder-audio",
  font: "folder-font",
  fonts: "folder-font",
  database: "folder-database",
  db: "folder-database",
  locale: "folder-i18n",
  locales: "folder-i18n",
  i18n: "folder-i18n",
  constants: "folder-constant",
  hooks: "folder-hook",
  layouts: "folder-layout",
  layout: "folder-layout",
  middleware: "folder-middleware",
  plugins: "folder-plugin",
  plugin: "folder-plugin",
};

const exactFileMap: Record<string, string> = {
  "package.json": "nodejs",
  "package-lock.json": "nodejs",
  "bun.lock": "lock",
  "bun.lockb": "lock",
  "cargo.toml": "rust",
  "cargo.lock": "lock",
  dockerfile: "docker",
  "docker-compose.yml": "docker",
  "docker-compose.yaml": "docker",
  ".dockerignore": "docker",
  ".gitignore": "git",
  ".gitattributes": "git",
  ".gitmodules": "git",
  "readme.md": "readme",
  readme: "readme",
  "readme.txt": "readme",
  license: "license",
  "license.md": "license",
  "license.txt": "license",
  "tsconfig.json": "tsconfig",
  "tsconfig.node.json": "tsconfig",
  "vite.config.ts": "vite",
  "vite.config.js": "vite",
  "tailwind.config.js": "tailwindcss",
  "tailwind.config.ts": "tailwindcss",
  "postcss.config.js": "postcss",
  "components.json": "json",
  ".env": "tune",
  ".env.local": "tune",
  ".env.development": "tune",
  ".env.production": "tune",
  ".eslintrc": "eslint",
  ".eslintrc.json": "eslint",
  ".eslintrc.js": "eslint",
  ".prettierrc": "prettier",
};

const extMap: Record<string, string> = {
  ts: "typescript",
  tsx: "react-ts",
  js: "javascript",
  jsx: "react",
  mjs: "javascript",
  cjs: "javascript",
  json: "json",
  html: "html",
  htm: "html",
  css: "css",
  scss: "sass",
  sass: "sass",
  less: "less",
  rs: "rust",
  py: "python",
  pyc: "python-misc",
  md: "markdown",
  markdown: "markdown",
  txt: "document",
  text: "document",
  pdf: "pdf",
  doc: "word",
  docx: "word",
  xls: "table",
  xlsx: "table",
  csv: "table",
  ppt: "powerpoint",
  pptx: "powerpoint",
  png: "image",
  jpg: "image",
  jpeg: "image",
  gif: "image",
  svg: "svg",
  webp: "image",
  ico: "image",
  bmp: "image",
  tiff: "image",
  tif: "image",
  mp4: "video",
  mkv: "video",
  mov: "video",
  avi: "video",
  wmv: "video",
  webm: "video",
  mp3: "audio",
  wav: "audio",
  flac: "audio",
  aac: "audio",
  ogg: "audio",
  zip: "zip",
  rar: "zip",
  "7z": "zip",
  tar: "zip",
  gz: "zip",
  bz2: "zip",
  xz: "zip",
  tgz: "zip",
  iso: "disc",
  exe: "exe",
  msi: "exe",
  dll: "dll",
  db: "database",
  sqlite: "database",
  sqlite3: "database",
  sql: "database",
  log: "log",
  yml: "yaml",
  yaml: "yaml",
  toml: "toml",
  xml: "xml",
  c: "c",
  cpp: "cpp",
  h: "c",
  hpp: "cpp",
  java: "java",
  class: "java",
  jar: "java",
  go: "go",
  kt: "kotlin",
  kts: "kotlin",
  dart: "dart",
  swift: "swift",
  php: "php",
  sh: "console",
  bash: "console",
  zsh: "console",
  ps1: "powershell",
  bat: "console",
  cmd: "console",
};

export function getIconName(name: string, isDir: boolean, isOpen = false): string {
  const cleanName = name.trim().toLowerCase();

  if (isDir) {
    const matched = folderMap[cleanName];
    if (matched) {
      if (isOpen) {
        const openVariant = `${matched}-open`;
        if (validIconKeys.has(openVariant)) {
          return `material-icon-theme:${openVariant}`;
        }
      }
      if (validIconKeys.has(matched)) {
        return `material-icon-theme:${matched}`;
      }
    }
    return isOpen
      ? "material-icon-theme:folder-open"
      : "material-icon-theme:folder";
  }

  // Exact file match
  const exact = exactFileMap[cleanName];
  if (exact && validIconKeys.has(exact)) {
    return `material-icon-theme:${exact}`;
  }

  // Extension match
  const lastDotIndex = cleanName.lastIndexOf(".");
  if (lastDotIndex !== -1 && lastDotIndex < cleanName.length - 1) {
    const ext = cleanName.slice(lastDotIndex + 1);
    const extIcon = extMap[ext];
    if (extIcon && validIconKeys.has(extIcon)) {
      return `material-icon-theme:${extIcon}`;
    }
  }

  return "material-icon-theme:file";
}
