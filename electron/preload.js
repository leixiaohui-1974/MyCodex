const { contextBridge, ipcRenderer } = require("electron");

// RED-1: Basic parameter validation before IPC calls
function assertString(value, name) {
  if (value !== undefined && value !== null && typeof value !== "string") {
    throw new TypeError(`${name} must be a string`);
  }
}

function assertObject(value, name) {
  if (value === null || typeof value !== "object") {
    throw new TypeError(`${name} must be an object`);
  }
}

function sanitizeName(name) {
  const str = String(name || "").trim();
  if (str && !/^[a-zA-Z0-9\u4E00-\u9FFF\u3000-\u303F _.-]{1,64}$/u.test(str)) {
    throw new Error("Project name contains invalid characters or is too long (max 64).");
  }
  return str;
}

contextBridge.exposeInMainWorld("mycodex", {
  listProjects: (root) => {
    assertString(root, "root");
    return ipcRenderer.invoke("projects:list", root);
  },
  createProject: (root, name) => {
    assertString(root, "root");
    const safeName = sanitizeName(name);
    return ipcRenderer.invoke("projects:create", root, safeName);
  },
  updateProjectManifest: (projectPath, manifest) => {
    assertString(projectPath, "projectPath");
    assertObject(manifest, "manifest");
    return ipcRenderer.invoke("projects:update-manifest", projectPath, manifest);
  },
  runTeam: (payload) => {
    assertObject(payload, "payload");
    return ipcRenderer.invoke("team:run", payload);
  },
  runGws: (payload) => {
    assertObject(payload, "payload");
    return ipcRenderer.invoke("gws:run", payload);
  },
  runLzc: (payload) => {
    assertObject(payload, "payload");
    return ipcRenderer.invoke("lzc:run", payload);
  },
  deployGitea: (payload) => {
    assertObject(payload, "payload");
    return ipcRenderer.invoke("gitea:deploy", payload);
  },
  initGitTeamFlow: (payload) => {
    assertObject(payload, "payload");
    return ipcRenderer.invoke("git:team:init", payload);
  },
  bindGiteaRemote: (payload) => {
    assertObject(payload, "payload");
    return ipcRenderer.invoke("git:gitea:bind-remote", payload);
  },
  runGitTeamQuickFlow: (payload) => {
    assertObject(payload, "payload");
    return ipcRenderer.invoke("git:team:quick-flow", payload);
  },
  backupGithub: (payload) => {
    assertObject(payload, "payload");
    return ipcRenderer.invoke("backup:github", payload);
  },
  runtimeStatus: () => ipcRenderer.invoke("runtime:status"),
  listArtifacts: (projectPath) => {
    assertString(projectPath, "projectPath");
    return ipcRenderer.invoke("artifacts:list", projectPath);
  },
  readArtifact: (targetPath, projectRoot) => {
    assertString(targetPath, "targetPath");
    assertString(projectRoot, "projectRoot");
    return ipcRenderer.invoke("artifacts:read", targetPath, projectRoot);
  },
  startGoogleAuth: () => ipcRenderer.invoke("auth:google:start"),
  startWechatAuth: () => ipcRenderer.invoke("auth:wechat:start"),
  openFile: (targetPath) => {
    assertString(targetPath, "targetPath");
    return ipcRenderer.invoke("file:open", targetPath);
  }
});
