import type { ArtifactContent, MergePreview, TimelineEntry } from "../types";
import { formatSize, formatTime, renderMarkdown, formatJson, withLineNumbers } from "../utils";

export interface RightPaneProps {
  previewTab: "preview" | "log" | "timeline";
  setPreviewTab: (tab: "preview" | "log" | "timeline") => void;
  timeline: TimelineEntry[];
  logs: string;
  preview: ArtifactContent | null;
  mergePreview: MergePreview | null;
  activeProjectPath: string;
  onRefreshPreview: () => void;
  onOpenPreviewFile: () => void;
}
export function RightPane({
  previewTab,
  setPreviewTab,
  timeline,
  logs,
  preview,
  mergePreview,
  activeProjectPath,
  onRefreshPreview,
  onOpenPreviewFile,
}: RightPaneProps) {
  return (
      <aside className="right-pane">
        <div className="preview-head">
          <h2>Result Preview</h2>
          <div className="tabs">
            <button className={previewTab === "preview" ? "tab active" : "tab"} onClick={() => setPreviewTab("preview")}>
              Preview
            </button>
            <button className={previewTab === "log" ? "tab active" : "tab"} onClick={() => setPreviewTab("log")}>
              Logs
            </button>
            <button
              className={previewTab === "timeline" ? "tab active" : "tab"}
              onClick={() => setPreviewTab("timeline")}
            >
              Timeline
            </button>
          </div>
        </div>

        {previewTab === "timeline" ? (
          <div className="timeline-panel">
            {timeline.length === 0 ? <p className="empty">No team runs yet.</p> : null}
            {timeline.map((entry) => (
              <article key={entry.id} className="timeline-card">
                <div className="timeline-head">
                  <strong>{entry.label}</strong>
                  <span className={`timeline-state state-${entry.status}`}>{entry.status}</span>
                </div>
                <p>Task: {entry.taskId}</p>
                <p>Preset: {entry.presetLabel}</p>
                <p>Start: {formatTime(entry.startTime)}</p>
                <p>Exit: {entry.exitCode ?? "-"}</p>
              </article>
            ))}
          </div>
        ) : previewTab === "log" ? (
          <pre className="log-panel">{logs}</pre>
        ) : mergePreview ? (
          <div className="preview-panel">
            <div className="preview-meta">
              <strong>{mergePreview.baseName}</strong>
              <span>
                {mergePreview.left.name} vs {mergePreview.right.name}
              </span>
            </div>
            <div className="diff-grid">
              <div className="diff-column">
                <h3>{mergePreview.left.name}</h3>
                <pre className="code-preview">{withLineNumbers(mergePreview.leftContent)}</pre>
              </div>
              <div className="diff-column">
                <h3>{mergePreview.right.name}</h3>
                <pre className="code-preview">{withLineNumbers(mergePreview.rightContent)}</pre>
              </div>
            </div>
          </div>
        ) : preview?.ok && preview.content ? (
          <div className="preview-panel">
            <div className="preview-meta">
              <strong>{preview.artifact?.name}</strong>
              <span>{preview.artifact?.relativePath}</span>
              <span>
                {preview.artifact?.kind} | {formatSize(preview.artifact?.size)} | {formatTime(preview.artifact?.mtimeMs)}
              </span>
              <div className="row-buttons">
                <button onClick={() => onOpenPreviewFile()}>Open File</button>
                {preview.truncated ? <span className="caption">Preview truncated to 128 KB.</span> : null}
              </div>
            </div>
            {preview.kind === "html" ? (
              <iframe
                className="html-preview"
                srcDoc={preview.content}
                title={preview.artifact?.name || "preview"}
                sandbox=""
              />
            ) : preview.kind === "markdown" ? (
              <article
                className="markdown-preview"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(preview.content) }}
              />
            ) : preview.kind === "json" ? (
              <pre className="code-preview">{formatJson(preview.content)}</pre>
            ) : (
              <pre className="code-preview">{preview.content}</pre>
            )}
          </div>
        ) : (
          <div className="empty-preview">
            <p>{preview?.error || "No preview available. Run a task or scan project artifacts."}</p>
            <button onClick={() => onRefreshPreview()} disabled={!activeProjectPath}>
              Refresh Preview
            </button>
          </div>
        )}
      </aside>
  );
}
