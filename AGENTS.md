# AGENTS.md

## Technology baseline

* Use Vue 3, TypeScript, Vite, and Vue Router.
* Use Composition API and `<script setup lang="ts">`.
* Do not use Vue 2 syntax or Options API.
* Do not introduce React, Nuxt, Pinia, Tailwind CSS, a large UI framework, a backend, or a database unless explicitly approved.
* Prefer native Vue and browser APIs before adding dependencies.
* Use npm consistently. Do not switch package managers.

## Module boundaries

* Each tool must remain an independent feature module under `src/tools`.
* Tool modules may import from `src/shared`.
* `src/shared` must never import from a specific tool module.
* One tool module must never import directly from another tool module.
* Application-level layout, routing, and tool metadata belong under `src/app`.
* Shared code must represent genuinely shared behaviour, not merely visually similar code.

## Shared code

The following may be shared when genuinely needed:

* Application layout and navigation
* Tool registry and route metadata
* Small base UI components
* Clipboard operations
* Local draft persistence
* File import and export
* Confirmation dialogs
* Storage access and backup format
* Generic text, validation, ID, and date utilities

Tool-specific state, processing rules, forms, validation, and result displays must remain inside the corresponding tool module.

## Abstraction rules

* Do not create universal tool engines, schema-driven form engines, plugin frameworks, or speculative abstractions.
* Do not generalize code solely because two files currently look similar.
* Extract shared code only when it has the same meaning, behaviour, error handling, and reason to change.
* Avoid shared components controlled by many boolean flags.
* Small duplication is preferable to an incorrect abstraction.
* Do not create empty directories merely to make every tool follow an identical folder structure.

## Refactoring rules

Before a structural refactor, explain:

1. The concrete problem.
2. The affected files.
3. The contracts that may change.
4. The behaviour that must remain unchanged.
5. The validation steps.

During a refactor:

* Do not add unrelated features.
* Do not redesign the UI.
* Do not alter business rules or output formats.
* Do not rename or move unrelated files.
* Do not rewrite an entire module when a smaller change is sufficient.
* Preserve routes, stored data, component props, and function contracts unless explicitly instructed otherwise.
* Feature development and major structural refactoring must be separate tasks.
* Never replace working code merely because another implementation appears cleaner.

## Storage rules

* Vue components must not access `localStorage` or IndexedDB directly.
* Persistent data must use a shared storage or repository layer.
* Storage keys must be centrally defined.
* Exported backups must contain a schema version.
* Persisted data changes require backward compatibility or an explicit migration.
* No private API keys, passwords, tokens, or personal source material may be committed.

## Quality rules

* Implement processing logic as pure TypeScript functions where practical.
* Keep business logic out of Vue templates.
* Avoid components with excessive responsibilities.
* Add focused unit tests for processing, storage serialization, backup migration, and other important pure logic.
* Do not add ceremonial tests that provide no behavioural protection.
* Keep changes small and reviewable.
* Run relevant checks before reporting completion.

## Communication rules

* Before making broad changes, summarize the intended scope.
* Report every dependency added and why it is required.
* Report files created, modified, moved, or deleted.
* Clearly distinguish completed work from recommendations.
* Do not silently expand the requested task.
* Do not perform Git commits, pushes, deployments, or destructive operations unless explicitly asked.
