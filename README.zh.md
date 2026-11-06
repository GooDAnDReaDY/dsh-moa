# 📦 @goodandready/dsh-moa

<div align="center">

<h3>面向 DeepSeek Harness 的 Mixture of Agents (MoA) 多模型协作与代码综合引擎</h3>

<p align="center">
  <a href="https://www.npmjs.com/package/@goodandready/dsh-moa"><img src="https://img.shields.io/npm/v/@goodandready/dsh-moa.svg?style=for-the-badge&color=6366f1&labelColor=1e1b4b" alt="npm version"></a>
  <a href="../LICENSE"><img src="https://img.shields.io/github/license/GooDAnDReaDY/dsh-moa.svg?style=for-the-badge&color=10b981&labelColor=064e3b" alt="license"></a>
  <a href="https://github.com/topics/dsh-plugin"><img src="https://img.shields.io/badge/DSH-Plugin-8b5cf6.svg?style=for-the-badge&labelColor=2e1065" alt="DSH Plugin"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/Node-20%2B-f59e0b.svg?style=for-the-badge&labelColor=451a03" alt="Node version"></a>
</p>

<p align="center">
  <a href="https://goodandready.app/"><img src="https://img.shields.io/badge/作者所有项目-goodandready.app-ff4500.svg?style=for-the-badge&logo=rocket&logoColor=white&labelColor=1a1a2e" alt="GoodAndReady 作品展"></a>
</p>

<p align="center">
  <a href="README.md"><b>🇬🇧 English</b></a> •
  <a href="README.ru.md"><b>🇷🇺 Русский</b></a> •
  <a href="README.zh.md"><b>🇨🇳 中文说明</b></a>
</p>

<table align="center">
  <tr>
    <td align="center">
      ⭐ <strong>如果您喜欢这个插件，请在 GitHub 上为它点亮 Star</strong> — 这能让我知道插件对您有用，并鼓励我继续开发和维护它。
      <br><br>
      🐛 <strong>如果您发现 Bug 或希望增加功能</strong>，请使用任意语言在 GitHub 上提交 Issue — 我会评估您的建议，并在后续版本中实现有价值的改进。
    </td>
  </tr>
</table>

</div>

---

## ⚡ 概述与解决的核心痛点

在面对复杂的软件工程任务时，单一模型生成往往容易受到视角盲区、架构幻觉以及生成质量不稳定的限制。当用户输入模糊或缺乏技术细节的提示词时，单一模型容易做出主观假设，生成未经充分验证的单体代码。

**`@goodandready/dsh-moa`** 通过 `/moa` 斜杠命令将 **Mixture of Agents (MoA)** 混合智能体架构原生引入 DeepSeek Harness：

