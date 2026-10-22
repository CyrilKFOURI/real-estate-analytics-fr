# 014 tasks (spec revised 2026-10-21)
- [x] 1. Pipeline precomputes: series (départements, régions), explorer tables, commune points, section points (n ≥ 10), rent curve parameters, breaks for every layer
- [x] 2. Design system: UI_UX.md from the user's "zero-slop" brief, tokens (light paper + dark), Cyfouri logo, shell (sidebar, top bar), filter bar with URL state, InfoTip + KPI catalogue, Méthode page; deps maplibre-gl + echarts, leaflet removed
- [x] 3. Carte: choropleth RdYlGn (+ colour-blind toggle), points mode (communes, sections), hover tooltips, docked detail panel
- [x] 4. Explorer (table, scatter, histogram, CSV) and Évolution (multi-place curves, base 100)
- [x] 5. Marché town page, every section of spec §5.6
- [x] 6. Analyser un bien: rent at exact surface, comparables map, waterfall
- [x] 7. Comparer, Simulateur, Accueil national dashboard
- [x] Each step: tests, tsc, lint, browser check 1440/390 light/dark against the brief's checklist

Notes (2026-10-22):
- Comparables map shows the commune's published section points (property's section dark), not sale coordinates: the local API returns none and DVF re-identification rules apply.
- The in-app browser pane gives 0 animation frames while hidden; map checks use `__cyMap.redraw()`.
- `src/data/` was never committed (root .gitignore `data/` matched it): rule anchored to `/data/`, files added.
- Pipeline fixes found while verifying: OLL "4P et plus" rooms and repeated cells, département/région names and the région of each département.
