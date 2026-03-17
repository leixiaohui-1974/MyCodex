/// <reference types="vite/client" />

type TaskType = "coding" | "research" | "writing";
type AuthStatus = "not_started" | "browser_opened" | "manually_bound";
type PreviewKind = "markdown" | "html" | "text" | "json";

type ProjectManifest = {
  displayName: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
  linkedAccountEmail: string;
  linkedWechatId: string;
  authStatus: AuthStatus;
  giteaBaseUrl: string;
  giteaRepoUrl: string;
  selectedPresetId: string;
  backupBranch: string;
  taskDefaults: {
    teamId: string;
    taskType: TaskType;
    subtype: string;
    task: string;
    goal: string;
  };
};

type Project = {
  name: string;
  path: string;
  manifest: ProjectManifest;
};

type Artifact = {
  name: string;
  path: string;
  ext: string;
  kind: PreviewKind;
  relativePath: string;
  mtimeMs: number;
  size: number;
  hasConflict?: boolean;
};

declare global {
  interface Window {
    mycodex: {
      listProjects: (root?: string) => Promise<{ ok: boolean; root: string; projects: Project[] }>;
      createProject: (root: string, name: string) => Promise<{ ok: boolean; project: Project; error?: string }>;
      updateProjectManifest: (
        projectPath: string,
        manifest: ProjectManifest
      ) => Promise<{ ok: boolean; project: Project; error?: string }>;
      runTeam: (payload: Record<string, unknown>) => Promise<any>;
      runGws: (payload: { commandLine: string; cwd?: string }) => Promise<any>;
      runLzc: (payload: { commandLine: string; cwd?: string }) => Promise<any>;
      deployGitea: (payload: { cwd?: string; appName?: string; image?: string }) => Promise<any>;
      initGitTeamFlow: (payload: { projectPath: string }) => Promise<any>;
      bindGiteaRemote: (payload: {
        projectPath: string;
        remoteUrl: string;
        remoteName?: string;
      }) => Promise<any>;
      runGitTeamQuickFlow: (payload: {
        projectPath: string;
        topic: string;
        commitType: string;
        summary: string;
        branchPrefix?: string;
        remoteName?: string;
      }) => Promise<any>;
      backupGithub: (payload: {
        projectPath: string;
        message?: string;
        branch?: string;
        remoteName?: string;
      }) => Promise<any>;
      runtimeStatus: () => Promise<{
        ok: boolean;
        launcher: { found: boolean; path: string };
        tools: Array<{ tool: string; found: boolean; detail: string }>;
      }>;
      listArtifacts: (projectPath: string) => Promise<{ ok: boolean; artifacts: Artifact[]; error?: string }>;
      readArtifact: (targetPath: string) => Promise<any>;
      startGoogleAuth: (payload?: { url?: string }) => Promise<{ ok: boolean; message?: string }>;
      startWechatAuth: (payload?: { url?: string }) => Promise<{ ok: boolean; message?: string }>;
      openFile: (targetPath: string) => Promise<{ ok: boolean; error?: string }>;
    };
  }
}

export {};
