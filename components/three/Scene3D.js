import { Canvas } from '@react-three/fiber'
import { Environment, ContactShadows, useTexture, useProgress } from '@react-three/drei'
import { SheetProvider, PerspectiveCamera } from '@theatre/r3f'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import RefractionGLB from './RefractionGLB'
import TheatreGLB from './TheatreGLB'
import TheatreObject from './TheatreObject'
import { theatreSheet } from '@/components/theatre/config'
import * as THREE from 'three'

// ProgressReporter — MUST be inside Canvas tree for useProgress() to work
function ProgressReporter({ onProgress, onLoaded }) {
  const { progress, active } = useProgress()
  const hasReportedLoaded = useRef(false)
  const lastProgress = useRef(0)

  useEffect(() => {
    // Always report progress changes
    if (onProgress && progress !== lastProgress.current) {
      lastProgress.current = progress
      onProgress(progress)
    }

    // Fire onLoaded at 75% — gives buffer for exit animation while remaining assets trickle in
    // OR immediately if progress jumps to 100 (cached assets)
    const shouldLoad = progress >= 75 || (progress === 100 && !active)
    
    if (shouldLoad && !hasReportedLoaded.current) {
      hasReportedLoaded.current = true
      // Immediate callback for cached loads, small delay for normal loads
      const delay = progress === 100 ? 0 : 100
      setTimeout(() => { 
        if (onLoaded) onLoaded() 
      }, delay)
    }
  }, [progress, active, onProgress, onLoaded])

  return null
}

// NOTE: useGLTF.preload() calls were REMOVED — they conflicted with
// useOptimizedGLTF which loads the same models, causing double downloads
// and main-thread contention that froze Firefox during loading.

