import { useEffect, useMemo, useState } from "react";
import { useTransport } from "./hooks/useTransport";
import {
  type TaskType,
  type Project,
  type Artifact,
  type ArtifactContent,
  type CommandResult,
  type ProjectListResponse,
  type ProjectMutationResponse,
  type ProjectManifest,
  type RuntimeStatus,
  type TimelineEntry,
  type MergePreview,
  TEAM_PRESETS,
} from "./types";
import {
  makeTaskId,
  formatTime,
  formatSize,
  normalizeArtifactBaseName,
  renderMarkdown,
  projectSummary,
  formatJson,
  withLineNumbers,
} from "./utils";
import { MenuBar } from "./components/MenuBar";
import { Sidebar } from "./components/Sidebar";
import { MainContent } from "./components/MainContent";

export default function App() {
  const transport = useTransport();

  const [projectsRoot, setProjectsRoot] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectPath, setActiveProjectPath] = useState<string>("");
  const [newProjectName, setNewProjectName] = useState("");
  const [logs, setLogs] = useState("暂无日志。");
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [selectedArtifactPath, setSelectedArtifactPath] = useState("");
  const [preview, setPreview] = useState<ArtifactContent | null>(null);
  const [previewTab, setPreviewTab] = useState<"preview" | "log" | "timeline" | "artifacts">("preview");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [mergePreview, setMergePreview] = useState<MergePreview | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [gwsCommand, setGwsCommand] = useState("gws --help");
  const [lzcCommand, setLzcCommand] = useState("lzc app ls");
  const [giteaAppName, setGiteaAppName] = useState("gitea");
  const [giteaBaseUrl, setGiteaBaseUrl] = useState("");
  const [giteaRepoUrl, setGiteaRepoUrl] = useState("");
  const [gitTopic, setGitTopic] = useState("mycodex-collab");
  const [gitCommitType, setGitCommitType] = useState("feat");
  const [gitSummary, setGitSummary] = useState("update team workflow");
  const [backupMessage, setBackupMessage] = useState("backup: mycodex checkpoint");
  const [accountEmailDraft, setAccountEmailDraft] = useState("");
  const [wechatIdDraft, setWechatIdDraft] = useState("");
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const activeProject = projects.find((project) => project.path === activeProjectPath) ?? null;

  const [teamId, setTeamId] = useState("mycodex_mvp");
  const [taskType, setTaskType] = useState<TaskType>("coding");
  const [subtype, setSubtype] = useState("docs");
  const [task, setTask] = useState(TEAM_PRESETS[0].task);
  const [goal, setGoal] = useState(TEAM_PRESETS[0].goal);
  const [selectedPresetId, setSelectedPresetId] = useState(TEAM_PRESETS[0].id);

  const artifactGroups = useMemo(() => {
    const grouped = new Map<string, Artifact[]>();
    for (const artifact of artifacts) {
      const key = normalizeArtifactBaseName(artifact.name) || artifact.name;
      const list = grouped.get(key) || [];
      list.push(artifact);
      grouped.set(key, list);
    }
    return Array.from(grouped.entries())
      .map(([baseName, list]) => ({
        baseName,
        artifacts: list
          .slice()
          .sort((left, right) => right.mtimeMs - left.mtimeMs)
      }))
      .sort((left, right) => right.artifacts[0].mtimeMs - left.artifacts[0].mtimeMs);
  }, [artifacts]);

  function appendLog(block: string) {
    setLogs((prev) => `${prev}\n${block}`.trim());
  }

  function showError(message: string) {
    setErrorMessage(message);
    appendLog(`[error] ${message}`);
    setTimeout(() => setErrorMessage(null), 8000);
  }

  function syncFormFromProject(project: Project | null) {
    if (!project) return;
    const defaults = project.manifest.taskDefaults;
    setSelectedPresetId(project.manifest.selectedPresetId);
    setTeamId(defaults.teamId);
    setTaskType(defaults.taskType);
    setSubtype(defaults.subtype);
    setTask(defaults.task);
    setGoal(defaults.goal);
    setAccountEmailDraft(project.manifest.linkedAccountEmail);
    setWechatIdDraft(project.manifest.linkedWechatId || "");
    setGiteaBaseUrl(project.manifest.giteaBaseUrl || "");
    setGiteaRepoUrl(project.manifest.giteaRepoUrl || "");
  }

  async function refreshProjects(nextRoot = projectsRoot) {
    const res = (await transport.listProjects(nextRoot)) as ProjectListResponse;
    if (!res.ok) {
      showError("加载项目列表失败。");
      return;
    }
    setProjectsRoot(res.root);
    setProjects(res.projects);
    const selectedPath =
      res.projects.find((project) => project.path === activeProjectPath)?.path ??
      res.projects[0]?.path ??
      "";
    setActiveProjectPath(selectedPath);
    const selectedProject = res.projects.find((project) => project.path === selectedPath) ?? null;
    syncFormFromProject(selectedProject);
  }

  async function loadArtifacts(projectPath: string, preferredPath?: string) {
    if (!projectPath) {
      setArtifacts([]);
      setPreview(null);
      setMergePreview(null);
      return;
    }
    const res = await transport.listArtifacts(projectPath);
    if (!res.ok) {
      showError(`产物扫描失败: ${res.error ?? "未知错误"}`);
      setArtifacts([]);
      setPreview(null);
      setMergePreview(null);
      return;
    }
    setArtifacts(res.artifacts);
    const nextPath = preferredPath || selectedArtifactPath || res.artifacts[0]?.path || "";
    setSelectedArtifactPath(nextPath);
    if (nextPath) {
      const content = (await transport.readArtifact(nextPath, projectPath)) as ArtifactContent;
      setPreview(content.ok ? content : { ok: false, error: content.error || "Preview failed." });
      setMergePreview(null);
    } else {
      setPreview(null);
      setMergePreview(null);
    }
  }

  async function refreshRuntimeStatus() {
    const res = (await transport.runtimeStatus()) as RuntimeStatus;
    setRuntimeStatus(res);
    setProjectsRoot((current) => (!current ? res.defaultProjectsRoot || current : current));
  }

  // R1 fix: Mount-only effects use explicit function refs to avoid stale closures
  useEffect(() => {
    void (async () => {
      try {
        const status = (await transport.runtimeStatus()) as RuntimeStatus;
        setRuntimeStatus(status);
        const root = status.defaultProjectsRoot || "";
        setProjectsRoot((current) => current || root);
        const listRes = (await transport.listProjects(root)) as ProjectListResponse;
        if (listRes.ok) {
          setProjects(listRes.projects);
          setProjectsRoot(listRes.root);
          const firstPath = listRes.projects[0]?.path ?? "";
          setActiveProjectPath(firstPath);
        } else {
          showError("初始化失败：无法加载项目列表。");
        }
      } catch (err) {
        showError(`初始化失败：${err instanceof Error ? err.message : String(err)}`);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync form + artifacts when active project changes
  const activeProjectPathRef = activeProjectPath;
  useEffect(() => {
    const project = projects.find((p) => p.path === activeProjectPathRef) ?? null;
    if (project) {
      syncFormFromProject(project);
      void loadArtifacts(project.path);
    } else {
      setArtifacts([]);
      setPreview(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectPathRef]);

  async function createProject() {
    if (!newProjectName.trim()) return;
    const res = (await transport.createProject(projectsRoot, newProjectName)) as ProjectMutationResponse;
    if (!res.ok) {
      showError(`项目创建失败: ${res.error ?? "未知错误"}`);
      return;
    }
    setNewProjectName("");
    await refreshProjects(projectsRoot);
    setActiveProjectPath(res.project.path);
    appendLog(`[project] created ${res.project.path}`);
  }

  async function saveProjectSettings(overrides?: Partial<ProjectManifest>) {
    if (!activeProject) return;
    const manifest: ProjectManifest = {
      ...activeProject.manifest,
      ...overrides,
      selectedPresetId,
      linkedAccountEmail: accountEmailDraft,
      linkedWechatId: wechatIdDraft,
      giteaBaseUrl,
      giteaRepoUrl,
      taskDefaults: {
        teamId: teamId || makeTaskId(task),
        taskType,
        subtype,
        task,
        goal
      }
    };
    const res = (await transport.updateProjectManifest(activeProject.path, manifest)) as ProjectMutationResponse;
    if (!res.ok) {
      showError(`设置保存失败: ${res.error ?? "未知错误"}`);
      return;
    }
    setProjects((prev) => prev.map((project) => (project.path === res.project.path ? res.project : project)));
    appendLog(`[project] saved settings for ${res.project.manifest.displayName}`);
  }

  function applyPreset(presetId: string) {
    const preset = TEAM_PRESETS.find((item) => item.id === presetId);
    if (!preset) return;
    const currentPresetMatch = TEAM_PRESETS.find((p) => p.id === selectedPresetId);
    const hasEdits =
      currentPresetMatch &&
      (task !== currentPresetMatch.task || goal !== currentPresetMatch.goal || teamId !== currentPresetMatch.teamId);
    if (hasEdits && !window.confirm("当前有未保存的编辑，切换预设将覆盖。是否继续？")) {
      return;
    }
    setSelectedPresetId(preset.id);
    setTeamId(preset.teamId);
    setTaskType(preset.taskType);
    setSubtype(preset.subtype);
    setTask(preset.task);
    setGoal(preset.goal);
  }

  async function executeAndCapture(
    label: string,
    work: () => Promise<CommandResult>,
    projectPath?: string,
    meta?: { taskId?: string; presetLabel?: string }
  ) {
    setIsBusy(true);
    const runId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const startTime = Date.now();
    setTimeline((prev) => [
      {
        id: runId,
        label,
        taskId: meta?.taskId || "n/a",
        presetLabel: meta?.presetLabel || "manual",
        startTime,
        status: "running"
      },
      ...prev
    ]);
    try {
      const res = await work();
      appendLog(
        [
          `[${label}] status=${res.status ?? (res.ok ? "ok" : "failed")} exit=${res.code}`,
          res.command ? `command: ${res.command} ${(res.args || []).join(" ")}` : "",
          res.warnings?.length ? `warnings: ${res.warnings.join(" | ")}` : "",
          res.stdout,
          res.stderr
        ]
          .filter(Boolean)
          .join("\n")
      );
      if (projectPath) {
        const preferred = res.artifacts?.[0]?.path;
        await loadArtifacts(projectPath, preferred);
      }
      setPreviewTab(res.artifacts?.length ? "preview" : "log");
      setTimeline((prev) =>
        prev.map((entry) =>
          entry.id === runId
            ? {
                ...entry,
                exitCode: res.code,
                status: res.ok ? "ok" : "failed"
              }
            : entry
        )
      );
      return res;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      appendLog(`[${label}] 意外错误: ${message}`);
      setTimeline((prev) =>
        prev.map((entry) =>
          entry.id === runId
            ? {
                ...entry,
                exitCode: 1,
                status: "failed"
              }
            : entry
        )
      );
      return {
        ok: false,
        code: 1,
        stdout: "",
        stderr: message
      };
    } finally {
      setIsBusy(false);
    }
  }

  async function runTeam(command: "run" | "resume" | "plan" | "status" | "open") {
    const currentPreset = TEAM_PRESETS.find((preset) => preset.id === selectedPresetId);
    const projectPath = activeProject?.path || projectsRoot || runtimeStatus?.defaultProjectsRoot || "";
    if (!projectPath) {
      appendLog("[team] 缺少项目路径。请等待运行环境检测或选择一个项目。");
      return;
    }
    await saveProjectSettings();
    await executeAndCapture(
      `team:${command}`,
      () =>
        transport.runTeam({
          command,
          id: teamId || makeTaskId(task),
          type: taskType,
          subtype,
          task,
          goal,
          workspace: projectPath,
          cwd: projectPath,
          autoMergeMode: "apply",
          mergeTimeoutScale: 4,
          parallel: false
        }),
      projectPath,
      {
        taskId: teamId || makeTaskId(task),
        presetLabel: currentPreset?.label || "custom"
      }
    );
  }

  async function runGws() {
    const projectPath = activeProject?.path || projectsRoot || runtimeStatus?.defaultProjectsRoot || "";
    if (!projectPath) {
      appendLog("[gws] 缺少项目路径。请等待运行环境检测或选择一个项目。");
      return;
    }
    await executeAndCapture(
      "gws",
      () =>
        transport.runGws({
          commandLine: gwsCommand,
          cwd: projectPath
        }),
      projectPath
    );
  }

  async function runLzc() {
    const projectPath = activeProject?.path || projectsRoot || runtimeStatus?.defaultProjectsRoot || "";
    if (!projectPath) {
      appendLog("[lzc] 缺少项目路径。请等待运行环境检测或选择一个项目。");
      return;
    }
    await executeAndCapture(
      "lzc",
      () =>
        transport.runLzc({
          commandLine: lzcCommand,
          cwd: projectPath
        }),
      projectPath
    );
  }

  async function deployGiteaByLzc() {
    const projectPath = activeProject?.path || projectsRoot || runtimeStatus?.defaultProjectsRoot || "";
    if (!projectPath) {
      appendLog("[gitea] 缺少项目路径。请等待运行环境检测或选择一个项目。");
      return;
    }
    await executeAndCapture(
      "gitea:deploy",
      () =>
        transport.deployGitea({
          cwd: projectPath,
          appName: giteaAppName
        }),
      projectPath
    );
  }

  async function startGoogleLogin() {
    const res = await transport.startGoogleAuth({
      url: "https://accounts.google.com/signin/v2/identifier"
    });
    appendLog(`[auth] ${res.message || "auth opened"}`);
    await saveProjectSettings({ authStatus: "browser_opened" });
  }

  async function startWechatLogin() {
    const res = await transport.startWechatAuth({
      url: "https://open.weixin.qq.com/"
    });
    appendLog(`[auth-wechat] ${res.message || "auth opened"}`);
    await saveProjectSettings({ authStatus: "browser_opened" });
  }

  async function bindAccount() {
    if (!activeProject) return;
    await saveProjectSettings({
      linkedAccountEmail: accountEmailDraft,
      linkedWechatId: wechatIdDraft,
      authStatus: accountEmailDraft || wechatIdDraft ? "manually_bound" : "not_started"
    });
  }

  async function initGitTeamCollaboration() {
    if (!activeProject) return;
    await executeAndCapture(
      "git:team:init",
      () =>
        transport.initGitTeamFlow({
          projectPath: activeProject.path
        }),
      activeProject.path
    );
  }

  async function bindGiteaRemote() {
    if (!activeProject) return;
    await saveProjectSettings();
    await executeAndCapture(
      "git:gitea:bind-remote",
      () =>
        transport.bindGiteaRemote({
          projectPath: activeProject.path,
          remoteUrl: giteaRepoUrl,
          remoteName: "origin"
        }),
      activeProject.path
    );
  }

  async function runGitQuickFlow() {
    if (!activeProject) return;
    await executeAndCapture(
      "git:team:quick-flow",
      () =>
        transport.runGitTeamQuickFlow({
          projectPath: activeProject.path,
          topic: gitTopic,
          commitType: gitCommitType,
          summary: gitSummary,
          branchPrefix: gitCommitType === "fix" ? "fix" : "feat",
          remoteName: "origin"
        }),
      activeProject.path
    );
  }

  async function runBackup() {
    if (!activeProject) return;
    await executeAndCapture(
      "backup",
      () =>
        transport.backupGithub({
          projectPath: activeProject.path,
          message: backupMessage,
          branch: activeProject.manifest.backupBranch,
          remoteName: "origin"
        }),
      activeProject.path
    );
  }

  async function openMergePair(baseName: string, pair: Artifact[]) {
    if (pair.length < 2) return;
    const [left, right] = pair;
    const projectRoot = activeProject?.path || projectsRoot;
    const leftRes = (await transport.readArtifact(left.path, projectRoot)) as ArtifactContent;
    const rightRes = (await transport.readArtifact(right.path, projectRoot)) as ArtifactContent;
    if (!leftRes.ok || !rightRes.ok) {
      appendLog(
        `[merge] failed to load pair: ${leftRes.error || "left read failed"} | ${rightRes.error || "right read failed"}`
      );
      return;
    }
    setSelectedArtifactPath(left.path);
    setPreview({
      ok: true,
      artifact: left,
      kind: left.kind,
      content: leftRes.content || "",
      truncated: leftRes.truncated
    });
    setMergePreview({
      baseName,
      left,
      right,
      leftContent: leftRes.content || "",
      rightContent: rightRes.content || ""
    });
    setPreviewTab("preview");
  }

  async function openArtifact(artifactPath: string) {
    const content = (await transport.readArtifact(artifactPath, activeProject?.path || projectsRoot)) as ArtifactContent;
    setSelectedArtifactPath(artifactPath);
    setPreview(content.ok ? content : { ok: false, error: content.error || "Preview failed." });
    setMergePreview(null);
  }



  return (
    <div className="app-shell-v2">
      <MenuBar
        gwsCommand={gwsCommand}
        setGwsCommand={setGwsCommand}
        onRunGws={() => void runGws()}
        lzcCommand={lzcCommand}
        setLzcCommand={setLzcCommand}
        giteaAppName={giteaAppName}
        setGiteaAppName={setGiteaAppName}
        giteaBaseUrl={giteaBaseUrl}
        setGiteaBaseUrl={setGiteaBaseUrl}
        onRunLzc={() => void runLzc()}
        onDeployGitea={() => void deployGiteaByLzc()}
        giteaRepoUrl={giteaRepoUrl}
        setGiteaRepoUrl={setGiteaRepoUrl}
        gitTopic={gitTopic}
        setGitTopic={setGitTopic}
        gitCommitType={gitCommitType}
        setGitCommitType={setGitCommitType}
        gitSummary={gitSummary}
        setGitSummary={setGitSummary}
        backupMessage={backupMessage}
        setBackupMessage={setBackupMessage}
        onInitGit={() => void initGitTeamCollaboration()}
        onBindRemote={() => void bindGiteaRemote()}
        onQuickFlow={() => void runGitQuickFlow()}
        onBackup={() => void runBackup()}
        accountEmailDraft={accountEmailDraft}
        setAccountEmailDraft={setAccountEmailDraft}
        wechatIdDraft={wechatIdDraft}
        setWechatIdDraft={setWechatIdDraft}
        onGoogleLogin={() => void startGoogleLogin()}
        onWechatLogin={() => void startWechatLogin()}
        onBindAccount={() => void bindAccount()}
        teamId={teamId}
        setTeamId={setTeamId}
        taskType={taskType}
        setTaskType={setTaskType}
        subtype={subtype}
        setSubtype={setSubtype}
        onSaveSettings={() => void saveProjectSettings()}
        runtimeStatus={runtimeStatus}
        onRefreshRuntime={() => void refreshRuntimeStatus()}
        activeProject={activeProject}
        isBusy={isBusy}
      />
      <div className="app-body">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          projects={projects}
          activeProject={activeProject}
          onSelectProject={(path) => setActiveProjectPath(path)}
          newProjectName={newProjectName}
          setNewProjectName={setNewProjectName}
          onCreateProject={() => void createProject()}
          onRefreshProjects={() => void refreshProjects(projectsRoot)}
          onOpenFolder={() => activeProject && void transport.openFile(activeProject.path)}
          projectsRoot={projectsRoot}
          setProjectsRoot={setProjectsRoot}
        />
        <MainContent
          selectedPresetId={selectedPresetId}
          task={task}
          goal={goal}
          setTask={setTask}
          setGoal={setGoal}
          onApplyPreset={(presetId) => applyPreset(presetId)}
          onRunTeam={(cmd) => void runTeam(cmd)}
          isBusy={isBusy}
          activeProject={activeProject}
          previewTab={previewTab}
          setPreviewTab={setPreviewTab}
          timeline={timeline}
          logs={logs}
          preview={preview}
          mergePreview={mergePreview}
          activeProjectPath={activeProjectPath}
          onRefreshPreview={() => activeProject && void loadArtifacts(activeProject.path)}
          onOpenPreviewFile={() => preview?.artifact && void transport.openFile(preview.artifact.path)}
          artifacts={artifacts}
          artifactGroups={artifactGroups}
          selectedArtifactPath={selectedArtifactPath}
          onScanArtifacts={() => activeProject && void loadArtifacts(activeProject.path)}
          onOpenArtifact={(path) => void openArtifact(path)}
          onOpenMergePair={(baseName, pair) => void openMergePair(baseName, pair)}
        />
      </div>
      {errorMessage && (
        <div className="error-toast" role="alert" onClick={() => setErrorMessage(null)}>
          {errorMessage}
        </div>
      )}
    </div>
  );
}
