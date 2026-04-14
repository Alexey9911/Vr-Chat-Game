import { create } from 'zustand'

interface KeyboardState {
  pressedKeys: Set<string>
  setPressedKeys: (keys: Set<string>) => void
  addPressedKey: (key: string) => void
  removePressedKey: (key: string) => void
  isKeyPressed: (key: string) => boolean
  chatActive: boolean
  setChatActive: (v: boolean) => void
  // Jump state
  jumpRequested: boolean
  setJumpRequested: (v: boolean) => void
  currentAnimation: string | null
  setCurrentAnimation: (anim: string | null) => void
  // Voice chat (push-to-talk)
  localMicActive: boolean
  setLocalMicActive: (v: boolean) => void
}

export const useKeyboardStore = create<KeyboardState>((set, get) => ({
  pressedKeys: new Set(),
  setPressedKeys: (keys) => set({ pressedKeys: keys }),
  addPressedKey: (key) => {
    const newKeys = new Set(get().pressedKeys)
    newKeys.add(key.toLowerCase())
    set({ pressedKeys: newKeys })
  },
  removePressedKey: (key) => {
    const newKeys = new Set(get().pressedKeys)
    newKeys.delete(key.toLowerCase())
    set({ pressedKeys: newKeys })
  },
  isKeyPressed: (key) => get().pressedKeys.has(key.toLowerCase()),
  chatActive: false,
  setChatActive: (v) => set({ chatActive: v }),
  jumpRequested: false,
  setJumpRequested: (v) => set({ jumpRequested: v }),
  currentAnimation: null,
  setCurrentAnimation: (anim) => set({ currentAnimation: anim }),
  localMicActive: false,
  setLocalMicActive: (v) => set({ localMicActive: v }),
}))
