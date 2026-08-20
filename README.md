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
| road.svg | 1x1 tile — road is 2 rows on an EXACT 64 grid; the yellow center/merge line is half-tile art meeting at the row seam |
| car.svg | 2x1 (traffic; drawn facing right, flipped in code) |
| streetlight.svg | 1x3 |
| bench.svg | 2x1 |
| trashcan.svg | 1x1 |
| atm.svg | 1x2 |

Done: the-tile.svg, dirt.svg, grass.svg

No horizon — Stardew-style ground plane. dirt.svg is reserved for paths/yards/construction ground.
