// GLB Inspector — parses JSON chunk directly (no Draco needed for metadata)
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const inputPath = process.argv[2]
const glbPath = inputPath
  ? resolve(__dirname, '..', inputPath)
  : resolve(__dirname, '../public/alon_house/house_scene-v1.glb')

const buf = readFileSync(glbPath)

// GLB structure: 12-byte header, then chunks
// Header: magic(4) + version(4) + length(4)
const magic = buf.toString('ascii', 0, 4)
if (magic !== 'glTF') { console.error('Not a GLB file'); process.exit(1) }

// First chunk is always JSON
const chunkLen = buf.readUInt32LE(12)
const chunkType = buf.readUInt32LE(16)
const jsonStr = buf.toString('utf8', 20, 20 + chunkLen)
const gltf = JSON.parse(jsonStr)

const nodes = gltf.nodes || []
const meshes = gltf.meshes || []
const accessors = gltf.accessors || []

console.log(`\n=== GLB Inspector ===`)
console.log(`File: ${glbPath}`)
console.log(`Nodes: ${nodes.length}, Meshes: ${meshes.length}\n`)

// Helper: resolve TRS from node (handles both direct and sparse accessors)
function getTRS(node) {
  const t = node.translation || [0, 0, 0]
  const r = node.rotation || [0, 0, 0, 1]
  const s = node.scale || [1, 1, 1]
  return { t, r, s }
}

function fmt(arr, decimals = 4) {
  return `[${arr.map(v => Number(v).toFixed(decimals)).join(', ')}]`
}

function getAccessorMinMax(accessorIndex) {
  const acc = accessors?.[accessorIndex]
  if (!acc) return null
  if (!Array.isArray(acc.min) || !Array.isArray(acc.max)) return null
  return { min: acc.min, max: acc.max, type: acc.type }
}

function getMeshPositionMinMax(meshIndex) {
  const mesh = meshes?.[meshIndex]
  if (!mesh) return null
  const prim = mesh.primitives?.[0]
  const posAccessorIndex = prim?.attributes?.POSITION
  if (typeof posAccessorIndex !== 'number') return null
  return getAccessorMinMax(posAccessorIndex)
}

function getNodeByName(name) {
  return nodes.find((n) => n?.name === name) || null
}

function computeWorldYExtentsFromMinMax(nodeName) {
  const node = getNodeByName(nodeName)
  if (!node || typeof node.mesh !== 'number') return null

  const { t, s } = getTRS(node)
  const mm = getMeshPositionMinMax(node.mesh)
  if (!mm) return null

  const localMinY = mm.min?.[1]
  const localMaxY = mm.max?.[1]
  if (typeof localMinY !== 'number' || typeof localMaxY !== 'number') return null

  const scaleY = (s?.[1] ?? 1)
  const ty = (t?.[1] ?? 0)

  const worldMinY = ty + localMinY * scaleY
  const worldMaxY = ty + localMaxY * scaleY
  const worldHeight = Math.abs(worldMaxY - worldMinY)
  return {
    nodeName,
    localMinY,
    localMaxY,
    worldMinY,
    worldMaxY,
    worldHeight,
    scaleY,
    ty,
  }
}

// Floor_Modular nodes
console.log('=== FLOOR MODULAR NODES ===')
for (const node of nodes) {
  if (node.name && node.name.startsWith('Floor_Modular')) {
    const { t, r, s } = getTRS(node)
    const meshIdx = node.mesh !== undefined ? node.mesh : '(none)'
    const meshName = node.mesh !== undefined ? (meshes[node.mesh]?.name || `mesh_${node.mesh}`) : '(none)'
    console.log(`${node.name} | mesh: ${meshName} | pos: ${fmt(t)} | rot: ${fmt(r)} | scale: ${fmt(s)}`)
  }
}

// Tree/bush nodes
console.log('\n=== TREE/BUSH/PLANT NODES ===')
for (const node of nodes) {
  const low = (node.name || '').toLowerCase()
  if (low.includes('tree') || low.includes('arbol') || low.includes('bush') || low.includes('arbusto') || low.includes('plant') || low.includes('shrub') || low.includes('hedge')) {
    const { t, r, s } = getTRS(node)
    const meshName = node.mesh !== undefined ? (meshes[node.mesh]?.name || `mesh_${node.mesh}`) : '(none)'
    console.log(`${node.name} | mesh: ${meshName} | pos: ${fmt(t)} | rot: ${fmt(r)} | scale: ${fmt(s)}`)
  }
}