1. **自适应澄清问卷 (Questionnaire Gate)**：针对宽泛或不明确的提示词，顾问模型（Proposers）自动提炼关键分歧点，裁判模型（Judge）在生成代码前合成结构化的 2–4 题交互式问卷。
2. **多模型并行生成与工作区沙箱隔离**：多个独立模型并行分析任务。每个候选方案的文件生成均写入独立的磁盘沙箱 (`.moa/candidate-N/`)，彻底避免跨模型文件污染。
3. **旗舰裁判模型评估与文件自动提升 (Promotion)**：深度推理模型对所有候选方案进行交叉评审，通过机器标记 (`WINNER_CANDIDATE_INDEX: N`) 评选胜出方案，并将胜出者的完整文件自动同步到项目根目录。
4. **极简对话摘要与 Token 节省**：对话界面不输出冗长的原始代码块，而是生成整洁的文件清单与架构设计摘要。
5. **单轮会话即时恢复**：作为一次性会话修改器运行，任务完成后自动恢复用户原本的会话主力模型。
6. **动态定价目录与 Token 成本估算**：300+ 模型的实时价格自动从 OpenRouter 公开目录后台获取（无需鉴权，缓存于 `~/.dsh/storages/dsh-moa-catalog.json`，24 小时刷新），同时支持直连厂商价格与 `settings.yaml` 中的自定义 `prices` 覆盖。
7. **增量修改模式 (Refinement Mode)**：自动感知现有代码库上下文，生成精确的增量修改而非破坏性的整文件重写。
8. **快速模式与自定义评审标准**：面向快速任务的单模型极简管线，以及可自定义的裁判评审准则。
9. **运行历史与胜率排行榜**：对每一类运行（综合、快速模式、问卷）进行持久化记录，并内置 REST 端点（`/dsh-moa/history`、`/dsh-moa/leaderboard`、`/dsh-moa/runs/<id>`）。
10. **Live Canvas 一键预览（可选）**：当同一 profile 中安装了 `@goodandready/dsh-live-canvas` 时，提升到项目根目录的 HTML 会被推入其沙箱，MoA 回答附带一键预览链接；未安装时该步骤静默跳过。
11. **交互式工作台 (1-10分文件打分、自由混搭、最优模型粘合与裁判复审)**：裁判对每个候选模型生成的每个文件进行 1–10 分打分并列出优缺点。用户可在 WebUI 中自由勾选组合所需文件；当轮最高分模型被调用以粘合协同跨文件导入与类型接口，随后由裁判进行最终复审。支持配套插件 [`dsh-time-machine`](https://github.com/goodandready/dsh-time-machine) 在文件提升前创建影子 Git 回滚快照。
12. **对抗性白帽安全模糊测试关卡 (#302)**：红队安全审计器在裁判前检查 SQLi、XSS、命令注入、路径穿越、ReDoS 和原型污染漏洞，发现严重漏洞时触发 `SECURITY_VETO` 否决。
13. **代码事实与 API 验证链关卡 (CoVe) (#314)**：独立的裁判前事实核验，生成针对性 API 问题并对照标准库及项目配置清单，杜绝调用虚构不存在的幻觉方法。
14. **运行期 CPU 与内存性能分析关卡 (#315)**：在隔离沙箱中微基准测试候选方案执行延迟、吞吐量（ops/sec）与堆内存占用，带有硬超时保护，指引裁判挑选算法最优代码。
15. **候选测试套件变异测试关卡 (#316)**：注入 AST 级别故障变异以计算变异得分（消灭 vs 存活变异体），剔除恒真废测试与虚假测试套件。

---

## 🏗️ 架构图

```mermaid
graph TD
    subgraph Input ["用户交互 (聊天输入框)"]
        Cmd["斜杠命令: /moa [preset] &lt;prompt&gt;"]
        Gate{"模糊需求判断"}
        QModal["交互式澄清问卷<br/>(多选选项与自定义输入)"]
    end

    subgraph Proposers ["并行顾问模型层 (Proposers)"]
        P1["提案模型 1<br/>(创新方案)"]
        P2["提案模型 2<br/>(替代架构)"]
        P3["提案模型 3<br/>(高性能策略)"]
        WS1[".moa/candidate-1/<br/>(隔离文件)"]
        WS2[".moa/candidate-2/<br/>(隔离文件)"]
        WS3[".moa/candidate-3/<br/>(隔离文件)"]
    end

    subgraph Judge ["综合评估与提升层 (Judge)"]
        Aggregator["旗舰裁判模型<br/>(交叉对比与代码审查)"]
        WinnerMarker{"WINNER_CANDIDATE_INDEX"}
        Promote["提升胜出者文件<br/>(移至根目录并清理沙箱)"]
        Summary["紧凑型摘要<br/>(文件清单与架构亮点)"]
    end

    Cmd --> Gate
    Gate -->|需求宽泛/模糊| QModal
    QModal -->|用户确认选项| P1 & P2 & P3
    Gate -->|需求明确/详尽| P1 & P2 & P3
    P1 --> WS1
    P2 --> WS2
    P3 --> WS3
    WS1 & WS2 & WS3 --> Aggregator
    Aggregator --> WinnerMarker
    WinnerMarker --> Promote
    Promote --> Summary
```

---

## ✨ 特性与能力

### 1. 斜杠命令 (`/moa`) 与实时补全
深度集成于 DeepSeek Harness 输入框。输入 `/moa` 即可触发预设菜单与自动补全：

```text
/moa 开发一个包含图表与 WebSocket 实时更新的响应式仪表盘
```

或指定命名预设：

```text
/moa code-review 审查身份验证中间件和安全边界
```

等效的 flag 形式：

```text
/moa --preset=deep-reasoning 逐步求解这道数学题
```

或直接提升候选者方案（支持指定 runId 与候选序号）：

```text
/moa promote 2
/moa promote <runId> 2
```

### 2. 自适应澄清问卷
当需求过于抽象（例如 *"制作一个计算器"*）时，系统会在生成代码前主动询问 UI 风格、数据持久化方式或框架偏好。

### 3. 并行调用与实时心跳反馈
* 多个顾问模型并发执行，并伴随实时心跳进度条 (`⏳ [3s] Processing...`，显示各模型独立进度)。
* 自动清理顾问上下文中的冗余系统提示词与工具定义，消除“缺少工具”的拒绝报错并大幅节约 Token。

### 4. 磁盘级沙箱隔离与胜出者提升
与仅停留在聊天文本层面的 MoA 不同，`dsh-moa` 针对真实工程项目：
* 各提案模型在 `.moa/candidate-1/`、`.moa/candidate-2/` 等独立目录生成工程代码。
* 裁判模型对比各版本实现，通过 `WINNER_CANDIDATE_INDEX: N` 指定最优方案。
* 胜出方案自动提升至项目根目录，临时沙箱随后自动清理。
* 支持随时通过命令 `/moa promote [runId] <candidateIndex>` 或 UI 界面一键手动提升指定候选者的方案。

### 5. 原生设置卡片与预设管理
在 `设置 → 插件 → Mixture of Agents` 中可视化配置模型：
* 配置顾问模型列表（快速生成多样化构想）。
* 配置裁判模型（强推理模型进行严谨审查）。
* 自定义命名预设 (`default`, `fast`, `deep-reasoning`)、裁判评审准则与温度。
* 启用/停用 MoA 开关并查看真实的主机状态徽章；遥测网格展示总运行次数与平均运行成本。

### 7. 候选方案差异对比器 (Candidate Diff Viewer)
直接在界面中可视化对比顾问方案之间以及顾问与裁判综合方案之间的逐行差异。支持文件筛选、增删改高亮，基于纯 JavaScript LCS 差异算法，零第三方依赖。

### 8. 提升前 Git 快照检查点 (`dsh-time-machine`)
在将胜出候选者的文件提升并覆盖至项目根目录前，`dsh-moa` 自动调用本地 `dsh-time-machine` 建立影子 Git 检查点 (`moa-pre-promotion: candidate-N`)。如 `dsh-time-machine` 未安装或无法访问，文件提升将被阻断以防止未备份的项目文件被意外覆盖（仅在明确不需要检查点时可通过 `force: true` 覆盖）。

### 9. 自动化测试执行网关 (Automated Test Execution Gate)
当启用 `test_gate_enabled: true` 并配置 `test_command`（如 `npm test` 或 `pytest`）时，候选代码将在临时沙箱覆盖层中执行。沙箱基于 Node.js 原生权限模型（`--permission`）与运行时防护栏（`lib/moa-sandbox.js`）。在无操作系统级容器隔离（bubblewrap）时，严格禁用子进程创建（省略 `--allow-child-process`），杜绝候选代码通过剥离 `NODE_OPTIONS` 逃逸沙箱 (#260)。包管理器命令（`npm test`）直接映射到底层脚本，并在执行前严密拦截任何规避意图（`env -u NODE_OPTIONS`、`unset NODE_OPTIONS` 等）。裁判在最终决策前将获取客观的测试结果、耗时与输出日志。

### 18. 平滑降级与本地容灾恢复 (Local Fallback Resilience)
当 `local_fallback_enabled: true` 时，因网络中断、超时或速率限制（429/500）而失败的候选模型会自动使用配置的本地模型（Ollama / MiniPC）恢复。每个后备模型都拥有独立的超时执行配额与关联主 turn signal 的隔离取消控制器，防止云端超时耗尽本地恢复时间。同时严格检测终止错误与流中断，确保安全容灾且杜绝已取消 turn 的延迟文件提升。

### 19. 零 Token 本地预审语法网关 (Zero-Token Pre-Judge Syntax Filter)
在调用裁判模型之前，在本地解析所有候选方案的 Markdown 代码块，进行 JavaScript/TypeScript AST 语法校验、JSON 解析以及括号/引号匹配检查。检测到语法损坏的候选将被自动过滤或附带结构化语法错误注解，无需消耗模型 Token 即可杜绝语法缺陷代码流入最终裁决。通过 `local_preflight_check: true` 配置（默认开启）。

### 20. 语义共识提前退出机制 (Early Exit upon Semantic Consensus)
基于 Token 级 Sørensen-Dice 相似度算法比对归一化后的候选方案。当多个候选模型给出高度一致的代码方案（达到或超过 `early_exit_threshold` 阈值，默认 0.95）时，自动跳过高耗费的裁判综合评审阶段，直接将共识方案提升至项目，在大幅缩短响应延迟的同时节省多达 100% 的裁判 Token 支出。通过 `early_exit_consensus_enabled: true` 与 `early_exit_threshold: 0.95` 配置。

### 21. 动态共识阈值与裁判自适应升级 (Dynamic Consensus & Judge Escalation)
基于归一化 Sørensen-Dice 计算候选方案间的分歧度 (Disagreement Metric 0.0–1.0)。当候选分歧超过设定阈值 (`escalation_disagreement_threshold`，默认 0.40) 时，流水线自动触发升级策略：
- `auto_upgrade`: 自动将普通/快速裁判升级为指定的高阶旗舰裁判 (`escalation_judge` 或首选候补裁判)。
- `council_majority`: 组建 3 裁判多数席裁决团。
触发 `moa/judge-escalation` 事件并在实时流中呈现决策依据。

### 22. 单模型自洽性温度采样 (Self-Consistency Temperature Sampling)
专为仅配置单模型（如本地 Ollama/vLLM 或单一 API Key）的场景设计。开启后自动将单槽位扩展为 $N$ 个并行采样（分别采用 0.2、0.6、0.9 等递增温度与 `proposer`、`challenger`、`minimalist` 互补提示词），评估自洽一致性比率并进行全流程 MoA 综合聚合，触发 `moa/self-consistency-expand` 事件。

### 23. 基于项目清单的感知角色演化 (Stack-Aware Personas)
自动扫描工作区清单 (`package.json`, `Cargo.toml`, `pyproject.toml`, `go.mod`) 识别编程语言、框架与核心依赖，动态为各候选槽位分派互补的领域专家角色（如 React 渲染优化、TypeScript 严格类型安全、可访问性审查、FastAPI 异步架构），触发 `moa/stack-detected` 事件。通过 `stack_aware_personas_enabled: true` 配置。

### 24. 自学习开发者代码偏好元提示词 (Developer Preferences)
在本地 `~/.dsh/moa/preferences.json` 持久化存储团队编码规范与架构偏好，将启用的规则动态注入裁判评审阶段，使综合方案贴合开发者个人习惯（严格类型、函数不可变性、防御性错误边界）。提供 `GET/POST/DELETE /dsh-moa/preferences` REST 端点，通过 `developer_preferences_enabled: true` 开启。

### 6. Live Canvas 一键预览（可选）
若同一 profile 中安装了 `@goodandready/dsh-live-canvas`，`dsh-moa` 会将提升后的 HTML 文件推送到 Live Canvas 的 REST 契约（`POST /dsh-live-canvas/api/preview`，由同一 harness webServer 提供服务），并在回答中附上一键预览链接（`/dsh-live-canvas/sandbox/<id>`）。未安装该插件时此步骤静默跳过——日志无报错，也不会出现死链接。

---

## 📦 安装

在 DeepSeek Harness Web 配置文件中安装：

```bash
dsh plugin --profile web add @goodandready/dsh-moa
```

重启 DeepSeek Harness 实例并刷新浏览器页面。

---

## ⚙️ 配置 (`settings.yaml`)

可在 `settings.yaml` 中配置预设与模型管道，或通过 Web UI 设置面板（设置 → 插件 → Mixture of Agents）进行调整：

```yaml
# settings.yaml
dsh-moa:
  enabled: true
  default_preset: "default"
  prices:
    "my-provider/my-model":
      input: 0.20
      output: 0.80
    "ollama/*":
      input: 0
      output: 0
  presets:
    - name: default
      ask_clarifying_questions: true
      reference_models:
        - provider: "your-fast-provider"
          model: "your-creative-model"
        - provider: "your-fast-provider"
          model: "your-balanced-model"
      aggregator:
        provider: "your-reasoning-provider"
        model: "your-judge-model"
      reference_temperature: 0.6
      aggregator_temperature: 0.4
      max_tokens: 4096
      judge_criteria: ""
    - name: fast
      ask_clarifying_questions: false
      reference_models:
        - provider: "your-fast-provider"
          model: "your-fast-model"
      aggregator:
        provider: "your-fast-provider"
        model: "your-fast-model"
```

### 配置项说明

| 参数 | 类型 | 默认值 | 说明 |
|:---|:---|:---|:---|
| `enabled` | `boolean` | `true` | `/moa` 命令、回合路由与 `POST /dsh-moa/run` 的总开关（可在设置卡片中切换） |
| `default_preset` | `string` | `"default"` | 输入 `/moa <prompt>` 且未显式指定预设时调用的预设 |
| `presets` | `array` | `[...]` | 命名预设列表；通过 `/moa <name> <prompt>` 或 `/moa --preset=<name> <prompt>` 选择 |
| `presets[].reference_models` | `array` | `[...]` | 并行提案阶段并发调用的顾问模型列表 |
| `presets[].aggregator` | `object` | `{...}` | 负责综合评审、代码审查与裁决胜出者的裁判模型 |
| `presets[].ask_clarifying_questions` | `boolean` | `true` | 针对宽泛需求合成澄清问卷（预设级别开关） |
| `presets[].local_preflight_check` | `boolean` | `true` | 在裁判评审前本地验证候选代码块的 AST、JSON 与括号平衡（零 Token 消耗） |
| `presets[].early_exit_consensus_enabled` | `boolean` | `false` | 当候选方案达成高语义共识时跳过裁判评审并直接提升获胜方案 |
| `presets[].early_exit_threshold` | `number` | `0.95` | 触发语义共识提前退出的 Token 相似度阈值（0.50 至 1.00） |
| `presets[].reference_temperature` / `.aggregator_temperature` | `number` | `0.6` / `0.4` | 顾问与裁判的采样温度 |
| `presets[].max_tokens` | `number` | `4096` | 每次模型调用的最大输出 Token 数 |
| `presets[].judge_criteria` | `string` | `""` | 传给裁判的可选附加评审准则 |
| `prices` | `map` | `{}` | 自定义美元/百万 Token 费率（`"provider/model"`、`"provider/*"`、`"*"`），用于成本估算 |

> **隐私提示：** 在增量修改模式下，可读的项目文件（最多约 1.6 万字符；`.env*` 等点文件已被排除）会随提示词发送给所配置的候选模型与裁判模型。请勿在非点文件中包含密钥的项目里运行 `/moa`。

---

## 📊 REST API 端点

| 端点 | 方法 | 说明 |
|:---|:---|:---|
| `/dsh-moa/status` | `GET` | 供设置卡片状态徽章使用的健康/启用状态快照 |
| `/dsh-moa/presets` | `GET` | 返回已配置的 MoA 预设与默认预设 |
| `/dsh-moa/presets` | `POST` | 经 schema 校验后替换预设/默认预设/enabled（非法载荷返回 400） |
| `/dsh-moa/models` | `GET` | 列出可用于候选/裁判槽位的模型 |
| `/dsh-moa/history?limit=20&offset=0` | `GET` | 返回近期运行记录（含候选、胜出者、Token 与成本） |
| `/dsh-moa/leaderboard` | `GET` | 计算模型胜率排行榜与平均执行成本 |
| `/dsh-moa/runs/<id>` | `GET` | 按 id 返回单条运行记录 |
| `/dsh-moa/run` | `POST` | 通过 HTTP 运行完整 MoA 管线（`enabled: false` 时返回 400） |
| `/dsh-moa/diff` | `GET` | 计算候选运行结果或综合输出的行级别差异（支持按 runId 解析工作区） |
| `/dsh-moa/promote` | `POST` | 手动将候选工作区文件提升到项目根目录（带时间机器快照） |
| `/dsh-moa/cache` | `GET` | 返回语义缓存统计信息、命中次数与节省 Token 指标 |
| `/dsh-moa/cache` | `POST` | 清除语义缓存条目，支持 olderThanMs 过滤 |
| `/api/dsh-moa/update` | `POST` | 从 npm 一键更新插件，带安全写入源校验 |

---

## 🧪 测试

运行自动化测试套件：

```bash
npm test
```

---

## 📄 许可证

MIT © [GooDAnDReaDY](https://github.com/GooDAnDReaDY)
