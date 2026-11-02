# Story Space & Timeline — Requirements

Snapshot retrieved 2026-11-02.

- URL: https://linear.app/tristansturgess/document/story-space-and-timeline-requirements-9cdbaf0afe89
- Document id: `b046053e-aba8-42ec-a7ea-712dae120761`
- Updated in Linear: 2026-10-15
- Project: Story Space & Timeline (`P-DEF-10`), separate from Creative Writing System V3

---

## Status and scope

Requirements captured from the 2026-10-13 brainstorm and updated with the 2026-10-14 shared-graph and two-agent framing. **Required** items reflect intended capabilities; **proposed safeguards** make those capabilities consistent; **open decisions** are not settled architecture. This document does not prescribe a framework, database, exact schema or endpoint naming.

The application is standalone and local-only initially. It serves both human exploration and future planner integration. Full character modeling, prose/plot generation, production hosting and full-world simulation are outside initial scope.

## Agreed architecture

One shared graph/state object contains event IDs, events, timeline, characters and locations. This subsystem is responsible for its location and physical-timeline aspects and their query/rendering behavior. Richer character/narrative properties may coexist in that graph without becoming this subsystem's responsibility.

Both narrative and location agents can use deterministic read tools. The narrative agent submits proposed events and place/time constraints; the location agent has authority to apply protected location/physical-timeline updates through validated mutation tools. Exact field permissions, narrative event-creation flow and human UI write policy remain design decisions.

Use structural invariants and deterministic validation where possible, plus location-agent reasoning for contextual ambiguity and concerns that cannot be fully formalized. Deterministic validation is not a claim that all conflicts can be detected.

## Functional requirements

