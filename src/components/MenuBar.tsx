import { useState, useRef, useEffect } from "react";
import type { Project, RuntimeStatus, TaskType } from "../types";
import "./menubar.css";

export interface MenuBarProps {
  gwsCommand: string;
  setGwsCommand: (v: string) => void;
  onRunGws: () => void;
  lzcCommand: string;
  setLzcCommand: (v: string) => void;
  giteaAppName: string;
  setGiteaAppName: (v: string) => void;
  giteaBaseUrl: string;
  setGiteaBaseUrl: (v: string) => void;
  onRunLzc: () => void;
  onDeployGitea: () => void;
  giteaRepoUrl: string;
  setGiteaRepoUrl: (v: string) => void;
  gitTopic: string;
  setGitTopic: (v: string) => void;
  gitCommitType: string;
  setGitCommitType: (v: string) => void;
  gitSummary: string;
  setGitSummary: (v: string) => void;
  backupMessage: string;
  setBackupMessage: (v: string) => void;
  onInitGit: () => void;
  onBindRemote: () => void;
  onQuickFlow: () => void;
  onBackup: () => void;
  accountEmailDraft: string;
  setAccountEmailDraft: (v: string) => void;
  wechatIdDraft: string;
  setWechatIdDraft: (v: string) => void;
  onGoogleLogin: () => void;
  onWechatLogin: () => void;
  onBindAccount: () => void;
  teamId: string;
  setTeamId: (v: string) => void;
  taskType: TaskType;
  setTaskType: (v: TaskType) => void;
  subtype: string;
  setSubtype: (v: string) => void;
  onSaveSettings: () => void;
  runtimeStatus: RuntimeStatus | null;
  onRefreshRuntime: () => void;
  activeProject: Project | null;
  isBusy: boolean;
}

type OpenMenu = 'tools' | 'git' | 'settings' | null;

