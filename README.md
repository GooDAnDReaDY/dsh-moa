# @goodandready/dsh-moa

> **Mixture of Agents (MoA)** plugin for **DeepSeek Harness** adding the `/moa <prompt>` slash command.

---

## Overview

`dsh-moa` introduces the **Mixture of Agents** architecture to DeepSeek Harness, inspired by Hermes Agent and OpenClaw.

Instead of routing a complex problem to a single language model, `dsh-moa` executes a collaborative two-phase pipeline:
1. **Candidate Proposers (Advisors):** Multiple independent models query the prompt concurrently to produce diverse, creative, and distinct solutions.
2. **Aggregator (Judge / Synthesizer):** A frontier reasoning model critically compares all candidate responses, eliminates errors and hallucinations, and synthesizes the optimal unified answer.
3. **One-Shot Session Model Restoration:** The slash command operates strictly as a one-shot turn modifier. As soon as the synthesis completes (even on errors), the session automatically and cleanly reverts to the user's primary working model.

---

## Features

- **Slash Command Integration (`/moa`):** Built-in autocompletion in the DeepSeek Harness web composer via `inputTriggers`.
- **Parallel Fan-out:** Fast concurrent model evaluation with graceful degradation (if one proposer fails, the aggregator still receives the rest).
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
                             +--------------------+--------------------+
                             |                    |                    |
                             v                    v                    v
                      +--------------+     +--------------+     +--------------+
                      |  Proposer 1  |     |  Proposer 2  |     |  Proposer 3  |
                      |  (DeepSeek)  |     |    (GPT)     |     |   (Claude)   |
                      +--------------+     +--------------+     +--------------+
                             |                    |                    |
                             +--------------------+--------------------+
                                                  | (Parallel responses)
                                                  v
                       +-------------------------------------------------------+
                       |               Aggregator / Judge Model                |
                       |    Compares candidates, rectifies flaws & synthesizes |
                       +-------------------------------------------------------+
                                                  |
                                                  v
                       +-------------------------------------------------------+
                       |                  finally block                        |
                       |       Guaranteed restore to initial session model     |
                       +-------------------------------------------------------+
```

---

## Verification & Testing

Zero-network unit and contract tests run through `node --test`:

```bash
node --test test/*.test.mjs
```

---

## License

MIT © [GooDAnDReaDY](https://github.com/GooDAnDReaDY)
