import type { Project, TaskType } from "../types";
import { TEAM_PRESETS } from "../types";

export interface CenterPaneProps {
  activeProject: Project | null;
  isBusy: boolean;
  selectedPresetId: string;
  teamId: string;
  taskType: TaskType;
  subtype: string;
  task: string;
  goal: string;
  setTeamId: (value: string) => void;
  setTaskType: (value: TaskType) => void;
  setSubtype: (value: string) => void;
  setTask: (value: string) => void;
  setGoal: (value: string) => void;
  onApplyPreset: (presetId: string) => void;
  onRunTeam: (command: "run" | "resume" | "plan" | "status" | "open") => void;
  onSaveProjectSettings: () => void;
  accountEmailDraft: string;
  wechatIdDraft: string;
  setAccountEmailDraft: (value: string) => void;
  setWechatIdDraft: (value: string) => void;
  onStartGoogleLogin: () => void;
  onStartWechatLogin: () => void;
  onBindAccount: () => void;
  gwsCommand: string;
  setGwsCommand: (value: string) => void;
  onRunGws: () => void;
  lzcCommand: string;
  giteaAppName: string;
  giteaBaseUrl: string;
  setLzcCommand: (value: string) => void;
  setGiteaAppName: (value: string) => void;
  setGiteaBaseUrl: (value: string) => void;
  onRunLzc: () => void;
  onDeployGitea: () => void;
  giteaRepoUrl: string;
  backupMessage: string;
  gitTopic: string;
  gitCommitType: string;
  gitSummary: string;
  setGiteaRepoUrl: (value: string) => void;
  setBackupMessage: (value: string) => void;
  setGitTopic: (value: string) => void;
  setGitCommitType: (value: string) => void;
  setGitSummary: (value: string) => void;
  onInitGitTeamCollaboration: () => void;
  onBindGiteaRemote: () => void;
  onRunGitQuickFlow: () => void;
  onRunBackup: () => void;
}
export function CenterPane({
  activeProject,
  isBusy,
  selectedPresetId,
  teamId,
  taskType,
  subtype,
  task,
  goal,
  setTeamId,
  setTaskType,
  setSubtype,
  setTask,
  setGoal,
  onApplyPreset,
  onRunTeam,
  onSaveProjectSettings,
  accountEmailDraft,
  wechatIdDraft,
  setAccountEmailDraft,
  setWechatIdDraft,
  onStartGoogleLogin,
  onStartWechatLogin,
  onBindAccount,
  gwsCommand,
  setGwsCommand,
  onRunGws,
  lzcCommand,
  giteaAppName,
  giteaBaseUrl,
  setLzcCommand,
  setGiteaAppName,
  setGiteaBaseUrl,
  onRunLzc,
  onDeployGitea,
  giteaRepoUrl,
  backupMessage,
  gitTopic,
  gitCommitType,
  gitSummary,
  setGiteaRepoUrl,
  setBackupMessage,
  setGitTopic,
  setGitCommitType,
  setGitSummary,
  onInitGitTeamCollaboration,
  onBindGiteaRemote,
  onRunGitQuickFlow,
  onRunBackup,
}: CenterPaneProps) {
  const currentPreset = TEAM_PRESETS.find((preset) => preset.id === selectedPresetId);
  return (
      <main className="center-pane">
        <section className="panel">
          <div className="section-head">
            <h2>Default Agent Team</h2>
            <span className="pill">{currentPreset?.label ?? "custom"}</span>
          </div>
          <label>Preset</label>
          <select
            value={selectedPresetId}
            onChange={(e) => {
              applyPreset(e.target.value);
            }}
          >
            {TEAM_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
          </select>
          <p className="caption">{currentPreset?.description}</p>
          <label>Team ID</label>
          <input value={teamId} onChange={(e) => setTeamId(e.target.value)} />
          <div className="field-grid">
            <div>
              <label>Task Type</label>
              <select value={taskType} onChange={(e) => setTaskType(e.target.value as TaskType)}>
                <option value="coding">coding</option>
                <option value="research">research</option>
                <option value="writing">writing</option>
              </select>
            </div>
            <div>
              <label>Subtype</label>
              <input value={subtype} onChange={(e) => setSubtype(e.target.value)} />
            </div>
          </div>
          <label>Task</label>
          <textarea rows={4} value={task} onChange={(e) => setTask(e.target.value)} />
          <label>Goal</label>
          <textarea rows={4} value={goal} onChange={(e) => setGoal(e.target.value)} />
          <div className="row-buttons">
            <button onClick={() => onRunTeam("plan")} disabled={isBusy}>
              Team Plan
            </button>
            <button onClick={() => onRunTeam("run")} disabled={isBusy}>
              Team Run
            </button>
            <button onClick={() => onRunTeam("resume")} disabled={isBusy}>
              Resume
            </button>
            <button onClick={() => onRunTeam("status")} disabled={isBusy}>
              Status
            </button>
            <button onClick={() => onSaveProjectSettings()} disabled={!activeProject || isBusy}>
              Save Project Defaults
            </button>
          </div>
        </section>

        <section className="panel split-panel">
          <div className="subpanel">
            <div className="section-head">
              <h2>账号登录</h2>
              <span className={`pill state-${activeProject?.manifest.authStatus ?? "not_started"}`}>
                {activeProject?.manifest.authStatus ?? "not_started"}
              </span>
            </div>
            <label>Gmail account</label>
            <input
              value={accountEmailDraft}
              placeholder="name@gmail.com"
              onChange={(e) => setAccountEmailDraft(e.target.value)}
            />
            <label>Wechat ID (for team sync)</label>
            <input
              value={wechatIdDraft}
              placeholder="wechat id"
              onChange={(e) => setWechatIdDraft(e.target.value)}
            />
            <div className="row-buttons">
              <button onClick={() => onStartGoogleLogin()} disabled={!activeProject || isBusy}>
                Open Google Login
              </button>
              <button onClick={() => onStartWechatLogin()} disabled={!activeProject || isBusy}>
                Open WeChat Login
              </button>
              <button onClick={() => onBindAccount()} disabled={!activeProject || isBusy}>
                Bind Account IDs
              </button>
            </div>
            <p className="caption">MVP stores Gmail/WeChat IDs in project metadata for local-team sync mapping.</p>
          </div>

          <div className="subpanel">
            <div className="section-head">
              <h2>GWS CLI</h2>
              <span className="pill">CLI</span>
            </div>
            <label>Command</label>
            <input value={gwsCommand} onChange={(e) => setGwsCommand(e.target.value)} />
            <div className="row-buttons">
              <button onClick={() => onRunGws()} disabled={isBusy}>
                Run GWS
              </button>
              <button onClick={() => setGwsCommand("gws auth login")} disabled={isBusy}>
                Auth Login
              </button>
              <button onClick={() => setGwsCommand("gws --help")} disabled={isBusy}>
                Help
              </button>
            </div>
          </div>

          <div className="subpanel">
            <div className="section-head">
              <h2>LZC + Gitea</h2>
              <span className="pill">private</span>
            </div>
            <label>lzc command</label>
            <input value={lzcCommand} onChange={(e) => setLzcCommand(e.target.value)} />
            <label>Gitea app name</label>
            <input value={giteaAppName} onChange={(e) => setGiteaAppName(e.target.value)} />
            <label>Gitea base URL</label>
            <input
              value={giteaBaseUrl}
              placeholder="https://your-gitea.local"
              onChange={(e) => setGiteaBaseUrl(e.target.value)}
            />
            <div className="row-buttons">
              <button onClick={() => onRunLzc()} disabled={isBusy}>
                Run LZC
              </button>
              <button onClick={() => onDeployGitea()} disabled={isBusy}>
                Deploy Gitea
              </button>
            </div>
          </div>

          <div className="subpanel">
            <div className="section-head">
              <h2>Git 协作与备份</h2>
              <span className="pill">git</span>
            </div>
            <label>Gitea repo URL</label>
            <input
              value={giteaRepoUrl}
              placeholder="https://gitea.example.com/team/mycodex.git"
              onChange={(e) => setGiteaRepoUrl(e.target.value)}
            />
            <label>Commit message</label>
            <input value={backupMessage} onChange={(e) => setBackupMessage(e.target.value)} />
            <label>Branch topic</label>
            <input value={gitTopic} onChange={(e) => setGitTopic(e.target.value)} />
            <label>Commit type</label>
            <select value={gitCommitType} onChange={(e) => setGitCommitType(e.target.value)}>
              <option value="feat">feat</option>
              <option value="fix">fix</option>
              <option value="docs">docs</option>
              <option value="research">research</option>
              <option value="chore">chore</option>
            </select>
            <label>Commit summary</label>
            <input value={gitSummary} onChange={(e) => setGitSummary(e.target.value)} />
            <div className="row-buttons">
              <button onClick={() => onInitGitTeamCollaboration()} disabled={!activeProject || isBusy}>
                Init Team Git Flow
              </button>
              <button onClick={() => onBindGiteaRemote()} disabled={!activeProject || isBusy}>
                Bind Gitea Remote
              </button>
              <button onClick={() => onRunGitQuickFlow()} disabled={!activeProject || isBusy}>
                Quick Branch + Commit + Push
              </button>
            </div>
            <button onClick={() => onRunBackup()} disabled={!activeProject || isBusy}>
              Backup To GitHub
            </button>
            <p className="caption">
              Supports private Gitea remote for team collaboration, while keeping GitHub backup for external redundancy.
            </p>
          </div>
        </section>
      </main>
  );
}
