import type { Project } from "./types";

export function makeTaskId(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "mycodex_task"
  );
}

export function formatTime(value?: number): string {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

export function formatSize(bytes?: number): string {
  if (!bytes && bytes !== 0) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function normalizeArtifactBaseName(name: string): string {
  const withoutExt = name.replace(/\.[^.]+$/u, "");
  return withoutExt
    .replace(/([_-])(codex|claude|gemini|lane\d+|run\d+|v\d+|\d{8,})$/iu, "")
    .replace(/([_-])(codex|claude|gemini|lane\d+|run\d+|v\d+|\d{8,})$/iu, "")
    .trim();
}

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderMarkdown(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  const chunks: string[] = [];
  let listMode: "ul" | "ol" | null = null;
  let inCodeBlock = false;
  let codeBuffer: string[] = [];
  let inQuote = false;

  const closeList = () => {
    if (listMode) {
      chunks.push(`</${listMode}>`);
      listMode = null;
    }
  };

  const closeQuote = () => {
    if (inQuote) {
      chunks.push("</blockquote>");
      inQuote = false;
    }
  };

  const inline = (text: string) =>
    escapeHtml(text).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/`(.+?)`/g, "<code>$1</code>");

  for (const line of lines) {
    if (/^```/.test(line)) {
      if (inCodeBlock) {
        chunks.push(`<pre class="md-code"><code>${escapeHtml(codeBuffer.join("\n"))}</code></pre>`);
        inCodeBlock = false;
        codeBuffer = [];
      } else {
        closeList();
        closeQuote();
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      continue;
    }

    if (!line.trim()) {
      closeList();
      closeQuote();
      chunks.push("<p class='md-space'></p>");
      continue;
    }

    if (/^\s*---+\s*$/u.test(line)) {
      closeList();
      closeQuote();
      chunks.push("<hr />");
      continue;
    }

    if (line.startsWith("> ")) {
      closeList();
      if (!inQuote) {
        chunks.push("<blockquote>");
        inQuote = true;
      }
      chunks.push(`<p>${inline(line.slice(2))}</p>`);
      continue;
    }

    if (line.startsWith("# ")) {
      closeList();
      closeQuote();
      chunks.push(`<h1>${inline(line.slice(2))}</h1>`);
      continue;
    }
    if (line.startsWith("## ")) {
      closeList();
      closeQuote();
      chunks.push(`<h2>${inline(line.slice(3))}</h2>`);
      continue;
    }
    if (line.startsWith("### ")) {
      closeList();
      closeQuote();
      chunks.push(`<h3>${inline(line.slice(4))}</h3>`);
      continue;
    }

    const ordered = line.match(/^(\d+)\.\s+(.+)$/u);
    if (ordered) {
      closeQuote();
      if (listMode !== "ol") {
        closeList();
        listMode = "ol";
        chunks.push("<ol>");
      }
      chunks.push(`<li>${inline(ordered[2])}</li>`);
      continue;
    }

    if (line.startsWith("- ")) {
      closeQuote();
      if (listMode !== "ul") {
        closeList();
        listMode = "ul";
        chunks.push("<ul>");
      }
      chunks.push(`<li>${inline(line.slice(2))}</li>`);
      continue;
    }

    closeList();
    closeQuote();
    chunks.push(`<p>${inline(line)}</p>`);
  }

  if (inCodeBlock) {
    chunks.push(`<pre class="md-code"><code>${escapeHtml(codeBuffer.join("\n"))}</code></pre>`);
  }
  closeList();
  closeQuote();
  return chunks.join("");
}

export function projectSummary(project: Project | null): string {
  if (!project) return "No project selected";
  return `${project.manifest.displayName} | ${project.manifest.selectedPresetId} | ${project.manifest.authStatus}`;
}

export function formatJson(input: string): string {
  try {
    return JSON.stringify(JSON.parse(input), null, 2);
  } catch {
    return input;
  }
}

export function withLineNumbers(input: string): string {
  return input
    .split(/\r?\n/)
    .map((line, index) => `${String(index + 1).padStart(4, " ")} | ${line}`)
    .join("\n");
}
