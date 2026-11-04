# Writing System Evaluation Recommendations

## Purpose

Establish a small, inexpensive set of LLM-judge evaluations that can detect improvements or regressions in the writing system as its prompts, models, and workflows change.

The initial goal is **comparative engineering feedback**, not an authoritative measure of literary merit. Evaluations should help answer:

- Did a change make the generated output more coherent or effective?
- Did the system follow the generation brief and use the provided story context?
- Which stage improved or regressed: scene writing, arc planning, or Story Bible construction?

The suite should be easy to run repeatedly, easy to inspect, and small enough that maintaining it does not distract from building the writing system.

## Guiding Principles

1. **Start small.** Use a few distinct criteria per output type, a fixed test set, and one capable judge model. Expand only when a recurring failure mode is not captured.
2. **Evaluate outputs against their intent.** Supply the original instructions, relevant Story Bible context, and the generated artifact. Do not reward an attractive output that ignores its brief.
3. **Prefer observable criteria.** Coherence, structure, consistency, and adherence are easier to judge reliably than general claims that writing is “good” or “interesting.”
4. **Distinguish correctness from quality.** A structurally valid artifact can be narratively ineffective; compelling prose can violate established story facts.
5. **Respect deliberate ambiguity.** Unresolved arcs, partially specified entities, conflicting character beliefs, and unconventional scenes may be entirely appropriate.
6. **Evaluate stages independently.** Judge arcs as plans, scenes as prose, and Story Bible objects as structured narrative data, so failures can be attributed to the right stage.
7. **Treat LLM scores as noisy measurements.** Track trends and specific regressions, not tiny numerical differences as definitive proof.

## Initial Evaluation Categories

Each category uses three independent dimensions scored from 1–5, with short, evidence-based explanations.

### 1. Scene Quality

**Inputs:** Scene-generation brief, relevant narrative and Story Bible context, generated prose.

| Dimension | Question |
|---|---|
| **Coherence** | Are events, dialogue, actions, and transitions understandable and internally consistent? |
| **Prose quality** | Is the prose clear, fluent, and appropriate to the requested tone and style? |
| **Scene effectiveness** | Does the scene achieve its intended narrative purpose, such as developing conflict, revealing character, or establishing atmosphere? |

**Intention:** Catch unreadable or inconsistent writing without enforcing a single literary style. Judge whether the scene fulfills its purpose, rather than requiring every scene to have a conventional beginning, middle, and end.

Do not initially introduce separate ratings for dialogue, pacing, imagery, emotional impact, or originality; add these only if the broad rubric misses important, repeated problems.

### 2. Narrative Arc Quality

**Inputs:** Arc-generation brief, relevant story context, proposed arc and its events or beats.

| Dimension | Question |
|---|---|
| **Coherence** | Do developments form a comprehensible causal or psychological progression? |
| **Structure** | Does the arc establish a starting situation, develop it, and reach an appropriate endpoint for its requested scope? |
| **Narrative effectiveness** | Does the arc meaningfully develop its intended conflict, theme, relationship, or character transformation? |

**Intention:** Distinguish an orderly sequence of beats from an arc that actually produces the intended change or tension. A character-development arc, for example, should challenge or reshape something meaningful about the character—not merely include a beginning and an ending.

Do not penalize ongoing arcs for lacking final resolution, or experimental structures for departing from familiar formulas, when those choices match the brief.

### 3. Story Bible Construction Quality

**Inputs:** Object-generation or update brief, relevant existing Story Bible state, generated entities/events/assertions and their properties or relationships.

| Dimension | Question |
|---|---|
| **Instruction adherence** | Were the requested entities, properties, relationships, events, and details represented appropriately? |
| **Internal consistency** | Does the result avoid unintended contradictions with itself and established story facts? |
| **Relevance and usefulness** | Is the information meaningful for the requested narrative task without unnecessary or distracting inventions? |

**Intention:** Evaluate semantic usefulness and faithfulness to the brief, not the sheer quantity of worldbuilding detail. The Story Bible deliberately supports partial specification: unspecified facts are not defects unless the task required them. Conflicting character perspectives or intentionally disputed claims are not automatically world-state inconsistencies.

Apply the same core rubric to entities, events, and assertion sets, with wording tailored to each object type. Assertions relate entities; entity properties remain on entities. An eventual deterministic validation layer should check schema-level requirements separately.

## Shared Scoring Rubric

| Score | Interpretation |
|---|---|
| **1** | Fundamentally unsuccessful; serious problems |
| **2** | Significant problems; partially successful |
| **3** | Adequate, but noticeably weak |
| **4** | Good; largely successful with minor weaknesses |
| **5** | Excellent; achieves the criterion very well |

Include a short description of each dimension in the judge prompt, and require a brief justification tied to concrete features of the output. The dimensions should be scored independently rather than allowing a generally positive impression to inflate every score.

Record individual dimension scores rather than relying only on an overall aggregate. In particular, an improvement in prose quality should not conceal a decline in coherence.

## Initial Evaluation Workflow

1. **Create a fixed suite of approximately 15 prompts:** five scenes, five arcs, and five Story Bible tasks.
2. **Run each prompt through the system** and save the output, generation instructions, relevant context, and generator version.
3. **Apply a category-specific LLM judge rubric** using one fixed, capable judge model.
4. **Save structured results** with scores and short explanations.
5. **Compare versions on the same prompts**, by category and dimension, looking for meaningful patterns and inspecting explanations behind regressions.

