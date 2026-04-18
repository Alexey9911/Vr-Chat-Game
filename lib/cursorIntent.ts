// Shared intent flag between the HUD cursor button / T key (intentional
// unlocks) and the LobbyScreen (which opens the lobby on ESC unlock).
//
// When the user presses T or clicks the HUD cursor button, we set
// `intentionalUnlock = true` just before calling `document.exitPointerLock()`.
// The `pointerlockchange` listener in LobbyScreen checks this flag:
//   - true  → user chose to free the cursor; don't open the lobby.
//   - false → the unlock came from the browser's native ESC handler (which
//             does NOT dispatch a JS keydown for Escape while locked) → open
//             the lobby.
// The flag resets automatically after it is consumed.
export const cursorIntent = {
  intentionalUnlock: false,
}
