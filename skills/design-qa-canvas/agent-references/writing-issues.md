# Writing issues

How the words on a card read: title and details. (What to report at all, screenshots and priority are in the main SKILL.md rules.)

## Do

- Lead the title with what's wrong, in plain words.
- Add what it should be only when that isn't obvious from the problem.
- Write a title a teammate understands without opening the card. The user presents from the titles, so each one should carry the point alone.
- Use the names the user sees on screen.
- Leave the details empty when the title says it all. No next step or "to do" line.
- Use short bullets in the details when one card has several parts.
- End the details with a plain "Reporter: <name / AI>" line if you know.

## Don't

- Don't use internal names, routes or IDs in titles.
- Avoid repeating the title in the details.
- Don't narrate what you did to find it.
- Don't describe the screenshot back, or write what you can't tell from it; ask in the thread instead.
- Write the user's point as the issue itself, not "Reported by …: …".
- Don't pile on record IDs, dates and steps as proof.
- Don't copy meeting status ("Dev to check", "Planned", "<name> to confirm").

## Examples

### Titles

| Before | After |
|---|---|
| Units typed into free text | Units are free text instead of coming from the order |
| “Add payment method” dialog | Add payment method: fields are clipped and padded unevenly |
| “Show more” is styled two different ways | “Show more” is blue here; the design has it grey |

### Details

| Before | After |
|---|---|
| Created order ORD-1042 with Type = A and ORD-1043 with Type = B. Both orders' detail panels look identical… | *(empty)* |
| Running the price check shows a green “Success — Running check…” toast and a separate “Generating…” card with grey skeleton bars. Neither is wanted as designed here. | • Title should be Price check<br>• Results in the same card, not a new one<br>• Store dropdown UI |
| Store dropdown has no search — Noted, will add. | *(empty)* |

## Suggestions (`sugg`)

Suggestions are options the user keeps or drops, so they're worth adding only when they're likely to be kept.

- **Lead with the design reference.** Compare the screenshot with the reference (Figma, a design branch, a signed-off build) and suggest the differences: layout, spacing, alignment, component, type, colour, an element that's missing or extra. Say where in the reference. If the card has no reference yet, ask for one in its thread first.
- **Follow the user's lens.** Read what the user wrote on this card and on other cards, and suggest more of the same kind. They review the build against the design: what's there that shouldn't be, what looks or sits differently.
- **Keep it to what the screenshot shows.** Clipping, truncation, misalignment and uneven spacing are good candidates; the user can confirm them at a glance.
- **Usually one or two per card.** Add more only when the reference shows more clear gaps.
- **Leave other observations for when they matter.** Test data that looks odd (dates, counts, empty rows), copy and wording, and guesses about behaviour ("unclear whether…") are rarely kept. Raise one only if it blocks the flow or the user asks for that kind of review, and then as a question in the thread rather than a suggestion.
