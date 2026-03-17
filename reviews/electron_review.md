# Electron 安全性与架构评审报告

**项目**: MyCodex Desktop (mycodex-desktop v0.1.0)
**评审文件**: electron/main.js (1284行) / electron/preload.js (88行) / electron/shared.js (374行)
**Electron 版本**: ^33.0.0
**评审日期**: 2026-03-17
**评审员**: CHS Agent Teams 多引擎并发评审

---

## 执行摘要

整体安全基线**良好**。contextIsolation:true + nodeIntegration:false + contextBridge 组合正确实施了 Electron 现代安全模型。主要风险集中在：主进程 IPC 层缺乏路径白名单校验（RED-1/3/4）、deployGitea 拼接 Shell 字符串（RED-2）、shared.js 与 main.js 代码重复（YELLOW-5）。4 项严重问题的修复均为低难度——核心模式（isPathWithinRoots）已在 artifacts:read 中实现，只需推广应用。

---

## 严重问题（必须修复）

### RED-1  projects:list / projects:create 接受任意 rootDir，无路径边界校验

**位置**: main.js 第 1179-1204 行

**风险**: 渲染进程（或被 XSS 污染的 Web 内容）可传入任意路径（如 C:/Windows/System32），导致：
- 目录遍历泄露敏感目录结构
- ensureDir 在系统目录下意外创建子目录
- projects:create 在任意路径下写入文件和 manifest

**根本原因**: ipcMain.handle("projects:list") 直接使用渲染进程传入的 rootDir，仅做空值回退，未调用 isPathWithinRoots 进行边界校验。

**修复方案**: 新增辅助函数，在所有接受路径参数的 Handler 入口统一调用：
```js
function assertWithinAllowedRoot(inputPath) {
  const resolved = path.resolve(inputPath);
  if (!isPathWithinRoots(resolved, [DEFAULT_PROJECTS_ROOT])) {
    throw new Error("Access denied: path is outside allowed projects root.");
  }
  return resolved;
}

ipcMain.handle("projects:list", async (_event, rootDir) => {
  const root = rootDir ? assertWithinAllowedRoot(rootDir) : DEFAULT_PROJECTS_ROOT;
  // 其余逻辑不变
```

### RED-2  deployGitea 中 appName / image 参数直接拼接进 Shell 命令字符串

**位置**: main.js 第 593-647 行

**问题**: runShell 使用 shell:true 执行拼接字符串。即使经过 quoteArg 转义，Windows cmd.exe 规则极为复杂，quoteArg 仅覆盖部分特殊字符（缺少反引号、换行符、分号等）。精心构造的 appName（如 "x & calc.exe"）在某些 Windows 版本下仍可能绕过转义执行任意命令。

**修复方案**: 改用 runCmd（shell:false）+ 数组参数，OS 级别保证参数隔离：
```js
// 替换: const create = await runShell(giteaCmd, cwd)
const result = await runCmd(
  "lzc",
  ["app", "create", appName, "--image", image],
  cwd
);
```
同理，checkCmd("lzc app ls") 也应改为 runCmd("lzc", ["app", "ls"], cwd)。

### RED-3  artifacts:list 的 projectPath 参数无路径边界校验

**位置**: main.js 第 1232-1237 行

**风险**: scanArtifacts 递归遍历传入路径下最多 5 层目录，返回所有匹配预览扩展名的文件路径和元数据。攻击者可通过此接口枚举任意目录的文件结构（包括 %USERPROFILE%、系统目录等）。

**修复方案**:
```js
ipcMain.handle("artifacts:list", async (_event, projectPath) => {
  if (!projectPath) return { ok: false, error: "No project path provided.", artifacts: [] };
  if (!isPathWithinRoots(projectPath, [DEFAULT_PROJECTS_ROOT])) {
    return { ok: false, error: "Access denied: path is outside project directory.", artifacts: [] };
  }
  return { ok: true, artifacts: scanArtifacts(projectPath) };
});
```

### RED-4  Git 系列 IPC Handler 的 projectPath 无路径边界校验

**位置**: main.js 第 649-1110 行（initGitTeamFlow / bindGiteaRemote / runGitTeamQuickFlow / runGitBackup）

**风险**: 渲染进程可将任意目录作为 git 操作目标：
- 对系统关键目录执行 git add -A + git commit（如 C:/Windows）
- 通过 git push 将敏感文件推送到攻击者控制的远程仓库

**修复方案**: 在四个函数入口统一调用 assertWithinAllowedRoot(payload.projectPath)，校验失败时提前返回错误对象。

---

## 建议改进

