#!/usr/bin/env node
// GLB compression pipeline: decode draco+webp -> PNG, then UASTC KTX2, then meshopt geometry.
// Produces <name>_ktx2.glb next to each source.
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS, KHRDracoMeshCompression } from '@gltf-transform/extensions'
import { textureCompress } from '@gltf-transform/functions'
import draco3d from 'draco3dgltf'
import sharp from 'sharp'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, basename } from 'node:path'
import { existsSync, statSync, unlinkSync } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const GLTF_CLI = resolve(ROOT, 'node_modules/@gltf-transform/cli/bin/cli.js')

// { src, skipMeshopt, mode } — `mode` = 'uastc' (default, high quality) or 'etc1s' (~3x smaller, leve distorsión).
// Use ETC1S for escenas grandes donde el tamaño importa más que la calidad de textura.
// Use UASTC para skins/personajes (se ven de cerca).
//
// skipMeshopt=true for scenes whose consumers extract raw .geometry at runtime.
// Meshopt's KHR_mesh_quantization bakes a decode scale into the NODE MATRIX — extracting
// only .geometry loses that scale unless consumers bake the node matrix into geometry first
// (see HouseAirdrops.jsx / OrangiePathNPC.jsx for the fix).
const TARGETS = [
  // NOTE: house_scene-v1.glb se quedó como Draco (no KTX2) porque la conversión
  // causaba bugs (Mesh_0.003 + Orangie traspasaban el suelo por meshopt quantization),
  // inflaba el peso del archivo, y con el fix del singleton de KTX2Loader el loading
  // screen ya va fluido. Ver commit 76bde55 para la versión Draco original restaurada.
  // Skins SÍ usan KTX2 UASTC (se ven de cerca, calidad importa).
  { src: 'public/alonskin-v1.glb', mode: 'uastc' },
  { src: 'public/elonmuskchibi-v1.glb', mode: 'uastc' },
  { src: 'public/trumpskin-v1.glb', mode: 'uastc' },
  { src: 'public/alon_house/skins/chillhouse-v1.glb', mode: 'uastc' },
  { src: 'public/alon_house/skins/tobaku-v1.glb', mode: 'uastc' },
  { src: 'public/alon_house/skins/unc-v1.glb', mode: 'uastc' },
  { src: 'public/alon_house/skins/pinguin-v1.glb', mode: 'uastc' },
]

async function decodeToPng(inputAbs, outputAbs) {
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({
      'draco3d.decoder': await draco3d.createDecoderModule(),
      'draco3d.encoder': await draco3d.createEncoderModule(),
    })
  const doc = await io.read(inputAbs)
  doc.createExtension(KHRDracoMeshCompression).setRequired(false)
  await doc.transform(textureCompress({ encoder: sharp, targetFormat: 'png' }))
  await io.write(outputAbs, doc)
}

function run(subcommand, args) {
  execFileSync(process.execPath, [GLTF_CLI, subcommand, ...args], { stdio: 'inherit' })
}

async function processOne({ src, skipMeshopt, mode = 'uastc' }) {
  const absIn = resolve(ROOT, src)
  if (!existsSync(absIn)) {
    console.warn(`[skip] missing: ${src}`)
    return
  }
  const absOut = absIn.replace(/\.glb$/i, '_ktx2.glb')
  const tmp1 = absIn.replace(/\.glb$/i, '.__step1.glb')
  const tmp2 = absIn.replace(/\.glb$/i, '.__step2.glb')

  const sizeIn = statSync(absIn).size
  console.log(`\n=== ${basename(src)} (${(sizeIn / 1024).toFixed(1)} KB) [mode=${mode}${skipMeshopt ? ', no meshopt' : ''}] ===`)

  try {
    console.log('[1/2] decode draco + webp -> png')
    await decodeToPng(absIn, tmp1)

    console.log(`[2/2] ${mode} (KTX2)`)
    const ktxArgs = mode === 'etc1s' ? [tmp1, skipMeshopt ? absOut : tmp2, '--quality', '128'] : [tmp1, skipMeshopt ? absOut : tmp2]
    run(mode, ktxArgs)

    if (!skipMeshopt) {
      console.log('[3/3] meshopt (level=medium)')
      run('meshopt', [tmp2, absOut, '--level', 'medium'])
    }

    const sizeOut = statSync(absOut).size
    const pct = ((sizeOut / sizeIn) * 100).toFixed(0)
    console.log(`-> ${basename(absOut)} (${(sizeOut / 1024).toFixed(1)} KB, ${pct}% of original)`)
  } finally {
    for (const t of [tmp1, tmp2]) {
      try { if (existsSync(t)) unlinkSync(t) } catch {}
    }
  }
}

for (const t of TARGETS) {
  await processOne(t)
}
