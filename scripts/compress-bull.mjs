#!/usr/bin/env node
// Compress the Ansem BULL skin: decode -> resize textures to 2K -> KTX2 UASTC -> meshopt.
// Mirrors scripts/compress-glb.mjs (the proven skin pipeline) but adds a 2048 resize
// because the Meshy HD texture is 4K. Output: public/new_skins/ansembull-v1_ktx2.glb
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS, KHRDracoMeshCompression } from '@gltf-transform/extensions'
import { textureCompress } from '@gltf-transform/functions'
import draco3d from 'draco3dgltf'
import sharp from 'sharp'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { statSync, existsSync, unlinkSync } from 'node:fs'

const ROOT = process.cwd()
const GLTF_CLI = resolve(ROOT, 'node_modules/@gltf-transform/cli/bin/cli.js')
const SRC = resolve(ROOT, 'public/new_skins/ansembull-v1.glb')
const OUT = resolve(ROOT, 'public/new_skins/ansembull-v1_ktx2.glb')
const tmp1 = SRC.replace(/\.glb$/i, '.__s1.glb')
const tmp2 = SRC.replace(/\.glb$/i, '.__s2.glb')

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(),
  'draco3d.encoder': await draco3d.createEncoderModule(),
})

function run(sub, args) { execFileSync(process.execPath, [GLTF_CLI, sub, ...args], { stdio: 'inherit' }) }

try {
  console.log(`src ${(statSync(SRC).size/1e6).toFixed(1)} MB`)
  console.log('[1/3] decode + resize textures -> 2048 PNG')
  const doc = await io.read(SRC)
  doc.createExtension(KHRDracoMeshCompression).setRequired(false)
  await doc.transform(textureCompress({ encoder: sharp, targetFormat: 'png', resize: [2048, 2048] }))
  await io.write(tmp1, doc)

  console.log('[2/3] KTX2 UASTC')
  run('uastc', [tmp1, tmp2])

  console.log('[3/3] meshopt (level=medium)')
  run('meshopt', [tmp2, OUT, '--level', 'medium'])

  console.log(`-> ${OUT.split(/[\\/]/).pop()} ${(statSync(OUT).size/1e6).toFixed(2)} MB (${(statSync(OUT).size/statSync(SRC).size*100).toFixed(0)}% of raw)`)
} finally {
  for (const t of [tmp1, tmp2]) { try { if (existsSync(t)) unlinkSync(t) } catch {} }
}
