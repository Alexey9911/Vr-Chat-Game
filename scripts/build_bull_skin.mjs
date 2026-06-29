#!/usr/bin/env node
// Build the final Ansem "BULL" skin GLB:
//   base = rigged character (4_rigged.glb)
//   + transplant animation clips from the per-clip Meshy GLBs (walk/run/idle/jump/dances)
//   + rename clips to clean names
//   + strip root (Hips) motion so locomotion/dances loop IN PLACE and jump is owned by physics
//   + (optional) bake the rifle prop onto the Spine02 bone (rides the back, follows animation)
// Output: public/new_skins/ansembull-v1.glb  (raw; compress to KTX2 afterwards)
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { mergeDocuments } from '@gltf-transform/functions'
import draco3d from 'draco3dgltf'
import * as THREE from 'three'
import { resolve } from 'node:path'

const ROOT = process.cwd()
const DIR = resolve(ROOT, 'meshy_output/ansem_bull')
const WEAPON_GLB = resolve(ROOT, 'meshy_output/weapon/rifle.glb')
const OUT = resolve(ROOT, 'public/new_skins/ansembull-v1.glb')
const INCLUDE_WEAPON = process.env.WEAPON === '1'

const ROOT_BONE = 'Hips'
// clip sources: file, newName, root-motion strip mode ('xz' keep Y bob | 'all' constant | 'none')
const CLIPS = [
  { file: '4_rigged.glb',            name: null,                strip: 'none', skip: true }, // base only
  { file: 'anim_idle.glb',           name: 'Idle',              strip: 'xz' },
  { file: '5_walking.glb',           name: 'Walking',           strip: 'xz' },
  { file: '6_running.glb',           name: 'Running',           strip: 'xz' },
  { file: 'anim_jump.glb',           name: 'Jump',              strip: 'all' },
  { file: 'anim_dance_hiphop.glb',   name: 'Dance_HipHop',      strip: 'xz' },
  { file: 'anim_dance_gangnam.glb',  name: 'Dance_Gangnam',     strip: 'xz' },
  { file: 'anim_dance_breakdance.glb', name: 'Dance_Breakdance', strip: 'xz' },
]

// Weapon mount, specified in WORLD space (intuitive) and converted to the bone's
// local frame at bake time (the bones have a 0.01 world scale, so local values
// are unintuitive). 'Spine' is the UPPER back in this rig. TUNE via env MOUNT.
const MOUNT = process.env.MOUNT ? JSON.parse(process.env.MOUNT) : {
  bone: 'Spine',
  worldPos: [0, 1.31, -0.16],              // centered, upper back, just behind the vest
  worldEulerDeg: [6, 0, 20],               // slight back-tilt + diagonal slung look
  worldScale: 0.42,                        // rifle (~1.9 long) -> ~0.8 across the back
}

// World matrix of a gltf-transform node (walk parents, compose TRS).
function nodeLocalMatrix(n) {
  const t = n.getTranslation(), r = n.getRotation(), s = n.getScale()
  return new THREE.Matrix4().compose(
    new THREE.Vector3(t[0], t[1], t[2]),
    new THREE.Quaternion(r[0], r[1], r[2], r[3]),
    new THREE.Vector3(s[0], s[1], s[2]),
  )
}
function worldMatrix(node, parentMap) {
  const chain = []
  let cur = node
  while (cur) { chain.push(cur); cur = parentMap.get(cur) }
  const M = new THREE.Matrix4()
  for (let i = chain.length - 1; i >= 0; i--) M.multiply(nodeLocalMatrix(chain[i]))
  return M
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(),
  'draco3d.encoder': await draco3d.createEncoderModule(),
})

const base = await io.read(resolve(DIR, '4_rigged.glb'))
const buffer = base.getRoot().listBuffers()[0]
const nodesByName = new Map(base.getRoot().listNodes().map((n) => [n.getName(), n]))
console.log('base bones:', nodesByName.size, '| root present:', nodesByName.has(ROOT_BONE))

// remove pre-existing animations from base
for (const a of base.getRoot().listAnimations()) a.dispose()

function cloneAccessor(src) {
  return base.createAccessor()
    .setType(src.getType())
    .setArray(src.getArray().slice())
    .setBuffer(buffer)
    .setNormalized(src.getNormalized())
}

function stripRoot(outArr, mode) {
  const x0 = outArr[0], y0 = outArr[1], z0 = outArr[2]
  for (let i = 0; i < outArr.length; i += 3) {
    if (mode === 'all') { outArr[i] = x0; outArr[i+1] = y0; outArr[i+2] = z0 }
    else if (mode === 'xz') { outArr[i] = x0; outArr[i+2] = z0 } // keep Y bob
  }
}

