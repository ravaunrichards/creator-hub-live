# Creator Hub Live — CSS Style Lab

## Contents
- `styles/`: 165 individual CSS experiments, one for each requested style name.
- `styles/CHL Professional Combined.css`: separate combined responsive design.
- `preview/index.html`: dropdown-based browser preview to test styles one at a time.
- `docs/STYLE-MANIFEST.json`: machine-readable file inventory.

## Test it
1. Extract the ZIP.
2. Open `preview/index.html` in a modern browser.
3. Select an individual CSS file to preview it alone.
4. Click **Load combined style** to test the unified design.
5. Resize the browser or test on a phone.

If your browser blocks local CSS files, run a local static server from the extracted directory with `python -m http.server 8000`, then open `http://localhost:8000/preview/`.

## Important
This is a standalone visual test lab; it does not connect to or change the CHL live site. The individual CSS files are generated experiments, not verified copies of existing production styles. The combined stylesheet is a starting point for review, not a guaranteed drop-in replacement. Do not load all 165 files into production at once: overlapping rules can conflict. Before integration, inspect the actual CHL source, adapt selectors to its markup, and test pages, routes, accessibility, and responsive breakpoints. No backend, wallet, payment, gift, authentication, or live-streaming behavior is implemented or modified.
