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
            <h2>Agent Team</h2>
            <span className="pill">{currentPreset?.label ?? "自定义"}</span>
          </div>
          <select
            value={selectedPresetId}
            onChange={(e) => {
              onApplyPreset(e.target.value);
            }}
          >
            {TEAM_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
          </select>
          <div className="row-buttons">
            <button onClick={() => onRunTeam("run")} disabled={isBusy}>
              开始执行
            </button>
            <button onClick={() => onRunTeam("plan")} disabled={isBusy}>
              生成计划
            </button>
            <button onClick={() => onRunTeam("resume")} disabled={isBusy}>
              继续
            </button>
            <button onClick={() => onRunTeam("status")} disabled={isBusy}>
              状态
            </button>
          </div>

          <details className="accordion-item">
            <summary className="accordion-header">
              <span>任务详情</span>
              <span className="caption">{task.length > 20 ? task.slice(0, 20) + "…" : task}</span>
            </summary>
            <div className="accordion-body">
              <label>任务描述</label>
              <textarea rows={3} value={task} onChange={(e) => setTask(e.target.value)} />
              <label>目标</label>
              <textarea rows={3} value={goal} onChange={(e) => setGoal(e.target.value)} />
            </div>
          </details>

          <details className="accordion-item">
            <summary className="accordion-header">
              <span>高级设置</span>
              <span className="pill">{taskType}</span>
            </summary>
            <div className="accordion-body">
              <label>Team ID</label>
              <input value={teamId} onChange={(e) => setTeamId(e.target.value)} />
              <div className="field-grid">
                <div>
                  <label>任务类型</label>
                  <select value={taskType} onChange={(e) => setTaskType(e.target.value as TaskType)}>
                    <option value="coding">编码开发</option>
                    <option value="research">文献调研</option>
                    <option value="writing">文档写作</option>
                  </select>
                </div>
                <div>
                  <label>子类型</label>
                  <input value={subtype} onChange={(e) => setSubtype(e.target.value)} />
                </div>
              </div>
              <button onClick={() => onSaveProjectSettings()} disabled={!activeProject || isBusy}>
                保存项目默认值
              </button>
            </div>
          </details>
        </section>

        <section className="panel accordion-panel">
          <details className="accordion-item">
            <summary className="accordion-header">
              <h2>账号登录</h2>
              <span className={`pill state-${activeProject?.manifest.authStatus ?? "not_started"}`}>
                {activeProject?.manifest.authStatus ?? "未开始"}
              </span>
            </summary>
            <div className="accordion-body">
              <label>Gmail 账号</label>
              <input
                value={accountEmailDraft}
                placeholder="name@gmail.com"
                onChange={(e) => setAccountEmailDraft(e.target.value)}
              />
              <label>微信 ID（团队同步用）</label>
              <input
                value={wechatIdDraft}
                placeholder="微信 ID"
                onChange={(e) => setWechatIdDraft(e.target.value)}
              />
              <div className="row-buttons">
                <button onClick={() => onStartGoogleLogin()} disabled={!activeProject || isBusy}>
                  Google 登录
                </button>
                <button onClick={() => onStartWechatLogin()} disabled={!activeProject || isBusy}>
                  微信登录
                </button>
                <button onClick={() => onBindAccount()} disabled={!activeProject || isBusy}>
                  绑定账号
                </button>
              </div>
              <p className="caption">MVP 版本将 Gmail/微信 ID 存储在项目元数据中，用于本地团队同步映射。</p>
            </div>
          </details>

          <details className="accordion-item">
            <summary className="accordion-header">
              <h2>GWS 命令行</h2>
              <span className="pill">CLI</span>
            </summary>
            <div className="accordion-body">
              <label>命令</label>
              <input value={gwsCommand} onChange={(e) => setGwsCommand(e.target.value)} />
              <div className="row-buttons">
                <button onClick={() => onRunGws()} disabled={isBusy}>
                  运行 GWS
                </button>
                <button onClick={() => setGwsCommand("gws auth login")} disabled={isBusy}>
                  认证登录
                </button>
                <button onClick={() => setGwsCommand("gws --help")} disabled={isBusy}>
                  帮助
                </button>
              </div>
            </div>
          </details>

          <details className="accordion-item">
            <summary className="accordion-header">
              <h2>LZC + Gitea</h2>
              <span className="pill">私有部署</span>
            </summary>
            <div className="accordion-body">
              <label>LZC 命令</label>
              <input value={lzcCommand} onChange={(e) => setLzcCommand(e.target.value)} />
              <label>Gitea 应用名</label>
              <input value={giteaAppName} onChange={(e) => setGiteaAppName(e.target.value)} />
              <label>Gitea 地址</label>
              <input
                value={giteaBaseUrl}
                placeholder="https://your-gitea.local"
                onChange={(e) => setGiteaBaseUrl(e.target.value)}
              />
              <div className="row-buttons">
                <button onClick={() => onRunLzc()} disabled={isBusy}>
                  运行 LZC
                </button>
                <button onClick={() => onDeployGitea()} disabled={isBusy}>
                  部署 Gitea
                </button>
              </div>
            </div>
          </details>

          <details className="accordion-item">
            <summary className="accordion-header">
              <h2>Git 协作与备份</h2>
              <span className="pill">git</span>
            </summary>
            <div className="accordion-body">
              <label>Gitea 仓库地址</label>
              <input
                value={giteaRepoUrl}
                placeholder="https://gitea.example.com/team/mycodex.git"
                onChange={(e) => setGiteaRepoUrl(e.target.value)}
              />
              <label>提交信息</label>
              <input value={backupMessage} onChange={(e) => setBackupMessage(e.target.value)} />
              <label>分支主题</label>
              <input value={gitTopic} onChange={(e) => setGitTopic(e.target.value)} />
              <label>提交类型</label>
              <select value={gitCommitType} onChange={(e) => setGitCommitType(e.target.value)}>
                <option value="feat">feat (新功能)</option>
                <option value="fix">fix (修复)</option>
                <option value="docs">docs (文档)</option>
                <option value="research">research (调研)</option>
                <option value="chore">chore (维护)</option>
              </select>
              <label>提交摘要</label>
              <input value={gitSummary} onChange={(e) => setGitSummary(e.target.value)} />
              <div className="row-buttons">
                <button onClick={() => onInitGitTeamCollaboration()} disabled={!activeProject || isBusy}>
                  初始化团队 Git
                </button>
                <button onClick={() => onBindGiteaRemote()} disabled={!activeProject || isBusy}>
                  绑定 Gitea 远程
                </button>
                <button onClick={() => onRunGitQuickFlow()} disabled={!activeProject || isBusy}>
                  一键建分支 + 提交 + 推送
                </button>
              </div>
              <button onClick={() => onRunBackup()} disabled={!activeProject || isBusy}>
                备份到 GitHub
              </button>
              <p className="caption">
                支持私有 Gitea 远程仓库用于团队协作，同时保留 GitHub 备份用于外部冗余。
              </p>
            </div>
          </details>
        </section>
      </main>
  );
}
