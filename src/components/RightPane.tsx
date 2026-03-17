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
          <h2>结果预览</h2>
          <div className="tabs">
            <button className={previewTab === "preview" ? "tab active" : "tab"} onClick={() => setPreviewTab("preview")}>
              预览
            </button>
            <button className={previewTab === "log" ? "tab active" : "tab"} onClick={() => setPreviewTab("log")}>
              日志
            </button>
            <button
              className={previewTab === "timeline" ? "tab active" : "tab"}
              onClick={() => setPreviewTab("timeline")}
            >
              时间线
            </button>
          </div>
        </div>

        {previewTab === "timeline" ? (
          <div className="timeline-panel">
            {timeline.length === 0 ? <p className="empty">暂无运行记录。</p> : null}
            {timeline.map((entry) => (
              <article key={entry.id} className="timeline-card">
                <div className="timeline-head">
                  <strong>{entry.label}</strong>
                  <span className={`timeline-state state-${entry.status}`}>{entry.status}</span>
                </div>
                <p>任务: {entry.taskId}</p>
                <p>预设: {entry.presetLabel}</p>
                <p>开始: {formatTime(entry.startTime)}</p>
                <p>退出码: {entry.exitCode ?? "-"}</p>
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
                <button onClick={() => onOpenPreviewFile()}>打开文件</button>
                {preview.truncated ? <span className="caption">预览已截断至 128 KB。</span> : null}
              </div>
            </div>
            {preview.kind === "html" ? (
              <iframe
                className="html-preview"
                srcDoc={preview.content}
                title={preview.artifact?.name || "预览"}
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
            <p>{preview?.error || "暂无预览内容。运行任务或扫描项目产物。"}</p>
            <button onClick={() => onRefreshPreview()} disabled={!activeProjectPath}>
              刷新预览
            </button>
          </div>
        )}
      </aside>
  );
}
