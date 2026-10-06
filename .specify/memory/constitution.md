<!--
Sync Impact Report
- Version change: (template) → 1.0.0
- Modified principles: none (initial ratification; all placeholders replaced)
- Added sections: Core Principles I–V, Technology & Platform Constraints,
  Development Workflow, Governance
- Removed sections: none
- Deferred items: none
-->
# Nutrilara Constitution

## Core Principles

### I. English Everywhere
All source code, identifiers, comments, commit messages, specifications, plans, tasks and
documentation MUST be written in English. User-facing app text MUST be externalized into
translation resources so other languages can be added without touching code.
Rationale: one working language keeps the project readable to any contributor and keeps
tooling output consistent.

### II. Simple and Clear Code
Code MUST favor readability over cleverness. Concretely:
- Prefer the simplest solution that satisfies the spec; no speculative abstractions (YAGNI).
- Names MUST describe intent; functions MUST do one thing and stay short enough to read
  without scrolling.
- Comments explain *why*, never *what*.
- Any added complexity (extra layer, pattern, dependency) MUST be justified in the plan's
  complexity-tracking section.
Rationale: simple code is cheaper to review, test and change.

### III. Open and Free Technologies
Every language, framework, library, tool, service and data source adopted MUST be open source
(OSI-approved license) or free to use with no paid tier required for core functionality.
Proprietary or paid-only dependencies, and vendor lock-in for essential features, are
prohibited unless an amendment to this constitution approves them. Each dependency's license
MUST be recorded in the plan that introduces it.
Rationale: the project must stay free to build, run and distribute.

### IV. Lightweight Mobile App
Nutrilara is a mobile application and MUST remain light on device resources:
- Small install size and fast cold start; budgets MUST be defined in each plan and verified
  before release.
- Core features MUST work offline or on poor connections; network use MUST be minimal and
  justified.
- Dependencies MUST be added sparingly; each one is weighed against its size and battery cost.
- Heavy work MUST NOT block the UI thread.
Rationale: users run the app on a wide range of phones and data plans.

### V. Documentation Aligned with Implementation
Documentation is part of the deliverable, not an afterthought. A change that alters behavior,
interfaces, data models or setup MUST update the matching spec, plan, tasks and README in the
same change. Documentation that no longer matches the code MUST be fixed or removed; the code
and its docs MUST NOT be allowed to drift. Reviews MUST check this alignment, and
`/speckit-analyze` SHOULD be run before implementation to catch inconsistencies across
artifacts.
Rationale: stale docs mislead contributors and erode trust in the specs.

## Technology & Platform Constraints

- Target platform: mobile (the specific stack is chosen per feature in `/speckit-plan`,
  subject to Principles III and IV).
- Prefer a single cross-platform codebase over parallel native codebases when it keeps the
  code simpler and the app light.
- Persist user data locally by default; any remote storage MUST be justified in the plan
  and use free/open services.
- No user data is collected beyond what a feature's spec requires.

## Development Workflow

- Work follows the Spec Kit flow: constitution → specify → (clarify) → plan → tasks →
  implement.
- Every plan MUST include a Constitution Check against the principles above.
- Each task MUST be small and reviewable; behavior that matters MUST be covered by tests
  proportionate to its risk.
- Changes are merged only after the review confirms compliance with this constitution,
  including documentation alignment (Principle V).

## Governance

This constitution supersedes other project practices. Amendments MUST be made through
`/speckit-constitution`, state the reason, and update any affected spec, plan or task
artifacts in the same change.

Versioning follows semantic versioning:
- MAJOR: a principle is removed or redefined in a backward-incompatible way.
- MINOR: a principle or section is added or materially expanded.
- PATCH: clarifications and wording fixes.

Compliance is reviewed at every plan (Constitution Check) and every code review.
Unjustified violations block the merge.

**Version**: 1.0.0 | **Ratified**: 2026-10-03 | **Last Amended**: 2026-10-03
