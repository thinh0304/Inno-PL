# Review checklist

Copied word for word from `node_modules/@reflexify/agentflow-elements/DESIGN.md`, "Review checklist". When the two differ, the guide is right.

Answer each question in English and in Vietnamese, in the light and the dark theme, at 1280 px and at 800 px of module width, and once with a red primary colour, as AgentFlow's crimson brand gives. Every answer must be yes.

1. Is every colour a token from the root's block, a `color-mix` of tokens, or a module-owned hue declared there, with no other hex, `rgb()` or `oklch()` literal?
2. Does coloured text use an `-ink` mix, with the raw status hues only on icons and bars?
3. Do status and priority avoid `--accent`, so the screen still reads when the primary colour is red?
4. Are spacing, radius, type and duration all from the scales in Foundations?
5. Does the module put one `<style>` in its shadow root, the kit's CSS first, with no selector on `:root`, `html` or `body` and no custom property on `:host`?
6. Are responsive rules `@container` queries only, with no width `@media`, no viewport unit and no window size?
7. Does the module's own code add no listener on `document` or `window`?
8. Does every id come from a key resolved through the SDK's objects cache, and every address the browser opens itself from `host.apiUrl`?
9. Does a change of language or theme re-render in place, keeping an open dialog and what is typed in it?
10. Does every interactive element have hover, focus-visible, active and locked states?
11. Is every focus ring 2 px, solid, in the primary colour, unclipped, and drawn on the card rather than on a stretched `::after`?
12. Is every control at least 32 px, or 24 px with 4 px between them in a dense row?
13. Is every locked control `aria-disabled`, with its reason in a tooltip and in hidden text that its `aria-describedby` names?
14. Does truncated text carry its full text in one `af-tooltip`, while status words, buttons and reasons wrap instead?
15. Does Vietnamese fit, with no clipped diacritics (line height at least 1.35) and no fixed-width box around text?
16. Are the icons SVG in `currentColor` at 16, 14 or 12 px with `aria-hidden`, and is there no emoji?
17. Are dates formatted through `Intl` as `af-date` formats them, relative only for the day before, of or after today, each a `<time dateTime>` with its full date in a tooltip?
18. Do numbers go through `Intl.NumberFormat`, with `tabular-nums`?
19. Does every change made in place show its result before the server answers, and roll back with the flash and the server's reason?
20. Does a confirmation come only before what cannot be undone, with the act's name on its button and a dismiss word that is not the act's verb?
21. Does loading show a skeleton shaped like the layout after 150 ms, and do empty states give an icon, a title and at most one action, and errors the reason and Try again?
22. Is all motion `transform` and `opacity`, with reduced motion respected, and does dark mode keep visible surface steps, borders beside shadows and legible tints?
23. Is every `af-tooltip` on a non-interactive value mounted on first pointer arrival, and does it only add detail the visible text implies, with the full form also visually hidden text?
