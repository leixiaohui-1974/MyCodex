export type TaskType = "coding" | "research" | "writing";
export type AuthStatus = "not_started" | "browser_opened" | "manually_bound";
export type PreviewKind = "markdown" | "html" | "text" | "json";

export type ProjectManifest = {
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

export type Project = {
  name: string;
  path: string;
  manifest: ProjectManifest;
};

export type Artifact = {
  name: string;
  path: string;
  ext: string;
  kind: PreviewKind;
  relativePath: string;
  mtimeMs: number;
  size: number;
  hasConflict?: boolean;
};

export type ArtifactContent = {
  ok: boolean;
  artifact?: Artifact;
  content?: string;
  kind?: PreviewKind;
  truncated?: boolean;
  error?: string;
};

export type CommandResult = {
  ok: boolean;
  code: number;
  stdout: string;
  stderr: string;
  warnings?: string[];
  artifacts?: Artifact[];
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

export type ProjectListResponse = {
  ok: boolean;
  root: string;
  projects: Project[];
};

export type ProjectMutationResponse = {
  ok: boolean;
  project: Project;
  error?: string;
};

export type TeamPreset = {
  id: string;
  label: string;
  description: string;
  taskType: TaskType;
  subtype: string;
  task: string;
  goal: string;
  teamId: string;
};

export type RuntimeStatus = {
  ok: boolean;
  defaultProjectsRoot: string;
  launcher: { found: boolean; path: string };
  tools: Array<{ tool: string; found: boolean; detail: string }>;
};

export type TimelineStatus = "running" | "ok" | "failed";

export type TimelineEntry = {
  id: string;
  label: string;
  taskId: string;
  presetLabel: string;
  startTime: number;
  exitCode?: number;
  status: TimelineStatus;
};

export type MergePreview = {
  baseName: string;
  left: Artifact;
  right: Artifact;
  leftContent: string;
  rightContent: string;
};

export type ArtifactGroup = {
  baseName: string;
  artifacts: Artifact[];
};

export type ToolStatus = {
  tool: string;
  found: boolean;
  detail: string;
};

export const TEAM_PRESETS: TeamPreset[] = [
  {
    id: "mvp_build",
    label: "MVP Build",
    description: "Default coding lane for shipping desktop features with auto-merge.",
    taskType: "coding",
    subtype: "docs",
    task: "\u8bf7\u89c4\u5212\u5e76\u5b9e\u65bd\u5f53\u524d\u9879\u76ee\u7684\u6838\u5fc3\u5f00\u53d1\u4efb\u52a1\uff0c\u8f93\u51fa\u53ef\u6267\u884c\u4ee3\u7801\u3001\u9a8c\u8bc1\u6b65\u9aa4\u548c\u98ce\u9669\u8bf4\u660e\u3002",
    goal: "\u5b8c\u6210\u53ef\u8fd0\u884c\u7248\u672c\uff0c\u5e76\u7ed9\u51fa\u53ef\u590d\u7528\u7684\u540e\u7eed\u8fed\u4ee3\u65b9\u6848\u3002",
    teamId: "mycodex_mvp"
  },
  {
    id: "research_scan",
    label: "Research Scan",
    description: "Research-oriented team run for external evidence and option comparison.",
    taskType: "research",
    subtype: "docs",
    task: "Research MyCodex product options, workflow patterns, and CLI integration risks.",
    goal: "Produce concise evidence-backed recommendations for the next iteration.",
    teamId: "mycodex_research"
  },
  {
    id: "docs_draft",
    label: "Docs Draft",
    description: "Writing workflow for requirement, design, and release note drafts.",
    taskType: "writing",
    subtype: "docs",
    task: "Draft MyCodex documentation from the current workspace state and implementation progress.",
    goal: "Produce a polished draft that can be reviewed and published quickly.",
    teamId: "mycodex_docs"
  },
  {
    id: "gitea_collab",
    label: "\u56e2\u961f\u534f\u4f5c / Gitea",
    description: "\u9762\u5411\u56e2\u961f\u5199\u4f5c\u3001\u79d1\u7814\u3001\u5f00\u53d1\u7684\u79c1\u6709\u5316\u534f\u4f5c\u6d41\u7a0b\uff0c\u4f18\u5148\u8d70 Gitea + Agent Teams\u3002",
    taskType: "coding",
    subtype: "docs",
    task: "\u57fa\u4e8e Gitea \u79c1\u6709\u5316\u4ed3\u5e93\u4e0e Agent Teams \u6784\u5efa\u56e2\u961f\u534f\u4f5c\u673a\u5236\uff0c\u8986\u76d6\u5199\u4f5c\u3001\u79d1\u7814\u548c\u4ee3\u7801\u5f00\u53d1\u3002",
    goal: "\u4ea7\u51fa\u53ef\u6267\u884c\u534f\u4f5c\u89c4\u8303\u3001\u53ef\u8ffd\u8e2a\u9879\u76ee\u6d41\u7a0b\u4e0e\u53ef\u56de\u6eda\u7248\u672c\u7ba1\u7406\u4f53\u7cfb\u3002",
    teamId: "mycodex_gitea_team"
  }
];
