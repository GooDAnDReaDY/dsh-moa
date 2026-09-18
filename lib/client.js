// Plugin Settings Card (settings.plugin.item).
//
// Aligned with dsh-clinebot design language:
// - Header with real status chips (host online/offline/disabled via /dsh-moa/status)
// - Clean section cards (.moa-section-card) using native DSH design tokens (--dsw-alias-*)
// - Segmented preset selectors and count pills
// - Refined temperature sliders and searchable model picker
// - Telemetry summary grid fed by /dsh-moa/history
// - Robust error boundary and settingsScope reactivity
//
// English is the canonical source language; the ru translation is provided
// by the DSH translation plugin at runtime (no bundled ru duplicate).

window.__ModuleLoader__.load({
  id: '@goodandready/dsh-moa',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    const React = require('react')
    const NS = 'dsh-moa'
    // Plugins page row seat (DSH 0.1.6-alpha.2): key = '<package name>#<row id>'.
    const PKG = '@goodandready/dsh-moa'
    const ROW_ID = 'dsh-moa'
    const ROW_CONFIG_KEY = PKG + '#' + ROW_ID
    const TITLE = 'Mixture of Agents (MoA)'
    const SUBTITLE = 'Ensemble parallel candidate generation with judge synthesis via /moa.'

    let rootCtx = null

    const en = {
      title: 'Mixture of Agents (MoA)',
      description: 'Ensemble model orchestration: parallel candidate proposals + judge synthesis via /moa <prompt>.',
      'header.title': 'Mixture of Agents (MoA) Orchestration',
      'header.sub': 'Parallel generation by candidate proposers with final evaluation and code promotion by a leading aggregator/judge. Returns to your session model automatically.',
      'badge.online': 'MoA Active',
      'badge.offline': 'Host Unreachable',
      'badge.preset': 'Preset: {name}',
      'badge.models': '{count} models available',
      'badge.candidates': '{count} proposers',
      'presets.title': '📋 Preset Management',
      'presets.desc': 'Select active preset or create custom configurations for specific tasks (e.g. code review, math, quick triage).',
      'presets.active_badge': 'Active Default',
      'presets.set_default': 'Set as Default',
      'presets.new_btn': '+ New Preset',
      'presets.del_btn': 'Delete',
      'presets.del_confirm': 'Are you sure you want to delete preset "{name}"?',
      'presets.create': 'Create',
      'presets.cancel': 'Cancel',
      'presets.name_placeholder': 'New preset name (e.g. fast-audit)',
      'aggregator.title': '⚖️ Leading Model / Judge (Synthesis & Audit)',
      'aggregator.desc': 'Compares candidate proposals, resolves discrepancies, filters hallucination, and synthesizes final solution.',
      'aggregator.temp_label': 'Judge Temperature',
      'aggregator.temp_hint': 'Recommended: 0.2 – 0.4 for strict validation and deterministic synthesis.',
      'aggregator.criteria_label': 'Judge Evaluation Criteria (Optional):',
      'aggregator.criteria_placeholder': 'e.g. Priority: performance, zero external dependencies, robust edge-case handling...',
      'aggregator.questions_label': 'Ask clarifying questions on broad tasks (Questionnaire)',
      'aggregator.questions_hint': 'When enabled: for short/vague prompts, the judge synthesizes a 2-4 question checklist before code generation.',
      'aggregator.curator_label': 'Curator Synthesis & Master Assembler Advice',
      'aggregator.curator_hint': 'When enabled: the curator highlights the finest components of each candidate, applies the antipatterns rubric, and advises which agent model should assemble the solution.',
      'aggregator.stream_label': 'Live Stream Curator/Judge Thinking',
      'aggregator.stream_hint': 'Streams aggregator tokens directly to chat in real time for zero-latency initial response.',
      'aggregator.peer_label': 'Consilium: Peer Critique (Round 2)',
      'aggregator.peer_hint': 'Candidates critique each other\'s solutions and refine their code before final judge synthesis.',
      'aggregator.override_label': 'Allow Candidate Override Actions',
      'aggregator.override_hint': 'Keeps candidate workspaces in .moa to let you apply any candidate files via chat command.',
      'proposers.role_label': 'Persona:',
      'proposers.role_general': 'General',
      'proposers.role_minimalist': 'Minimalist',
      'proposers.role_robustness': 'Robustness',
      'proposers.role_performance': 'Performance',
      'proposers.role_tester': 'Tester',
      'leaderboard.filter_all': 'All Presets',
      'leaderboard.export_csv': 'Export CSV',
      'leaderboard.export_json': 'Export JSON',
      'aggregator.blind_label': 'Blind Review (Anonymize Candidates for Judge)',
      'aggregator.blind_hint': 'When enabled: candidate model names and providers are hidden from the judge prompt to prevent family/brand bias.',
      'aggregator.timeout_label': 'Judge synthesis timeout (sec):',
      'proposers.timeout_label': 'Candidate timeout (sec):',
      'leaderboard.title': '🏆 Model Win-Rate Leaderboard',
      'leaderboard.desc': 'Performance metrics calculated from recorded MoA run verdicts.',
      'leaderboard.model': 'Model',
      'leaderboard.runs': 'Runs',
      'leaderboard.wins': 'Wins',
      'leaderboard.winrate': 'Win Rate',
      'leaderboard.cost': 'Avg Cost',
      'leaderboard.empty': 'No historical runs recorded yet.',
      'aggregator.fallbacks_title': 'Fallback Judges Chain',
      'aggregator.fallbacks_desc': 'Sequential backup models invoked automatically if the primary judge experiences rate limits or outages.',
      'aggregator.add_fallback_btn': '+ Add Fallback Judge',
      'proposers.quorum_label': 'Quorum Fast-Forward (Straggler Mitigation)',
      'proposers.quorum_hint': 'When 67%+ candidates finish, start a grace timer (default: 10s) and proceed without waiting for hanging providers.',
      'proposers.grace_label': 'Grace Period (sec):',
      'proposers.title': '👥 Candidate Models (Proposers)',
      'proposers.desc': 'Generate independent solutions in parallel to maximize diversity and solution space coverage.',
      'proposers.parallel_count': 'Parallel Proposers',
      'proposers.candidate': 'Candidate',
      'proposers.add_btn': '+ Add Candidate Model',
      'proposers.temp_label': 'Candidates Temperature',
      'proposers.temp_hint': 'Recommended: 0.6 – 0.8 for creative, independent solution exploration.',
      'stats.title': '📈 MoA Analytics & Telemetry',
      'stats.desc': 'Session telemetry, historical runs, and model win-rate tracking.',
      'stats.total_runs': 'Total Runs',
      'stats.avg_cost': 'Avg Run Cost',
      'stats.active_models': 'Configured Models',
      'stats.preset_count': 'Total Presets',
      'picker.select': 'Select model…',
      'picker.search_placeholder': 'Search model by name or provider…',
      'picker.found': 'Found',
      'picker.of': 'of',
      'picker.clear': 'Clear',
      'picker.none': 'No matching models found.',
      'picker.custom': 'Use custom: ',
      'actions.save': 'Save Configuration',
      'actions.saving': 'Saving…',
      'actions.saved': 'Configuration saved successfully!',
      'actions.retry': 'Reload Configuration',
      'badge.disabled': 'MoA Disabled',
      'config.enabled_label': 'Enable MoA (slash command and turn routing)',
      'slash.desc': 'Run turn with Mixture of Agents ensemble synthesis (/moa [preset] <prompt>)',
      'updater.title': 'Plugin Updates',
      'updater.desc': 'Check npm registry for new versions and update with one click.',
      'updater.btnCheck': 'Check Updates',
      'updater.btnUpdate': 'Update to v{version}',
      'updater.checking': 'Checking registry...',
      'updater.updating': 'Updating plugin...',
      'updater.current': 'Current version: v{version}',
      'updater.available': 'Update available: v{version}',
      'updater.upToDate': 'Up to date',
      'updater.checkFailed': 'Registry check failed',
      'updater.success': 'Successfully updated to v{version}. Restart DSH to apply.',
    }

    const zh = {
      title: '智能体混合 (MoA)',
      description: '多模型协同编排：通过 /moa <提示词> 进行候选模型并行提案与主裁判综合。',
      'header.title': '智能体混合 (MoA) 编排系统',
      'header.sub': '由多个候选提案模型并行生成方案，再由领先的聚合裁判模型进行终审评测与代码提拔。完成后自动切回您的会话模型。',
      'badge.online': 'MoA 已启用',
      'badge.offline': '主机不可达',
      'badge.preset': '预设：{name}',
      'badge.models': '{count} 个可用模型',
      'badge.candidates': '{count} 个提案模型',
      'presets.title': '📋 预设管理',
      'presets.desc': '选择当前活动预设或针对特定任务（如代码审查、数学推演、快速分流）创建自定义配置。',
      'presets.active_badge': '默认激活',
      'presets.set_default': '设为默认',
      'presets.new_btn': '+ 新建预设',
      'presets.del_btn': '删除',
      'presets.del_confirm': '确定要删除预设“{name}”吗？',
      'presets.create': '创建',
      'presets.cancel': '取消',
      'presets.name_placeholder': '新预设名称（例如：fast-audit）',
      'aggregator.title': '⚖️ 领先模型 / 裁判（综合与审计）',
      'aggregator.desc': '对比候选方案，消除差异，过滤幻觉，并综合生成最终生产级解决方案。',
      'aggregator.temp_label': '裁判采样温度 (Temperature)',
      'aggregator.temp_hint': '推荐：0.2 – 0.4，以确保严格的验证和确定性的代码综合。',
      'aggregator.criteria_label': '裁判评测标准（可选）：',
      'aggregator.criteria_placeholder': '例如：优先考虑高性能、零外部依赖、完善的边界异常处理...',
      'aggregator.questions_label': '对于宽泛任务先提出澄清问题（需求问卷）',
      'aggregator.questions_hint': '启用时：对于简短或模糊的任务，裁判在生成代码前会先综合一份包含 2–4 个问题的选项清单。',
      'aggregator.curator_label': '策展人综合与主组装模型建议',
      'aggregator.curator_hint': '启用时：策展人会提炼每个候选方案的精华部分，应用反模式清单，并建议由哪个智能体模型组装最终方案。',
      'aggregator.stream_label': '实时流式传输裁判/策展人思考过程',
      'aggregator.stream_hint': '将裁判生成的思考过程实时推送到聊天框，实现零延迟首字响应。',
      'aggregator.peer_label': '决策评议会：候选模型交叉互评（第二轮 Consilium）',
      'aggregator.peer_hint': '在主裁判终审前，各候选模型互相审阅并改进彼此的方案代码。',
      'aggregator.override_label': '允许手动候选方案提拔操作 (Override)',
      'aggregator.override_hint': '在 .moa 目录中保留候选模型的工作区，允许通过聊天命令提拔任意候选模型的文件。',
      'proposers.role_label': '工程角色画像：',
      'proposers.role_general': '通用平衡 (General)',
      'proposers.role_minimalist': '极简标准库 (Minimalist)',
      'proposers.role_robustness': '防御鲁棒 (Robustness)',
      'proposers.role_performance': '极致性能 (Performance)',
      'proposers.role_tester': '测试驱动 (Tester)',
      'leaderboard.filter_all': '全部预设',
      'leaderboard.export_csv': '导出 CSV',
      'leaderboard.export_json': '导出 JSON',
      'aggregator.blind_label': '盲审模式（对裁判隐藏候选模型名称）',
      'aggregator.blind_hint': '启用时：从裁判提示词中匿名化候选模型的提供商和名称，杜绝品牌偏见。',
      'aggregator.timeout_label': '裁判综合超时时长（秒）：',
      'proposers.timeout_label': '候选模型生成超时时长（秒）：',
      'leaderboard.title': '🏆 模型胜率排行榜',
      'leaderboard.desc': '基于历史记录的 MoA 裁判评测判决数据统计指标。',
      'leaderboard.model': '模型',
      'leaderboard.runs': '运行次数',
      'leaderboard.wins': '胜出次数',
      'leaderboard.winrate': '胜率',
      'leaderboard.cost': '平均成本',
      'leaderboard.empty': '暂无历史运行记录。',
      'aggregator.fallbacks_title': '备用裁判链',
      'aggregator.fallbacks_desc': '当主裁判触发速率限制或服务不可用时，自动顺序调用的备用模型。',
      'aggregator.add_fallback_btn': '+ 添加备用裁判',
      'proposers.quorum_label': '法定人数快进（防拖尾模型机制）',
      'proposers.quorum_hint': '当 67% 以上候选模型完成时，开启缓冲定时器（默认 10 秒），不再死等卡顿的模型。',
      'proposers.grace_label': '缓冲等待时长（秒）：',
      'proposers.title': '👥 候选提案模型 (Proposers)',
      'proposers.desc': '并行生成互相独立的解决方案，最大化思路多样性与解空间覆盖度。',
      'proposers.parallel_count': '并行提案模型数量',
      'proposers.candidate': '候选模型',
      'proposers.add_btn': '+ 添加候选模型',
      'proposers.temp_label': '候选模型采样温度 (Temperature)',
      'proposers.temp_hint': '推荐：0.6 – 0.8，鼓励创造性、发散性的独立探索。',
      'stats.title': '📈 MoA 数据分析与遥测',
      'stats.desc': '会话遥测、历史运行追踪及模型胜率统计。',
      'stats.total_runs': '总运行次数',
      'stats.avg_cost': '平均每次成本',
      'stats.active_models': '已配置模型数',
      'stats.preset_count': '预设总数',
      'picker.select': '选择模型…',
      'picker.search_placeholder': '按名称或提供商搜索模型…',
      'picker.found': '找到',
      'picker.of': '共',
      'picker.clear': '清除',
      'picker.none': '未找到匹配的模型。',
      'picker.custom': '使用自定义：',
      'actions.save': '保存配置',
      'actions.saving': '正在保存…',
      'actions.saved': '配置已成功保存！',
      'actions.retry': '重新加载配置',
      'badge.disabled': 'MoA 已禁用',
      'config.enabled_label': '启用 MoA（斜杠命令与轮次拦截路由）',
      'slash.desc': '使用智能体混合 (MoA) 协同综合运行此轮次 (/moa [预设] <提示词>)',
      'updater.title': '插件在线更新',
      'updater.desc': '检查 npm 镜像源上的最新版本并支持一键无感升级。',
      'updater.btnCheck': '检查更新',
      'updater.btnUpdate': '升级至 v{version}',
      'updater.checking': '正在检查版本...',
      'updater.updating': '正在执行更新...',
      'updater.current': '当前版本：v{version}',
      'updater.available': '发现新版本：v{version}',
      'updater.upToDate': '已是最新版本',
      'updater.checkFailed': '检查版本失败',
      'updater.success': '成功更新至 v{version}，请重启 DSH 使其生效。',
    }


    function makeT(dict, fallback) {
      return function t(key, vars) {
        let val = (dict && dict[key]) || (fallback && fallback[key]) || key
        if (vars && typeof val === 'string') {
          for (const k of Object.keys(vars)) {
            val = val.replace(new RegExp('\\{' + k + '\\}', 'g'), String(vars[k]))
          }
        }
        return val
      }
    }

    function FallbackChevron({ className, style }) {
      return React.createElement(
        'svg',
        {
          width: 14,
          height: 14,
          viewBox: '0 0 14 14',
          fill: 'none',
          'aria-hidden': true,
          className,
          style,
        },
        React.createElement('path', {
          d: 'M3.5 5.25L7 8.75L10.5 5.25',
          stroke: 'currentColor',
          strokeWidth: 1.5,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        })
      )
    }
    let Chevron = FallbackChevron
    try {
      const primitives = require('@deepseek-ai/dsh-client-ui-primitives')
      if (primitives && typeof primitives.IconChevronDownOutline14 === 'function') {
        Chevron = primitives.IconChevronDownOutline14
      }
    } catch (noPrimitives) {
      Chevron = FallbackChevron
    }

    const STYLES = `
/* dsh-moa modern clinebot-aligned styling */
.moa-page{display:flex;flex-direction:column;gap:18px;padding:4px 0 24px;max-width:960px}
.moa-header{display:flex;flex-direction:column;gap:8px;padding-bottom:14px;border-bottom:1px solid var(--dsw-alias-border-l2)}
.moa-page-title{font-size:20px;font-weight:700;color:var(--dsw-alias-label-primary);display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.moa-page-sub{font-size:13px;color:var(--dsw-alias-label-secondary);line-height:1.5}

.moa-badge-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:2px}
.moa-badge{font-size:12px;padding:3px 10px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2);display:inline-flex;align-items:center;gap:5px;font-weight:500}
.moa-badge-ok{border-color:var(--dsw-alias-state-success-primary);color:var(--dsw-alias-state-success-primary);background:color-mix(in srgb, var(--dsw-alias-state-success-primary) 10%, transparent)}
.moa-badge-warn{border-color:var(--dsw-alias-state-warning-primary);color:var(--dsw-alias-state-warning-primary);background:color-mix(in srgb, var(--dsw-alias-state-warning-primary) 10%, transparent)}
.moa-badge-brand{border-color:var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2)}

.moa-section-card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:12px;padding:18px 20px;display:flex;flex-direction:column;gap:14px}
.moa-section-title{font-size:15px;font-weight:600;color:var(--dsw-alias-label-primary);display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
.moa-section-desc{font-size:13px;color:var(--dsw-alias-label-secondary);margin-top:-6px;line-height:1.4}

.moa-grid-2{display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:12px}
.moa-stat-box{padding:12px 14px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-2);display:flex;flex-direction:column;gap:4px}
.moa-stat-val{font-size:18px;font-weight:700;color:var(--dsw-alias-label-primary)}
.moa-stat-lbl{font-size:12px;color:var(--dsw-alias-label-secondary)}

.moa-input{height:36px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border-radius:8px;padding:0 12px;font-size:13px;width:100%;box-sizing:border-box}
.moa-input:focus{outline:none;border-color:var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))}
.moa-textarea{width:100%;box-sizing:border-box;padding:10px 12px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-size:13px;resize:vertical;outline:none;line-height:1.4}
.moa-textarea:focus{border-color:var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))}

.moa-btn{appearance:none;font:inherit;cursor:pointer;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:7px 14px;font-size:13px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-weight:500;display:inline-flex;align-items:center;justify-content:center;gap:6px;transition:all .15s ease}
.moa-btn:hover:not(:disabled){background:var(--dsw-alias-bg-layer-4, var(--dsw-alias-bg-layer-1));border-color:var(--dsw-alias-label-secondary)}
.moa-btn-primary{background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3);border-color:transparent}
.moa-btn-primary:hover:not(:disabled){background:var(--dsw-alias-label-primary) !important;color:var(--dsw-alias-bg-layer-3) !important;opacity:0.9}
.moa-btn-danger{color:var(--dsw-alias-state-error-primary);border-color:color-mix(in srgb, var(--dsw-alias-state-error-primary) 35%, transparent)}
.moa-btn-danger:hover:not(:disabled){background:color-mix(in srgb, var(--dsw-alias-state-error-primary) 12%, transparent) !important;border-color:color-mix(in srgb, var(--dsw-alias-state-error-primary) 50%, transparent)}
.moa-btn-sub{padding:5px 12px;font-size:12px;border-radius:6px}

/* Segmented Buttons */
.moa-seg-group{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.moa-seg-btn{appearance:none;font:inherit;padding:6px 14px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-size:13px;font-weight:500;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:all .15s ease}
.moa-seg-btn:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-label-secondary)}
.moa-seg-btn-active{background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3);border-color:transparent;font-weight:600}
.moa-seg-btn-active:hover{background:var(--dsw-alias-label-primary) !important;color:var(--dsw-alias-bg-layer-3) !important}

/* Sliders */
.moa-slider-row{display:flex;align-items:center;gap:14px}
.moa-slider{flex:1;accent-color:var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary));cursor:pointer;height:6px}
.moa-slider-badge{min-width:48px;height:30px;padding:0 8px;display:flex;align-items:center;justify-content:center;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);border-radius:6px;font-size:13px;font-weight:700;color:var(--dsw-alias-label-primary)}

/* Candidate Rows */
.moa-cand-list{display:flex;flex-direction:column;gap:10px}
.moa-cand-row{display:flex;align-items:center;gap:10px}
.moa-cand-badge{font-size:12px;font-weight:600;color:var(--dsw-alias-label-secondary);min-width:92px;flex-shrink:0}
.moa-cand-picker{flex:1;min-width:0}

/* Searchable Model Picker */
.moa-picker-container{position:relative;width:100%}
.moa-picker-btn{width:100%;min-height:38px;padding:6px 12px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;color:var(--dsw-alias-label-primary);display:flex;align-items:center;justify-content:space-between;cursor:pointer;font-size:13px;text-align:left;box-sizing:border-box;gap:8px}
.moa-picker-btn:hover{border-color:var(--dsw-alias-label-secondary)}
.moa-picker-summary{display:flex;align-items:center;gap:8px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.moa-prov-chip{font-size:11px;font-weight:600;text-transform:uppercase;padding:2px 6px;border-radius:4px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);flex-shrink:0}
.moa-model-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500}
.moa-picker-popover{position:absolute;top:calc(100% + 4px);left:0;right:0;background:var(--dsw-alias-bg-layer-3);border:1px solid var(--dsw-alias-border-l2);border-radius:10px;box-shadow:0 12px 36px color-mix(in srgb, var(--dsw-alias-label-tertiary) 45%, transparent);z-index:1000;max-height:360px;display:flex;flex-direction:column;overflow:hidden}
.moa-picker-search-bar{padding:8px 10px;border-bottom:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);display:flex;flex-direction:column;gap:4px}
.moa-search-input{width:100%;height:32px;padding:0 10px;background:var(--dsw-alias-bg-layer-3);border:1px solid var(--dsw-alias-border-l2);border-radius:6px;color:var(--dsw-alias-label-primary);font-size:13px;outline:none;box-sizing:border-box}
.moa-search-input:focus{border-color:var(--dsw-alias-label-primary)}
.moa-search-info{font-size:11px;color:var(--dsw-alias-label-tertiary);padding:0 2px;display:flex;justify-content:space-between}
.moa-picker-list{overflow-y:auto;max-height:280px;padding:6px;display:flex;flex-direction:column;gap:2px}
.moa-group-title{font-size:11px;font-weight:700;text-transform:uppercase;color:var(--dsw-alias-label-tertiary);padding:8px 8px 4px}
.moa-picker-item{display:flex;align-items:center;justify-content:space-between;padding:7px 10px;border-radius:6px;font-size:13px;color:var(--dsw-alias-label-primary);cursor:pointer;text-align:left;border:none;background:transparent;width:100%;gap:8px}
.moa-picker-item:hover, .moa-picker-item-selected{background:var(--dsw-alias-interactive-bg-hover, var(--dsw-alias-bg-layer-2))}
.moa-picker-check{color:var(--dsw-alias-state-success-primary);font-weight:bold;font-size:14px;flex-shrink:0}
.moa-custom-opt{padding:8px 10px;border-top:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);font-size:12px;color:var(--dsw-alias-label-primary);cursor:pointer;display:flex;align-items:center;gap:6px}

/* Alerts & Collapsible Card */
.moa-alert-ok{padding:10px 14px;border-radius:8px;background:color-mix(in srgb, var(--dsw-alias-state-success-primary) 10%, transparent);color:var(--dsw-alias-state-success-primary);font-size:13px;font-weight:500}
.moa-alert-err{padding:10px 14px;border-radius:8px;background:color-mix(in srgb, var(--dsw-alias-state-error-primary) 10%, transparent);color:var(--dsw-alias-state-error-primary);font-size:13px;font-weight:500}
.moa-card{list-style:none;margin:0;padding:0;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:12px;overflow:hidden;transition:border-color .15s ease}
.moa-head{width:100%;padding:14px 18px;display:flex;align-items:center;justify-content:space-between;background:transparent;border:none;color:inherit;cursor:pointer;text-align:left}
.moa-head:hover{background:var(--dsw-alias-bg-layer-2)}
.moa-title{font-size:15px;font-weight:600;color:var(--dsw-alias-label-primary)}
.moa-sub{font-size:12px;color:var(--dsw-alias-label-secondary);margin-top:2px}
.moa-chev{transition:transform .2s ease;color:var(--dsw-alias-label-secondary)}
.moa-chev-open{transform:rotate(180deg)}
.moa-body{padding:0 18px 20px;border-top:1px solid var(--dsw-alias-border-l2)}
`

    let stylesInjected = false
    function ensureStyles() {
      if (stylesInjected || typeof document === 'undefined') return
      stylesInjected = true
      const style = document.createElement('style')
      style.id = 'dsh-moa-full-css'
      if (style.dataset) {
        style.dataset.dshPlugin = NS
      } else if (typeof style.setAttribute === 'function') {
        style.setAttribute('data-dsh-plugin', NS)
      }
      style.textContent = STYLES
      document.head.appendChild(style)
    }

    const PROVIDER_TITLES = {
      codex: 'ChatGPT Codex',
      claude: 'Claude (Anthropic)',
      grok: 'Grok (xAI)',
      antigravity: 'Antigravity (Google)',
      gemini: 'Google Gemini',
      commandcode: 'CommandCode Provider',
      'opencode-go': 'OpenCode-Go',
      'qwen-token-plan': 'Qwen (Token Plan)',
      groq: 'Groq Cloud',
      zai: 'Zhipu GLM',
      ollama: 'Ollama (Local / Cloud)',
      'kimi-coding': 'Kimi Coding',
      minimax: 'MiniMax',
      'xiaomi-token-plan-sgp': 'Xiaomi Token Plan',
      'deepseek-official': 'DeepSeek Official',
    }

    function SearchableModelPicker({
      provider,
      model,
      onChange,
      availableModels = [],
      t,
    }) {
      const [open, setOpen] = React.useState(false)
      const [query, setQuery] = React.useState('')
      const rootRef = React.useRef(null)
      const inputRef = React.useRef(null)

      const selectedLabel = React.useMemo(() => {
        if (!provider && !model) return t('picker.select')
        const found = availableModels.find((m) => m.provider === provider && m.model === model)
        return found ? (found.label || `${provider}: ${found.model}`) : `${provider}:${model}`
      }, [availableModels, provider, model, t])

      const filtered = React.useMemo(() => {
        const q = query.trim().toLowerCase()
        if (!q) return availableModels
        return availableModels.filter((m) => {
          const prov = (m.provider || '').toLowerCase()
          const mod = (m.model || '').toLowerCase()
          const lbl = (m.label || '').toLowerCase()
          return prov.includes(q) || mod.includes(q) || lbl.includes(q)
        })
      }, [availableModels, query])

      const grouped = React.useMemo(() => {
        const map = new Map()
        for (const m of filtered) {
          const p = m.provider || 'other'
          if (!map.has(p)) map.set(p, [])
          map.get(p).push(m)
        }
        const groups = []
        for (const [prov, items] of map.entries()) {
          const title = PROVIDER_TITLES[prov] || prov.toUpperCase()
          groups.push({ provider: prov, title, items })
        }
        return groups
      }, [filtered])

      React.useEffect(() => {
        if (!open) return
        const handleClickOutside = (e) => {
          if (rootRef.current && !rootRef.current.contains(e.target)) {
            setOpen(false)
          }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
      }, [open])

      React.useEffect(() => {
        if (open && inputRef.current) {
          inputRef.current.focus()
        }
      }, [open])

      const handleSelect = (item) => {
        onChange(item.provider, item.model)
        setOpen(false)
        setQuery('')
      }

      const handleCustom = () => {
        const trimmed = query.trim()
        if (!trimmed) return
        let prov = provider || 'custom'
        let mod = trimmed
        if (trimmed.includes(':')) {
          const [p, ...rest] = trimmed.split(':')
          prov = p.trim()
          mod = rest.join(':').trim()
        }
        onChange(prov, mod)
        setOpen(false)
        setQuery('')
      }

      return React.createElement(
        'div',
        { className: 'moa-picker-container', ref: rootRef },
        React.createElement(
          'button',
          {
            type: 'button',
            className: 'moa-picker-btn',
            onClick: () => setOpen(!open),
          },
          React.createElement(
            'div',
            { className: 'moa-picker-summary' },
            provider && React.createElement('span', { className: 'moa-prov-chip' }, provider),
            React.createElement('span', { className: 'moa-model-name' }, selectedLabel)
          ),
          React.createElement(Chevron, { style: { transform: open ? 'rotate(180deg)' : 'none' } })
        ),
        open &&
          React.createElement(
            'div',
            { className: 'moa-picker-popover' },
            React.createElement(
              'div',
              { className: 'moa-picker-search-bar' },
              React.createElement('input', {
                ref: inputRef,
                type: 'text',
                className: 'moa-search-input',
                placeholder: t('picker.search_placeholder'),
                value: query,
                onChange: (e) => setQuery(e.target.value),
                onKeyDown: (e) => {
                  if (e.key === 'Escape') setOpen(false)
                  if (e.key === 'Enter' && query.trim()) handleCustom()
                },
              }),
              React.createElement(
                'div',
                { className: 'moa-search-info' },
                React.createElement(
                  'span',
                  null,
                  `${t('picker.found')}: ${filtered.length} ${t('picker.of')} ${availableModels.length}`
                ),
                query &&
                  React.createElement(
                    'span',
                    { style: { cursor: 'pointer', textDecoration: 'underline' }, onClick: () => setQuery('') },
                    t('picker.clear')
                  )
              )
            ),
            React.createElement(
              'div',
              { className: 'moa-picker-list' },
              grouped.map((g) =>
                React.createElement(
                  React.Fragment,
                  { key: g.provider },
                  React.createElement('div', { className: 'moa-group-title' }, g.title),
                  g.items.map((item) => {
                    const isCur = item.provider === provider && item.model === model
                    return React.createElement(
                      'button',
                      {
                        key: `${item.provider}:${item.model}`,
                        type: 'button',
                        className: isCur ? 'moa-picker-item moa-picker-item-selected' : 'moa-picker-item',
                        onClick: () => handleSelect(item),
                      },
                      React.createElement(
                        'div',
                        { style: { display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 } },
                        React.createElement('span', { className: 'moa-prov-chip' }, item.provider),
                        React.createElement('span', { className: 'moa-model-name' }, item.label || item.model)
                      ),
                      isCur && React.createElement('span', { className: 'moa-picker-check' }, '✓')
                    )
                  })
                )
              ),
              filtered.length === 0 &&
                React.createElement(
                  'div',
                  { style: { padding: '12px 10px', fontSize: 13, color: 'var(--dsw-alias-label-secondary)' } },
                  t('picker.none')
                )
            ),
            query.trim() &&
              React.createElement(
                'div',
                { className: 'moa-custom-opt', onClick: handleCustom },
                React.createElement('span', null, '➕'),
                React.createElement(
                  'span',
                  null,
                  `${t('picker.custom')}"${query.trim()}"`
                )
              )
          )
      )
    }

    function MoAEditor({
      t,
      presets,
      setPresets,
      defaultPreset,
      setDefaultPreset,
      availableModels,
      enabled,
      setEnabled,
      hostStatus,
      stats,
      leaderboard = [],
      leaderboardPresetFilter = 'all',
      setLeaderboardPresetFilter = () => {},
      handleSave,
      saveStatus,
      reload,
      updateState,
      checkUpdates,
      runUpdate,
    }) {
      const [selectedPresetName, setSelectedPresetName] = React.useState(defaultPreset || (presets[0] && presets[0].name) || 'default')
      const [isCreating, setIsCreating] = React.useState(false)
      const [newPresetName, setNewPresetName] = React.useState('')

      React.useEffect(() => {
        if (!presets.some((p) => p.name === selectedPresetName)) {
          setSelectedPresetName(defaultPreset || (presets[0] && presets[0].name) || 'default')
        }
      }, [presets, selectedPresetName, defaultPreset])

      const currentPreset = presets.find((p) => p.name === selectedPresetName) || presets[0] || {
        name: 'default',
        reference_models: [],
        aggregator: { provider: 'codex', model: 'gpt-5.6-sol' },
        aggregator_temperature: 0.4,
        reference_temperature: 0.6,
        judge_criteria: '',
        ask_clarifying_questions: true,
      }

      const updateCurrentPreset = (modifier) => {
        setPresets((prev) => {
          const copy = structuredClone(prev || [])
          const idx = copy.findIndex((p) => p.name === currentPreset.name)
          if (idx !== -1) {
            copy[idx] = modifier(copy[idx])
          }
          return copy
        })
      }

      const setAggregatorModel = (prov, mod) => {
        updateCurrentPreset((p) => ({ ...p, aggregator: { provider: prov, model: mod } }))
      }

      const setAggregatorTemp = (temp) => {
        const val = Math.round(Number(temp) * 100) / 100
        updateCurrentPreset((p) => ({ ...p, aggregator_temperature: val }))
      }

      const setReferenceTemp = (temp) => {
        const val = Math.round(Number(temp) * 100) / 100
        updateCurrentPreset((p) => ({ ...p, reference_temperature: val }))
      }

      const setJudgeCriteria = (criteria) => {
        updateCurrentPreset((p) => ({ ...p, judge_criteria: criteria }))
      }

      const setReferenceModel = (idx, prov, mod) => {
        updateCurrentPreset((p) => {
          const refs = [...(p.reference_models || [])]
          refs[idx] = { provider: prov, model: mod }
          return { ...p, reference_models: refs }
        })
      }

      const setReferenceCount = (targetCount) => {
        updateCurrentPreset((p) => {
          let refs = [...(p.reference_models || [])]
          if (refs.length > targetCount) {
            refs = refs.slice(0, targetCount)
          } else {
            while (refs.length < targetCount) {
              const fallback = availableModels[refs.length % (availableModels.length || 1)] || {
                provider: 'opencode-go',
                model: 'deepseek-v4-flash',
              }
              refs.push({ provider: fallback.provider, model: fallback.model })
            }
          }
          return { ...p, reference_models: refs }
        })
      }

      const removeReference = (idx) => {
        updateCurrentPreset((p) => {
          const refs = [...(p.reference_models || [])]
          refs.splice(idx, 1)
          return { ...p, reference_models: refs }
        })
      }

      const addReference = () => {
        updateCurrentPreset((p) => {
          const refs = [...(p.reference_models || [])]
          const fallback = availableModels[refs.length % (availableModels.length || 1)] || {
            provider: 'opencode-go',
            model: 'deepseek-v4-flash',
          }
          refs.push({ provider: fallback.provider, model: fallback.model })
          return { ...p, reference_models: refs }
        })
      }

      const handleCreatePreset = () => {
        const name = newPresetName.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-')
        if (!name) return
        if (presets.some((p) => p.name === name)) {
          setSelectedPresetName(name)
          setIsCreating(false)
          setNewPresetName('')
          return
        }
        const created = {
          name,
          enabled: true,
          ask_clarifying_questions: true,
          reference_models: currentPreset?.reference_models?.length ? structuredClone(currentPreset.reference_models) : [
            { provider: 'opencode-go', model: 'deepseek-v4-flash' },
            { provider: 'codex', model: 'gpt-5.6-sol' },
          ],
          aggregator: currentPreset?.aggregator?.provider ? structuredClone(currentPreset.aggregator) : {
            provider: 'codex',
            model: 'gpt-5.6-sol',
          },
          reference_temperature: 0.6,
          aggregator_temperature: 0.4,
          max_tokens: 4096,
          judge_criteria: '',
        }
        setPresets((prev) => [...(prev || []), created])
        setSelectedPresetName(name)
        setIsCreating(false)
        setNewPresetName('')
      }

      const handleDeletePreset = (nameToDelete) => {
        if (presets.length <= 1) return
        if (typeof window !== 'undefined' && window.confirm) {
          if (!window.confirm(t('presets.del_confirm', { name: nameToDelete }))) return
        }
        setPresets((prev) => prev.filter((p) => p.name !== nameToDelete))
        if (defaultPreset === nameToDelete) {
          const nextDefault = presets.find((p) => p.name !== nameToDelete)?.name || 'default'
          setDefaultPreset(nextDefault)
        }
      }

      const aggTemp = currentPreset.aggregator_temperature !== undefined ? currentPreset.aggregator_temperature : 0.4
      const refTemp = currentPreset.reference_temperature !== undefined ? currentPreset.reference_temperature : 0.6
      const currentRefs = currentPreset.reference_models || []
      const judgeCriteria = currentPreset.judge_criteria || ''
      const isDefault = defaultPreset === currentPreset.name
      const hostStatusBadge = hostStatus === 'online'
        ? React.createElement('span', { className: 'moa-badge moa-badge-ok' }, '🟢 ' + t('badge.online'))
        : hostStatus === 'disabled'
          ? React.createElement('span', { className: 'moa-badge moa-badge-warn' }, '⏸ ' + t('badge.disabled'))
          : React.createElement('span', { className: 'moa-badge moa-badge-warn' }, '🔴 ' + t('badge.offline'))

      return React.createElement(
        'div',
        { className: 'moa-page' },

        /* ── HEADER WITH LIVE STATUS CHIPS ── */
        React.createElement(
          'div',
          { className: 'moa-header' },
          React.createElement(
            'div',
            { className: 'moa-page-title' },
            React.createElement('span', null, '🧠 ' + t('header.title')),
              React.createElement(
                'div',
                { className: 'moa-badge-row' },
                hostStatusBadge,
                React.createElement('span', { className: 'moa-badge moa-badge-brand' }, t('badge.preset', { name: currentPreset.name })),
              React.createElement('span', { className: 'moa-badge moa-badge-brand' }, t('badge.models', { count: availableModels.length })),
              React.createElement('span', { className: 'moa-badge moa-badge-brand' }, t('badge.candidates', { count: currentRefs.length }))
            )
          ),
          React.createElement('div', { className: 'moa-page-sub' }, t('header.sub'))
        ),

        /* ── SECTION 1: PRESET MANAGEMENT ── */
        React.createElement(
          'div',
          { className: 'moa-section-card' },
          React.createElement(
            'div',
            { className: 'moa-section-title' },
            React.createElement('span', null, t('presets.title')),
            React.createElement(
              'div',
              { style: { display: 'flex', gap: 8, alignItems: 'center' } },
              !isDefault &&
                React.createElement(
                  'button',
                  {
                    type: 'button',
                    className: 'moa-btn moa-btn-sub',
                    onClick: () => setDefaultPreset(currentPreset.name),
                  },
                  '★ ' + t('presets.set_default')
                ),
              isDefault &&
                React.createElement('span', { className: 'moa-badge moa-badge-ok' }, '✓ ' + t('presets.active_badge')),
              !isCreating &&
                React.createElement(
                  'button',
                  {
                    type: 'button',
                    className: 'moa-btn moa-btn-sub',
                    onClick: () => setIsCreating(true),
                  },
                  t('presets.new_btn')
                )
            )
          ),
          React.createElement('div', { className: 'moa-section-desc' }, t('presets.desc')),
          React.createElement(
            'div',
            { className: 'moa-seg-group' },
            presets.map((p) => {
              const isCur = p.name === selectedPresetName
              return React.createElement(
                'button',
                {
                  key: p.name,
                  type: 'button',
                  className: isCur ? 'moa-seg-btn moa-seg-btn-active' : 'moa-seg-btn',
                  onClick: () => setSelectedPresetName(p.name),
                },
                p.name === defaultPreset ? `★ ${p.name}` : p.name
              )
            }),
            presets.length > 1 &&
              React.createElement(
                'button',
                {
                  type: 'button',
                  className: 'moa-btn moa-btn-danger moa-btn-sub',
                  onClick: () => handleDeletePreset(currentPreset.name),
                  title: t('presets.del_btn'),
                },
                '🗑 ' + t('presets.del_btn')
              )
          ),
          isCreating &&
            React.createElement(
              'div',
              { style: { display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 } },
              React.createElement('input', {
                type: 'text',
                className: 'moa-input',
                style: { maxWidth: 320 },
                placeholder: t('presets.name_placeholder'),
                value: newPresetName,
                onChange: (e) => setNewPresetName(e.target.value),
                onKeyDown: (e) => {
                  if (e.key === 'Enter') handleCreatePreset()
                  if (e.key === 'Escape') setIsCreating(false)
                },
              }),
              React.createElement(
                'button',
                {
                  type: 'button',
                  className: 'moa-btn moa-btn-primary',
                  onClick: handleCreatePreset,
                },
                t('presets.create')
              ),
              React.createElement(
                'button',
                {
                  type: 'button',
                  className: 'moa-btn',
                  onClick: () => setIsCreating(false),
                },
                t('presets.cancel')
              )
            )
        ),

        /* ── SECTION 2: AGGREGATOR / JUDGE ── */
        React.createElement(
          'div',
          { className: 'moa-section-card' },
          React.createElement(
            'div',
            { className: 'moa-section-title' },
            React.createElement('span', null, t('aggregator.title')),
            React.createElement('span', { className: 'moa-badge moa-badge-brand' }, `Temp: ${aggTemp}`)
          ),
          React.createElement('div', { className: 'moa-section-desc' }, t('aggregator.desc')),
          React.createElement(SearchableModelPicker, {
            provider: currentPreset.aggregator?.provider || '',
            model: currentPreset.aggregator?.model || '',
            onChange: setAggregatorModel,
            availableModels,
            t,
          }),
          React.createElement(
            'div',
            { style: { display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 } },
            React.createElement(
              'div',
              { style: { display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 500 } },
              React.createElement('span', null, t('aggregator.temp_label')),
              React.createElement('span', { style: { color: 'var(--dsw-alias-label-secondary)', fontSize: 12 } }, t('aggregator.temp_hint'))
            ),
            React.createElement(
              'div',
              { className: 'moa-slider-row' },
              React.createElement('input', {
                type: 'range',
                className: 'moa-slider',
                min: '0',
                max: '2',
                step: '0.05',
                value: aggTemp,
                onChange: (e) => setAggregatorTemp(e.target.value),
              }),
              React.createElement('div', { className: 'moa-slider-badge' }, aggTemp)
            )
          ),
          React.createElement(
            'div',
            { style: { display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4, borderTop: '1px solid var(--dsw-alias-border-l2)', paddingTop: 10 } },
            React.createElement('label', { style: { fontSize: 13, fontWeight: 500 } }, t('aggregator.criteria_label')),
            React.createElement('textarea', {
              className: 'moa-textarea',
              rows: 2,
              placeholder: t('aggregator.criteria_placeholder'),
              value: judgeCriteria,
              onChange: (e) => setJudgeCriteria(e.target.value),
            }),
            React.createElement(
              'div',
              { style: { marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3 } },
              React.createElement(
                'label',
                { style: { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 } },
                React.createElement('input', {
                  type: 'checkbox',
                  checked: currentPreset.ask_clarifying_questions !== false,
                  onChange: (e) => updateCurrentPreset((p) => ({ ...p, ask_clarifying_questions: e.target.checked })),
                  style: { accentColor: 'var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))', cursor: 'pointer' },
                }),
                t('aggregator.questions_label')
              ),
              React.createElement(
                'div',
                { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)', marginLeft: 22 } },
                t('aggregator.questions_hint')
              ),
              React.createElement(
                'label',
                { style: { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500, marginTop: 8 } },
                React.createElement('input', {
                  type: 'checkbox',
                  checked: Boolean(currentPreset.curator_synthesis),
                  onChange: (e) => updateCurrentPreset((p) => ({ ...p, curator_synthesis: e.target.checked })),
                  style: { accentColor: 'var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))', cursor: 'pointer' },
                }),
                t('aggregator.curator_label')
              ),
              React.createElement(
                'div',
                { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)', marginLeft: 22 } },
                t('aggregator.curator_hint')
              ),
              React.createElement(
                'label',
                { style: { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500, marginTop: 8 } },
                React.createElement('input', {
                  type: 'checkbox',
                  checked: currentPreset.stream_aggregator !== false,
                  onChange: (e) => updateCurrentPreset((p) => ({ ...p, stream_aggregator: e.target.checked })),
                  style: { accentColor: 'var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))', cursor: 'pointer' },
                }),
                t('aggregator.stream_label')
              ),
              React.createElement(
                'div',
                { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)', marginLeft: 22 } },
                t('aggregator.stream_hint')
              ),
              React.createElement(
                'label',
                { style: { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500, marginTop: 8 } },
                React.createElement('input', {
                  type: 'checkbox',
                  checked: Boolean(currentPreset.blind_evaluation),
                  onChange: (e) => updateCurrentPreset((p) => ({ ...p, blind_evaluation: e.target.checked })),
                  style: { accentColor: 'var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))', cursor: 'pointer' },
                }),
                t('aggregator.blind_label')
              ),
              React.createElement(
                'div',
                { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)', marginLeft: 22 } },
                t('aggregator.blind_hint')
              ),
              React.createElement(
                'div',
                { style: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 } },
                React.createElement('span', { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)' } }, t('aggregator.timeout_label')),
                React.createElement('input', {
                  type: 'number',
                  className: 'moa-input',
                  style: { width: 80, height: 28, padding: '0 6px', fontSize: 12 },
                  min: 30,
                  max: 600,
                  value: currentPreset.aggregator_timeout_sec ?? 180,
                  onChange: (e) => {
                    const val = parseInt(e.target.value, 10)
                    updateCurrentPreset((p) => ({ ...p, aggregator_timeout_sec: isNaN(val) ? 180 : val }))
                  },
                })
              ),
              React.createElement(
                'label',
                { style: { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500, marginTop: 8 } },
                React.createElement('input', {
                  type: 'checkbox',
                  checked: Boolean(currentPreset.peer_critique_enabled),
                  onChange: (e) => updateCurrentPreset((p) => ({ ...p, peer_critique_enabled: e.target.checked })),
                  style: { accentColor: 'var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))', cursor: 'pointer' },
                }),
                t('aggregator.peer_label')
              ),
              React.createElement(
                'div',
                { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)', marginLeft: 22 } },
                t('aggregator.peer_hint')
              ),
              React.createElement(
                'label',
                { style: { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500, marginTop: 8 } },
                React.createElement('input', {
                  type: 'checkbox',
                  checked: Boolean(currentPreset.allow_candidate_override),
                  onChange: (e) => updateCurrentPreset((p) => ({ ...p, allow_candidate_override: e.target.checked })),
                  style: { accentColor: 'var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))', cursor: 'pointer' },
                }),
                t('aggregator.override_label')
              ),
              React.createElement(
                'div',
                { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)', marginLeft: 22 } },
                t('aggregator.override_hint')
              ),
              /* Fallback Judges Chain */
              React.createElement(
                'div',
                { style: { marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 } },
                React.createElement(
                  'div',
                  { style: { fontSize: 13, fontWeight: 600, color: 'var(--dsw-alias-label-primary)' } },
                  t('aggregator.fallbacks_title')
                ),
                React.createElement(
                  'div',
                  { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)', marginTop: -4 } },
                  t('aggregator.fallbacks_desc')
                ),
                (Array.isArray(currentPreset.aggregator_fallbacks) ? currentPreset.aggregator_fallbacks : []).map((fb, fbIdx) =>
                  React.createElement(
                    'div',
                    { key: fbIdx, style: { display: 'flex', alignItems: 'center', gap: 8 } },
                    React.createElement('span', { className: 'moa-cand-badge' }, `Fallback #${fbIdx + 1}`),
                    React.createElement(
                      'div',
                      { style: { flex: 1 } },
                      React.createElement(SearchableModelPicker, {
                        value: fb,
                        onChange: (val) => {
                          updateCurrentPreset((p) => {
                            const list = [...(p.aggregator_fallbacks || [])]
                            list[fbIdx] = val
                            return { ...p, aggregator_fallbacks: list }
                          })
                        },
                        allModels,
                        t,
                      })
                    ),
                    React.createElement(
                      'button',
                      {
                        type: 'button',
                        className: 'moa-btn moa-btn-danger moa-btn-sub',
                        onClick: () => {
                          updateCurrentPreset((p) => ({
                            ...p,
                            aggregator_fallbacks: (p.aggregator_fallbacks || []).filter((_, i) => i !== fbIdx),
                          }))
                        },
                      },
                      '✕'
                    )
                  )
                ),
                React.createElement(
                  'div',
                  null,
                  React.createElement(
                    'button',
                    {
                      type: 'button',
                      className: 'moa-btn moa-btn-sub',
                      style: { marginTop: 4 },
                      onClick: () => {
                        updateCurrentPreset((p) => ({
                          ...p,
                          aggregator_fallbacks: [...(p.aggregator_fallbacks || []), { provider: 'opencode-go', model: 'deepseek-v4-flash' }],
                        }))
                      },
                    },
                    t('aggregator.add_fallback_btn')
                  )
                )
              )
            )
          )
        ),

        /* ── SECTION 3: CANDIDATE PROPOSERS ── */
        React.createElement(
          'div',
          { className: 'moa-section-card' },
          React.createElement(
            'div',
            { className: 'moa-section-title' },
            React.createElement('span', null, t('proposers.title')),
            React.createElement(
              'div',
              { className: 'moa-seg-group' },
              React.createElement('span', { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)' } }, t('proposers.parallel_count') + ':'),
              [2, 3, 4, 5].map((cnt) =>
                React.createElement(
                  'button',
                  {
                    key: cnt,
                    type: 'button',
                    className: currentRefs.length === cnt ? 'moa-seg-btn moa-seg-btn-active moa-btn-sub' : 'moa-seg-btn moa-btn-sub',
                    onClick: () => setReferenceCount(cnt),
                  },
                  cnt
                )
              )
            )
          ),
          React.createElement('div', { className: 'moa-section-desc' }, t('proposers.desc')),
          React.createElement(
            'div',
            { style: { display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 12px', background: 'var(--dsw-alias-bg-layer-2)', borderRadius: 8, border: '1px solid var(--dsw-alias-border-l2)' } },
            React.createElement(
              'label',
              { style: { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 } },
              React.createElement('input', {
                type: 'checkbox',
                checked: Boolean(currentPreset.quorum_enabled),
                onChange: (e) => updateCurrentPreset((p) => ({ ...p, quorum_enabled: e.target.checked })),
                style: { accentColor: 'var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))', cursor: 'pointer' },
              }),
              t('proposers.quorum_label')
            ),
            React.createElement(
              'div',
              { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)', marginLeft: 22 } },
              t('proposers.quorum_hint')
            ),
            currentPreset.quorum_enabled && React.createElement(
              'div',
              { style: { marginLeft: 22, display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 } },
              React.createElement('span', { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)' } }, t('proposers.grace_label')),
              React.createElement('input', {
                type: 'number',
                className: 'moa-input',
                style: { width: 70, height: 28, padding: '0 6px', fontSize: 12 },
                min: 2,
                max: 60,
                value: currentPreset.grace_period_sec ?? 10,
                onChange: (e) => {
                  const val = parseInt(e.target.value, 10)
                  updateCurrentPreset((p) => ({ ...p, grace_period_sec: isNaN(val) ? 10 : val }))
                },
              })
            ),
            React.createElement(
              'div',
              { style: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 } },
              React.createElement('span', { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)' } }, t('proposers.timeout_label')),
              React.createElement('input', {
                type: 'number',
                className: 'moa-input',
                style: { width: 70, height: 28, padding: '0 6px', fontSize: 12 },
                min: 10,
                max: 300,
                value: currentPreset.reference_timeout_sec ?? 60,
                onChange: (e) => {
                  const val = parseInt(e.target.value, 10)
                  updateCurrentPreset((p) => ({ ...p, reference_timeout_sec: isNaN(val) ? 60 : val }))
                },
              })
            )
          ),
          React.createElement(
            'div',
            { className: 'moa-cand-list' },
            currentRefs.map((ref, idx) =>
              React.createElement(
                'div',
                { key: idx, className: 'moa-cand-row' },
                React.createElement('span', { className: 'moa-cand-badge' }, `${t('proposers.candidate')} #${idx + 1}`),
                React.createElement(
                  'div',
                  { className: 'moa-cand-picker' },
                  React.createElement(SearchableModelPicker, {
                    provider: ref.provider || '',
                    model: ref.model || '',
                    onChange: (p, m) => setReferenceModel(idx, p, m),
                    availableModels,
                    t,
                  })
                ),
                React.createElement(
                  'select',
                  {
                    className: 'moa-select',
                    style: { width: 105, height: 32, fontSize: 12, padding: '0 6px' },
                    value: ref.role_persona || 'general',
                    title: t('proposers.role_label'),
                    onChange: (e) => {
                      const newRole = e.target.value
                      updateCurrentPreset((p) => {
                        const refs = [...(p.reference_models || [])]
                        refs[idx] = { ...refs[idx], role_persona: newRole }
                        return { ...p, reference_models: refs }
                      })
                    },
                  },
                  React.createElement('option', { value: 'general' }, t('proposers.role_general') || 'General'),
                  React.createElement('option', { value: 'minimalist' }, t('proposers.role_minimalist') || 'Minimalist'),
                  React.createElement('option', { value: 'robustness' }, t('proposers.role_robustness') || 'Robustness'),
                  React.createElement('option', { value: 'performance' }, t('proposers.role_performance') || 'Performance'),
                  React.createElement('option', { value: 'tester' }, t('proposers.role_tester') || 'Tester')
                ),
                currentRefs.length > 1 &&
                  React.createElement(
                    'button',
                    {
                      type: 'button',
                      className: 'moa-btn moa-btn-danger moa-btn-sub',
                      title: 'Remove',
                      onClick: () => removeReference(idx),
                    },
                    '✕'
                  )
              )
            )
          ),
          React.createElement(
            'button',
            {
              type: 'button',
              className: 'moa-btn',
              style: { alignSelf: 'flex-start' },
              onClick: addReference,
            },
            t('proposers.add_btn')
          ),
          React.createElement(
            'div',
            { style: { display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4, borderTop: '1px solid var(--dsw-alias-border-l2)', paddingTop: 10 } },
            React.createElement(
              'div',
              { style: { display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 500 } },
              React.createElement('span', null, t('proposers.temp_label')),
              React.createElement('span', { style: { color: 'var(--dsw-alias-label-secondary)', fontSize: 12 } }, t('proposers.temp_hint'))
            ),
            React.createElement(
              'div',
              { className: 'moa-slider-row' },
              React.createElement('input', {
                type: 'range',
                className: 'moa-slider',
                min: '0',
                max: '2',
                step: '0.05',
                value: refTemp,
                onChange: (e) => setReferenceTemp(e.target.value),
              }),
              React.createElement('div', { className: 'moa-slider-badge' }, refTemp)
            )
          )
        ),

        /* ── SECTION 4: TELEMETRY & STATS SUMMARY ── */
        React.createElement(
          'div',
          { className: 'moa-section-card' },
          React.createElement('div', { className: 'moa-section-title' }, t('stats.title')),
          React.createElement('div', { className: 'moa-section-desc' }, t('stats.desc')),
          React.createElement(
            'div',
            { className: 'moa-grid-2' },
            React.createElement(
              'div',
              { className: 'moa-stat-box' },
              React.createElement('div', { className: 'moa-stat-val' }, String(presets.length)),
              React.createElement('div', { className: 'moa-stat-lbl' }, t('stats.preset_count'))
            ),
            React.createElement(
              'div',
              { className: 'moa-stat-box' },
              React.createElement('div', { className: 'moa-stat-val' }, (stats.totalRuns === null || stats.totalRuns === undefined) ? '—' : String(stats.totalRuns)),
              React.createElement('div', { className: 'moa-stat-lbl' }, t('stats.total_runs'))
            ),
            React.createElement(
              'div',
              { className: 'moa-stat-box' },
              React.createElement('div', { className: 'moa-stat-val' }, (stats.avgCostUsd === null || stats.avgCostUsd === undefined) ? '—' : `~\$${stats.avgCostUsd.toFixed(4)}`),
              React.createElement('div', { className: 'moa-stat-lbl' }, t('stats.avg_cost'))
            ),
            React.createElement(
              'div',
              { className: 'moa-stat-box' },
              React.createElement('div', { className: 'moa-stat-val' }, String(currentRefs.length)),
              React.createElement('div', { className: 'moa-stat-lbl' }, t('stats.active_models'))
            )
          ),
          Array.isArray(leaderboard) && leaderboard.length > 0 && React.createElement(
            'div',
            { style: { marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 } },
            React.createElement(
              'div',
              { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' } },
              React.createElement('div', { style: { fontSize: 13, fontWeight: 600, color: 'var(--dsw-alias-label-primary)' } }, t('leaderboard.title')),
              React.createElement(
                'div',
                { style: { display: 'flex', alignItems: 'center', gap: 6 } },
                React.createElement(
                  'select',
                  {
                    className: 'moa-select',
                    style: { height: 26, fontSize: 11, padding: '0 6px' },
                    value: leaderboardPresetFilter,
                    onChange: (e) => setLeaderboardPresetFilter(e.target.value),
                  },
                  React.createElement('option', { value: 'all' }, t('leaderboard.filter_all')),
                  presets.map((p) => React.createElement('option', { key: p.name, value: p.name }, p.name))
                ),
                React.createElement(
                  'a',
                  {
                    href: `/dsh-moa/history/export?format=csv${leaderboardPresetFilter !== 'all' ? '&preset=' + encodeURIComponent(leaderboardPresetFilter) : ''}`,
                    download: 'moa-history.csv',
                    className: 'moa-btn',
                    style: { height: 26, fontSize: 11, padding: '0 8px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' },
                  },
                  t('leaderboard.export_csv') || 'CSV'
                ),
                React.createElement(
                  'a',
                  {
                    href: `/dsh-moa/history/export?format=json${leaderboardPresetFilter !== 'all' ? '&preset=' + encodeURIComponent(leaderboardPresetFilter) : ''}`,
                    download: 'moa-history.json',
                    className: 'moa-btn',
                    style: { height: 26, fontSize: 11, padding: '0 8px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' },
                  },
                  t('leaderboard.export_json') || 'JSON'
                )
              )
            ),
            React.createElement('div', { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)', marginTop: -4 } }, t('leaderboard.desc')),
            React.createElement(
              'div',
              { style: { overflowX: 'auto', border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 8 } },
              React.createElement(
                'table',
                { style: { width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' } },
                React.createElement(
                  'thead',
                  { style: { background: 'var(--dsw-alias-bg-layer-2)', borderBottom: '1px solid var(--dsw-alias-border-l2)' } },
                  React.createElement(
                    'tr',
                    null,
                    React.createElement('th', { style: { padding: '6px 10px' } }, t('leaderboard.model')),
                    React.createElement('th', { style: { padding: '6px 8px' } }, t('leaderboard.runs')),
                    React.createElement('th', { style: { padding: '6px 8px' } }, t('leaderboard.wins')),
                    React.createElement('th', { style: { padding: '6px 8px' } }, t('leaderboard.winrate')),
                    React.createElement('th', { style: { padding: '6px 10px' } }, t('leaderboard.cost'))
                  )
                ),
                React.createElement(
                  'tbody',
                  null,
                  leaderboard.map((m, mIdx) =>
                    React.createElement(
                      'tr',
                      { key: mIdx, style: { borderBottom: mIdx < leaderboard.length - 1 ? '1px solid var(--dsw-alias-border-l2)' : 'none' } },
                      React.createElement('td', { style: { padding: '6px 10px', fontWeight: 500, color: 'var(--dsw-alias-label-primary)' } }, m.modelKey || m.model),
                      React.createElement('td', { style: { padding: '6px 8px', color: 'var(--dsw-alias-label-secondary)' } }, String(m.runs)),
                      React.createElement('td', { style: { padding: '6px 8px', color: 'var(--dsw-alias-state-success-primary)' } }, String(m.wins)),
                      React.createElement('td', { style: { padding: '6px 8px', fontWeight: 600 } }, (m.winRate ?? 0) + '%'),
                      React.createElement('td', { style: { padding: '6px 10px', color: 'var(--dsw-alias-label-secondary)' } }, (m.avgCostUsd > 0) ? ('$' + m.avgCostUsd.toFixed(4)) : 'Free')
                    )
                  )
                )
              )
            )
          )
        ),

        /* ── PLUGIN UPDATES ── */
        React.createElement(
          'div',
          { className: 'moa-section-card' },
          React.createElement(
            'div',
            { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 } },
            React.createElement('div', { className: 'moa-sec-title' }, '✨ ' + (t('updater.title') || 'Plugin Updates')),
            React.createElement(
              'div',
              { style: { display: 'flex', gap: 8 } },
              React.createElement(
                'button',
                {
                  type: 'button',
                  className: 'moa-btn moa-btn-sub',
                  disabled: updateState?.checking || updateState?.updating,
                  onClick: checkUpdates,
                },
                updateState?.checking ? (t('updater.checking') || 'Checking...') : (t('updater.btnCheck') || 'Check Updates')
              ),
              updateState?.updateAvailable
                ? React.createElement(
                    'button',
                    {
                      type: 'button',
                      className: 'moa-btn moa-btn-sub moa-btn-primary',
                      disabled: updateState?.updating,
                      onClick: runUpdate,
                    },
                    updateState?.updating
                      ? (t('updater.updating') || 'Updating...')
                      : (t('updater.btnUpdate') || 'Update to v{version}').replace('{version}', updateState.latestVersion || '')
                  )
                : null
            )
          ),
          React.createElement(
            'div',
            { className: 'moa-sec-desc', style: { marginBottom: 8 } },
            t('updater.desc') || 'Check npm registry for new versions and update with one click.'
          ),
          React.createElement(
            'div',
            { style: { display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 } },
            React.createElement(
              'span',
              { style: { color: 'var(--dsw-alias-label-secondary)' } },
              (t('updater.current') || 'Current version: v{version}').replace('{version}', updateState?.currentVersion || '0.2.16')
            ),
            updateState?.checking
              ? React.createElement('span', { style: { color: 'var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))' } }, t('updater.checking'))
              : updateState?.updateAvailable
                ? React.createElement(
                    'span',
                    { style: { color: 'var(--dsw-alias-state-error-primary)', fontWeight: 600 } },
                    (t('updater.available') || 'Update available: v{version}').replace('{version}', updateState?.latestVersion || '')
                  )
                : updateState?.currentVersion && !updateState?.error
                  ? React.createElement('span', { style: { color: 'var(--dsw-alias-state-success-primary)' } }, '✓ ' + (t('updater.upToDate') || 'Up to date'))
                  : null
          ),
          updateState?.notice
            ? React.createElement(
                'div',
                { className: 'moa-alert-ok', style: { marginTop: 8 } },
                updateState.notice
              )
            : null,
          updateState?.error
            ? React.createElement(
                'div',
                { className: 'moa-alert-err', style: { marginTop: 8 } },
                updateState.error
              )
            : null
        ),

        /* ── ENABLED TOGGLE ── */
        React.createElement(
          'label',
          { style: { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500, alignSelf: 'flex-start' } },
          React.createElement('input', {
            type: 'checkbox',
            checked: enabled !== false,
            onChange: (e) => setEnabled(e.target.checked),
            style: { accentColor: 'var(--dsw-alias-state-brand-primary, var(--dsw-alias-label-primary))', cursor: 'pointer' },
          }),
          t('config.enabled_label')
        ),

        /* ── FOOTER ACTIONS & SAVE ── */
        React.createElement(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 } },
          React.createElement(
            'button',
            {
              type: 'button',
              className: 'moa-btn moa-btn-primary',
              style: { padding: '10px 24px', fontSize: 14, fontWeight: 600 },
              onClick: handleSave,
            },
            saveStatus === t('actions.saving') ? t('actions.saving') : t('actions.save')
          ),
          React.createElement(
            'button',
            {
              type: 'button',
              className: 'moa-btn',
              onClick: reload,
            },
            t('actions.retry')
          ),
          saveStatus &&
            React.createElement(
              'span',
              {
                className: saveStatus.startsWith('Error') ? 'moa-alert-err' : 'moa-alert-ok',
              },
              saveStatus
            )
        )
      )
    }

    function useMoASettings(props) {
      const effectiveCtx = (props && props.ctx) || rootCtx
      // English is canonical; prefer the core-provided translator for the
      // active UI language (the slot declares locale: NS), fall back to en.
      const t = typeof props?.t === 'function' ? props.t : makeT(en, null)

      const scope = React.useMemo(() => {
        if (!effectiveCtx) return undefined
        const s = effectiveCtx.get ? effectiveCtx.get('settingsScope') : effectiveCtx.settingsScope
        return s && typeof s.bind === 'function' ? s.bind({ namespace: NS }) : undefined
      }, [effectiveCtx])

      const snapshot = React.useSyncExternalStore
        ? React.useSyncExternalStore(
            React.useMemo(() => (cb) => (scope ? scope.subscribe(cb) : () => {}), [scope]),
            React.useCallback(() => (scope ? scope.getSnapshot() : { status: 'unavailable' }), [scope]),
            React.useCallback(() => ({ status: 'loading' }), [])
          )
        : null

      const [status, setStatus] = React.useState('loading')
      const [presets, setPresets] = React.useState([])
      const [defaultPreset, setDefaultPreset] = React.useState('default')
      const [availableModels, setAvailableModels] = React.useState([])
      const [saveStatus, setSaveStatus] = React.useState('')
      const [updateState, setUpdateState] = React.useState({
        checking: false,
        updating: false,
        currentVersion: '0.2.16',
        latestVersion: undefined,
        updateAvailable: false,
        notice: null,
        error: null,
      })

      const checkUpdates = async () => {
        setUpdateState((prev) => ({ ...prev, checking: true, error: null, notice: null }))
        try {
          const res = await fetch('/api/dsh-moa/update', { cache: 'no-store' })
          const data = await res.json()
          if (data && data.currentVersion) {
            setUpdateState((prev) => ({
              ...prev,
              checking: false,
              currentVersion: data.currentVersion,
              latestVersion: data.latestVersion,
              updateAvailable: Boolean(data.updateAvailable),
              error: data.latestCheckFailed ? (t('updater.checkFailed') || 'Registry check failed') : null,
            }))
          } else {
            setUpdateState((prev) => ({ ...prev, checking: false, error: data.error || 'Check failed' }))
          }
        } catch (err) {
          setUpdateState((prev) => ({ ...prev, checking: false, error: String(err?.message || err) }))
        }
      }

      const runUpdate = async () => {
        setUpdateState((prev) => ({ ...prev, updating: true, error: null, notice: null }))
        try {
          const res = await fetch('/api/dsh-moa/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-dsh-plugin-update': '1' },
          })
          const data = await res.json()
          if (data && data.updated) {
            setUpdateState((prev) => ({
              ...prev,
              updating: false,
              updateAvailable: false,
              currentVersion: data.updatedVersion || data.latestVersion,
              notice: (t('updater.success') || 'Successfully updated to v{version}. Restart DSH to apply.').replace('{version}', data.updatedVersion || data.latestVersion),
            }))
          } else {
            setUpdateState((prev) => ({
              ...prev,
              updating: false,
              error: data.error || data.message || 'Update failed',
            }))
          }
        } catch (err) {
          setUpdateState((prev) => ({ ...prev, updating: false, error: String(err?.message || err) }))
        }
      }
      const [enabled, setEnabled] = React.useState(true)
      const [hostStatus, setHostStatus] = React.useState('connecting')
      const [stats, setStats] = React.useState({ totalRuns: null, avgCostUsd: null })
      const [leaderboard, setLeaderboard] = React.useState([])
      const [leaderboardPresetFilter, setLeaderboardPresetFilter] = React.useState('all')

      React.useEffect(() => {
        if (!scope || !snapshot) {
          setStatus('unavailable')
          return
        }
        const snapStatus = snapshot.status || 'unavailable'
        if (snapStatus === 'ready') {
          const val = snapshot.value || {}
          if (Array.isArray(val.presets)) setPresets(val.presets)
          if (val.default_preset) setDefaultPreset(val.default_preset)
          if (typeof val.enabled === 'boolean') setEnabled(val.enabled)
          setStatus('ready')
        } else if (snapStatus === 'unavailable') {
          setStatus('unavailable')
        }
      }, [scope, snapshot])

      const reload = React.useCallback(() => {
        if (!scope) setStatus('loading')

        fetch('/dsh-moa/status', { cache: 'no-store' })
          .then((r) => r.json())
          .then((data) => {
            if (data && data.ok) {
              setHostStatus(data.enabled === false ? 'disabled' : 'online')
            } else {
              setHostStatus('offline')
            }
          })
          .catch(() => {
            setHostStatus('offline')
          })

        const lbUrl = leaderboardPresetFilter !== 'all'
          ? `/dsh-moa/leaderboard?preset=${encodeURIComponent(leaderboardPresetFilter)}`
          : '/dsh-moa/leaderboard'
        fetch(lbUrl, { cache: 'no-store' })
          .then((r) => r.json())
          .then((data) => {
            if (data && data.ok && Array.isArray(data.models)) {
              setLeaderboard(data.models.slice(0, 10))
            }
          })
          .catch(() => {})

        fetch('/dsh-moa/history?limit=100', { cache: 'no-store' })
          .then((r) => r.json())
          .then((data) => {
            if (data && data.ok && Array.isArray(data.runs)) {
              const runs = data.runs
              const withCost = runs.filter((run) => typeof run.totalCostUsd === 'number')
              const avgCostUsd = withCost.length > 0
                ? withCost.reduce((acc, run) => acc + run.totalCostUsd, 0) / withCost.length
                : null
              setStats({ totalRuns: data.total || runs.length, avgCostUsd })
            }
          })
          .catch((err) => {
            console.warn('[dsh-moa] History fetch failed:', err)
          })

        fetch('/dsh-moa/presets', { cache: 'no-store' })
          .then((r) => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`)
            return r.json()
          })
          .then((data) => {
            if (data && data.ok) {
              setPresets(data.presets || [])
              setDefaultPreset(data.defaultPreset || 'default')
              setStatus('ready')
            } else if (!scope) {
              setStatus('unavailable')
            }
          })
          .catch((err) => {
            console.warn('[dsh-moa] Presets fetch failed:', err)
            if (!scope) setStatus('unavailable')
          })

        fetch('/dsh-moa/models', { cache: 'no-store' })
          .then((r) => r.json())
          .then((data) => {
            if (data && data.ok && Array.isArray(data.models)) {
              setAvailableModels(data.models)
            }
          })
          .catch((err) => {
            console.warn('[dsh-moa] Models fetch failed:', err)
          })
      }, [scope])

      React.useEffect(() => {
        reload()
      }, [reload])

      const handleSave = () => {
        setSaveStatus(t('actions.saving'))

        if (scope && typeof scope.set === 'function') {
          Promise.all([
            scope.set('enabled', enabled),
            scope.set('presets', presets),
            scope.set('default_preset', defaultPreset),
          ])
            .then(() => {
              setSaveStatus(t('actions.saved'))
              setTimeout(() => setSaveStatus(''), 3000)
            })
            .catch((err) => {
              console.warn('[dsh-moa] scope.set failed, trying REST fallback:', err)
              doRestSave()
            })
          return
        }

        doRestSave()
      }

      const doRestSave = () => {
        fetch('/dsh-moa/presets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled, presets, default_preset: defaultPreset }),
        })
          .then((r) => r.json())
          .then((res) => {
            if (res && res.ok) {
              setSaveStatus(t('actions.saved'))
              if (Array.isArray(res.presets)) setPresets(res.presets)
              if (res.defaultPreset) setDefaultPreset(res.defaultPreset)
              setTimeout(() => setSaveStatus(''), 3000)
            } else {
              setSaveStatus('Error saving: ' + (res?.error || 'failed'))
            }
          })
          .catch((err) => {
            setSaveStatus(`Error: ${err.message || err}`)
          })
      }

      return {
        t,
        status,
        presets,
        setPresets,
        defaultPreset,
        setDefaultPreset,
        availableModels,
        enabled,
        setEnabled,
        hostStatus,
        stats,
        leaderboard,
        leaderboardPresetFilter,
        setLeaderboardPresetFilter,
        handleSave,
        saveStatus,
        reload,
        updateState,
        checkUpdates,
        runUpdate,
      }
    }

    class MoAErrorBoundary extends React.Component {
      constructor(props) {
        super(props)
        this.state = { hasError: false, error: null }
      }
      static getDerivedStateFromError(error) {
        return { hasError: true, error }
      }
      componentDidCatch(error, errorInfo) {
        console.error('[dsh-moa] MoAErrorBoundary caught error:', error, errorInfo)
      }
      render() {
        if (this.state.hasError) {
          return React.createElement(
            'div',
            {
              className: 'moa-alert-err',
              style: { margin: '12px 0', padding: '14px', borderRadius: '8px' },
            },
            React.createElement('div', { style: { fontWeight: 600, marginBottom: '6px' } }, '⚠️ MoA UI Error:'),
            React.createElement('div', { style: { fontSize: '12px', wordBreak: 'break-all' } }, String(this.state.error?.message || this.state.error)),
            React.createElement(
              'button',
              {
                type: 'button',
                className: 'moa-btn',
                style: { marginTop: '10px', fontSize: '12px', padding: '4px 10px' },
                onClick: () => this.setState({ hasError: false, error: null }),
              },
              'Retry'
            )
          )
        }
        return this.props.children
      }
    }

    function MoACard(props) {
      ensureStyles()
      const state = useMoASettings(props)
      const page = !!(props && props.view === 'page')
      const [open, setOpen] = React.useState(!!page)

      // Row seat (plugins.row.config): the host page draws title/icon/crumb and the
      // padding, so the summary is a one-liner and the page drops our card chrome.
      if (props && props.view === 'summary') {
        return React.createElement('div', { className: 'moa-sub' }, state.t('description') || SUBTITLE)
      }

      return React.createElement(
        page ? 'div' : 'li',
        { className: page ? 'moa-page' : 'moa-card' },
        React.createElement(
          'button',
          {
            type: 'button',
            className: 'moa-head',
            style: page ? { display: 'none' } : undefined,
            'aria-expanded': open,
            onClick: () => setOpen(!open),
          },
          React.createElement(
            'div',
            null,
            React.createElement('div', { className: 'moa-title' }, '🧠 ' + (state.t('title') || TITLE)),
            React.createElement('div', { className: 'moa-sub' }, state.t('description') || SUBTITLE)
          ),
          React.createElement(Chevron, {
            className: open ? 'moa-chev moa-chev-open' : 'moa-chev',
          })
        ),
        open &&
          React.createElement(
            'div',
            { className: 'moa-body' },
            state.status === 'loading'
              ? React.createElement('div', { style: { padding: '16px 0', color: 'var(--dsw-alias-label-secondary)', fontSize: 13 } }, 'Loading MoA settings…')
              : state.status === 'unavailable'
                ? React.createElement(
                    'div',
                    { style: { padding: '16px 0', display: 'flex', flexDirection: 'column', gap: 10 } },
                    React.createElement('div', { className: 'moa-alert-err' }, 'MoA service temporarily unavailable'),
                    React.createElement(
                      'button',
                      {
                        type: 'button',
                        className: 'moa-btn',
                        style: { width: 'fit-content' },
                        onClick: state.reload,
                      },
                      state.t('actions.retry')
                    )
                  )
                : React.createElement(MoAEditor, state)
          )
      )
    }

    exports.inject = ['slots', 'locale', 'inputTriggers', 'settingsScope']
    exports.apply = function apply(ctx) {
      rootCtx = ctx

      const addLocale = (locale, dictionary) => {
        try {
          if (ctx.locale && typeof ctx.locale.register === 'function') {
            return ctx.locale.register(NS, locale, dictionary)
          }
        } catch {
          return () => {}
        }
        return () => {}
      }

      if (typeof ctx.effect === 'function') {
        ctx.effect(() => {
          const undo = [addLocale('en', en), addLocale('zh', zh)]
          return () => {
            for (const off of undo) {
              if (typeof off === 'function') {
                try { off() } catch (offErr) { /* unsubscribe best-effort */ }
              }
            }
          }
        }, 'dsh-moa: dictionaries')
      } else {
        addLocale('en', en)
      }

      if (ctx.slots) {
        const registerCard = (slotName, key) => () => {
          try {
            ctx.slots.register(
              {
                name: slotName,
                key,
                order: 35,
                locale: NS,
                inject: () => ({ ctx }),
              },
              (props) => React.createElement(MoAErrorBoundary, null, React.createElement(MoACard, props))
            )
          } catch (err) {
            console.warn('[dsh-moa] Failed to register ' + slotName + ':', err)
          }
        }

        if (typeof ctx.slots.inject === 'function') {
          // Row seat first (the seat the current core renders), legacy seat kept as a
          // fallback for older cores.
          ctx.slots.inject('plugins.row.config', registerCard('plugins.row.config', ROW_CONFIG_KEY))
          ctx.slots.inject('settings.plugin.item', registerCard('settings.plugin.item', NS))
        } else {
          registerCard('plugins.row.config', ROW_CONFIG_KEY)()
          registerCard('settings.plugin.item', NS)()
        }
      }

      // Register slash command in composer
      ctx.effect(() => {
        const triggers = ctx.get ? ctx.get('inputTriggers') : ctx.inputTriggers
        if (!triggers || typeof triggers.registerSource !== 'function') return () => {}

        const dispose = triggers.registerSource({
          trigger: '/',
          name: 'moa',
          order: 35,
          description: en['slash.desc'],
          candidates: (_session, req) => {
            if (req.position !== 'leading') return Promise.resolve([])
            const q = req.query.trim().toLowerCase()
            if (q !== '' && !'moa'.startsWith(q)) return Promise.resolve([])
            return Promise.resolve([
              {
                name: 'moa',
                description: en['slash.desc'],
              },
            ])
          },
          onPick: ({ candidate }) => ({
            text: '/' + candidate.name + ' ',
          }),
          matchSpace: (_session, token) => {
            if (token === '/moa') return { text: '/moa ' }
            return undefined
          },
          matchEnter: (_session, _line) => {
            return Promise.resolve(undefined)
          },
        })

        return () => {
          if (typeof dispose === 'function') dispose()
        }
      }, 'dsh-moa: slash command trigger')
    }

    return module.exports
  },
})