export default function Scene3D({ onProgress, onLoaded }) {
  const [renderer, setRenderer] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    setIsMobile(window.innerWidth < 768);
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  const humanColor = '#5c5c5c';

  const floorOpacity = 0.5;
  const floorResolution = 768;
  const floorOffset = 0.02;
  const floorColor = '#797979';
  const floorRotX = -1.58;
  const floorRotY = 0;
  const floorRotZ = 0;
  const floorScale = 1.38;
  const floorBaseMapIntensity = 0.85;
  const floorPosX = -0.38;
  const floorPosY = 0.04;
  const floorPosZ = -1.14;

  useEffect(() => {
    if (!renderer) return;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.setPixelRatio(1);
  }, [renderer]);

  const platformInstances = [
    { key: 'Platform_2_v2', position: [6.09, -0.43, 0.71], rotation: [0, 0, 0] },
    { key: 'Platform_3_v2', position: [6.57, 0.11, 1.83], rotation: [0, 0, 0] },
    { key: 'Platform_4_v2', position: [6.67, 0.87, -1.25], rotation: [0, 0, 0] },
  ];

  return (
    <>
      <div className="w-full h-screen">
        <Canvas
          gl={{
            antialias: true,
            alpha: true,
            powerPreference: 'high-performance',
            stencil: false,
            depth: true,
          }}
          onCreated={({ gl }) => {
            setRenderer(gl);
          }}
          dpr={1}
          frameloop='always'
        >
          <Suspense fallback={null}>
          <ProgressReporter onProgress={onProgress} onLoaded={onLoaded} />
          <ToneMappingExposureLoop exposureRef={renderer} />
          <SheetProvider sheet={theatreSheet}>
            {/* Cámara editable con Theatre.js */}
            <PerspectiveCamera
              theatreKey="Camera"
              makeDefault
              position={[10.5, 0, 0]}
              fov={isMobile ? 75 : 55}
            />

            {/* Iluminación */}
            <ambientLight intensity={0.5} />
            <directionalLight
              position={[10, 10, 5]}
              intensity={1}
            />


            {/* VR Art Gallery Model */}
            <GalleryFloor
              floorOpacity={floorOpacity}
              floorResolution={floorResolution}
              floorOffset={floorOffset}
              floorColor={floorColor}
              floorRotX={floorRotX}
              floorRotY={floorRotY}
              floorRotZ={floorRotZ}
              floorScale={floorScale}
              floorBaseMapIntensity={floorBaseMapIntensity}
              floorPosX={floorPosX}
              floorPosY={floorPosY}
              floorPosZ={floorPosZ}
            />

            {/* Human Model */}
            <TheatreGLB
              uniqueKey="Human_v2"
              modelPath="/models/humanblender-v1.glb"
              position={[-7, -2, 0]}
              rotation={[0, 1.2, 0]}
              scale={[0.10368, 0.10368, 0.10368]}
              enableAnimationControls
              animationName="Take 001"
              forcePlay
              materialOverrides={{ color: humanColor, metalness: 1, roughness: 0.15 }}
            />

            {/* Particle Model */}
            <TheatreGLB
              uniqueKey="Particle"
              modelPath="/models/Particle-v1.glb"
              position={[0, 0, 0]}
              rotation={[0.14, 1.54, -0.06]}
              scale={[1, 1, 1]}
              enableAnimationControls
            />

            {/* Platform Base (repeatable) */}
            {platformInstances.map((item) => (
              <TheatreGLB
                key={item.key}
                uniqueKey={item.key}
                modelPath="/models/PlatformBase1-v1.glb"
                position={item.position}
                rotation={item.rotation}
                scale={[0.65, 0.65, 0.65]}
                enableAnimationControls
                materialOverrides={{ metalness: 1, roughness: 0.35 }}
              />
            ))}

            {/* Posters (cuadrado-v1) */}
            <PostersGroup />

            {/* Logo Model (Refraction) */}
            <RefractionGLB
              uniqueKey="Logo"
              modelPath="/models/logo.glb"
              position={[7.496, -1, 0]}
              rotation={[0, 1.5, 0]}
              scale={[0.24, 0.24, 0.24]}
              materialOverrides={{ metalness: 1, roughness: 0.5 }}
            />

            {/* Editable Cube */}
            <TheatreObject
              uniqueKey="Cube_v2"
              position={[-9.56, 0.24, 0]}
              rotation={[0, 0, 0]}
              scale={[0.18, 0.12, 5.78]}
            >
              <CubeCurtain />
            </TheatreObject>

            {/* Rombos Light Model */}
            <TheatreGLB
              uniqueKey="RombosLight"
              modelPath="/models/rombosLight-v1.glb"
              position={[6.25, 0.92, 1.48]}
              rotation={[1.6, 0, 1.6]}
              scale={[0.3, 0.3, 0.3]}
              enableAnimationControls
            />

            <TheatreGLB
              uniqueKey="RombosLight_2"
              modelPath="/models/rombosLight-v1.glb"
              position={[6.25, 0.07, -1.11]}
              rotation={[1.6, 0, 1.6]}
              scale={[-0.3, -0.3, -0.3]}
              enableAnimationControls
            />
            <TheatreGLB
              uniqueKey="RombosLight_3"
              modelPath="/models/rombosLight-v1.glb"
              position={[6.25, 0.92, 1.48]}
              rotation={[1.6, 0, 1.6]}
              scale={[0.3, 0.3, 0.3]}
              enableAnimationControls
            />

            <TheatreGLB
              uniqueKey="RombosLight_4"
              modelPath="/models/rombosLight-v1.glb"
              position={[6.25, 0.07, -1.11]}
              rotation={[1.6, 0, 1.6]}
              scale={[-0.3, -0.3, -0.3]}
              enableAnimationControls
            />


            {/* Controles y ambiente */}
            <RotatingEnvironment />
          </SheetProvider>

          </Suspense>
        </Canvas>
      </div>
    </>
  )
}

function ToneMappingExposureLoop({ exposureRef }) {
  useFrame((state) => {
    if (!exposureRef) return;
    const min = 0.45;
    const max = 0.85;
    const speed = 1.0;
    const t = 0.5 + 0.5 * Math.sin(state.clock.elapsedTime * speed);
    exposureRef.toneMappingExposure = min + (max - min) * t;
  });
  return null;
}

