# Writing issues

How the words on a card read: title and details. (What to report at all, screenshots and priority are in the main SKILL.md rules.)

## Do

- Lead the title with what's wrong, in plain words.
- Add what it should be only when that isn't obvious from the problem.
- Write a title a teammate understands without opening the card.
- Use the names the user sees on screen.
- Leave the details empty when the title says it all.
- Use short bullets in the details when one card has several parts.
- End the details with a plain "Reporter: <name / AI>" line if you know.

## Don't

- Don't use internal names, routes or IDs in titles.
- Avoid repeating the title in the details.
- Don't narrate what you did to find it.
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
