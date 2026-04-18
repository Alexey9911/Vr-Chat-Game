// Single vertical lift applied to BOTH rooms.glb (visual) and
// rooms_physics.glb (colliders). Same number for both → no drift.
// Purpose: push the whole interior well above the exterior camera's
// far plane (350) so the rooms get frustum-culled for free when the
// player is outside.
export const ROOM_Y_OFFSET = 183

// Native Blender Y of the reference plane in position_Y_rooms.glb.
// That plane sits at the character's EYE height when standing on the
// room floor (authored by the level designer). We add HouseScene.OY
// (1.1857) and ROOM_Y_OFFSET at runtime to derive the final world Y
// for the ground clamp and checkpoint spawn — keeps every downstream
// number in sync with whatever Blender says without re-guessing.
export const ROOM_FLOOR_BLENDER_Y = 322.70
