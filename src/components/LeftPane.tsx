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
          <p className="muted">Desktop control plane for Codex CLI, Agent Teams, GWS, and GitHub backup.</p>
        </div>

        <section className="panel">
          <div className="section-head">
            <h2>Runtime</h2>
            <button className="ghost" onClick={() => onRefreshRuntimeStatus()}>
              Recheck
            </button>
          </div>
          <p className="caption">
            Team launcher: {runtimeStatus?.launcher.found ? "ready" : "missing"} |{" "}
            {runtimeStatus?.launcher.path || "not configured"}
          </p>
          <ul className="runtime-list">
            {(runtimeStatus?.tools || []).map((item) => (
              <li key={item.tool}>
                <strong>{item.tool}</strong>
                <span>{item.found ? "ready" : "missing"}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel">
          <div className="section-head">
            <h2>Projects</h2>
            <span className="pill">{projects.length}</span>
          </div>
          <label>Projects Root</label>
          <input value={projectsRoot} onChange={(e) => setProjectsRoot(e.target.value)} />
          <div className="row-buttons">
            <button
              onClick={() => onRefreshProjects()}
              disabled={!projectsRoot}
              title={!projectsRoot ? "Waiting for runtime status..." : ""}
            >
              Refresh
            </button>
            <button onClick={() => onOpenFolder()} disabled={!activeProject}>
              Open Folder
            </button>
          </div>
          <div className="project-create">
            <input
              value={newProjectName}
              placeholder="new project name"
              onChange={(e) => setNewProjectName(e.target.value)}
            />
            <button onClick={() => onCreateProject()} disabled={!projectsRoot} title={!projectsRoot ? "Waiting for runtime status..." : ""}>
              Create
            </button>
          </div>
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
            <h2>Artifacts</h2>
            <button className="ghost" onClick={() => onScanArtifacts()} disabled={!activeProject}>
              Scan
            </button>
          </div>
          <div className="artifact-list">
            {artifacts.length === 0 ? <p className="empty">No previewable files yet.</p> : null}
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
                      Merge View
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
                        {artifact.hasConflict ? <span className="judge-badge">judge</span> : null}
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
