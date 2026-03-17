# MyCodex 前端代码质量评审报告

**评审日期**：2026-03-17
**评审范围**：src/App.tsx / src/main.tsx / src/mycodex.d.ts / src/transport/ / src/styles.css
**评审框架**：六路并发视角（工程师 / 架构 / 逻辑 / 规范 / 创新 / 安全）Map-Reduce 整合

---

## 一、评审总览

| 维度 | 评级 | 一句话结论 |
|------|------|-----------|
| 组件拆分 | 高风险 | 1256 行单组件，违反单一职责，必须拆分 |
| 状态管理 | 中风险 | 22+ 个顶层 useState，缺乏分组/归约策略 |
| 类型安全 | 中风险 | 类型三重定义且互不引用；多处 as 强转绕过类型检查 |
| 错误处理 | 中风险 | showError 竞态；初始化 useEffect 无异常捕获 |
| 性能 | 低风险 | renderMarkdown 每次重算；withLineNumbers 串联慢 |
| 可维护性 | 高风险 | 直接调用 window.mycodex；全局 CSS 无作用域隔离 |
| 传输层设计 | 优 | 接口抽象清晰，IPC/HTTP 双实现，工厂自动检测环境 |

---

## 二、严重问题（必须修复）

### 红色-1：App.tsx 是 1256 行的神组件，必须拆分

**共识视角**：工程师 + 架构 + 逻辑 三路标记（必修）

整个应用所有 UI、业务逻辑、数据获取、辅助函数全部堆在一个组件函数内。

**影响**：
- 任意状态变化均触发整棵树重新评估，所有子视图强耦合
- 无法针对单一功能写单元测试
- PR diff 噪声极大，Code Review 几乎不可行

**建议拆分结构**：

    src/
      components/
        ProjectPanel/        左侧项目列表 + 运行时状态
        TeamTaskPanel/       中央 Agent Team 任务配置
        AuthPanel/           账号登录子面板
        GwsPanel/            GWS CLI 子面板
        LzcGiteaPanel/       LZC + Gitea 子面板
        GitCollabPanel/      Git 协作与备份子面板
        PreviewPane/         右侧预览区
        ArtifactList/        Artifacts 列表
        MergeView/           Diff 对比视图
      hooks/
        useProjects.ts       项目加载 / 创建 / 刷新
        useArtifacts.ts      产物扫描 / 预览
        useTeamRun.ts        团队执行 + Timeline
        useRuntimeStatus.ts  运行时状态
      types/                 统一类型

---

### 红色-2：window.mycodex 直接调用，完全绕过已有 Transport 抽象层

**共识视角**：架构 + 工程师 + 规范 三路标记（必修）

项目已有设计精良的 src/transport/ 抽象层（IpcTransport / HttpTransport / createTransport()），但 App.tsx 全文约 20+ 处直接调用 window.mycodex.*，完全绕过该层。

代表性位置：
- 第 427 行：window.mycodex.listProjects(nextRoot)
- 第 450 行：window.mycodex.listArtifacts(projectPath)
- 第 652 行：window.mycodex.runTeam({...})

**影响**：
- 浏览器/Web 模式下（HttpTransport）所有操作将静默失败（window.mycodex 不存在）
- Transport 层形同虚设，双实现的工程投入被浪费
- 无法在纯浏览器环境做测试或调试

**修复**：在组件树顶层或 Context 初始化一次 transport：

    const transport = useMemo(() => createTransport(), []);
    const res = await transport.listProjects(root);

---

### 红色-3：类型定义三重冗余，各文件互不引用

**共识视角**：规范 + 工程师 + 架构 三路标记（必修）

| 文件 | 类型名示例 |
|------|-----------|
| src/mycodex.d.ts | MycodexProject, MycodexBridge（全局声明） |
| src/transport/types.ts | 再次完整定义相同类型（带 export type） |
| src/App.tsx 第 3-121 行 | 第三次定义（本地类型，无前缀） |

**影响**：
- 三处若有字段变更，需同步修改三份，极易遗漏
- App.tsx 的 CommandResult.code 为 number（必填），但实际 HTTP 响应中可能为 undefined，运行时崩溃风险