function CubeCurtain() {
  const cubeMeshRef = useRef(null);
  const cubeGradientUniforms = useMemo(
    () => ({
      uTop: { value: new THREE.Color('#E0E0E0') },
      uMid: { value: new THREE.Color('#FFFFFF') },
      uBottom: { value: new THREE.Color('#A7A7A7') },
      uMinY: { value: -0.5 },
      uMaxY: { value: 0.5 },
    }),
    []
  );
  const cubeGradientMaterial = useMemo(() => {
    const material = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      metalness: 0.6,
      roughness: 0.75,
    });
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uTop = cubeGradientUniforms.uTop;
      shader.uniforms.uMid = cubeGradientUniforms.uMid;
      shader.uniforms.uBottom = cubeGradientUniforms.uBottom;
      shader.uniforms.uMinY = cubeGradientUniforms.uMinY;
      shader.uniforms.uMaxY = cubeGradientUniforms.uMaxY;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `#include <common>\n varying float vWorldY;`
      );
      shader.vertexShader = shader.vertexShader.replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>\n vWorldY = worldPosition.y;`
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `#include <common>\n uniform vec3 uTop;\n uniform vec3 uMid;\n uniform vec3 uBottom;\n uniform float uMinY;\n uniform float uMaxY;\n varying float vWorldY;`
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        `
          #include <color_fragment>
          float denom = max(uMaxY - uMinY, 0.0001);
          float t = clamp((vWorldY - uMinY) / denom, 0.0, 1.0);
          vec3 gradColor = t > 0.5
            ? mix(uMid, uTop, (t - 0.5) / 0.5)
            : mix(uBottom, uMid, t / 0.5);
          diffuseColor.rgb *= gradColor;
        `
      );
      material.userData.shader = shader;
    };
    material.needsUpdate = true;
    return material;
  }, [cubeGradientUniforms]);
  const cubeBoundsTemp = useMemo(
    () => ({
      topLocal: new THREE.Vector3(0, 0.5, 0),
      bottomLocal: new THREE.Vector3(0, -0.5, 0),
      topWorld: new THREE.Vector3(),
      bottomWorld: new THREE.Vector3(),
    }),
    []
  );

  useFrame(() => {
    if (!cubeMeshRef.current) return;
    const mesh = cubeMeshRef.current;
    cubeBoundsTemp.topWorld.copy(cubeBoundsTemp.topLocal);
    cubeBoundsTemp.bottomWorld.copy(cubeBoundsTemp.bottomLocal);
    mesh.localToWorld(cubeBoundsTemp.topWorld);
    mesh.localToWorld(cubeBoundsTemp.bottomWorld);
    const minY = Math.min(cubeBoundsTemp.topWorld.y, cubeBoundsTemp.bottomWorld.y);
    const maxY = Math.max(cubeBoundsTemp.topWorld.y, cubeBoundsTemp.bottomWorld.y);
    cubeGradientUniforms.uMinY.value = minY;
    cubeGradientUniforms.uMaxY.value = maxY;
  });

  return (
    <mesh ref={cubeMeshRef} material={cubeGradientMaterial}>
      <boxGeometry args={[1, 1, 1]} />
    </mesh>
  );
}

function GalleryFloor({
  floorOpacity,
  floorResolution,
  floorOffset,
  floorColor,
  floorRotX,
  floorRotY,
  floorRotZ,
  floorScale,
  floorBaseMapIntensity,
  floorPosX,
  floorPosY,
  floorPosZ,
}) {
  const galleryFloorMap = useTexture('/textures/gallery-floor.png');

  useEffect(() => {
    if (!galleryFloorMap) return;
    galleryFloorMap.wrapS = galleryFloorMap.wrapT = THREE.RepeatWrapping;
    galleryFloorMap.repeat.set(1, 1);
    galleryFloorMap.colorSpace = THREE.SRGBColorSpace;
    galleryFloorMap.needsUpdate = true;
  }, [galleryFloorMap]);

  return (
    <TheatreGLB
      uniqueKey="VR_Art_Gallery"
      modelPath="/models/vr_art_gallery-v1.glb"
      position={[0, -1, 0]}
      scale={[1, 1, 1]}
      meshMaterialOverrides={{
        Cube_C_1_0: {
          type: 'reflector',
          opacity: floorOpacity,
          resolution: floorResolution,
          color: floorColor,
          offset: floorOffset,
          rotation: [floorRotX, floorRotY, floorRotZ],
          scale: [floorScale, floorScale, floorScale],
          position: [floorPosX, floorPosY, floorPosZ],
          baseMapIntensity: floorBaseMapIntensity,
          baseMap: galleryFloorMap,
        },
      }}
    />
  );
}

