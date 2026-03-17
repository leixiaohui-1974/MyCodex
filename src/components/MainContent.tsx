import { PresetBar, type PresetBarProps } from "./PresetBar";
import { ResultPanel, type ResultPanelProps } from "./ResultPanel";

export type { PresetBarProps };
export type MainContentProps = PresetBarProps & ResultPanelProps;

export function MainContent(props: MainContentProps) {
  return (
    <main className="main-content">
      <PresetBar
        selectedPresetId={props.selectedPresetId}
        task={props.task}
        goal={props.goal}
        setTask={props.setTask}
        setGoal={props.setGoal}
        onApplyPreset={props.onApplyPreset}
        onRunTeam={props.onRunTeam}
        isBusy={props.isBusy}
        activeProject={props.activeProject}
      />
      <ResultPanel
        previewTab={props.previewTab}
        setPreviewTab={props.setPreviewTab}
        timeline={props.timeline}
        logs={props.logs}
        preview={props.preview}
        mergePreview={props.mergePreview}
        activeProjectPath={props.activeProjectPath}
        onRefreshPreview={props.onRefreshPreview}
        onOpenPreviewFile={props.onOpenPreviewFile}
        artifacts={props.artifacts}
        artifactGroups={props.artifactGroups}
        selectedArtifactPath={props.selectedArtifactPath}
        onScanArtifacts={props.onScanArtifacts}
        onOpenArtifact={props.onOpenArtifact}
        onOpenMergePair={props.onOpenMergePair}
        activeProject={props.activeProject}
      />
    </main>
  );
}
