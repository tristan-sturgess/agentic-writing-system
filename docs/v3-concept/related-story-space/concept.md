# Story Space & Timeline — Concept

Snapshot retrieved 2026-11-02.

- URL: https://linear.app/tristansturgess/document/story-space-and-timeline-concept-5d3c42b88a01
- Document id: `ff654304-0d56-4652-9e91-03b1cf1a31d8`
- Updated in Linear: 2026-10-15
- Project: Story Space & Timeline (`P-DEF-10`), separate from Creative Writing System V3

---

## Purpose and intended outcome

Create a standalone, local application for exploring and refining the physical-space subsystem of the creative writing system. Its UI is an experimentation surface: users can inspect and edit locations, compare visualizations, scrub story time, and see character whereabouts. Its documented REST API is the primary future integration surface for story-planning agents.

The scope is broader than a static map, but narrower than a full story simulator: **where things are, how places connect, what their physical state is at a time, and whether recorded movement fits that space and time.**

## Shared state and subsystem responsibility

Events, their IDs, the timeline, characters and locations belong to **one shared graph/state object**. This replaces the earlier framing of separate event ownership versus an imported projection. Different agents have different views and mutation authority over that graph; they do not maintain competing character, event or location copies.

This subsystem creates, updates, interprets, queries and renders the location and physical-timeline aspects of shared state: locations, physical connections, location state, event placements, character presence and movement. Rich narrative and character attributes can exist in the shared graph without belonging to this subsystem's responsibility.

The standalone app exercises this same shared-state model with a minimal fixture graph. "Shared graph" is a logical contract, not a decision to use a particular graph database.

## Relationship to the creative writing system

| Component | Responsibility | Access and interaction |
| --- | --- | --- |
| Narrative planner | Narrative intent, proposed events, participants and desired place/time constraints | Shared deterministic read tools; submits physical update requests to the location agent rather than writing protected location/timeline fields directly |
| Location agent | Interpret requests, maintain spatial/time facts, assess ambiguity and semantic consistency, negotiate refinements | Shared read tools plus authorized location/physical-timeline mutation tools |
| Deterministic tools | Query and render shared state; calculate routes, occupancy and travel times; enforce structural invariants and calculable constraints | Reusable by both agents; mutation validation remains mandatory regardless of caller |
| Scene-writing agent | Prose and scene rendering | Retrieve physical context from shared state at the relevant time |
| Shared graph/state | Common event, character, location and timeline identities and facts | One logical source of truth with scoped mutation authority |
| Human UI | Inspect, experiment, edit and review | Uses the same state and validation; direct-edit versus agent-mediated write policy remains to be designed |

The location agent's exclusive write authority is relative to the narrative agent for the protected spatial/timeline fields. It does not imply ownership of all event or character attributes. The precise field/operation matrix and narrative-side event creation workflow remain design tasks.

Character views expose identity/name and physical presence/movement only. Motivations, relationships, interpretations and knowledge are outside this subsystem's responsibility even when those properties live in the same graph.

## Core model

### Locations and containment

Locations are free-form named nodes with descriptions and stable IDs. A room can be contained in a building, which is contained in a district and city; no fixed room/building/district taxonomy is required.

Containment and connectivity are different relationships. Being inside a house does not establish that every room connects to every other room. A coarse placement in a house means the exact room is unspecified.

### Physical connections and routes

Travel connections link locations and include direction, descriptive text, and structured travel duration. Descriptions can express atmosphere and physical detail: a dark path, a heavy door, a slide or a portal. Structured fields, rather than parsing that prose, determine traversability and time.

A one-way connection supports travel A→B without inventing B→A. Route queries return bounded alternatives, ordered steps, descriptions, durations and reasons for restrictions. Mermaid is a candidate deterministic rendering of a route subgraph; structured results remain the underlying contract.

Missing edges in a progressively specified map do not prove that travel is impossible. The service must distinguish no known route, explicitly blocked routes, and sufficient information to confirm feasibility.

### Time-dependent physical state

Location descriptions and connection state can change over story time. Examples include a door locked from 22:00 to 07:00, a room redecorated after an event, or a classroom scheduled for a class.

A class schedule is information about use/occupancy; it does not automatically mean the room cannot be entered. Restriction semantics must be explicit.

Historical queries should not return today's description for a past scene. Routing must inspect restrictions at the times a character reaches relevant steps, not only at departure. Waiting, recurrence, and state-change precedence need explicit decisions.

### Character presence and movement