for (const c of CLIPS) {
  if (c.skip) continue
  const src = await io.read(resolve(DIR, c.file))
  const srcAnim = src.getRoot().listAnimations()[0]
  if (!srcAnim) { console.warn('no anim in', c.file); continue }
  const anim = base.createAnimation(c.name)
  let chN = 0
  for (const ch of srcAnim.listChannels()) {
    const srcNode = ch.getTargetNode()
    if (!srcNode) continue
    const dst = nodesByName.get(srcNode.getName())
    if (!dst) continue
    const ss = ch.getSampler()
    const input = cloneAccessor(ss.getInput())
    const output = cloneAccessor(ss.getOutput())
    const path = ch.getTargetPath()
    if (c.strip !== 'none' && srcNode.getName() === ROOT_BONE && path === 'translation') {
      stripRoot(output.getArray(), c.strip)
    }
    const sampler = base.createAnimationSampler()
      .setInterpolation(ss.getInterpolation())
      .setInput(input).setOutput(output)
    const channel = base.createAnimationChannel()
      .setTargetNode(dst).setTargetPath(path).setSampler(sampler)
    anim.addSampler(sampler).addChannel(channel)
    chN++
  }
  console.log(`+ clip '${c.name}' (${chN} channels, strip=${c.strip})`)
}

// ---- optional: bake rifle on the back ----
if (INCLUDE_WEAPON) {
  // parent map over base nodes (for world matrix of the mount bone)
  const parentMap = new Map()
  for (const n of base.getRoot().listNodes()) for (const c of n.listChildren()) parentMap.set(c, n)
  const bone = nodesByName.get(MOUNT.bone)
  const Mbone = worldMatrix(bone, parentMap)

  // desired WORLD transform of the rifle, then convert to bone-local: local = Mbone^-1 * world
  const e = MOUNT.worldEulerDeg.map((d) => (d * Math.PI) / 180)
  const worldT = new THREE.Matrix4().compose(
    new THREE.Vector3(...MOUNT.worldPos),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(e[0], e[1], e[2], 'XYZ')),
    new THREE.Vector3(MOUNT.worldScale, MOUNT.worldScale, MOUNT.worldScale),
  )
  const localT = Mbone.clone().invert().multiply(worldT)
  const lp = new THREE.Vector3(), lq = new THREE.Quaternion(), ls = new THREE.Vector3()
  localT.decompose(lp, lq, ls)

  const wDoc = await io.read(WEAPON_GLB)
  const wScene = wDoc.getRoot().getDefaultScene() || wDoc.getRoot().listScenes()[0]
  const map = mergeDocuments(base, wDoc)
  const wSceneCopy = map.get(wScene)
  const holder = base.createNode('WeaponMount')
    .setTranslation([lp.x, lp.y, lp.z])
    .setRotation([lq.x, lq.y, lq.z, lq.w])
    .setScale([ls.x, ls.y, ls.z])
  for (const child of wSceneCopy.listChildren()) { wSceneCopy.removeChild(child); holder.addChild(child) }
  wSceneCopy.dispose()
  bone.addChild(holder)

  // verify: where does the holder origin end up in world?
  const check = Mbone.clone().multiply(new THREE.Matrix4().compose(lp, lq, ls))
  const cp = new THREE.Vector3().setFromMatrixPosition(check)
  console.log(`+ weapon on ${MOUNT.bone}: local scale~${ls.x.toFixed(1)} | world origin=(${cp.x.toFixed(2)},${cp.y.toFixed(2)},${cp.z.toFixed(2)})`)
}

// Consolidate to a single buffer (GLB requires 0–1 buffers; merge added a 2nd).
const mainBuf = base.getRoot().listBuffers()[0]
for (const acc of base.getRoot().listAccessors()) acc.setBuffer(mainBuf)
for (const b of base.getRoot().listBuffers()) if (b !== mainBuf) b.dispose()

await io.write(OUT, base)
console.log('WROTE', OUT)

// quick measure: vertical extents of skinned mesh accessors (bind pose, approx)
import { readFileSync } from 'node:fs'
const buf = readFileSync(OUT)
const jlen = buf.readUInt32LE(12)
const g = JSON.parse(buf.toString('utf8', 20, 20 + jlen))
let minY = Infinity, maxY = -Infinity
for (const m of g.meshes || []) for (const p of m.primitives || []) {
  const acc = g.accessors?.[p.attributes?.POSITION]
  if (acc?.min && acc?.max) { minY = Math.min(minY, acc.min[1]); maxY = Math.max(maxY, acc.max[1]) }
}
console.log(`clips: ${(g.animations||[]).map(a=>a.name).join(', ')}`)
console.log(`bindpose Y extent: min=${minY.toFixed(3)} max=${maxY.toFixed(3)} height=${(maxY-minY).toFixed(3)}`)
console.log(`size: ${(buf.length/1e6).toFixed(1)} MB`)