### YELLOW-1  checkToolAvailability 使用 shell:true 执行 where <tool>

**位置**: main.js 第 1112-1120 行

当前 tool 参数来自硬编码列表，无即时风险，但函数签名接受任意字符串，未来扩展时将引入注入风险。建议改为：
```js
const probe = await runCmd("where", [tool], process.cwd());
```

### YELLOW-2  runTeamCommand 的 payload 字段无长度限制

**位置**: main.js 第 432-486 行

payload.task、payload.goal 直接作为命令行参数传入外部进程。Windows CreateProcess 命令行上限约 32767 字符，超长输入可能导致进程启动失败且无明确错误提示。建议对 task/goal 字段增加最大长度校验（建议 2000 字符）。

### YELLOW-3  sandbox 选项未显式配置

**位置**: main.js 第 1149-1153 行

Electron 33 默认 sandbox:true（自 Electron 20 起），当前行为正确，但未显式声明。建议在 webPreferences 中明确写入 sandbox:true，记录安全意图，防止团队成员未来误降级（如临时关闭用于调试后忘记恢复）。

### YELLOW-4  生产包建议禁用 DevTools

**位置**: main.js createWindow() 函数

开发模式下 DevTools 可手动打开并直接调用 window.mycodex.* 的所有 IPC API。建议在 app.isPackaged 条件下监听 devtools-opened 事件并关闭：
```js
if (app.isPackaged) {
  mainWindow.webContents.on("devtools-opened", () => {
    mainWindow.webContents.closeDevTools();
  });
}
```

### YELLOW-5  shared.js 与 main.js 代码重复，main.js 未使用 shared.js

shared.js 导出完整工具函数集，但 main.js 完全未 require 它，独立维护了一份实现。两份实现存在显著差异：

| 函数 | main.js | shared.js | 差异 |
|------|---------|-----------|------|
| runShell / runCmd | 有 timeoutMs 参数 | 无超时控制 | main.js 更完整 |
| looksLikeMojibake | 基于 CJK 比例统计 | 基于 Unicode 替换字符检测 | 算法不同 |
| detectMissingBinary | (tool, result, preKnownMissing) | (result, toolName) | 参数顺序不同 |

**建议**: 明确 shared.js 实际用途（疑似供 server/ 目录使用），主进程专用工具提取为 electron/utils.js 并在 main.js 中统一引用，消除重复和 bug 分叉风险。

### YELLOW-6  preload.js 的 sanitizeName 正则覆盖不足

**位置**: preload.js 第 18 行

正则仅允许基本 CJK 统一汉字（U+4E00-9FFF）和 CJK 标点（U+3000-303F），不支持片假名、平假名、韩文、CJK 扩展 A/B 区生僻字，会误拒日韩用户的合法项目名。建议改为「不含路径危险字符」的负向匹配策略。

### YELLOW-7  file:open Handler 存在 TOCTOU 符号链接竞态

**位置**: main.js 第 1267-1283 行

safeStat 判断 isDir 与 shell.openPath 执行之间存在竞态窗口，符号链接可能在校验后被替换指向系统文件。建议使用 fs.realpathSync 解析真实路径后再做边界校验：
```js
let realResolved;
try { realResolved = fs.realpathSync(resolved); }
catch { return { ok: false, error: "Path resolution failed." }; }
if (!isPathWithinRoots(realResolved, [DEFAULT_PROJECTS_ROOT])) { ... }
```

### YELLOW-8  runtimeStatusCache 全局单例无过期机制

**位置**: main.js 第 38 行、第 1122-1141 行

工具安装状态缓存写入后永不过期，用户在运行期间安装 git、gws 等工具后界面始终显示未安装。建议增加 60 秒 TTL：
```js
let runtimeStatusCacheTime = 0;
const CACHE_TTL_MS = 60 * 1000;
// 在 getRuntimeStatus 入口判断:
// if (runtimeStatusCache && Date.now() - runtimeStatusCacheTime < CACHE_TTL_MS)
//   return runtimeStatusCache;
```

---

## 做得好的地方

### GREEN-1  contextIsolation + nodeIntegration 配置正确

contextIsolation:true + nodeIntegration:false 符合 Electron 现代安全最佳实践，完全隔离渲染进程与 Node.js 运行时，是安全架构的正确基础。

### GREEN-2  contextBridge API 面设计合理，暴露接口最小化

preload.js 仅暴露具名方法对象（window.mycodex）而非 ipcRenderer 本身，防止渲染进程发送任意 IPC 消息。每个方法有明确的类型前置断言（assertString / assertObject），在到达主进程前过滤非法类型。

