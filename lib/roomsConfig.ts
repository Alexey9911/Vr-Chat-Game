// Shared constants for the interior-rooms setup.
//
// ROOM_Y_OFFSET
// -------------
// Extra vertical shift applied to the rooms GLB (and to every checkpoint /
// spawn coord that lives inside the rooms). Purpose: push the interior far
// enough above the exterior that the exterior camera's far plane (350)
// can never reach it, so the moment the player is outside the rooms get
// frustum-culled completely and we stop paying their GPU cost.
//
// Math: exterior camera sits around Y ≈ 5 world units. With far=350, the
// visible sphere tops out at Y ≈ 355. Placing rooms at Y ≈ 470 puts them
// ~115 units past the far plane — safe margin against FOV/angle edge cases.
//
// Raising this value is free (same transition, same fade, same code path),
// but the entry/exit checkpoints automatically follow thanks to this
// shared constant, so we only change ONE number.
export const ROOM_Y_OFFSET = 173

// Extra lift applied ONLY to rooms_physics.glb (not to the visual mesh).
// Use this when the physics GLB was exported in Blender with its floor
// sitting lower than the visual GLB's floor (e.g. physics floor at Y=0
// while the visual floor is at Y=40). Raising this matches the physics
// floor to the visual floor without touching the visual position.
// Floor clamp and entry checkpoint spawn both add this automatically.
export const PHYSICS_EXTRA_Y = 10
