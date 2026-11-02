# DEF-50 — Revise architecture for local-first, deployment-ready storage and multi-tenancy

- URL: https://linear.app/tristansturgess/issue/DEF-50/revise-architecture-for-local-first-deployment-ready-storage-and-multi
- Status at snapshot (2026-11-02): Backlog
- Project: Creative Writing System V3

## Goal

Revise the V2 architecture docs to define how V3 should handle persistence, service boundaries, and eventual multi-user deployment while preserving a simple local-first path.

This issue is architecture/documentation work only. Do not implement Postgres, S3, multi-tenancy, or a frontend/backend split here.

## Architecture work

* Document how V2 currently stores data and couples storage to workflows/UI.
* Define the desired V3 storage boundaries and interfaces.
* Describe a local-first storage path and a future hosted path using Postgres and S3/object storage.
* Decide what data conceptually belongs in structured storage versus object storage.
* Document the minimum ownership/isolation model required for future multi-tenancy.
* Evaluate whether NiceGUI remains appropriate and whether a separate frontend/backend boundary is architecturally necessary.
* Record tradeoffs and deferred decisions explicitly.

## Deliverables

* Revised storage/service architecture docs.
* Local-first and hosted deployment diagrams/flows at the appropriate level of detail.
* Clear persistence boundaries and responsibilities.
* Documented decision on UI/service separation, or explicit criteria for deferring that decision.
* Open questions and assumptions carried forward to implementation planning.

## Open questions

* Should V3 initially remain fully local with swappable storage adapters?
* Is NiceGUI still the best fit?
* Does V3 need separate frontend/backend services architecturally, or can that wait?
* What data belongs in Postgres versus S3/object storage?
* What is the minimum tenant/user model worth designing up front?