Suggested coverage:

| Category | Five initial cases |
|---|---|
| Scenes | Dialogue; interpersonal conflict; introspection; action; atmosphere |
| Arcs | Character change; relationship development; external conflict; mystery; intentionally unresolved subplot |
| Story Bible | Character entity; location; relationships/assertions; event and state update; consistency with established facts |

Include cases involving ambiguity, incomplete world knowledge, and legitimately conflicting character beliefs to avoid rewarding simplistic or unnecessarily over-specified outputs.

The suite need not begin as a statistical benchmark. It is a small regression suite intended to reveal obvious changes and guide investigation. Small average differences are not conclusive.

## Judge Prompt Requirements

The judge should receive:

- The **generation instructions** and intended narrative purpose.
- The **relevant story context**, without overwhelming the judge with unrelated material.
- The **generated output** in the form appropriate to its stage.
- **Three dimension definitions**, the shared 1–5 scale, and instructions to provide concise supporting reasons.

It should be instructed to:

- Evaluate the artifact **as written**, not a hypothetical improved version.
- Judge against the **requested genre, style, purpose, and scope**.
- Avoid rewarding length, complexity, or excessive detail for their own sake.
- Accept appropriate ambiguity, partial specification, unconventional structure, and intentional unresolved tension.
- Return structured JSON so scores and rationale are easy to store and compare.

Example result:

```json
{
  "test_id": "arc_character_growth_01",
  "system_version": "v0.2",
  "scores": {
    "coherence": 4,
    "structure": 3,
    "narrative_effectiveness": 4
  },
  "reasoning": {
    "coherence": "The protagonist's choices follow from the established conflict.",
    "structure": "The final development is abrupt relative to the preceding beats.",
    "narrative_effectiveness": "The central belief is meaningfully challenged."
  }
}
```

Use a similar structure for each category. Keep judge model and rubric versions in evaluation metadata, and hold them fixed during generator comparisons.

## Calibration and Reliability

Before trusting the evaluation trends:

- Review roughly **10–15 outputs manually**, comparing the judge's ratings with clear human judgments of strengths and failures.
- Make a few **deliberately degraded outputs**, such as an arc with a missing causal link, a scene with contradictory actions, or an assertion that clashes with established facts. Verify that ratings respond in the expected direction.
- Inspect **reasoning as well as scores**. A plausible-looking number with a mistaken explanation is not a trustworthy measurement.
- Revisit the rubric or judge only when it consistently misses a relevant failure mode; avoid constant rubric changes that make scores incomparable.

This lightweight calibration matters because research finds that LLM judges have preferences and biases—including position and verbosity effects—and can disagree substantially with human judgments of creative writing.

## Optional: Pairwise Comparisons Between Versions

When changing a generator prompt, model, or workflow, optionally ask a judge to compare two outputs produced from the **same test prompt**:

- Which output better meets the generation brief and rubric?
- Is the preference decisive, or are the outputs approximately tied?
- What concrete difference explains the preference?

Hide version identities, balance or reverse candidate order, and flag order-dependent judgments as uncertain. Report wins, losses, and ties alongside the pointwise dimension scores.

**Intention:** Pairwise comparisons may reveal improvements that are difficult to express as movement on a coarse 1–5 scale. They supplement rather than replace pointwise scoring.

## Later Experiment: Reader Preference / Interestingness

Creative engagement is important but harder to evaluate reliably. Do **not** make it a core quality score initially.

A future experiment can ask a pairwise judge:

> Which version of this scene would you rather continue reading, and why? Consider curiosity, emotional engagement, tension, and desire to know what happens next. Do not reward length or ornamentation for their own sake.

Keep this subjective reader-preference signal separate from structural or semantic correctness. Periodically compare its decisions with actual reader preferences or human reviews before using it to optimize the system.

## Out of Scope for the First Version

- A universal “literary quality” score.
- Large benchmark datasets, elaborate evaluation dashboards, or sophisticated aggregation methods.
- Separate evaluators for every possible writing craft dimension.
- Deterministic schema validation disguised as LLM judging.
- Definitive claims based on very small score changes.

The first release should be useful with a set of prompts, a judge prompt per output category, and JSON results. Expand in response to observed limitations, not anticipated complexity.

## Research Basis and Limitations

Research supports rubric-guided LLM evaluation as a practical proxy for some human judgments, but does **not** establish that these systems reliably measure artistic merit. Relevant work includes:

- **G-Eval** (Liu et al., 2023): rubric-based LLM evaluation of generated text, with strong results for tasks such as summaries and dialogue; not direct proof of reliable literary assessment. https://aclanthology.org/2023.emnlp-main.153/
- **Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena** (Zheng et al., 2023): documents biases such as position, verbosity, and self-preference in LLM judging. https://arxiv.org/abs/2306.05685
- **Prometheus 2** (2024): work on rubric-guided pointwise and pairwise evaluation. https://arxiv.org/abs/2405.01535
- **LitBench** (2026): research into agreement between automated judges and human creative-writing preferences; illustrates the difficulty of judging stories. https://aclanthology.org/2026.eacl-long.362/

**Practical takeaway:** Use LLM judges as repeatable, imperfect engineering instruments. Their greatest immediate value is helping identify why generated content improves or regresses under consistent test conditions—not declaring whether a story is objectively good.
