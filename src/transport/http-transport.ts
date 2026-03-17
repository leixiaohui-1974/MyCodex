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

type QueryValue = string | number | boolean | null | undefined;

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  query?: Record<string, QueryValue>;
  body?: unknown;
}

function normalizeBaseUrl(baseUrl?: string): string {
  if (!baseUrl) {
    return typeof window !== "undefined" ? window.location.origin : "";
  }
  return baseUrl.replace(/\/+$/, "");
}

function buildUrl(baseUrl: string, path: string, query?: Record<string, QueryValue>): string {
  const qs = query
    ? Object.entries(query)
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join("&")
    : "";
  const url = `${baseUrl}${path}`;
  return qs ? `${url}?${qs}` : url;
}

export class HttpTransport implements MyCodexTransport {
  private readonly baseUrl: string;
  private ws: WebSocket | null = null;

  constructor(baseUrl?: string) {
    this.baseUrl = normalizeBaseUrl(baseUrl);
  }

  private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { method = "GET", query, body } = options;
    const headers: Record<string, string> = {};
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }
    const res = await fetch(buildUrl(this.baseUrl, path, query), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return res.json() as Promise<T>;
  }

  listProjects(root: string): Promise<{ ok: boolean; root: string; projects: MycodexProject[] }> {
    return this.request("/api/projects", { query: { root } });
  }

  createProject(root: string, name: string): Promise<{ ok: boolean; project: MycodexProject; error?: string }> {
    return this.request("/api/projects", { method: "POST", body: { root, name } });
  }

  updateProjectManifest(
    projectPath: string,
    manifest: MycodexProjectManifest
  ): Promise<{ ok: boolean; project: MycodexProject; error?: string }> {
    return this.request("/api/projects/manifest", { method: "PUT", body: { projectPath, manifest } });
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
    return this.request("/api/team/run", { method: "POST", body: payload });
  }

  runGws(payload: { commandLine: string; cwd?: string }): Promise<MycodexCommandResult> {
    return this.request("/api/gws/run", { method: "POST", body: payload });
  }

  runLzc(payload: { commandLine: string; cwd?: string }): Promise<MycodexCommandResult> {
    return this.request("/api/lzc/run", { method: "POST", body: payload });
  }

  deployGitea(payload: { cwd?: string; appName?: string; image?: string }): Promise<MycodexCommandResult> {
    return this.request("/api/gitea/deploy", { method: "POST", body: payload });
  }

  initGitTeamFlow(payload: { projectPath: string }): Promise<MycodexCommandResult> {
    return this.request("/api/git/team/init", { method: "POST", body: payload });
  }

  bindGiteaRemote(payload: {
    projectPath: string;
    remoteUrl: string;
    remoteName?: string;
  }): Promise<MycodexCommandResult> {
    return this.request("/api/git/gitea/bind-remote", { method: "POST", body: payload });
  }

  runGitTeamQuickFlow(payload: {
    projectPath: string;
    topic?: string;
    commitType?: string;
    summary?: string;
    branchPrefix?: string;
    remoteName?: string;
  }): Promise<MycodexCommandResult> {
    return this.request("/api/git/team/quick-flow", { method: "POST", body: payload });
  }

  backupGithub(payload: {
    projectPath: string;
    message?: string;
    branch?: string;
    remoteName?: string;
  }): Promise<MycodexCommandResult> {
    return this.request("/api/backup/github", { method: "POST", body: payload });
  }

  runtimeStatus(): Promise<MycodexRuntimeStatus> {
    return this.request("/api/runtime/status");
  }

  listArtifacts(projectPath: string): Promise<{ ok: boolean; artifacts: MycodexArtifact[]; error?: string }> {
    return this.request("/api/artifacts", { query: { projectPath } });
  }

  readArtifact(targetPath: string, projectRoot?: string): Promise<MycodexArtifactContent> {
    return this.request("/api/artifacts/read", { query: { targetPath, projectRoot } });
  }

  startGoogleAuth(payload: { url?: string }): Promise<{ ok: boolean; message?: string; error?: string }> {
    return this.request("/api/auth/google/start", { method: "POST", body: payload });
  }

  startWechatAuth(payload: { url?: string }): Promise<{ ok: boolean; message?: string; error?: string }> {
    return this.request("/api/auth/wechat/start", { method: "POST", body: payload });
  }

  openFile(targetPath: string): Promise<{ ok: boolean; error?: string }> {
    return this.request("/api/file/open", { method: "POST", body: { targetPath } });
  }

  onTaskOutput(callback: (data: any) => void): () => void {
    const wsBase = this.baseUrl.replace(/^http/, "ws");
    this.ws = new WebSocket(`${wsBase}/ws/tasks`);
    this.ws.onmessage = (event) => {
      try {
        callback(JSON.parse(event.data));
      } catch {
        callback(event.data);
      }
    };
    return () => {
      this.ws?.close();
      this.ws = null;
    };
  }
}