**修复**：以 transport/types.ts 导出为唯一权威来源，mycodex.d.ts 引用它，App.tsx 删除本地类型改为 import type。

---

### 红色-4：初始化 useEffect 无错误捕获，失败时应用静默冻结

**共识视角**：工程师 + 逻辑 两路标记（必修）

第 478-493 行：void (async () => { ... })() 无 try/catch 包裹。若 runtimeStatus() 抛出异常，整个初始化中断，无任何提示。listRes.ok === false 时也不显示任何错误提示。

**影响**：应用启动时若 IPC bridge 未就绪，用户看到空白界面，无任何反馈。

**修复**：包裹 try/catch，失败时调用 showError()；对 !listRes.ok 同样触发错误提示。

---

### 红色-5：applyPreset 直接调用 window.confirm 阻塞渲染线程

**共识视角**：工程师 + 规范 两路标记（必修）

第 556 行：if (hasEdits && !window.confirm(...))

**影响**：window.confirm 在 Electron 默认配置下可能被禁用；阻塞 UI 线程；无法单元测试。

**修复**：用受控的确认对话框组件（内联 ConfirmDialog state）替代。

---

## 三、建议改进（酌情采纳）

### 黄色-1：22+ 个顶层 useState 散乱，建议按领域归组

第 348-372 行连续声明约 22 个 useState，跨越项目、表单、UI、CLI 工具多个领域。建议拆分到各自自定义 Hook：

    const { projects, activeProject, projectsRoot } = useProjects(transport);
    const { artifacts, preview, loadArtifacts } = useArtifacts(transport, activeProject?.path);
    const { logs, timeline, isBusy, executeAndCapture } = useTeamRun(transport);

---

### 黄色-2：renderMarkdown 每次渲染重新执行，应 useMemo 包裹

第 1236 行 dangerouslySetInnerHTML={{ __html: renderMarkdown(preview.content) }}，renderMarkdown 是纯函数，每次组件重渲染都重新执行，对 128KB 文档有可观性能开销。

修复：
    const renderedHtml = useMemo(
      () => preview?.content ? renderMarkdown(preview.content) : "",
      [preview?.content]
    );

---

### 黄色-3：withLineNumbers 大文件处理应 useMemo 包裹

第 1205/1209 行 withLineNumbers 使用 split + map + join 三次遍历全文，同样建议 useMemo 包裹避免无效重算。

---

### 黄色-4：showError 的 setTimeout 存在多 toast 竞态

第 405-409 行：若 8 秒内触发第二个错误，第一个 setTimeout 回调会提前清除第二条消息。

修复：用 useRef 保存 timer id，每次调用先 clearTimeout：

    const errorTimerRef = useRef(null);
    function showError(message) {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
      setErrorMessage(message);
      errorTimerRef.current = setTimeout(() => setErrorMessage(null), 8000);
    }

---

### 黄色-5：activeProjectPathRef 命名具有误导性

第 496 行 const activeProjectPathRef = activeProjectPath 只是普通常量赋值，Ref 后缀让人误以为是 useRef。建议直接将 activeProjectPath 放入 useEffect 依赖数组，删除中间变量和 eslint-disable 注释。

---

### 黄色-6：HttpTransport WebSocket 无断线重连，存在连接泄漏

http-transport.ts 第 161-175 行：
- 重复调用 onTaskOutput 时 this.ws 直接被覆盖，旧连接泄漏
- 网络断开后无重连机制，订阅永久失效

建议：调用前先 this.ws?.close()；增加指数退避重连逻辑。

---

### 黄色-7：normalizeArtifactBaseName 同一正则连续执行两次，注释缺失

第 190-191 行两行正则完全相同，意图是剥离两层后缀（如 report_v2_run001），但注释缺失。建议添加注释说明意图，或改用 while 循环使逻辑自文档化。

---

### 黄色-8：styles.css 无作用域隔离，全局选择器有污染风险

h1/h2/h3/p 的 margin:0 重置以及裸元素选择器 button/input/textarea，拆分组件后将产生意外样式覆盖。建议逐步迁移至 CSS Modules（.module.css），至少用 .app-shell 父选择器限定作用域。

---

