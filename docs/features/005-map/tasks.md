# 005 tasks
- [x] mapdata.py: contours ingest, per-département GeoJSON with KPIs, PLM arrondissements, test
- [x] app: data/map.ts (metrics, quintiles, colours) + tests, ChoroplethMap (Leaflet web, native placeholder), /map screen, home link
- [x] Browser check on the production export (npx expo export): 109 départements, 5 classes + grey, legend, drill-down to Landes (327 communes), Paris by 20 arrondissements. The dev server had stalled (blank page, bundle request pending) while the CPU was saturated; the exported build works.
