// Focused GLB inspector: animation clip names, skin joints, root + key bones.
import { readFileSync } from 'fs'
import { resolve } from 'path'
const p = resolve(process.cwd(), process.argv[2])
const buf = readFileSync(p)
if (buf.toString('ascii',0,4) !== 'glTF') { console.error('not glb'); process.exit(1) }
const len = buf.readUInt32LE(12)
const gltf = JSON.parse(buf.toString('utf8', 20, 20+len))
const nodes = gltf.nodes || []
console.log(`\n### ${process.argv[2]}`)
console.log('animations:', (gltf.animations||[]).map(a=>a.name||'(unnamed)'))
const skins = gltf.skins||[]
console.log('skins:', skins.length, 'joints:', skins[0]?.joints?.length||0)
// joint node names
const jointIdx = new Set((skins[0]?.joints)||[])
const childOf = new Map()
nodes.forEach((n,i)=>(n.children||[]).forEach(c=>childOf.set(c,i)))
// root joint = joint whose parent is not a joint
const roots = [...jointIdx].filter(i=>!jointIdx.has(childOf.get(i)))
console.log('root joint(s):', roots.map(i=>nodes[i]?.name))
const jointNames = [...jointIdx].map(i=>nodes[i]?.name).filter(Boolean)
console.log('all joints:', jointNames.join(', '))
console.log('back/spine/hand bones:', jointNames.filter(n=>/spine|chest|hand|neck|hips|shoulder|arm|clav/i.test(n)).join(', '))