// Plane/guide nodes for 3D text
console.log('\n=== PLANE/GUIDE NODES (for 3D text) ===')
for (const node of nodes) {
  const low = (node.name || '').toLowerCase()
  if (low.includes('plane') || low.includes('text') || low.includes('label') || low.includes('sign') || low.includes('guide') || low.includes('marker')) {
    const { t, r, s } = getTRS(node)
    console.log(`${node.name} | pos: ${fmt(t)} | rot: ${fmt(r)} | scale: ${fmt(s)}`)
  }
}

// Skin/decoration nodes
console.log('\n=== SKIN/DECORATION NODES ===')
for (const node of nodes) {
  const low = (node.name || '').toLowerCase()
  if (low.includes('skin') || low.includes('alon') || low.includes('character') || low.includes('deco') || low.includes('avatar') || low.includes('chibi') || low.includes('trump') || low.includes('elon')) {
    const { t, r, s } = getTRS(node)
    console.log(`${node.name} | pos: ${fmt(t)} | rot: ${fmt(r)} | scale: ${fmt(s)}`)
  }
}

// Mesh usage count (instancing candidates)
console.log('\n=== MESH USAGE COUNT (instancing candidates) ===')
const meshUsage = new Map()
for (const node of nodes) {
  if (node.mesh !== undefined) {
    const meshName = meshes[node.mesh]?.name || `mesh_${node.mesh}`
    const info = meshUsage.get(node.mesh) || { meshName, count: 0, nodes: [] }
    info.count++
    info.nodes.push(node.name || `node_${nodes.indexOf(node)}`)
    meshUsage.set(node.mesh, info)
  }
}
for (const [, info] of meshUsage) {
  if (info.count > 1) {
    console.log(`${info.meshName}: ${info.count} uses → ${info.nodes.join(', ')}`)
  }
}

// All node names
console.log('\n=== ALL NODE NAMES ===')
for (let i = 0; i < nodes.length; i++) {
  const n = nodes[i]
  const hasMesh = n.mesh !== undefined
  const hasSkin = n.skin !== undefined
  const children = n.children ? `children:[${n.children.join(',')}]` : ''
  console.log(`  [${i}] ${n.name || '(unnamed)'} ${hasMesh ? 'MESH' : ''} ${hasSkin ? 'SKIN' : ''} ${children}`)
}

// Quick measurements for key nodes
console.log('\n=== QUICK MEASUREMENTS (approx from accessor min/max) ===')
for (const name of ['char1', 'floor_main', 'Cube']) {
  const ext = computeWorldYExtentsFromMinMax(name)
  if (!ext) {
    console.log(`  ${name}: (no min/max found in accessors)`)
    continue
  }
  console.log(
    `  ${name}: worldMinY=${ext.worldMinY.toFixed(4)} worldMaxY=${ext.worldMaxY.toFixed(4)} height=${ext.worldHeight.toFixed(4)} scaleY=${ext.scaleY.toFixed(4)} ty=${ext.ty.toFixed(4)}`
  )
}

// Per-node AABB (world space from translation+scale) — useful for collisions, planes, waypoints
console.log('\n=== PER-NODE AABB (world = accessor min/max * scale + translation) ===')
for (const node of nodes) {
  if (node.mesh === undefined) continue
  const mesh = meshes[node.mesh]
  if (!mesh || !mesh.primitives) continue
  const t = node.translation || [0, 0, 0]
  const s = node.scale || [1, 1, 1]
  let mn = { x: Infinity, y: Infinity, z: Infinity }
  let mx = { x: -Infinity, y: -Infinity, z: -Infinity }
  for (const prim of mesh.primitives) {
    const acc = accessors[prim.attributes?.POSITION]
    if (!acc || !acc.min || !acc.max) continue
    for (let i = 0; i < 3; i++) {
      const lo = acc.min[i] * s[i] + t[i]
      const hi = acc.max[i] * s[i] + t[i]
      const a = Math.min(lo, hi), b = Math.max(lo, hi)
      const k = ['x', 'y', 'z'][i]
      mn[k] = Math.min(mn[k], a)
      mx[k] = Math.max(mx[k], b)
    }
  }
  if (mn.x === Infinity) continue
  const cx = (mn.x + mx.x) / 2, cy = (mn.y + mx.y) / 2, cz = (mn.z + mx.z) / 2
  const sx = mx.x - mn.x, sy = mx.y - mn.y, sz = mx.z - mn.z
  console.log(`  ${node.name || '(unnamed)'} | center:(${cx.toFixed(2)}, ${cy.toFixed(2)}, ${cz.toFixed(2)}) size:(${sx.toFixed(2)} x ${sy.toFixed(2)} x ${sz.toFixed(2)}) min:(${mn.x.toFixed(2)}, ${mn.y.toFixed(2)}, ${mn.z.toFixed(2)}) max:(${mx.x.toFixed(2)}, ${mx.y.toFixed(2)}, ${mx.z.toFixed(2)})`)
}

