type MycodexTaskType = "coding" | "research" | "writing";
type MycodexAuthStatus = "not_started" | "browser_opened" | "manually_bound";
type MycodexPreviewKind = "markdown" | "html" | "text" | "json";

type MycodexProjectManifest = {
  displayName: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
  linkedAccountEmail: string;
  linkedWechatId: string;
  authStatus: MycodexAuthStatus;
  giteaBaseUrl: string;
  giteaRepoUrl: string;
  selectedPresetId: string;
  backupBranch: string;
  taskDefaults: {
    teamId: string;
    taskType: MycodexTaskType;
    subtype: string;
    task: string;
    goal: string;
  };
};

type MycodexProject = {
  name: string;
  path: string;
  manifest: MycodexProjectManifest;
};

type MycodexArtifact = {
  name: string;
  path: string;
  ext: string;
  kind: MycodexPreviewKind;
  relativePath: string;
  mtimeMs: number;
  size: number;
  hasConflict?: boolean;
};

type MycodexArtifactContent = {
  ok: boolean;
  artifact?: MycodexArtifact;
  content?: string;
  kind?: MycodexPreviewKind;
  truncated?: boolean;
  error?: string;
};

type MycodexCommandResult = {
  ok: boolean;
  code: number;
  stdout: string;
  stderr: string;
  warnings?: string[];
  artifacts?: MycodexArtifact[];
  command?: string;
  args?: string[];
  status?: string;
  error?: string;
  steps?: Array<{
    cmd: string;
    code: number;
    stdout: string;
    stderr: string;
  }>;
};

type MycodexRuntimeStatus = {
  ok: boolean;
  defaultProjectsRoot: string;
  launcher: { found: boolean; path: string };
  tools: Array<{ tool: string; found: boolean; detail: string }>;
};

type MycodexBridge = {
  listProjects(root: string): Promise<{ ok: boolean; root: string; projects: MycodexProject[] }>;
  createProject(root: string, name: string): Promise<{ ok: boolean; project: MycodexProject; error?: string }>;
  updateProjectManifest(
    projectPath: string,
    manifest: MycodexProjectManifest
  ): Promise<{ ok: boolean; project: MycodexProject; error?: string }>;
  runTeam(payload: {
    command?: "run" | "resume" | "plan" | "status" | "open";
    id?: string;
    type?: MycodexTaskType;
    subtype?: string;
    task?: string;
    goal?: string;
    workspace?: string;
    cwd?: string;
    autoMergeMode?: "plan" | "apply";
    mergeTimeoutScale?: number;
    parallel?: boolean;
    maxWorkers?: number;
    noAutoMerge?: boolean;
  }): Promise<MycodexCommandResult>;
  runGws(payload: { commandLine: string; cwd?: string }): Promise<MycodexCommandResult>;
  runLzc(payload: { commandLine: string; cwd?: string }): Promise<MycodexCommandResult>;
  deployGitea(payload: { cwd?: string; appName?: string; image?: string }): Promise<MycodexCommandResult>;
  initGitTeamFlow(payload: { projectPath: string }): Promise<MycodexCommandResult>;
  bindGiteaRemote(payload: {
    projectPath: string;
    remoteUrl: string;
    remoteName?: string;
  }): Promise<MycodexCommandResult>;
  runGitTeamQuickFlow(payload: {
    projectPath: string;
    topic?: string;
    commitType?: string;
    summary?: string;
    branchPrefix?: string;
    remoteName?: string;
  }): Promise<MycodexCommandResult>;
  backupGithub(payload: {
    projectPath: string;
    message?: string;
    branch?: string;
    remoteName?: string;
  }): Promise<MycodexCommandResult>;
  runtimeStatus(): Promise<MycodexRuntimeStatus>;
  listArtifacts(projectPath: string): Promise<{ ok: boolean; artifacts: MycodexArtifact[]; error?: string }>;
  readArtifact(targetPath: string, projectRoot?: string): Promise<MycodexArtifactContent>;
  startGoogleAuth(payload: { url?: string }): Promise<{ ok: boolean; message?: string; error?: string }>;
  startWechatAuth(payload: { url?: string }): Promise<{ ok: boolean; message?: string; error?: string }>;
  openFile(targetPath: string): Promise<{ ok: boolean; error?: string }>;
};

declare global {
  interface Window {
    mycodex: MycodexBridge;
  }
}

export {};
