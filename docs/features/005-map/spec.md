# 005 — Maps (choropleth)

## User stories
- I see France by département, coloured by a KPI I choose (price, yield, trend, F/G share, vacancy, population, property tax).
- I click a département and see its communes (Paris, Lyon, Marseille by arrondissement), coloured the same way, with the market score available.
- I click a commune: its figures and a link to its page.

## Design
- Pipeline (`pipeline/src/rea_pipeline/mapdata.py`, part of S5 publish): Etalab contours (communes 100 m, départements 1 km) joined to the latest complete-year KPIs; only published cells (n ≥ 10).
  - `serve/map/departements.geojson` (~350 KB) for the France view;
  - `serve/map/communes/<dep>.geojson` (≤ 610 KB, ~4× less gzipped) loaded on click.
- App: Leaflet (the JS library behind Python's folium) on web, `choropleth-map.web.tsx`; native placeholder until step 009.
- Colours: 5 quintile classes per layer and metric (idea kept from the 2024 ECE DataViz project), ColorBrewer YlGnBu (colour-blind safe), grey = not enough data; legend shows class bounds and what "darker" means.
- Basemap: OpenStreetMap tiles with attribution (fine for development; switch to a hosted tile provider before public launch).
- Leaflet's CSS is vendored without its image rules (`src/components/leaflet.css`): Metro cannot bundle CSS url() images.

## Acceptance criteria
- GIVEN the map page THEN départements are drawn and coloured, legend shows 5 classes.
- GIVEN a click on Maine-et-Loire THEN its communes load and Angers can be selected, showing its KPIs and a link.
- GIVEN Paris THEN its 20 arrondissements are drawn instead of one polygon.
- No individual sale is ever on the map.
