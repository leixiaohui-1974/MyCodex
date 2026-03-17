import type {
  MyCodexTransport,
  MycodexProjectManifest,
  MycodexCommandResult,
  MycodexRuntimeStatus,
  MycodexArtifact,
  MycodexArtifactContent,
  MycodexProject,
  MycodexTaskType,
} from "./types";

export class IpcTransport implements MyCodexTransport {
  listProjects(root: string): Promise<{ ok: boolean; root: string; projects: MycodexProject[] }> {
    return window.mycodex.listProjects(root);
  }

  createProject(root: string, name: string): Promise<{ ok: boolean; project: MycodexProject; error?: string }> {
    return window.mycodex.createProject(root, name);
  }

  updateProjectManifest(
    projectPath: string,
    manifest: MycodexProjectManifest
  ): Promise<{ ok: boolean; project: MycodexProject; error?: string }> {
    return window.mycodex.updateProjectManifest(projectPath, manifest);
  }

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
  }): Promise<MycodexCommandResult> {
    return window.mycodex.runTeam(payload);
  }

  runGws(payload: { commandLine: string; cwd?: string }): Promise<MycodexCommandResult> {
    return window.mycodex.runGws(payload);
  }

  runLzc(payload: { commandLine: string; cwd?: string }): Promise<MycodexCommandResult> {
    return window.mycodex.runLzc(payload);
  }

  deployGitea(payload: { cwd?: string; appName?: string; image?: string }): Promise<MycodexCommandResult> {
    return window.mycodex.deployGitea(payload);
  }

  initGitTeamFlow(payload: { projectPath: string }): Promise<MycodexCommandResult> {
    return window.mycodex.initGitTeamFlow(payload);
  }

  bindGiteaRemote(payload: {
    projectPath: string;
    remoteUrl: string;
    remoteName?: string;
  }): Promise<MycodexCommandResult> {
    return window.mycodex.bindGiteaRemote(payload);
  }

  runGitTeamQuickFlow(payload: {
    projectPath: string;
    topic?: string;
    commitType?: string;
    summary?: string;
    branchPrefix?: string;
    remoteName?: string;
  }): Promise<MycodexCommandResult> {
    return window.mycodex.runGitTeamQuickFlow(payload);
  }

  backupGithub(payload: {
    projectPath: string;
    message?: string;
    branch?: string;
    remoteName?: string;
  }): Promise<MycodexCommandResult> {
    return window.mycodex.backupGithub(payload);
  }

  runtimeStatus(): Promise<MycodexRuntimeStatus> {
    return window.mycodex.runtimeStatus();
  }

  listArtifacts(projectPath: string): Promise<{ ok: boolean; artifacts: MycodexArtifact[]; error?: string }> {
    return window.mycodex.listArtifacts(projectPath);
  }

  readArtifact(targetPath: string, projectRoot?: string): Promise<MycodexArtifactContent> {
    return window.mycodex.readArtifact(targetPath, projectRoot);
  }

  startGoogleAuth(payload: { url?: string }): Promise<{ ok: boolean; message?: string; error?: string }> {
    return window.mycodex.startGoogleAuth(payload);
  }

  startWechatAuth(payload: { url?: string }): Promise<{ ok: boolean; message?: string; error?: string }> {
    return window.mycodex.startWechatAuth(payload);
  }

  openFile(targetPath: string): Promise<{ ok: boolean; error?: string }> {
    return window.mycodex.openFile(targetPath);
  }
}