// Calculate bounding box for all meshes combined (useful for collision boundaries)
console.log('\n=== BOUNDING BOX (all meshes) ===')
let globalMin = { x: Infinity, y: Infinity, z: Infinity }
let globalMax = { x: -Infinity, y: -Infinity, z: -Infinity }

for (const node of gltf.nodes || []) {
  if (node.mesh === undefined) continue
  const mesh = gltf.meshes[node.mesh]
  if (!mesh || !mesh.primitives) continue
  
  for (const prim of mesh.primitives) {
    const posAccIdx = prim.attributes?.POSITION
    if (posAccIdx === undefined) continue
    const acc = gltf.accessors[posAccIdx]
    if (!acc || !acc.min || !acc.max) continue
    
    // Get node transform
    const t = node.translation || [0, 0, 0]
    const s = node.scale || [1, 1, 1]
    
    // Transform min/max by node position and scale
    const minX = acc.min[0] * s[0] + t[0]
    const minY = acc.min[1] * s[1] + t[1]
    const minZ = acc.min[2] * s[2] + t[2]
    const maxX = acc.max[0] * s[0] + t[0]
    const maxY = acc.max[1] * s[1] + t[1]
    const maxZ = acc.max[2] * s[2] + t[2]
    
    globalMin.x = Math.min(globalMin.x, minX)
    globalMin.y = Math.min(globalMin.y, minY)
    globalMin.z = Math.min(globalMin.z, minZ)
    globalMax.x = Math.max(globalMax.x, maxX)
    globalMax.y = Math.max(globalMax.y, maxY)
    globalMax.z = Math.max(globalMax.z, maxZ)
  }
}

if (globalMin.x !== Infinity) {
  const width = globalMax.x - globalMin.x
  const height = globalMax.y - globalMin.y
  const depth = globalMax.z - globalMin.z
  const centerX = (globalMin.x + globalMax.x) / 2
  const centerY = (globalMin.y + globalMax.y) / 2
  const centerZ = (globalMin.z + globalMax.z) / 2
  
  console.log(`  Min: (${globalMin.x.toFixed(2)}, ${globalMin.y.toFixed(2)}, ${globalMin.z.toFixed(2)})`)
  console.log(`  Max: (${globalMax.x.toFixed(2)}, ${globalMax.y.toFixed(2)}, ${globalMax.z.toFixed(2)})`)
  console.log(`  Size: ${width.toFixed(2)} x ${height.toFixed(2)} x ${depth.toFixed(2)}`)
  console.log(`  Center: (${centerX.toFixed(2)}, ${centerY.toFixed(2)}, ${centerZ.toFixed(2)})`)
} else {
  console.log('  No mesh data found')
}

// Animations
if (gltf.animations && gltf.animations.length > 0) {
  console.log('\n=== ANIMATIONS ===')
  for (const anim of gltf.animations) {
    console.log(`  ${anim.name || '(unnamed)'} (${anim.channels?.length || 0} channels, ${anim.samplers?.length || 0} samplers)`)
  }
}

// Skins
if (gltf.skins && gltf.skins.length > 0) {
  console.log('\n=== SKINS ===')
  for (const skin of gltf.skins) {
    console.log(`  ${skin.name || '(unnamed)'} joints: ${skin.joints?.length || 0}`)
  }
}
