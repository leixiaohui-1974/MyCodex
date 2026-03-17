import type {
  Artifact,
  ArtifactGroup,
  Project,
  RuntimeStatus,
} from "../types";
import { formatSize, formatTime, projectSummary } from "../utils";

export interface LeftPaneProps {
  runtimeStatus: RuntimeStatus | null;
  projectsRoot: string;
  setProjectsRoot: (value: string) => void;
  projects: Project[];
  activeProject: Project | null;
  newProjectName: string;
  setNewProjectName: (value: string) => void;
  artifacts: Artifact[];
  artifactGroups: ArtifactGroup[];
  selectedArtifactPath: string;
  onRefreshRuntimeStatus: () => void;
  onRefreshProjects: () => void;
  onOpenFolder: () => void;
  onCreateProject: () => void;
  onSelectProject: (path: string) => void;
  onScanArtifacts: () => void;
  onOpenArtifact: (path: string) => void;
  onOpenMergePair: (baseName: string, pair: Artifact[]) => void;
}
export function LeftPane({
  runtimeStatus,
  projectsRoot,
  setProjectsRoot,
  projects,
  activeProject,
  newProjectName,
  setNewProjectName,
  artifacts,
  artifactGroups,
  selectedArtifactPath,
  onRefreshRuntimeStatus,
  onRefreshProjects,
  onOpenFolder,
  onCreateProject,
  onSelectProject,
  onScanArtifacts,
  onOpenArtifact,
  onOpenMergePair,
}: LeftPaneProps) {
  return (
      <aside className="left-pane">
        <div className="brand-block">
          <h1>MyCodex</h1>
          <p className="muted">Codex CLI、Agent Teams、GWS 和 GitHub 备份的桌面控制台。</p>
        </div>

        <section className="panel">
          <details className="accordion-item">
            <summary className="accordion-header">
              <h2>运行环境</h2>
              <button className="ghost" onClick={(e) => { e.preventDefault(); onRefreshRuntimeStatus(); }}>重新检测</button>
            </summary>
            <div className="accordion-body">
              <p className="caption">
                Team 启动器: {runtimeStatus?.launcher.found ? "就绪" : "缺失"} |{" "}
                {runtimeStatus?.launcher.path || "未配置"}
              </p>
              <ul className="runtime-list">
                {(runtimeStatus?.tools || []).map((item) => (
                  <li key={item.tool}>
                    <strong>{item.tool}</strong>
                    <span>{item.found ? "就绪" : "缺失"}</span>
                  </li>
                ))}
              </ul>
            </div>
          </details>
        </section>

        <section className="panel">
          <div className="section-head">
            <h2>项目</h2>
            <span className="pill">{projects.length}</span>
          </div>
          <details className="accordion-item">
            <summary className="accordion-header">
              <span>项目管理</span>
            </summary>
            <div className="accordion-body">
              <label>项目根目录</label>
              <input value={projectsRoot} onChange={(e) => setProjectsRoot(e.target.value)} />
              <div className="row-buttons">
                <button
                  onClick={() => onRefreshProjects()}
                  disabled={!projectsRoot}
                  title={!projectsRoot ? "等待运行环境检测..." : ""}
                >
                  刷新
                </button>
                <button onClick={() => onOpenFolder()} disabled={!activeProject}>
                  打开文件夹
                </button>
              </div>
              <div className="project-create">
                <input
                  value={newProjectName}
                  placeholder="新项目名称"
                  onChange={(e) => setNewProjectName(e.target.value)}
                />
                <button onClick={() => onCreateProject()} disabled={!projectsRoot} title={!projectsRoot ? "等待运行环境检测..." : ""}>
                  创建
                </button>
              </div>
            </div>
          </details>
          <ul className="project-list">
            {projects.map((project) => (
              <li key={project.path}>
                <button
                  className={activeProject?.path === project.path ? "active" : ""}
                  onClick={() => onSelectProject(project.path)}
                >
                  <strong>{project.manifest.displayName}</strong>
                  <span>{project.manifest.selectedPresetId}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="caption">{projectSummary(activeProject)}</p>
        </section>

        <section className="panel">
          <div className="section-head">
            <h2>产物文件</h2>
            <button className="ghost" onClick={() => onScanArtifacts()} disabled={!activeProject}>
              扫描
            </button>
          </div>
          <div className="artifact-list">
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
                      className={artifact.path === selectedArtifactPath ? "artifact-item active" : "artifact-item"}
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
        </section>
      </aside>
  );
}
