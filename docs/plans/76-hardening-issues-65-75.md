# Plan: Issues #65-#75 Hardening & Polish

## Scope & Target
- Address 11 open Gitea issues (#65 through #75).
- Maintain strict standards: DSH preflight, Gitea PR workflow, design contract, secure write routes, updater, modular client.
- Target version: 0.2.16.

## Phases
1. Core security & identity: package name (#67), isSafeRequest CSRF guards (#66), updater (#68), package files allowlist (#65, #72).
2. Reliability & error transparency: file-workspace & runner catch annotations & tracking (#74), status snapshot fallback (#70), dead code removal (#75), design decisions lock (#73).
3. Client decomposition: split lib/client.js into modular subcomponents per plan #47 (#71).
4. GitHub sanitization: exclude internal deployment & agent metadata from public mirror (#69).
5. Preflight verification, test suite (91+ passing), version bump to 0.2.16, PR & production acceptance.