export function MenuBar(props: MenuBarProps) {
  const {
    gwsCommand, setGwsCommand, onRunGws,
    lzcCommand, setLzcCommand,
    giteaAppName, setGiteaAppName,
    giteaBaseUrl, setGiteaBaseUrl,
    onRunLzc, onDeployGitea,
    giteaRepoUrl, setGiteaRepoUrl,
    gitTopic, setGitTopic,
    gitCommitType, setGitCommitType,
    gitSummary, setGitSummary,
    backupMessage, setBackupMessage,
    onInitGit, onBindRemote, onQuickFlow, onBackup,
    accountEmailDraft, setAccountEmailDraft,
    wechatIdDraft, setWechatIdDraft,
    onGoogleLogin, onWechatLogin, onBindAccount,
    teamId, setTeamId,
    taskType, setTaskType,
    subtype, setSubtype,
    onSaveSettings,
    runtimeStatus, onRefreshRuntime,
    activeProject, isBusy,
  } = props;
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const menuBarRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (menuBarRef.current && !menuBarRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, []);
  function toggleMenu(name: OpenMenu) {
    setOpenMenu((prev) => (prev === name ? null : name));
  }
  return (
    <div className="menu-bar" ref={menuBarRef}>
      <div className="menu-bar-logo">MyCodex</div>
      <nav className="menu-bar-nav">
        {/* 工具菜单 */}
        <div className="menu-trigger-wrap">
          <button
            className={`menu-trigger${openMenu === 'tools' ? ' menu-trigger--active' : ''}`}
            onClick={() => toggleMenu('tools')}
            type="button"
          >
            工具
          </button>
          {openMenu === 'tools' && (
            <div className="menu-dropdown">
              <h3 className="menu-group-title">GWS 命令行</h3>
              <div className="menu-row">
                <input
                  className="menu-input"
                  value={gwsCommand}
                  onChange={(e) => setGwsCommand(e.target.value)}
                  placeholder="gws --help"
                  onKeyDown={(e) => e.key === 'Enter' && onRunGws()}
                />
              </div>
              <div className="menu-row menu-row--buttons">
                <button className="menu-btn" onClick={onRunGws}>运行</button>
                <button className="menu-btn ghost" onClick={() => setGwsCommand('gws auth login')}>认证</button>
                <button className="menu-btn ghost" onClick={() => setGwsCommand('gws --help')}>帮助</button>
              </div>
              <h3 className="menu-group-title">LZC 命令</h3>
              <div className="menu-row">
                <input
                  className="menu-input"
                  value={lzcCommand}
                  onChange={(e) => setLzcCommand(e.target.value)}
                  placeholder="lzc app ls"
                  onKeyDown={(e) => e.key === 'Enter' && onRunLzc()}
                />
              </div>
              <div className="menu-row menu-row--buttons">
                <button className="menu-btn" onClick={onRunLzc}>运行</button>
              </div>
              <h3 className="menu-group-title">Gitea 部署</h3>
              <div className="menu-row">
                <input className="menu-input" value={giteaAppName} onChange={(e) => setGiteaAppName(e.target.value)} placeholder="应用名称 (gitea)" />
              </div>
              <div className="menu-row">
                <input className="menu-input" value={giteaBaseUrl} onChange={(e) => setGiteaBaseUrl(e.target.value)} placeholder="基础 URL (https://gitea.example.com)" />
              </div>
              <div className="menu-row menu-row--buttons">
                <button className="menu-btn" onClick={onDeployGitea}>部署</button>
              </div>
            </div>
          )}
        </div>
        {/* Git 菜单 */}
        <div className="menu-trigger-wrap">
          <button
            className={`menu-trigger${openMenu === 'git' ? ' menu-trigger--active' : ''}`}
            onClick={() => toggleMenu('git')}
            type="button"
          >
            Git
          </button>
          {openMenu === 'git' && (
            <div className="menu-dropdown">
              <div className="menu-row menu-row--buttons">
                <button className="menu-btn" style={{ width: '100%' }} onClick={onInitGit}>初始化团队 Git</button>
              </div>
              <h3 className="menu-group-title">绑定远程</h3>
              <div className="menu-row">
                <input className="menu-input" value={giteaRepoUrl} onChange={(e) => setGiteaRepoUrl(e.target.value)} placeholder="Gitea 仓库 URL" />
              </div>
              <div className="menu-row menu-row--buttons">
                <button className="menu-btn" onClick={onBindRemote}>绑定</button>
              </div>
              <h3 className="menu-group-title">一键提交</h3>
              <div className="menu-row">
                <input className="menu-input" value={gitTopic} onChange={(e) => setGitTopic(e.target.value)} placeholder="Topic" />
              </div>
              <div className="menu-row">
                <select className="menu-input" value={gitCommitType} onChange={(e) => setGitCommitType(e.target.value)}>
                  <option value="feat">feat</option>
                  <option value="fix">fix</option>
                  <option value="docs">docs</option>
                  <option value="refactor">refactor</option>
                  <option value="chore">chore</option>
                  <option value="test">test</option>
                </select>
              </div>
              <div className="menu-row">
                <input className="menu-input" value={gitSummary} onChange={(e) => setGitSummary(e.target.value)} placeholder="提交摘要" />
              </div>
              <div className="menu-row menu-row--buttons">
                <button className="menu-btn" onClick={onQuickFlow}>执行</button>
              </div>
              <h3 className="menu-group-title">备份</h3>
              <div className="menu-row">
                <input className="menu-input" value={backupMessage} onChange={(e) => setBackupMessage(e.target.value)} placeholder="备份说明" />
              </div>
              <div className="menu-row menu-row--buttons">
                <button className="menu-btn" onClick={onBackup}>备份到 GitHub</button>
              </div>
            </div>
          )}
        </div>
        {/* 设置菜单 */}
        <div className="menu-trigger-wrap">
          <button
            className={`menu-trigger${openMenu === 'settings' ? ' menu-trigger--active' : ''}`}
            onClick={() => toggleMenu('settings')}
            type="button"
          >
            设置
          </button>
          {openMenu === 'settings' && (
            <div className="menu-dropdown menu-dropdown--right">
              <h3 className="menu-group-title">账号</h3>
              <div className="menu-row">
                <input className="menu-input" type="email" value={accountEmailDraft} onChange={(e) => setAccountEmailDraft(e.target.value)} placeholder="邮箱地址" />
              </div>
              <div className="menu-row">
                <input className="menu-input" value={wechatIdDraft} onChange={(e) => setWechatIdDraft(e.target.value)} placeholder="微信 ID" />
              </div>
              <div className="menu-row menu-row--buttons">
                <button className="menu-btn ghost" onClick={onGoogleLogin}>Google 登录</button>
                <button className="menu-btn ghost" onClick={onWechatLogin}>微信登录</button>
                <button className="menu-btn" onClick={onBindAccount}>绑定</button>
              </div>
              <h3 className="menu-group-title">运行环境</h3>
              {runtimeStatus ? (
                <ul className="menu-runtime-list">
                  <li className={`menu-runtime-item menu-runtime-item--${runtimeStatus.launcher.found ? 'ok' : 'miss'}`}>
                    <span>Launcher</span>
                    <span>{runtimeStatus.launcher.found ? '已就绪' : '未找到'}</span>
                  </li>
                  {runtimeStatus.tools.map((t) => (
                    <li key={t.tool} className={`menu-runtime-item menu-runtime-item--${t.found ? 'ok' : 'miss'}`}>
                      <span>{t.tool}</span>
                      <span title={t.detail}>{t.found ? '已就绪' : '未找到'}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="menu-muted">检测中…</p>
              )}
              <div className="menu-row menu-row--buttons">
                <button className="menu-btn ghost" onClick={onRefreshRuntime}>重新检测</button>
              </div>
              <h3 className="menu-group-title">高级</h3>
              <div className="menu-row">
                <input className="menu-input" value={teamId} onChange={(e) => setTeamId(e.target.value)} placeholder="Team ID" />
              </div>
              <div className="menu-row">
                <select className="menu-input" value={taskType} onChange={(e) => setTaskType(e.target.value as TaskType)}>
                  <option value="coding">coding</option>
                  <option value="research">research</option>
                  <option value="writing">writing</option>
                </select>
              </div>
              <div className="menu-row">
                <input className="menu-input" value={subtype} onChange={(e) => setSubtype(e.target.value)} placeholder="子类型 (docs)" />
              </div>
              <div className="menu-row menu-row--buttons">
                <button className="menu-btn" onClick={onSaveSettings}>保存</button>
              </div>
            </div>
          )}
        </div>
      </nav>
      <div className="menu-bar-status">
        {isBusy && <span className="menu-spinner" aria-label="busy" />}
        <span className="menu-project-name">
          {activeProject ? activeProject.manifest.displayName : '未选择项目'}
        </span>
      </div>
    </div>
  );
}
