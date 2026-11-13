# Laying out flows

Optional: read it when laying out a new canvas or when flows look tangled. These are defaults; break one when the link is the point.

## Keep flows linear, don't tangle them
Arrows that cross between flows are hard to follow while presenting. So:
- **One main flow shows every core screen in a straight line**, start to finish (e.g. pencil → sheet → reason → saved → hover).
- **Other entry points are their own flow** (their own blue heading), not arrows into the middle of the main flow. If "PA: patient not found" and "Coverage: no match" both open the same sheet, don't draw both into it: each is its own short flow that ends at its own screen, and the main flow already shows the sheet. Name the flow after the entry point.
- **Connect flows only when the link is the point**, e.g. a branch that only makes sense as a continuation. Then use one arrow, not several.
- **Branch sparingly.** A side outcome (e.g. "assignees notified") can branch off the main flow; keep it to one level.
- Before building, check: does any arrow go backwards, cross another flow, or point into a screen that already has an arrow in? If so, make it a separate flow instead.

## Separate journeys (a guideline)
- Unrelated journeys are their own flows; a screen they share may repeat in each. Don't force everything into one graph.
- Before adding a second arrow into a screen, or one going backwards, ask whether a short separate flow reads better. Keep the join or loop when it is the story (a retry the viewer needs to see).

## Happy path on top, arrows straight
- **List the happy path first.** In `edges`, put the most common outcome of a step first and the rarer ones after it. The first-listed child stays level with its parent and sits on top; the others stack below. This is what a new viewer sees first, and what you present from.
- **Don't fight the layout.** You don't set positions. The canvas lines each step up with the step before it; a step pushed down by something above it brings its chain down with it, and only an extra branch or a join bends. If a flow looks unbalanced, change the order of the `edges` (or split the flow), not the screenshots.
