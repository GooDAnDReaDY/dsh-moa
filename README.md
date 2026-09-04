# @goodandready/dsh-moa

> **Mixture of Agents (MoA)** plugin for **DeepSeek Harness** adding the `/moa <prompt>` slash command.

---

## Overview

`dsh-moa` introduces the **Mixture of Agents** architecture to DeepSeek Harness, inspired by Hermes Agent and OpenClaw.

Instead of routing a complex problem to a single language model, `dsh-moa` executes a collaborative multi-phase pipeline:
1. **Interactive Requirement Refinement (Adaptive):** For broad or underspecified prompts (e.g. `/moa build a calculator`), advisor models formulate clarifying options and the judge synthesizes a structured 2-4 question questionnaire before generating code.
2. **Candidate Proposers (Advisors) & File Isolation:** Multiple independent models query the prompt concurrently to produce diverse, creative, and distinct solutions. Each candidate's generated files are isolated under `.moa/candidate-N/`.
3. **Aggregator (Judge / Synthesizer) & Promotion:** A frontier reasoning model critically compares all candidate solutions, chooses the best implementation via a machine marker (`WINNER_CANDIDATE_INDEX: N`), and promotes the winner's files directly into the project root directory while cleaning up temporary sandboxes.
4. **Live Canvas Integration:** If web files (HTML, JSX, etc.) are generated, `dsh-moa` automatically notifies `dsh-live-canvas` via its REST API, enabling instant 1-click visual previewing.
5. **Token-Efficient Code Summarization:** Chat responses present clean architectural summaries, file listings, and interactive links without dumping thousands of lines of raw code into the chat history.
6. **One-Shot Session Model Restoration:** The slash command operates strictly as a one-shot turn modifier. As soon as the synthesis completes (even on errors), the session automatically and cleanly reverts to the user's primary working model.

---

## Features

- **Slash Command Integration (`/moa`):** Built-in autocompletion in the DeepSeek Harness web composer via `inputTriggers`.
- **Adaptive Questionnaire Gate:** Detects broad requests and interactively asks clarifying questions with recommended answers.
- **Parallel Fan-out with Live Heartbeats:** Fast concurrent model evaluation with real-time progress indicators (`⏳ [Ns] Processing...`, per-model completion badges).
- **Disk-Level Workspace Isolation:** Candidates create real files on disk in temporary workspaces; the judge picks the winning candidate and promotes files to the workspace.
- **Live Canvas 1-Click Integration:** Automatically creates sandbox sessions in `@goodandready/dsh-live-canvas` for generated web applications.
- **Token-Saving Chat Output:** Strips voluminous raw code dumps in chat messages in favor of compact file listings and markdown summaries.
- **Advisory Context Isolation:** Tool dumps and bulky system prompts are stripped from candidate advisor context, preventing prompt bloat and "missing tools" refusals.
- **DSH Native Settings Card:** Collapsible plugin card under `Settings → Plugins → Mixture of Agents` built using native `--dsw-alias-*` theme tokens.
- **Named Presets:** Configure custom MoA presets such as `default`, `code-review`, or `deep-reasoning`.

---

## Usage

### In Composer

Type `/moa` in the DeepSeek Harness chat input:

```text
/moa explain the Raft consensus algorithm with state transitions
```

Or target a specific configured preset:

```text
/moa deep-reasoning analyze this concurrency bottleneck
```

To build a project with real files:

```text
/moa build an interactive scientific calculator in HTML/CSS/JS
```

---

## Configuration

In **Settings → Plugins → Mixture of Agents**:

| Field | Description | Default |
|---|---|---|
| **Default Preset** | Name of the default preset applied when no preset name is specified | `default` |
| **Proposer Models** | Array of `{ provider, model }` candidates queried in parallel | `deepseek:deepseek-chat`, `openai:gpt-4o` |
| **Aggregator Model** | Leading judge model synthesizing candidate responses | `anthropic:claude-3-7-sonnet` |
| **Reference Temperature** | Sampling temperature for proposer candidates | `0.6` |
| **Aggregator Temperature** | Sampling temperature for the synthesizer model | `0.4` |
| **Max Tokens** | Maximum tokens for generation | `4096` |

---

## Architecture

```
                       +-------------------------------------------------------+
                       |              User Input in DSH Composer               |
                       |             "/moa <complex problem prompt>"           |
                       +-------------------------------------------------------+
                                                  |
                                                  v
                       +-------------------------------------------------------+
                       |             Client Trigger (lib/client.js)            |
                       |       Autocomplete via inputTriggers, sends to agent  |
                       +-------------------------------------------------------+
                                                  |
                                                  v
                       +-------------------------------------------------------+
                       |            Host Interceptor (lib/index.js)            |
                       |  1. Records initial session model (originalModel)     |
                       |  2. Cleans context for advisory advisors              |
                       +-------------------------------------------------------+
                                                  |
                                                  v
                       +-------------------------------------------------------+
                       |             MoA Runner (lib/moa-runner.js)            |
                       |  1. Evaluates broadness -> Questionnaire or Sandbox   |
                       |  2. Parallel fan-out -> writes .moa/candidate-N/      |
                       |  3. Judge evaluation -> WINNER_CANDIDATE_INDEX        |
                       |  4. File Promotion -> moves winner files to root      |
                       |  5. Live Canvas API -> registers visual preview       |
                       +-------------------------------------------------------+
```

---

## Testing

Run unit and contract test suite without network dependencies:

```bash
node --test test/*.test.mjs
```

---

## License

MIT © [GooDAnDReaDY](https://github.com/GooDAnDReaDY)
