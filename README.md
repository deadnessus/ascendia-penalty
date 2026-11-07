# ASCENDIA PENALTYS

A realistic-feeling 3D penalty-shootout game for the browser (Three.js, no build step).
Champions League clubs, real player names, 8 kicking techniques, a full goalkeeper dive system,
broadcast-style HUD, per-player goal-celebration cutscenes, create-a-player, team builder and
peer-to-peer online play.

## Run it

```bash
python3 -m http.server 8000     # or any static server
# open http://localhost:8000
```

ES modules + an import map are used, so it must be served over http (not opened as `file://`).
Online play uses PeerJS (bundled in `vendor/`) and the free public PeerJS matchmaking server, so both players need internet.
If creating a room fails, the game retries automatically and shows a *Try again* button with the reason. Networks, ad-blockers
or VPNs that block `0.peerjs.com` will stop online play; to use your own PeerJS server set
`window.ASCENDIA_PEER = { host, port, path, secure }` before the game loads.

## Modes

* **Play Shootout** – pick your club and the opponent (16 Champions League clubs + your own teams).
  You kick the odd rounds and **keep goal** in the others, exactly like a real shootout (best of 3/5/7, then sudden death).
* **Online Match** – host a room, share the 5-letter code, friend joins. Peer-to-peer (WebRTC); each player kicks and keeps in turn.
* **My Player** – create a player (look, number, Power / Finesse / Accuracy with a point budget, signature celebration)
  and add him to **any** real team or your own.
* **My Team** – build a team with your own colours, a goalkeeper, and up to 8 **real players** picked from every club (or your created players).
* **Options** – AI level (Amateur → Legendary), shots per side, graphics, volume, crowd, aim assist, camera shake, cutscene skipping.

## Controls

**Kicking** — mouse to aim · hold click / `Space` to charge · release to shoot · `1`–`8` choose the kick · arrow keys also aim.
Release in the highlighted sweet-spot of the power bar for the most accurate shot; over-charging sends it flying.

| Key | Kick | Notes |
|---|---|---|
| 1 | Placed | most accurate |
| 2 | Power | fastest, harder to keep on target |
| 3 | Finesse | curls into the corner |
| 4 | Trivela | outside-of-the-boot bend |
| 5 | Panenka | slow chip – punishes keepers who dive early |
| 6 | Knuckleball | wobbles in flight |
| 7 | Low Driven | skidding grounder |
| 8 | Rabona | flair kick |

**Goalkeeping** — click one of the nine goal zones, or `Q W E / A S D / Z X C`. Hold `Shift` for a full-stretch dive.
Moves: Low / Mid / Fingertip dives, Spread block, Crouch block, Jump & punch, and full-stretch variants.
Saves are either **caught** or **parried**; shots near the corners need a full stretch.

## Celebrations (top 10)

The Siu · Knee Slide · The Robot · Baby Cradle · Backflip · The Griddy · Airplane · Shush · Meditate · Arms Crossed.
Pick your celebration on the first page (live 3D preview), or tick *Use each player's signature* so players use their own.
Every goal triggers a cinematic cutscene (letterbox, lower-third, orbiting camera) of the scorer performing it.

## Important notes

* This is an **independent fan project** and is not affiliated with or endorsed by EA SPORTS, FIFA or UEFA.
  "FIFA 2027" does not exist as a data source here: club and player names are real, but ratings, kits
  and appearance are approximations created for gameplay, and celebrations are original procedural
  re-creations of well-known celebrations. No official logos, licensed likenesses or EA assets are used.
  Rosters will drift out of date – use *My Team* / *My Player* to edit them.
* All animation is procedural (no external models), all audio is synthesised.

## Layout

```
index.html        UI shell
css/style.css     broadcast-style UI
js/data.js        clubs, players, kick types, celebrations, keeper moves
js/figure.js      player rig + kick / keeper / celebration animations
js/logic.js       deterministic shot physics, saves, AI
js/stadium.js     pitch, goal, stands, crowd, ad boards
js/audio.js       synthesised sound
js/net.js         PeerJS wrapper
js/main.js        UI, match flow, cameras, input, loop
vendor/           three.js r160 (MIT), PeerJS 1.5.4 (MIT)
```
