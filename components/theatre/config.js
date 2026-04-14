import { getProject } from '@theatre/core'
import studio from '@theatre/studio'
import extension from '@theatre/r3f/dist/extension'
import initialState from './animfinal.state.json'

const ENABLE_THEATRE_STUDIO = false

if (ENABLE_THEATRE_STUDIO && typeof window !== 'undefined') {
  studio.initialize()
  studio.extend(extension)
}

// Producción: sin Theatre Studio. Se requiere un state inicial no vacío.
const FALLBACK_STATE = {
  sheetsById: {},
  definitionVersion: '0.4.0',
  revisionHistory: [],
}

export const theatreProject = getProject('Next 3D Project', {
  state: initialState || FALLBACK_STATE,
})
export const theatreSheet = theatreProject.sheet('Main Scene')

let statePromise = null

export function ensureTheatreStateLoaded(url = '/animfinal.json') {
  if (statePromise) return statePromise
  if (typeof window === 'undefined') return Promise.resolve(null)

  statePromise = fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error(`Failed to load Theatre state: ${res.status}`)
      return res.json()
    })
    .then((state) => {
      if (typeof theatreProject.importState === 'function') {
        theatreProject.importState(state)
      } else if (typeof theatreProject.loadState === 'function') {
        theatreProject.loadState(state)
      } else {
        console.warn('[Theatre] importState/loadState not available')
      }
      return state
    })
    .catch((err) => {
      console.warn('[Theatre] Could not load state', err)
      return null
    })

  return statePromise
}