function RotatingEnvironment() {
  useFrame((state) => {
    if (!state.scene) return;
    if (!state.scene.environmentRotation) {
      state.scene.environmentRotation = new THREE.Euler(0, 0, 0);
    }
    const speed = 0.12;
    state.scene.environmentRotation.y = state.clock.elapsedTime * speed;
  });

  return <Environment preset="city" blur={1.0} />;
}

function PostersGroup() {
  const posterMetalness = 0.53;
  const posterRoughness = 0.1;
  const posterToneMapped = false;
  const posterColor = '#ffffff';
  const poster2Metalness = 0.53;
  const poster2Roughness = 0.1;
  const poster2ToneMapped = false;
  const poster2Color = '#ffffff';
  const poster3Shrink = 1;
  const poster3OffsetX = 0;
  const poster3OffsetY = 0;
  const poster4Shrink = 1;
  const poster4OffsetX = 0;
  const poster4OffsetY = 0.035;

  const [posterMap, posterMap2, posterMap3, posterMap4] = useTexture([
    '/posters/image1.png',
    '/posters/image2.png',
    '/posters/image3.png',
    '/posters/image4.png',
  ]);

  useEffect(() => {
    if (!posterMap) return;
    posterMap.colorSpace = THREE.SRGBColorSpace;
    posterMap.wrapS = posterMap.wrapT = THREE.ClampToEdgeWrapping;
    posterMap.minFilter = THREE.LinearMipmapLinearFilter;
    posterMap.magFilter = THREE.LinearFilter;
    posterMap.anisotropy = 8;
    if (posterMap.image && posterMap.image.width && posterMap.image.height) {
      const aspect = posterMap.image.width / posterMap.image.height;
      const shrink = 1.12;
      if (aspect >= 1) {
        const repeatX = (1 / aspect) * shrink;
        posterMap.repeat.set(repeatX, shrink);
        posterMap.offset.set((1 - repeatX) * 0.5, (1 - shrink) * 0.5);
      } else {
        const repeatY = aspect * shrink;
        posterMap.repeat.set(shrink, repeatY);
        posterMap.offset.set((1 - shrink) * 0.5, (1 - repeatY) * 0.5);
      }
    }
    posterMap.needsUpdate = true;
  }, [posterMap]);

  useEffect(() => {
    if (!posterMap2) return;
    posterMap2.colorSpace = THREE.SRGBColorSpace;
    posterMap2.wrapS = posterMap2.wrapT = THREE.ClampToEdgeWrapping;
    posterMap2.minFilter = THREE.LinearMipmapLinearFilter;
    posterMap2.magFilter = THREE.LinearFilter;
    posterMap2.anisotropy = 8;
    if (posterMap2.image && posterMap2.image.width && posterMap2.image.height) {
      const aspect = posterMap2.image.width / posterMap2.image.height;
      const shrink = 1.03;
      if (aspect >= 1) {
        const repeatX = (1 / aspect) * shrink;
        posterMap2.repeat.set(repeatX, shrink);
        posterMap2.offset.set((1 - repeatX) * 0.5, (1 - shrink) * 0.5 + 0.03);
      } else {
        const repeatY = aspect * shrink;
        posterMap2.repeat.set(shrink, repeatY);
        posterMap2.offset.set((1 - shrink) * 0.5, (1 - repeatY) * 0.5 + 0.03);
      }
    }
    posterMap2.needsUpdate = true;
  }, [posterMap2]);

  useEffect(() => {
    if (!posterMap3) return;
    posterMap3.colorSpace = THREE.SRGBColorSpace;
    posterMap3.wrapS = posterMap3.wrapT = THREE.ClampToEdgeWrapping;
    posterMap3.minFilter = THREE.LinearMipmapLinearFilter;
    posterMap3.magFilter = THREE.LinearFilter;
    posterMap3.anisotropy = 8;
    if (posterMap3.image && posterMap3.image.width && posterMap3.image.height) {
      const aspect = posterMap3.image.width / posterMap3.image.height;
      const shrink = poster3Shrink;
      if (aspect >= 1) {
        const repeatX = (1 / aspect) * shrink;
        posterMap3.repeat.set(repeatX, shrink);
        posterMap3.offset.set((1 - repeatX) * 0.5 + poster3OffsetX, (1 - shrink) * 0.5 + poster3OffsetY);
      } else {
        const repeatY = aspect * shrink;
        posterMap3.repeat.set(shrink, repeatY);
        posterMap3.offset.set((1 - shrink) * 0.5 + poster3OffsetX, (1 - repeatY) * 0.5 + poster3OffsetY);
      }
    }
    posterMap3.needsUpdate = true;
  }, [posterMap3, poster3Shrink, poster3OffsetX, poster3OffsetY]);

  useEffect(() => {
    if (!posterMap4) return;
    posterMap4.colorSpace = THREE.SRGBColorSpace;
    posterMap4.wrapS = posterMap4.wrapT = THREE.ClampToEdgeWrapping;
    posterMap4.minFilter = THREE.LinearMipmapLinearFilter;
    posterMap4.magFilter = THREE.LinearFilter;
    posterMap4.anisotropy = 8;
    if (posterMap4.image && posterMap4.image.width && posterMap4.image.height) {
      const aspect = posterMap4.image.width / posterMap4.image.height;
      const shrink = poster4Shrink;
      if (aspect >= 1) {
        const repeatX = (1 / aspect) * shrink;
        posterMap4.repeat.set(repeatX, shrink);
        posterMap4.offset.set((1 - repeatX) * 0.5 + poster4OffsetX, (1 - shrink) * 0.5 + poster4OffsetY);
      } else {
        const repeatY = aspect * shrink;
        posterMap4.repeat.set(shrink, repeatY);
        posterMap4.offset.set((1 - shrink) * 0.5 + poster4OffsetX, (1 - repeatY) * 0.5 + poster4OffsetY);
      }
    }
    posterMap4.needsUpdate = true;
  }, [posterMap4, poster4Shrink, poster4OffsetX, poster4OffsetY]);

  return (
    <>
      {['Poster_1_v2', 'Poster_2_v2', 'Poster_3_v2', 'Poster_4_v2'].map((key) => (
        <TheatreGLB
          key={key}
          uniqueKey={`Posters_v2/${key}`}
          modelPath="/models/cuadrado-v1.glb"
          position={[0, 0, 0]}
          rotation={[0, 0, 0]}
          scale={[1, 1, 1]}
          enableAnimationControls
          meshMaterialOverrides={{
            ButtonFace: {
              type: 'standard',
              map:
                key === 'Poster_2_v2'
                  ? posterMap2
                  : key === 'Poster_3_v2'
                  ? posterMap3
                  : key === 'Poster_4_v2'
                  ? posterMap4
                  : posterMap,
              color: key === 'Poster_2_v2' ? poster2Color : posterColor,
              metalness: posterMetalness,
              roughness: posterRoughness,
              toneMapped: key === 'Poster_2_v2' ? poster2ToneMapped : posterToneMapped,
            },
            ButtonBody: {
              type: 'standard',
              color: posterColor,
              metalness: posterMetalness,
              roughness: posterRoughness,
              toneMapped: posterToneMapped,
            },
          }}
        />
      ))}
    </>
  );
}
