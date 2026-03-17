import type { ArtifactContent, MergePreview, TimelineEntry, Artifact, ArtifactGroup } from "../types";
import { formatSize, formatTime, renderMarkdown, formatJson, withLineNumbers } from "../utils";

export interface ResultPanelProps {
  previewTab: "preview" | "log" | "timeline" | "artifacts";
  setPreviewTab: (tab: "preview" | "log" | "timeline" | "artifacts") => void;
  timeline: TimelineEntry[];
  logs: string;
  preview: ArtifactContent | null;
  mergePreview: MergePreview | null;
  activeProjectPath: string;
  onRefreshPreview: () => void;
  onOpenPreviewFile: () => void;
  // 产物相关（从 LeftPane 迁入）
  artifacts: Artifact[];
  artifactGroups: ArtifactGroup[];
  selectedArtifactPath: string;
  onScanArtifacts: () => void;
  onOpenArtifact: (path: string) => void;
  onOpenMergePair: (baseName: string, pair: Artifact[]) => void;
  activeProject: any;
}

export function ResultPanel({
  previewTab,
  setPreviewTab,
  timeline,
  logs,
  preview,
  mergePreview,
  activeProjectPath,
  onRefreshPreview,
  onOpenPreviewFile,
  artifacts,
  artifactGroups,
  selectedArtifactPath,
  onScanArtifacts,
  onOpenArtifact,
  onOpenMergePair,
  activeProject,
}: ResultPanelProps) {
  return (
    <div className="result-panel">
      <div className="preview-head">
        <h2>结果预览</h2>
        <div className="tabs">
          <button
            className={previewTab === "preview" ? "tab active" : "tab"}
            onClick={() => setPreviewTab("preview")}
          >
            预览
          </button>
          <button
            className={previewTab === "log" ? "tab active" : "tab"}
            onClick={() => setPreviewTab("log")}
          >
            日志
          </button>
          <button
            className={previewTab === "timeline" ? "tab active" : "tab"}
            onClick={() => setPreviewTab("timeline")}
          >
            时间线
          </button>
          <button
            className={previewTab === "artifacts" ? "tab active" : "tab"}
            onClick={() => setPreviewTab("artifacts")}
          >
            产物
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
      ) : previewTab === "artifacts" ? (
        <div className="artifacts-tab">
          <div className="artifacts-tab-head">
            <button className="ghost" onClick={onScanArtifacts} disabled={!activeProject}>
              扫描
            </button>
          </div>
          {artifacts.length === 0 ? <p className="empty">暂无可预览的文件。</p> : null}
          {artifactGroups.map((group) => {
            const mergeCandidates = group.artifacts.filter((item) => item.kind !== "html");
            const canMerge = mergeCandidates.length >= 2;
            return (
              <div key={`${group.baseName}_${group.artifacts[0].path}`} className="artifact-group">
                {canMerge ? (
                  <button
                    className="ghost merge-btn"
                    onClick={() => onOpenMergePair(group.baseName, mergeCandidates.slice(0, 2))}
                  >
                    对比视图
                  </button>
                ) : null}
                {group.artifacts.map((artifact) => (
                  <button
                    key={artifact.path}
                    className={
                      artifact.path === selectedArtifactPath
                        ? "artifact-item active"
                        : "artifact-item"
                    }
                    onClick={() => onOpenArtifact(artifact.path)}
                  >
                    <div className="artifact-title-row">
                      <strong>{artifact.name}</strong>
                      {artifact.hasConflict ? <span className="judge-badge">冲突</span> : null}
                    </div>
                    <span>{artifact.relativePath}</span>
                    <div className="artifact-meta-row">
                      <span className="kind-badge">{artifact.kind}</span>
                      <span>{formatSize(artifact.size)}</span>
                      <span>{formatTime(artifact.mtimeMs)}</span>
                    </div>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
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
              {preview.artifact?.kind} | {formatSize(preview.artifact?.size)} |{" "}
              {formatTime(preview.artifact?.mtimeMs)}
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
    </div>
  );
}
