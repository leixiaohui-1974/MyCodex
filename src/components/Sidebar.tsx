import type { Project } from "../types";

export interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  projects: Project[];
  activeProject: Project | null;
  onSelectProject: (path: string) => void;
  newProjectName: string;
  setNewProjectName: (v: string) => void;
  onCreateProject: () => void;
  onRefreshProjects: () => void;
  onOpenFolder: () => void;
  projectsRoot: string;
  setProjectsRoot: (v: string) => void;
}

export function Sidebar({
  collapsed,
  onToggle,
  projects,
  activeProject,
  onSelectProject,
  newProjectName,
  setNewProjectName,
  onCreateProject,
  onRefreshProjects,
  onOpenFolder,
  projectsRoot,
  setProjectsRoot,
}: SidebarProps) {
  return (
    <aside className={`sidebar${collapsed ? " sidebar-collapsed" : ""}`}>
      <div className="sidebar-header">
        <button
          onClick={onToggle}
          className="ghost sidebar-toggle"
          title={collapsed ? "展开侧栏" : "收起侧栏"}
        >
          {collapsed ? "▸" : "◂"}
        </button>
        {!collapsed && <span className="sidebar-title">项目</span>}
        {!collapsed && (
          <span className="pill" title={`共 ${projects.length} 个项目`}>
            {projects.length}
          </span>
        )}
      </div>

      {!collapsed && (
        <>
          <div className="sidebar-root-row">
            <input
              className="sidebar-root-input"
              value={projectsRoot}
              placeholder="项目根目录..."
              onChange={(e) => setProjectsRoot(e.target.value)}
              title="项目根目录路径"
            />
            <button
              className="ghost"
              onClick={onRefreshProjects}
              title="刷新项目列表"
            >
              ↻
            </button>
            <button
              className="ghost"
              onClick={onOpenFolder}
              title="在资源管理器中打开当前项目"
            >
              ⌂
            </button>
          </div>

          <div className="sidebar-actions">
            <input
              className="sidebar-new-input"
              value={newProjectName}
              placeholder="新项目..."
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && projectsRoot) onCreateProject();
              }}
            />
            <button
              className="ghost"
              onClick={onCreateProject}
              disabled={!projectsRoot || !newProjectName.trim()}
              title="创建新项目"
            >
              +
            </button>
          </div>

          <ul className="project-list">
            {projects.map((p) => {
              const isActive = activeProject?.path === p.path;
              return (
                <li key={p.path}>
                  <button
                    className={isActive ? "active" : ""}
                    onClick={() => onSelectProject(p.path)}
                    title={p.path}
                  >
                    <strong>{p.manifest.displayName}</strong>
                  </button>
                </li>
              );
            })}
            {projects.length === 0 && (
              <li className="project-list-empty">暂无项目</li>
            )}
          </ul>
        </>
      )}
    </aside>
  );
}
