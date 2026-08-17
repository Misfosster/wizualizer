# Spikes

A spike is a short investigation that reduces a specific uncertainty before the
team commits to production implementation. It is not a hidden feature branch and
does not need production-quality code.

## Lifecycle

1. **Proposed:** the question and why it matters are written down.
2. **Active:** the timebox, experiment, and expected evidence are defined.
3. **Concluded:** findings and a recommendation are recorded.
4. **Accepted or rejected:** the product/technical decision and follow-up work are
   linked from the spike.

Stop when the decision has enough evidence. If the question expands, conclude the
current spike and open another one instead of letting it become an unbounded plan.

## File naming

Use `NNN-short-description.md`, with monotonically increasing numbers. Store
supporting images in `docs/spikes/assets/` with the same numeric prefix.

## Template

```md
# SPK-NNN - Title

Status: Proposed | Active | Concluded | Accepted | Rejected
Owner:
Target milestone:
Timebox:
Decision needed by:

## Context

Why this uncertainty matters now.

## Question

One question the spike will answer.

## Constraints and non-goals

- Constraint
- Not in scope

## Options or hypotheses

1. Option
2. Option

## Experiment

What will be sketched, prototyped, measured, or tested.

## Evidence and findings

Links, screenshots, observations, measurements, and user feedback.

## Recommendation

The recommended direction and tradeoffs.

## Decision

Accepted/rejected direction, date, and decision maker.

## Follow-up

- Link to plan, issue, ADR, or implementation task.
```