### 黄色-9：refreshProjects 与初始化 useEffect 存在逻辑重复

refreshProjects（第 426 行）与初始化 useEffect（第 478 行）均执行 runtimeStatus + listProjects 序列，建议提取为 useProjects hook 内的单一初始化函数。

---

### 黄色-10：TEAM_PRESETS 混用 Unicode 转义与明文中文

第 130-131 行使用 Unicode 转义，第 154-163 行直接使用中文明文，建议统一为明文中文提升可读性。

---

## 四、做得好的地方

### 绿色-1：Transport 层设计优秀，抽象清晰

- MyCodexTransport 接口完整覆盖所有 Bridge 操作
- IpcTransport / HttpTransport 双实现，方法签名严格一致
- createTransport() 工厂函数自动检测 Electron 环境，零配置切换
- onTaskOutput? 设计为可选方法，正确处理了 IPC 无需 WebSocket 的差异

---

### 绿色-2：executeAndCapture 是优良的副作用编排模式

第 567-640 行：将 busy 状态设置、Timeline 记录、stdout/stderr 捕获、产物更新、异常兜底 封装为可复用模式，避免了各操作函数重复样板代码，是本项目架构中最有价值的设计之一。

---

### 绿色-3：错误 Toast 的 UX 设计合理

- 固定定位 + transform 水平居中，实现简洁
- role=alert 满足无障碍标准（ARIA）
- 点击可手动关闭，8 秒自动消失，用户体验良好
- 同时写入 log panel，便于事后追溯

---

### 绿色-4：useMemo 的 artifactGroups 分组逻辑正确

第 383-399 行用 useMemo 正确缓存了分组与排序计算，依赖数组 [artifacts] 精确，不存在过时闭包问题。

---

### 绿色-5：HTML 预览使用 sandbox 属性强沙箱隔离

第 1231 行 sandbox= 禁用所有权限（脚本、表单、弹窗等），有效防止用户产物中的 HTML 执行任意脚本，安全意识良好。

---

### 绿色-6：main.tsx 使用 React.StrictMode 且无冗余依赖

入口文件干净简洁，StrictMode 有助于在开发期暴露副作用问题。

---

### 绿色-7：响应式布局覆盖两个断点

styles.css 针对 1320px 和 860px 两个断点进行布局降级（三列到两列到单列），对不同屏幕宽度有基本适配。

---

### 绿色-8：mycodex.d.ts 的全局声明方式正确

通过 declare global 加 export {} 的方式，正确地将 Bridge 挂载到 Window 类型，避免了 TypeScript 将文件视为脚本模式的陷阱。

---

## 五、优先级修复路线图

| 优先级 | 编号 | 工作量 | 说明 |
|--------|------|--------|------|
| P0 立即 | 红色-2 | 0.5 天 | 将所有 window.mycodex.* 调用替换为 transport 实例 |
| P0 立即 | 红色-4 | 0.5 天 | 初始化 useEffect 加 try/catch，避免静默冻结 |
| P0 立即 | 红色-5 | 0.5 天 | 替换 window.confirm 为受控 Dialog 组件 |
| P1 本迭代 | 红色-3 | 1 天 | 三处类型定义合并为 transport/types.ts 唯一来源 |
| P1 本迭代 | 红色-1 | 3-5 天 | 按功能域拆分组件 + 提取自定义 hooks |
| P1 本迭代 | 黄色-4 | 0.25 天 | showError 竞态修复（useRef timer） |
| P2 下迭代 | 黄色-1 | 1 天 | useState 归组为 useReducer / 自定义 hook |
| P2 下迭代 | 黄色-2/3 | 0.25 天 | renderMarkdown / withLineNumbers 用 useMemo 包裹 |
| P2 下迭代 | 黄色-6 | 0.5 天 | WebSocket 多订阅者保护 + 断线重连 |
| P3 长期 | 黄色-8 | 2 天 | 样式迁移至 CSS Modules，消除全局污染风险 |

---

本报告由 CHS Agent Teams 多引擎评审框架生成，采用工程师 / 架构 / 逻辑 / 规范 / 创新 / 安全六路并发视角，经共识过滤（>= 2 视角）确定必修项，独有视角标注为酌情采纳。
