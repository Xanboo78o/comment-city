# COMMENT CITY (working title — the comments will name it)

The game the comments build. Every feature gets added because the audience asked.

## Art pipeline
Export SVG at 64-scale → drop in `art/` with the exact filename → refresh.
Anything untextured renders as THE TILE, labeled in-game with the file it's waiting for.

## Slots still waiting for art
| file | size |
|---|---|
| player.svg | 1x1.5 tiles |
| npc.svg | 1x1.5 tiles |
| apartment-facade.svg | 5x4 |
| burger-facade.svg | 6x3 |
| store-facade.svg | 5x3 |
| job2-facade.svg | 5x3 |
| filler-1.svg | 4x4 |
| filler-2.svg | 6x5 |
| construction.svg | 6x4 (the COMING SOON slot every winning comment moves into) |
| asphalt.svg | 1x1 plain lane surface (flat gray #696969 stands in until this exists) |
| car.svg | 2x1 (traffic; drawn facing right, flipped in code) |
| streetlight.svg | 1x3 |
| bench.svg | 2x1 |
| trashcan.svg | 1x1 |
| atm.svg | 1x2 |

Done: the-tile.svg, dirt.svg, grass.svg, road-center.svg (double yellow), road-dash.svg (merge line, unused until multi-lane), road-line.svg (solid white, unused until edge lines)

Road lines are drawn with the line VERTICAL in the tile; the engine rotates them 90°,
crops their border, and straddles them across the road's center seam (the half-tile plan).
No horizon — Stardew-style ground plane. dirt.svg is reserved for paths/yards/construction ground.
