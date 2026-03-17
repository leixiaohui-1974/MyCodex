import { TEAM_PRESETS } from "../types";

export interface PresetBarProps {
  selectedPresetId: string;
  task: string;
  goal: string;
  setTask: (v: string) => void;
  setGoal: (v: string) => void;
  onApplyPreset: (id: string) => void;
  onRunTeam: (cmd: "run" | "resume" | "plan" | "status" | "open") => void;
  isBusy: boolean;
  activeProject: { manifest: { displayName: string } } | null;
}

export function PresetBar({
  selectedPresetId,
  task,
  goal,
  setTask,
  setGoal,
  onApplyPreset,
  onRunTeam,
  isBusy,
  activeProject,
}: PresetBarProps) {
  return (
    <div className="preset-bar-wrapper">
      <div className="preset-bar">
        <select
          className="preset-select"
          value={selectedPresetId}
          onChange={(e) => onApplyPreset(e.target.value)}
          disabled={isBusy}
          title="选择预设方案"
        >
          {TEAM_PRESETS.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.label}
            </option>
          ))}
        </select>

        {activeProject && (
          <span className="preset-bar-project" title="当前项目">
            {activeProject.manifest.displayName}
          </span>
        )}

        <div className="preset-bar-actions">
          <button
            className="primary-action"
            onClick={() => onRunTeam("run")}
            disabled={isBusy}
            title="执行团队任务"
          >
            {isBusy ? "执行中…" : "执行"}
          </button>
          <button
            className="ghost"
            onClick={() => onRunTeam("plan")}
            disabled={isBusy}
            title="生成执行计划"
          >
            计划
          </button>
          <button
            className="ghost"
            onClick={() => onRunTeam("resume")}
            disabled={isBusy}
            title="继续上次任务"
          >
            继续
          </button>
          <button
            className="ghost"
            onClick={() => onRunTeam("status")}
            disabled={isBusy}
            title="查看当前状态"
          >
            状态
          </button>
        </div>
      </div>

      <details className="task-detail-toggle">
        <summary>编辑任务描述</summary>
        <div className="task-detail-body">
          <textarea
            rows={2}
            placeholder="任务描述..."
            value={task}
            onChange={(e) => setTask(e.target.value)}
            disabled={isBusy}
            spellCheck={false}
          />
          <textarea
            rows={2}
            placeholder="目标..."
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            disabled={isBusy}
            spellCheck={false}
          />
        </div>
      </details>
    </div>
  );
}
