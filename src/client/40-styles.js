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
/* Candidate Diff Viewer */
.moa-diff-container{display:flex;flex-direction:column;gap:10px;margin-top:10px}
.moa-diff-controls{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.moa-diff-select{height:32px;padding:0 8px;border-radius:6px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-size:12px;outline:none}
.moa-diff-box{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:8px 0;font-family:monospace, ui-monospace, Menlo, Consolas, monospace;font-size:12px;line-height:1.5;max-height:400px;overflow-y:auto;overflow-x:auto}
.moa-diff-line{display:flex;padding:1px 10px;white-space:pre}
.moa-diff-line-same{color:var(--dsw-alias-label-secondary)}
.moa-diff-line-add{background:color-mix(in srgb, var(--dsw-alias-state-success-primary) 14%, transparent);color:var(--dsw-alias-state-success-primary)}
.moa-diff-line-del{background:color-mix(in srgb, var(--dsw-alias-state-error-primary) 14%, transparent);color:var(--dsw-alias-state-error-primary)}
.moa-diff-prefix{width:20px;user-select:none;flex-shrink:0;font-weight:bold}
.moa-diff-content{flex:1}
.moa-diff-stat-add{color:var(--dsw-alias-state-success-primary);font-weight:600}
.moa-diff-stat-del{color:var(--dsw-alias-state-error-primary);font-weight:600}

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

