# Performance

## Dropdown interaction latency

### Symptom

On slower devices, opening a registration dropdown can briefly show the menu shadow or a dark edge before option rows are painted.

### Cause

Standard registration selects render an app-owned listbox so hover styling is consistent across browsers. The country field has 249 options; mounting every row at once can briefly block layout and paint on constrained CPUs. The previous `shadow-lg` treatment made this moment look darker.

School search does not share this exact path: it displays at most 50 results, but filtering still searches the 13,866-item school dataset.

### Current mitigations

- Route-level lazy loading keeps the register page and its large option data out of the initial sign-in bundle.
- School search uses a deferred query and pre-normalized values, keeping keystrokes responsive while filtering runs.
- Dropdown result surfaces use the light/clay palette rather than the browser-native popup.
- Standard dropdowns virtualize their option rows, keeping the full scroll range while mounting only visible choices.
- The Playwright regression in [tests/register.spec.ts](../tests/register.spec.ts) measures click-to-next-frame time for the country dropdown and fails above 100 ms. The test attaches the observed duration to its report.

### Follow-up

If production telemetry shows the budget is exceeded on representative low-end hardware, replace the long standard list with a searchable, capped result list. Avoid tightening the browser-test threshold below 100 ms without collecting measurements from CI and target devices, because browser scheduling can make smaller limits flaky.