Represent presence over time and travel between locations, with enough information to explain where a character is during a journey. A broad placement can be refined later without inventing earlier room assignments. Gaps should stay unknown unless an agreed rule supports inference.

Visualizations should expose timing overlaps, impossible transfers, broad placements, and incomplete journeys rather than masking uncertainty.

## Progressive specificity

Start with the least detail required. A planner may submit "the scene is in the house"; the location sub-agent reuses or creates that house, without laying out every room. If a later scene needs privacy, a doorway, or a route between rooms, the agent adds only the necessary detail and proposes any placement refinements.

Adding a room does not automatically move earlier house-level events into it. Refinement must be explicit and preserve existing constraints. Physical facts and desired plot conditions remain distinct. Conflicting requests from independently running planners are reported, not silently resolved by rewriting canon.

## Deterministic tools and agent reasoning

Prevent contradictions structurally where practical (valid references, acyclic containment, coherent intervals), and calculate known conflicts deterministically where sufficient facts exist (incompatible placements, access restrictions, or a known 30-minute journey allotted only 10 minutes).

Not every inconsistency can be detected from structured data. The location agent must also interpret requests, identify missing detail and assess contextual/semantic concerns. Agent judgments are distinguishable from deterministic findings; passing deterministic checks does not prove complete consistency.

For example, two conversations in the same house are not automatically contradictory. They may be compatible, require room-level refinement, or conflict with an explicit privacy/capacity constraint. The agent may ask for specificity or suggest rooms; whether it may choose a room or move an established placement automatically remains open.

## Integration workflow

1. The narrative planner queries shared read tools: e.g. "where is Alice at 10:00?", "who else is in the house then?", or "what routes fit this interval?" Results are generated and rendered from shared state with explicit uncertainty and relevant references.
2. It submits proposed events and physical constraints to the location agent, using the same event/character IDs rather than writing protected fields itself.
3. The location agent resolves references, uses deterministic tools and performs contextual reasoning. It separates provable conflicts, missing detail and agent-assessed concerns.
4. It returns an applicable refinement, an error with supporting facts, a request for clarification, or suggested alternatives. Planner and location agent can iterate.
5. Authorized physical updates are validated and applied to shared state. Findings and resulting IDs/changes are returned to the planner; rejected requests do not silently rewrite existing facts.
6. UI, planner and writing-agent views query the updated shared state through the same rules.

The exact response schema, proposal/canon lifecycle, automatic-refinement authority, concurrent-update protocol and UI write path remain open. Agent involvement in semantic assessment and planner negotiation is core scope; a separate specialized conflict-resolution agent is optional later work.

## UI experiments

* Containment view: nested locations and adjustable level of detail.
* Connection view: directed travel edges, descriptions, durations and time-dependent restrictions.
* Calendar/schedule view: selected nodes and their use/state intervals.
* Character timeline: lanes showing presence and travel through the day.
* Shared time selection linking graph state and character positions.
* Optional later experiment: characters moving on a rendered node map.

Graph layout is a visualization aid, not authoritative geometric distance. Precise floor plans, coordinate geometry and animated maps are optional experiments, not prerequisites.

## Boundaries and provisional delivery sequence

The app may be local-only and must be useful without running the full writing system. Build the core graph, descriptions, basic state intervals, whereabouts and API first; then validate synchronized views, routing and location-agent interactions against small story scenarios. More elaborate calendar recurrence, spatial relations such as audibility, animation, branching timelines and automated conflict resolution require explicit scope decisions.

Do not make the entire world, a complete character simulator, or all V3 implementation a dependency of this project.

## Existing work and unresolved reference

* [DEF-53 — Event graph and signals](https://linear.app/tristansturgess/issue/DEF-53/revise-the-event-graph-and-signal-model-architecture): align event references, start/end times and location state.
* [DEF-54 — Plot planning](https://linear.app/tristansturgess/issue/DEF-54/revise-plot-planning-architecture-around-global-narrative-intent): align planner requests and consistency responsibilities.
* [DEF-56 — Context assembly](https://linear.app/tristansturgess/issue/DEF-56/revise-architecture-for-story-bible-exploration-and-context-assembly): align scene context and provenance.
* [Creative Writing System V3](https://linear.app/tristansturgess/project/creative-writing-system-v3-f6bf311c12a2): architecture project; existing issues stay there.

A separately titled location-consistency redesign issue was not found in the accessible workspace. Link it when identified, without assuming DEF-53 is the same issue.
