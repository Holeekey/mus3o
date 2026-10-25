# Lobby walk (landing)

## Objective
When the landing lobby fills the screen, the visitor can switch to first person and walk around it with the
same controls as the museum (pointer lock, WASD/arrows, Shift to run, Esc to leave).

## Constraints
- Same movement logic as `scene/Player.tsx` (speeds, input, `moveWithCollisions`), shared, not duplicated.
- Must not write palace state in the global store (saved palace, doors, focus, exam): the lobby is a demo.
- Lobby renders only the start room: the walker stays inside it (door gap closed, visually and physically).
- Desktop only (project demo scope); touch devices keep the scroll-only lobby.
- Pointer lock needs a user gesture: a click starts walking.

## Tasks
- [x] T1 Extract shared walking step + lobby colliders (`scene/walk.ts`) with tests; Player uses it. Route: inline.
- [x] T2 `LobbyWalker` + door filler in `RoomPeek`; scroll camera pauses while walking and blends back. Route: inline.
- [x] T3 Landing: "click to walk" prompt when the lobby is full screen, scroll lock while walking, hint, docs. Route: inline.

- [x] T4 Wall panel: notes editor + featured palaces on the east wall (drei Html, shared elements), E to use / E to walk / Esc to scroll. Route: inline.
- [x] T5 Fix empty wall panel: drei Html recreated its root (target change when `events.connected` arrives + StrictMode double mount) and the deferred unmount left the new root empty; `MountWhenConnected` mounts it one frame after events connect. Route: inline (1 file).
- [x] T6 Landing lobby shows only project content: remove the example-topic (Membrana celular) pedestals, exhibits, paintings and signs from the lobby; keep Founders, wall panel, carpet. Museum scene unchanged. Route: delegated (2+ files).
- [x] T8 Large framed Platanus Hack [26] poster (`public/lobby/platanus-hack-26.jpg`, 2442x1274) on the west wall (right of Founders when facing them), lobby only. Route: delegated (same writer).
- [x] T9 Centre the "Ahora, el tuyo" wall panel on the east wall and frame it (dark frame like Founders/poster; Html sits just in front of the frame so blending occlusion does not hide it). Route: inline (1 file).
- [x] T7 Central sculpture = project logo (`public/brand.svg`) standing upright, rotating slowly on its pedestal/monument spot; keeps its collider. Route: delegated (same writer as T6).
- [x] T10 Founders portraits link to each member's LinkedIn: aim at a portrait while walking → "Clic para ver el perfil de X" hint, click opens the profile in a new tab; portraits also clickable with the normal pointer when not walking; same links on the #equipo page. Route: delegated (several files).

## Acceptance
- Prompt appears only when the lobby is fully open; click locks the pointer and walking works.
- Walls, door gap and the central logo pedestal block movement (concept pedestals are not drawn in the lobby, so they do not block).
- Esc returns to scrolling; the camera glides back to the scroll path; page scroll is frozen while walking.
- Typecheck, tests and build pass.

## Progress
- T1: RED observed (`walk` module missing), GREEN 3/3 in `scene/walk.test.ts`; Player refactored to `stepWalk`.
- T2–T3: typecheck clean, full suite 315/315, build OK.
- T4: typecheck clean, 315/315, build OK; verified drei blending writes alpha 0 holes (opaque shader → NoBlending).
- T5: browser-verified (Playwright, simulated pointer lock): panel in DOM, E to use, wall textarea mirrors landing, E/Esc exits. Typecheck clean, 315/315. No commit: working tree holds in-progress user work.
- T6–T7: `Room shellOnly` (lobby only) hides inscription, paintings, monument and pedestals; `LogoSculpture` extrudes `/brand.svg` as the horizontal wordmark (1.8 m wide, ~0.42 m tall, base 0.12 m above the 1.06 m pedestal slab, 0.35 rad/s). `lobbyColliders` drops concept pedestals and adds `LOGO_PEDESTAL` (1.9 x 1.9, h 2) at the centre. A vertically stacked variant (m/u/s/3/o column, 2.5 m) was tried and reverted by the user. RED observed (new collider test failed), GREEN 3/3; typecheck clean, 315/315. Browser check pending (parent).
- T8: `scene/LobbyPoster.tsx` sizes from the texture aspect (no stretch) to fit the free west-wall span (0.6 m corner margins, skips a west door gap if any) and the band 0.9 m .. height - 0.63 m. Example lobby (12.4 x 12.4 m, h 5.7, door only on e): image 7.53 x 3.93 m, frame 0.12 m (outer 7.77 x 4.17 m, depth 0.08), centre x = room.x - 5.94, y 2.985, z = room.z; height-limited, so centred in the band (2.3 m slot height does not fit). Typecheck clean, 315/315. Browser check pending (parent).
- T9: panel centred at z = room.z, Html 0.09 m off the wall in front of a 0.08 m deep frame (border 0.12 m, outer 5.44 x 4.04 m). Browser-verified: framed and centred, near prompt, E to use, wall textarea clickable. Typecheck clean, 315/315.
- T10: `profile` (LinkedIn) in `ui/team.ts`; portraits tagged `userData.founder`; `founderAim.ts` picks the nearest visible hit (≤ 7 m, anything in front blocks). Walking: `LobbyWalker` raycasts from the screen centre every frame (`far` 7 m) against the whole scene, Landing shows "Clic para ver el perfil de X" (`.walk-use`), a window click opens the profile and unlocks (onUnlock → 'off'). Scroll mode: R3F onClick/hover on portraits (gated `mode === 'off'`), re-raycast against the scene so walls/logo block; cursor pointer on canvas. #equipo cards get a `.team-link` (new tab, `noopener noreferrer`, aria-label). RED observed (module missing), GREEN 8/8 in `scene/founderAim.test.ts`; typecheck clean, 773/773. Browser check pending (parent).
- Engram mirror `odd/lobby-walk/tasks`: pending (Engram MCP unavailable this session).
- Pending: manual browser check (wall panel visibility/occlusion, typing and clicks on the wall, pointer lock, collisions, Esc return, scroll freeze). Not committed yet.
- Engram mirror: pending (Engram MCP unavailable this session).