| ID | Capability | Requirement |
| --- | --- | --- |
| LOC-01 | Location records | Stable IDs, names, free-form descriptions, optional metadata, and external/source references; agents can resolve and reuse records |
| LOC-02 | Containment | Free-form contained-in relationships, hierarchy traversal and broad placements; reject cycles; parent cardinality remains open |
| LOC-03 | Separate relations | Keep containment separate from travel connections; containment must not imply a traversable route |
| LOC-04 | Scene context | Retrieve a location's description and relevant containing-location context at a specified story time; retain attribution to locations and sources |
| EDGE-01 | Travel edges | Represent endpoints, direction, descriptions and structured duration; support one-way travel, including portals/slides |
| EDGE-02 | Physical state | Record connection availability and location state over time, with descriptive changes and explicit restrictions |
| ROUTE-01 | Route alternatives | Deterministically return bounded route alternatives between supplied locations, with ordered steps and route/path descriptions |
| ROUTE-02 | Timing | Calculate duration and arrival times from structured facts; unknown duration is reported, not invented by an LLM |
| ROUTE-03 | Temporal checks | Evaluate restrictions when each step is reached/traversed; report the relevant blocked interval and reason |
| ROUTE-04 | Agent representation | Return structured route data and a deterministic readable rendering; Mermaid is a candidate rather than the sole representation |
| ROUTE-05 | Incomplete maps | Distinguish a known route, known blockage, no known route and insufficient information; absence of an edge does not establish physical impossibility |
| TIME-01 | Story time | Use a consistent story-time coordinate shared with the writing system; format semantic dates/times in the presentation layer |
| TIME-02 | Temporal records | Support intervals and discrete changes, including historical lookup of descriptions/state; define boundaries and precedence before implementation |
| TIME-03 | Schedules | Represent scheduled location use (e.g. classes) and access state (e.g. locked hours) as distinct concepts |
| CHAR-01 | Minimal characters | Use shared character identities and display names; expose physical aspects without duplicating richer character details |
| CHAR-02 | Presence | Record character placement over time, including location known only at a broad level |
| CHAR-03 | Movement | Represent departures, route/steps and arrivals sufficiently to answer whereabouts during travel; exact representation is open |
| CHAR-04 | Consistency | Detect conflicting placements and movement timing that contradicts known facts; distinguish hard conflicts from insufficient detail |
| SPEC-01 | Gradual detail | Permit useful worlds/scenes with only a few broad nodes; add rooms/connections only when needed |
| SPEC-02 | Explicit refinement | Narrow placements explicitly; preserve established facts; adding nodes must not silently relocate prior events |
| AGENT-01 | Location sub-agent | Accept planner event/place/time requests; resolve shared references; assess/refine physical aspects; apply authorized updates or return errors, clarification needs and alternatives |
| AGENT-02 | Division of labor | Deterministic services own calculations, structural invariants and calculable checks; the location agent adds interpretation and contextual/semantic assessment |
| INT-01 | Shared graph | Events, characters, locations and timeline use one shared state and identities; this layer maintains physical aspects without separate event/character stores |
| INT-02 | Planner feedback | Return actionable missing information, blocked routes and conflicting facts so the planner can revise its plan |
| STATE-01 | Authority | Define protected spatial/timeline mutations available to the location agent; the narrative agent requests these updates rather than applying them directly |
| STATE-02 | Shared reads | Both agents can query character whereabouts, location occupants, state at time, routes and contextual slices from the same deterministic tools |
| STATE-03 | Consistent representation | Prevent invalid states by construction where practical; validate calculable contradictions before accepting protected updates |
| STATE-04 | Single physical truth | Define authoritative placement/state facts and derive or validate dependent event, whereabouts and visual views to avoid independently editable contradictory copies |
| AGENT-03 | Iterative negotiation | Support planner request → tool checks/agent reasoning → clarification/error/alternatives → revised request or authorized application |
| AGENT-04 | Finding provenance | Distinguish deterministic conflicts, insufficient information and agent-assessed concerns; include relevant IDs, times and explanations |
| AGENT-05 | Scope of authority | Location-agent write authority does not grant ownership of all narrative/event/character properties; exact field matrix and UI policy remain open |
| UI-01 | Graph views | Show containment and travel connections in distinct selectable visualizations of the same records |
| UI-02 | Inspector/editing | Inspect and edit descriptions, relationships, durations and state; identify broad/unknown values |
| UI-03 | Calendar | Filter/select locations and inspect scheduled use/state over a time range |
| UI-04 | Character timeline | Show character lanes with location-presence intervals and journeys; gaps and conflicts are visible |
| UI-05 | Time synchronization | Select/scrub story time so graph states, inspectors and character positions describe the same instant |
| API-01 | Local REST API | Expose records, edits, temporal queries, route queries, whereabouts, scene context and validation to coding/planning agents |
| API-02 | Documentation | Document operations, schemas, time semantics, errors and examples; provide a repeatable agent walkthrough using curl or an equivalent client |
| API-03 | UI/API parity | UI and API use the same underlying model and rules so visual feedback reflects agent-visible data |

## Proposed safeguards to validate during design

* Reference integrity: updates, renames and removals must not silently leave dangling event, edge, placement or character references. Choose deletion/merge behavior explicitly.
* Traceability: preserve source event/scene/request references for established facts and accepted refinements; distinguish sourced facts from agent proposals.
* Safe mutations: validate related edits together and return an understandable change result. Choose a minimal revision/conflict strategy for multiple planner requests and UI edits.
* Query purity: queries do not silently create missing locations, routes or durations. An agent can explicitly propose filling missing detail.
* Stable deterministic output: equivalent queries against the same data and time yield equivalent routes/state, with documented route bounds, ordering and tie-breaking.
* Local persistence: retain the model between sessions and support reproducible example scenarios. Exact persistence format is undecided.

These safeguards are design proposals, not a commitment to elaborate event sourcing or branching/version infrastructure.

## Representative acceptance scenarios

