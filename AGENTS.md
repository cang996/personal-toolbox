# AGENTS.md

## Repository-wide principles

* Keep changes small, scoped, and reviewable.
* Do not modify unrelated features, rename or move unrelated files, or silently expand the requested task.
* An investigation task does not authorize implementation unless the task itself explicitly permits autonomous continuation.
* When the user requests read-only analysis, do not modify files as a side effect.
* If critical domain or business semantics cannot be confirmed from reliable evidence, do not guess and use that guess to change production code.

## Frontend

### Technology and module boundaries

* Use Vue 3, TypeScript, Vite, and Vue Router.
* Use Composition API and `<script setup lang="ts">`; do not use Vue 2 syntax or the Options API.
* Do not introduce React, Nuxt, Pinia, Tailwind CSS, or a large UI framework unless explicitly approved.
* Frontend production code and tests live under `frontend/src/`; frontend package and build configuration live under `frontend/`.
* Each tool must remain an independent feature module under `frontend/src/tools`.
* Tool modules may import from `frontend/src/shared`; `frontend/src/shared` must never import from a specific tool module.
* One tool module must never import directly from another tool module.
* Application-level layout, routing, and tool metadata belong under `frontend/src/app`.

### Shared code and components

* Shared code must represent genuinely shared behaviour, not merely visually similar code.
* Application layout, navigation, tool metadata, small base UI components, clipboard operations, persistence, import/export, confirmation dialogs, storage access, backup formats, and generic utilities may be shared when their semantics are genuinely common.
* Tool-specific state, processing rules, forms, validation, and result displays must remain inside the corresponding tool module.
* Prefer native Vue and browser APIs before adding frontend dependencies.
* Implement frontend processing logic as pure TypeScript functions where practical.
* Keep business logic out of Vue templates and avoid components with excessive responsibilities.

### Frontend storage

* Vue components must not access `localStorage` or IndexedDB directly; use a shared storage or repository layer.
* Define storage keys centrally.
* Exported backups must contain a schema version.
* Persisted data changes require backward compatibility or an explicit migration.

## Backend

* The approved Python backend lives under `backend/`.
* Production backend code belongs under `backend/app/` and is organized by feature or domain.
* Backend tests and technical spikes must follow the same feature or domain boundaries under `backend/tests/` and `backend/spikes/`.
* `exchange_rate` is the currently established backend feature; do not create empty directories for speculative future features.
* Keep network acquisition separate from parser and domain logic.
* Prefer the Python standard library and existing dependencies before adding packages.
* Do not add a Python dependency without authorization from the current task.
* Do not introduce FastAPI, a database, or another backend framework without explicit approval.

## Dependency management

* The Node frontend uses npm; do not switch package managers.
* Python dependencies belong to the backend dependency scope.
* Do not add dependencies without task authorization. Report every dependency added and why it is required.
* Prefer existing dependencies and platform or language standard libraries when they meet the requirement.

## Abstraction and refactoring

* Do not create universal tool engines, schema-driven form engines, plugin frameworks, or speculative abstractions.
* Do not generalize code solely because files currently look similar.
* Extract shared code only when it has the same meaning, behaviour, error handling, and reason to change.
* Avoid shared components controlled by many boolean flags; small duplication is preferable to an incorrect abstraction.
* Do not create empty directories merely to impose a speculative uniform structure.

Before a structural refactor, explain:

1. The concrete problem.
2. The affected files.
3. The contracts that may change.
4. The behaviour that must remain unchanged.
5. The validation steps.

During a refactor:

* Do not add unrelated features, redesign the UI, or alter business rules or output formats.
* Do not rewrite an entire module when a smaller change is sufficient.
* Preserve routes, stored data, component props, public function contracts, and persisted formats unless explicitly instructed otherwise.
* Keep feature development and major structural refactoring as separate tasks.
* Never replace working code merely because another implementation appears cleaner.

## Testing and validation

* Add focused tests for important processing, parsing, validation, storage serialization, backup migration, and other behaviour where tests provide meaningful protection.
* Do not add ceremonial tests that provide no behavioural protection.
* Run focused checks during development and an appropriate regression suite before completing a code task, based on the affected scope and risk.
* Static analysis, syntax checks, and successful code generation do not establish runtime success.
* Claim that a command, request, test, or application run succeeded only after it was actually executed successfully.
* If a validation step was not run, say so explicitly. If tests cannot run, report the reason and do not claim they passed.
* Prefer observed runtime evidence over claims that something should work in theory.

## Communication, Git, and safety

* Before broad changes, summarize the intended scope.
* Report files created, modified, moved, or deleted.
* Clearly distinguish completed work, observed evidence, assumptions, and recommendations.
* Do not commit private API keys, passwords, tokens, or personal source material.
* Do not perform Git commits, pushes, deployments, or destructive operations unless explicitly requested.
