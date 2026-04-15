import { useViewStore } from '../lib/camera/viewStore'

export default function CinematicHUD() {
  const cinematicMode = useViewStore((s) => s.cinematicMode)

  if (!cinematicMode) return null

  return (
    <div className="cinematic-hud">
      <span className="cinematic-hud-dot" />
      <span>CINEMATIC</span>
      <span className="cinematic-hud-sub">F9 exit · WASD fly · Mouse orbit · Shift sprint · Q/E up/down</span>
    </div>
  )
}