1. **Broad-to-specific:** Create only House, place a scene/character there, then add Kitchen later. The original placement stays House until explicitly refined; the UI and API agree.
2. **Directed travel:** A slide permits Tower→Courtyard. Reverse travel via that edge is absent; a separate staircase can supply a valid return route.
3. **Alternative routes:** Two known A→B routes have distinct durations and descriptive text. Repeated queries return equivalent structured options and a matching diagram.
4. **Locked door at arrival:** A route departs at 21:58 and reaches a door at 22:03; the door locks at 22:00. The result flags that restriction even though departure preceded the lock.
5. **Scheduled use:** A classroom hosts a class from 10:00–11:00. Its calendar shows the booking, without asserting that entry is forbidden unless explicit access state says so.
6. **Historical description:** After an event damages a room, queries before and after that event return the appropriate physical description/state.
7. **Character whereabouts:** A lane shows presence at A, a journey, then presence at B. A mid-journey query and the graph time selection show transit rather than falsely placing the character at an endpoint.
8. **Incomplete world:** No route is recorded between two broad locations. The response reports missing knowledge and permits explicit refinement instead of declaring travel impossible.
9. **Conflicting plans:** Two requests put the same character in incompatible locations at overlapping times. Validation returns the conflicting references; no silent overwrite occurs.
10. **Agent walkthrough:** A coding agent uses only the API documentation to create a small world, query scene context/routes, apply a temporal change and inspect feedback; the UI displays the same results.

These scenarios are intended to drive design/prototype validation, not require the whole writing system to run.

11. **Shared read access:** Narrative and location agents query the same graph revision for "where is Alice?" and "who else is here?" and receive compatible results; broad/uncertain placements remain explicit.
12. **Protected writes:** A narrative-agent attempt to mutate protected location/timeline data is unavailable or rejected by the tool/API boundary. A submitted request can be applied by the location agent after validation.
13. **Travel-time contradiction:** A proposed 10-minute event includes a journey whose known feasible routes all require at least 30 minutes. Return the calculable conflict and relevant facts; the agent can suggest a revised time or location. Incomplete route knowledge must be qualified.
14. **Concurrent conversations:** Two conversations in House trigger neither automatic rejection nor silent relocation. The agent examines available detail/constraints and can ask for rooms or suggest a compatible refinement; automatic choice policy is unresolved.
15. **Agent assessment:** A contextual concern that structured checks cannot establish is returned as an agent assessment with rationale. Passing deterministic checks does not certify the absence of every possible conflict.
16. **Round-trip negotiation:** A planner queries, proposes an event, receives a conflict/clarification, revises the request, and the location agent applies a valid update; UI and subsequent reads reflect that same shared state.

## Open decisions

| Decision | What must be resolved |
| --- | --- |
| Shared-state contract | Shared graph is agreed. Define authoritative physical fields, derived views, scoped write permissions, event-creation handoff and consistent reads |
| Temporal semantics | Numeric units, precision, interval boundaries, instantaneous events, timezone/calendar rendering, recurring schedules and overlap precedence |
| Route semantics | Waiting, mid-traversal closures, departure/arrival evaluation, duration defaults, broad endpoints, path limits and incomplete-map feedback |
| Canon/refinement | Location agent controls protected writes. Decide automatic room selection/relocation authority, proposal acceptance and concurrent refinements |
| Graph structure | One parent or multiple; parallel passages; endpoint binding across hierarchy levels; non-travel relations such as audibility/proximity |
| Character model | Presence versus movement records; unspecified intervals; coarse placement; minimal consistency rules |
| First release | Which synchronized views are needed initially; whether recurrence, spatial relation queries and map animation come later |
| Existing issue | Identify and link the referenced location-consistency redesign issue; avoid assuming it is DEF-53 |

## Candidate later experiments

Rendered map animation, richer geometry, audibility/visibility relationships, additional specialized conflict-resolution agents, recurring calendar rules beyond the first implementation, alternate timeline branches and richer traversal conditions. Preserve room to explore them without making them prerequisites for a useful initial subsystem.

## Related architecture

[DEF-53](https://linear.app/tristansturgess/issue/DEF-53/revise-the-event-graph-and-signal-model-architecture), [DEF-54](https://linear.app/tristansturgess/issue/DEF-54/revise-plot-planning-architecture-around-global-narrative-intent), and [DEF-56](https://linear.app/tristansturgess/issue/DEF-56/revise-architecture-for-story-bible-exploration-and-context-assembly). Existing architecture issues retain their original scope; this project develops the standalone app and feeds findings back into those designs.
