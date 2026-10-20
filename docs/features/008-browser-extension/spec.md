# 008 — Browser extension "Analyser ce bien"

## User story
On a listing page (LeBonCoin, SeLoger, PAP, Bien'ici…), I click the extension and the property
dashboard (012) opens prefilled with the listing's price, surface, rooms, type and town; I check the
fields and click "Analyser".

## Legal frame (docs/research/state_of_the_art.md, "Scraping listing sites")
- Read only the page the user is viewing, only when they click. No crawling, no background reading.
- Extract only property facts (price, surface, rooms, type, postcode/town). Never seller names, phones, photos.
- Nothing is sent to any server by the extension and nothing is stored: it opens a URL of our app.
- Permissions: `activeTab` + `scripting` only (no host permissions, no history, no storage).

## Design
- Manifest V3, plain JavaScript, no build step and no dependency (`apps/extension/`).
- `parser.js`: pure functions, unit-tested with Node's runner on HTML fixtures:
  1. schema.org JSON-LD (`offers.price`, `floorSize`, `numberOfRooms`, `address`) when present;
  2. Open Graph / title fallbacks;
  3. text patterns ("45 m²", "2 pièces", "150 000 €", "49100 Angers").
  Each field records its source; missing fields stay empty for the user to fill.
- `popup.js`: on click, injects the parser into the active tab (`chrome.scripting.executeScript`),
  shows what was found, and opens `<APP_URL>/property?address=…&type=…&surface=…&rooms=…&price=…`.
- The app's `/property` screen reads those query params into its form; it does not analyse until the
  user confirms (the listing may be wrong or incomplete).

## Acceptance criteria
- GIVEN a page with JSON-LD WHEN parsed THEN price, surface, rooms, type and postcode come from it.
- GIVEN a page with only text THEN the text patterns fill what they can, nothing is invented.
- GIVEN the popup on a listing THEN the dashboard opens prefilled and waits for "Analyser".
- The manifest requests no host permission.
