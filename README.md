# 🍑🔫 PUCKZONU: Booty Blaster 3000

He jumps. He spreads his arms. He has no idea what's coming.

A browser mini-game: the video loops, you get a machine gun and **100 bullets**. Hit the butt. The closer you get to dead-center, the bigger the score.

## How to play

| | |
|---|---|
| 🎯 **Aim for the butt** | Dead-center = **PERFECT** (100), cheek clap (50), graze (25) |
| 👆 **Tap vs hold** | Tapping gives precise shots. Holding sprays the machine gun, and the spread grows |
| 🦘 **Air butt** | Hit him mid-jump for **2×** points |
| 🔥 **Combo** | Every 5 hits in a row raises the multiplier, up to ×4. A miss resets it |
| 🥥 **Coconuts** | Shoot falling coconuts for +10 ammo. Golden ones trigger **slow-mo** |
| ⚡ **Nerves** | The more you shoot, the faster he jumps |

Press **H** to show the hitbox and **Space** to fire. Your high score is saved in the browser.

## Play it on GitHub Pages

1. Go to the repo's **Settings → Pages**.
2. Under **Build and deployment**, pick **Deploy from a branch**, choose the branch and the `/ (root)` folder, then save.
3. After a minute the game is live at `https://<your-username>.github.io/puckzonu/`.

## Run locally

It's plain HTML/CSS/JS with no build step. Serve the folder with any static server, for example `npx http-server`, and open it in a browser.

## Files

- `index.html`, `style.css`, `game.js`: the game (sounds are synthesized with Web Audio, so there are no sound files)
- `track.js`: the butt hitbox for each 0.1s of the video. It was generated automatically by following the yellow stripe on his jacket
- `assets/target.mp4` and `assets/target.webm`: the looping video (muted, with the audio stripped)