### GREEN-3  artifacts:read 有完整路径边界校验（应作为所有 Handler 的范例）

```js
const allowedRoots = [projectRoot, DEFAULT_PROJECTS_ROOT].filter(Boolean);
if (!isPathWithinRoots(targetPath, allowedRoots)) {
  return { ok: false, error: "Access denied: path is outside project directory." };
}
```
isPathWithinRoots 使用 path.resolve + path.sep 精确匹配，正确防止 ../../../etc/passwd 类路径遍历。此模式应推广到所有接受路径参数的 Handler（即 RED-1/3/4 的修复目标）。

### GREEN-4  大多数命令执行使用 runCmd（shell:false）防止 Shell 注入

git 操作、gws/lzc 调用均通过 spawn 数组参数形式执行，OS 级别保证参数隔离，从根本上防止 Shell 注入。RED-2 的修复只需将 deployGitea 中的 runShell 调用改为 runCmd，保持架构一致性。

### GREEN-5  auth Handler 使用硬编码 URL，防止协议注入

代码注释明确说明设计意图（S-4: Hardcoded URL, ignore user-provided URLs to prevent protocol abuse），防止 javascript: 协议注入和任意 URL 重定向攻击。

### GREEN-6  manifest 写入使用原子操作（先写 .tmp 再 rename）

防止应用崩溃时 manifest 被写成半截损坏状态，是文件持久化的最佳实践。

### GREEN-7  输出缓冲区有 512KB 硬性上限，防止内存耗尽

appendCapped 确保长时间运行的命令不会因输出过多耗尽主进程内存，且向调用方明确警告截断情况，防止静默数据丢失。

### GREEN-8  scanArtifacts 递归深度限制为 5 层，ignoreDirs 排除大型目录

防止 node_modules、.git 等超大目录造成性能问题，depth>5 防止符号链接环导致无限递归。

### GREEN-9  sanitizeManifest 对枚举字段进行白名单校验

authStatus 和 selectedPresetId 通过 Set.has() 白名单验证，防止非法枚举值注入业务逻辑。

---

## 优先级汇总表

| 编号 | 类型 | 问题 | 影响面 | 修复难度 |
|------|------|------|--------|----------|
| RED-1 | 严重 | projects:list/create 接受任意 rootDir | 文件系统枚举/写入 | 低 |
| RED-2 | 严重 | deployGitea Shell 拼接注入风险 | 任意命令执行 | 低 |
| RED-3 | 严重 | artifacts:list 无路径校验 | 文件系统枚举 | 低 |
| RED-4 | 严重 | Git 系列操作 projectPath 无路径校验 | 任意目录 git 操作 | 低 |
| YELLOW-1 | 建议 | checkToolAvailability 用 shell:true | 潜在注入 | 低 |
| YELLOW-2 | 建议 | payload 字段无长度限制 | 命令行溢出 | 低 |
| YELLOW-3 | 建议 | sandbox 未显式声明 | 代码意图不清晰 | 极低 |
| YELLOW-4 | 建议 | 生产包未禁用 DevTools | 接口暴露 | 低 |
| YELLOW-5 | 建议 | shared.js 与 main.js 代码重复 | 维护风险/bug 分叉 | 中 |
| YELLOW-6 | 建议 | sanitizeName 正则覆盖不足 | 用户体验 | 低 |
| YELLOW-7 | 建议 | file:open 符号链接竞态 | 路径绕过 | 低 |
| YELLOW-8 | 建议 | runtimeStatusCache 无过期机制 | 功能准确性 | 低 |

---

## 架构建议：main.js 拆分方案

1284 行的 main.js 建议按以下职责拆分，每个模块控制在 80-200 行，便于单元测试和代码审查：

```
electron/
  main.js                  # 入口：app 生命周期 + ipcMain 注册 (~150行)
  handlers/
    projects.js            # projects:list / create / update-manifest
    artifacts.js           # artifacts:list / read
    git.js                 # git:team:init / quick-flow / bind-remote / backup
    team.js                # team:run / gws:run / lzc:run / gitea:deploy
    auth.js                # auth:google:start / auth:wechat:start / file:open
    runtime.js             # runtime:status
  utils/
    paths.js               # isPathWithinRoots / assertWithinAllowedRoot
    shell.js               # runCmd / runShell / quoteArg / parseCommandLine
    manifest.js            # readManifest / writeManifest / sanitizeManifest
    artifacts-scan.js      # scanArtifacts / readArtifactContent
  preload.js               # 不变
```

---

*报告由 CHS Agent Teams 多引擎并发评审生成 | 评审模型: claude-sonnet-4-6*

