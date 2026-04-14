import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import Link from 'next/link'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { orbitron, tektur, spaceGrotesk, plusJakarta } from '@/lib/fonts'
import Scene3D from '@/components/three/Scene3D'
import { ensureTheatreStateLoaded, theatreSheet } from '@/components/theatre/config'
import { Twitter, Github, FileText, Menu, X, Send, ArrowRight, Atom, Activity, Heart, Network } from 'lucide-react'
import NeyrsLogo from '@/components/NeyrsLogo'
import DexScreenerLogo from '@/components/DexScreenerLogo'

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

const MASTER_SCROLL_SCREENS = 13.0
const SCROLL_SCRUB = 2.2
const PROGRESS_EASE = null
const DEFAULT_SEQUENCE_SECONDS = 8.05

const FEATURE_TIMINGS = {
  feature1In: 2.61,
  feature1Out: 3.30,
  feature2In: 3.50,
  feature2Out: 3.86,
  feature3In: 4.02,
  feature3Out: 4.48,
  feature4In: 4.71,
  feature4Out: 5.14,
}

const HERO_TIMINGS = {
  heroIn: 0.0,
  heroOut: 0.18,
}

const CTA_TIMINGS = {
  ctaIn: 6.24,
  ctaOut: 7.72,
}


export default function ScrollStory({ introReady = false, onProgress, onLoaded }) {
  const rootRef = useRef(null)
  const timelineRef = useRef(null)
  const introTimelineRef = useRef(null)
  const introDoneRef = useRef(false)
  const sequenceLengthRef = useRef(DEFAULT_SEQUENCE_SECONDS)
  const lastAnimTimeRef = useRef(0)

  useEffect(() => {
    ensureTheatreStateLoaded()
      .then(() => {
        if (theatreSheet?.sequence?.length) {
          sequenceLengthRef.current = theatreSheet.sequence.length
        }
      })
      .catch(() => { })
  }, [])

  useIsomorphicLayoutEffect(() => {
    if (!rootRef.current) return

    gsap.registerPlugin(ScrollTrigger)

    const ctx = gsap.context(() => {
      const textLayer = rootRef.current.querySelector('[data-story-layer]')
      const textBlocks = Array.from(rootRef.current.querySelectorAll('[data-feature-block]'))
      const heroBlock = rootRef.current.querySelector('[data-hero-block]')
      const heroItems = heroBlock?.querySelectorAll('[data-hero-item]')
      const ctaBlock = rootRef.current.querySelector('[data-cta-block]')
      const ctaItems = ctaBlock?.querySelectorAll('[data-cta-item]')
      // navItems and socialItems are inside Navbar.js which is OUTSIDE rootRef —
      // must query document-level to find them
      const navItems = Array.from(document.querySelectorAll('[data-nav-item]'))
      const socialItems = Array.from(document.querySelectorAll('[data-social-icon]'))
      const feature1Items = textBlocks[0]?.querySelectorAll('[data-feature-item]')
      const feature2Items = textBlocks[1]?.querySelectorAll('[data-feature-item]')
      const feature3Items = textBlocks[2]?.querySelectorAll('[data-feature-item]')
      const feature4Items = textBlocks[3]?.querySelectorAll('[data-feature-item]')
      const feature1TitleWords = textBlocks[0]?.querySelectorAll('[data-title-word]')
      const feature2TitleWords = textBlocks[1]?.querySelectorAll('[data-title-word]')
      const feature3TitleWords = textBlocks[2]?.querySelectorAll('[data-title-word]')
      const feature4TitleWords = textBlocks[3]?.querySelectorAll('[data-title-word]')

      gsap.set(textLayer, { autoAlpha: 0 })
      if (heroItems) {
        gsap.set(heroItems, {
          autoAlpha: 0,
          y: 32,
          filter: 'blur(10px)',
          clipPath: 'inset(0 0 100% 0)',
        })
      }
      if (ctaItems) {
        gsap.set(ctaItems, {
          autoAlpha: 0,
          y: 32,
          filter: 'blur(10px)',
          clipPath: 'inset(0 0 100% 0)',
        })
      }
      textBlocks.forEach((block) => {
        const items = block.querySelectorAll('[data-feature-item]')
        gsap.set(items, {
          autoAlpha: 0,
          y: 28,
          scale: 0.985,
          filter: 'blur(10px)',
          clipPath: 'inset(0 0 100% 0)',
        })
      })

      const titleWords = Array.from(rootRef.current.querySelectorAll('[data-title-word]'))
      gsap.set(titleWords, { autoAlpha: 0, y: 28, filter: 'blur(10px)' })
      if (feature1TitleWords) {
        gsap.set(feature1TitleWords, { autoAlpha: 0, y: 28, filter: 'blur(10px)' })
      }
      if (feature2TitleWords) {
        gsap.set(feature2TitleWords, { autoAlpha: 0, y: 28, filter: 'blur(10px)' })
      }
      if (feature3TitleWords) {
        gsap.set(feature3TitleWords, { autoAlpha: 0, y: 28, filter: 'blur(10px)' })
      }
      if (feature4TitleWords) {
        gsap.set(feature4TitleWords, { autoAlpha: 0, y: 28, filter: 'blur(10px)' })
      }

      if (navItems.length) {
        gsap.set(navItems, { autoAlpha: 0, y: -12, filter: 'blur(6px)' })
      }
      if (socialItems.length) {
        gsap.set(socialItems, { autoAlpha: 0, y: 12, scale: 0.9, filter: 'blur(6px)' })
      }

      introTimelineRef.current = gsap
        .timeline({
          paused: true,
          defaults: { ease: 'power3.out' },
          onComplete: () => {
            introDoneRef.current = true
          },
        })
        // 1. Navbar items slide down from top
        .to(navItems, {
          autoAlpha: 1,
          y: 0,
          filter: 'blur(0px)',
          duration: 0.55,
          stagger: { each: 0.06, from: 'start' },
        }, 0.0)
        // 2. Social icons slide up from bottom — delayed so navbar finishes first
        .to(socialItems, {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          filter: 'blur(0px)',
          duration: 0.5,
          stagger: { each: 0.07, from: 'start' },
        }, 0.3)
        // 3. Text layer fade in
        .to(textLayer, { autoAlpha: 1, duration: 0.2 }, 0.35)
        // 4. Hero text items reveal — starts after nav + social settled
        .to(heroItems, {
          autoAlpha: 1,
          y: 0,
          filter: 'blur(0px)',
          clipPath: 'inset(0 0 0% 0)',
          stagger: { each: 0.08, from: 'start' },
          duration: 0.8,
          ease: 'expo.out',
        }, 0.45)

      const master = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: rootRef.current,
          start: 'top top',
          end: () => `+=${window.innerHeight * MASTER_SCROLL_SCREENS}`,
          pin: true,
          scrub: SCROLL_SCRUB,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            if (!introDoneRef.current) {
              return
            }
            const progress = self.progress
            const easedProgress = PROGRESS_EASE
              ? gsap.parseEase(PROGRESS_EASE)(progress)
              : progress
            const animTime = easedProgress * sequenceLengthRef.current

            if (theatreSheet?.sequence) {
              theatreSheet.sequence.position = animTime
            }

            // Duraciones de transición (en segundos)
            const FADE_IN_DURATION = 0.15
            const FADE_OUT_DURATION = 0.12
            const HERO_FADE_OUT_DURATION = 0.16 // Un poco más lento para el hero

            // Helper para calcular progreso de fade in/out
            const getFadeProgress = (time, startTime, endTime, fadeInDur, fadeOutDur) => {
              if (time < startTime) return 0
              if (time > endTime) return 0

              const fadeInEnd = startTime + fadeInDur
              const fadeOutStart = endTime - fadeOutDur

              if (time < fadeInEnd) {
                // Fade in
                return gsap.parseEase('power2.out')((time - startTime) / fadeInDur)
              } else if (time > fadeOutStart) {
                // Fade out
                return gsap.parseEase('power2.in')(1 - (time - fadeOutStart) / fadeOutDur)
              } else {
                // Completamente visible
                return 1
              }
            }

            // Helper especial para hero (sin fade in, empieza visible)
            const getHeroProgress = (time, startTime, endTime, fadeOutDur) => {
              if (time < startTime) return 0
              if (time > endTime) return 0

              const fadeOutStart = endTime - fadeOutDur

              if (time > fadeOutStart) {
                // Fade out más suave con power1.in
                return gsap.parseEase('power1.in')(1 - (time - fadeOutStart) / fadeOutDur)
              } else {
                // Completamente visible desde el inicio
                return 1
              }
            }

            // Hero section (visible desde el inicio)
            const heroProgress = getHeroProgress(
              animTime,
              HERO_TIMINGS.heroIn,
              HERO_TIMINGS.heroOut,
              HERO_FADE_OUT_DURATION
            )
            const heroActive = heroProgress > 0

            if (heroActive) {
              gsap.set(textLayer, { autoAlpha: 1 })
              if (heroItems) {
                gsap.set(heroItems, {
                  autoAlpha: heroProgress,
                  y: (1 - heroProgress) * 20,
                  filter: `blur(${(1 - heroProgress) * 8}px)`,
                  clipPath: `inset(0 0 ${(1 - heroProgress) * 100}% 0)`,
                })
              }
            }

            // CTA section (visible hasta el final)
            const ctaProgress = getHeroProgress(
              animTime,
              CTA_TIMINGS.ctaIn,
              CTA_TIMINGS.ctaOut,
              HERO_FADE_OUT_DURATION
            )
            const ctaActive = ctaProgress > 0

            if (ctaActive) {
              gsap.set(textLayer, { autoAlpha: 1 })
              if (ctaItems) {
                gsap.set(ctaItems, {
                  autoAlpha: ctaProgress,
                  y: (1 - ctaProgress) * 20,
                  filter: `blur(${(1 - ctaProgress) * 8}px)`,
                  clipPath: `inset(0 0 ${(1 - ctaProgress) * 100}% 0)`,
                })
              }
            }

            // Feature 1 section
            const f1Progress = getFadeProgress(
              animTime,
              FEATURE_TIMINGS.feature1In,
              FEATURE_TIMINGS.feature1Out,
              FADE_IN_DURATION,
              FADE_OUT_DURATION
            )
            const f1Active = f1Progress > 0

            if (f1Active) {
              gsap.set(textLayer, { autoAlpha: 1 })
              if (feature1TitleWords) {
                gsap.set(feature1TitleWords, {
                  autoAlpha: f1Progress,
                  y: (1 - f1Progress) * 16,
                  filter: `blur(${(1 - f1Progress) * 8}px)`,
                })
              }
              if (feature1Items) {
                gsap.set(feature1Items, {
                  autoAlpha: f1Progress,
                  y: (1 - f1Progress) * 16,
                  scale: 0.985 + (f1Progress * 0.015),
                  filter: `blur(${(1 - f1Progress) * 8}px)`,
                  clipPath: `inset(0 0 ${(1 - f1Progress) * 100}% 0)`,
                })
              }
            }

            // Feature 2 section
            const f2Progress = getFadeProgress(
              animTime,
              FEATURE_TIMINGS.feature2In,
              FEATURE_TIMINGS.feature2Out,
              FADE_IN_DURATION,
              FADE_OUT_DURATION
            )
            const f2Active = f2Progress > 0

            if (f2Active) {
              gsap.set(textLayer, { autoAlpha: 1 })
              if (feature2TitleWords) {
                gsap.set(feature2TitleWords, {
                  autoAlpha: f2Progress,
                  y: (1 - f2Progress) * 16,
                  filter: `blur(${(1 - f2Progress) * 8}px)`,
                })
              }
              if (feature2Items) {
                gsap.set(feature2Items, {
                  autoAlpha: f2Progress,
                  y: (1 - f2Progress) * 16,
                  scale: 0.985 + (f2Progress * 0.015),
                  filter: `blur(${(1 - f2Progress) * 8}px)`,
                  clipPath: `inset(0 0 ${(1 - f2Progress) * 100}% 0)`,
                })
              }
            }

            // Feature 3 section
            const f3Progress = getFadeProgress(
              animTime,
              FEATURE_TIMINGS.feature3In,
              FEATURE_TIMINGS.feature3Out,
              FADE_IN_DURATION,
              FADE_OUT_DURATION
            )
            const f3Active = f3Progress > 0

            if (f3Active) {
              gsap.set(textLayer, { autoAlpha: 1 })
              if (feature3TitleWords) {
                gsap.set(feature3TitleWords, {
                  autoAlpha: f3Progress,
                  y: (1 - f3Progress) * 16,
                  filter: `blur(${(1 - f3Progress) * 8}px)`,
                })
              }
              if (feature3Items) {
                gsap.set(feature3Items, {
                  autoAlpha: f3Progress,
                  y: (1 - f3Progress) * 16,
                  scale: 0.985 + (f3Progress * 0.015),
                  filter: `blur(${(1 - f3Progress) * 8}px)`,
                  clipPath: `inset(0 0 ${(1 - f3Progress) * 100}% 0)`,
                })
              }
            }

            // Feature 4 section (Emotion AI - layout especial)
            const f4Progress = getFadeProgress(
              animTime,
              FEATURE_TIMINGS.feature4In,
              FEATURE_TIMINGS.feature4Out,
              FADE_IN_DURATION,
              FADE_OUT_DURATION
            )
            const f4Active = f4Progress > 0

            if (f4Active) {
              gsap.set(textLayer, { autoAlpha: 1 })
              if (feature4TitleWords) {
                gsap.set(feature4TitleWords, {
                  autoAlpha: f4Progress,
                  y: (1 - f4Progress) * 16,
                  filter: `blur(${(1 - f4Progress) * 8}px)`,
                })
              }
              if (feature4Items) {
                gsap.set(feature4Items, {
                  autoAlpha: f4Progress,
                  y: (1 - f4Progress) * 16,
                  scale: 0.985 + (f4Progress * 0.015),
                  filter: `blur(${(1 - f4Progress) * 8}px)`,
                  clipPath: `inset(0 0 ${(1 - f4Progress) * 100}% 0)`,
                })
              }
            }

            // Ocultar elementos inactivos
            if (!heroActive && heroItems) {
              gsap.set(heroItems, {
                autoAlpha: 0,
                y: -16,
                filter: 'blur(8px)',
                clipPath: 'inset(0 0 100% 0)',
              })
            }

            if (!ctaActive && ctaItems) {
              gsap.set(ctaItems, {
                autoAlpha: 0,
                y: -16,
                filter: 'blur(8px)',
                clipPath: 'inset(0 0 100% 0)',
              })
            }

            if (!f1Active) {
              if (feature1TitleWords) {
                gsap.set(feature1TitleWords, {
                  autoAlpha: 0,
                  y: -12,
                  filter: 'blur(8px)',
                })
              }
              if (feature1Items) {
                gsap.set(feature1Items, {
                  autoAlpha: 0,
                  y: -12,
                  scale: 0.985,
                  filter: 'blur(8px)',
                  clipPath: 'inset(0 0 100% 0)',
                })
              }
            }

            if (!f2Active) {
              if (feature2TitleWords) {
                gsap.set(feature2TitleWords, {
                  autoAlpha: 0,
                  y: -12,
                  filter: 'blur(8px)',
                })
              }
              if (feature2Items) {
                gsap.set(feature2Items, {
                  autoAlpha: 0,
                  y: -12,
                  scale: 0.985,
                  filter: 'blur(8px)',
                  clipPath: 'inset(0 0 100% 0)',
                })
              }
            }

            if (!f3Active) {
              if (feature3TitleWords) {
                gsap.set(feature3TitleWords, {
                  autoAlpha: 0,
                  y: -12,
                  filter: 'blur(8px)',
                })
              }
              if (feature3Items) {
                gsap.set(feature3Items, {
                  autoAlpha: 0,
                  y: -12,
                  scale: 0.985,
                  filter: 'blur(8px)',
                  clipPath: 'inset(0 0 100% 0)',
                })
              }
            }

            if (!f4Active) {
              if (feature4TitleWords) {
                gsap.set(feature4TitleWords, {
                  autoAlpha: 0,
                  y: -12,
                  filter: 'blur(8px)',
                })
              }
              if (feature4Items) {
                gsap.set(feature4Items, {
                  autoAlpha: 0,
                  y: -12,
                  scale: 0.985,
                  filter: 'blur(8px)',
                  clipPath: 'inset(0 0 100% 0)',
                })
              }
            }

            // Ocultar textLayer si nada está activo
            if (!heroActive && !f1Active && !f2Active && !f3Active && !f4Active && !ctaActive) {
              gsap.set(textLayer, { autoAlpha: 0 })
            }
          },
        },
      })

      master.to({}, { duration: 1 })

      timelineRef.current = master

      // Force GSAP ScrollTrigger to recalculate trigger offsets immediately 
      // after the 2000vh spacer generation is locked into the DOM geometry.
      // Emit an event so downstream GSAP animations defer loading until now.
      setTimeout(() => {
        ScrollTrigger.refresh(true)
        window.dispatchEvent(new Event('scrollstory-ready'))
      }, 150)

    }, rootRef)

    return () => {
      if (introTimelineRef.current) {
        introTimelineRef.current.kill()
        introTimelineRef.current = null
      }
      if (timelineRef.current) {
        timelineRef.current.scrollTrigger?.kill()
        timelineRef.current.kill()
        timelineRef.current = null
      }
      ScrollTrigger.getAll().forEach((trigger) => trigger.kill())
      ctx.revert()
    }
  }, [])

  useEffect(() => {
    if (!introReady || introDoneRef.current || !introTimelineRef.current) return
    introTimelineRef.current.play(0)
  }, [introReady])

  return (
    <>
      <div ref={rootRef} className="hero_main relative h-screen w-full overflow-hidden">
        <div className="fixed inset-0 z-[3] pointer-events-none bg-black">
          <Scene3D onProgress={onProgress} onLoaded={onLoaded} />
        </div>

        <div className="fixed inset-0 z-[4]">
          <div data-story-layer className="relative h-full w-full">
            <div data-hero-block className="absolute left-1/2 bottom-[10vh] w-full max-w-5xl -translate-x-1/2 px-6 sm:px-10 md:px-12">
              <div className={`space-y-3 text-center ${spaceGrotesk.className}`}>
                <p data-hero-item className={`text-sm uppercase tracking-[0.35em] ${orbitron.className}`}>
                  <span className="bg-gradient-to-r from-white/50 via-white/40 to-white/50 bg-clip-text text-transparent">
                    Neyrs • AI Assistant
                  </span>
                </p>
                <p
                  data-hero-item
                  className={`mx-auto max-w-5xl text-5xl font-semibold leading-[1.05] md:text-6xl ${tektur.className}`}
                >
                  <span className="bg-gradient-to-br from-white via-white/95 to-white/85 bg-clip-text text-transparent">
                    Neyrs is an AI agent that speaks, listens, and operates across tools in real time
                  </span>
                </p>
                <p data-hero-item className={`mx-auto max-w-2xl text-base leading-[1.45] md:text-lg ${plusJakarta.className}`}>
                  <span className="text-white/75">
                    Voice synthesis with prosody control, mood‑aware replies, image generation, and task routing built into a single agent.
                  </span>
                </p>
              </div>
            </div>
            <div data-cta-block className="absolute left-1/2 bottom-[10vh] w-full max-w-4xl -translate-x-1/2 px-6 sm:px-10 md:px-12">
              <div className={`space-y-2.5 text-center ${spaceGrotesk.className}`}>
                <p data-cta-item className={`text-xs md:text-sm uppercase tracking-[0.32em] ${orbitron.className}`}>
                  <span className="bg-gradient-to-r from-white/50 via-white/40 to-white/50 bg-clip-text text-transparent">
                    Ready to experience Neyrs?
                  </span>
                </p>
                <p
                  data-cta-item
                  className={`mx-auto max-w-3xl text-3xl md:text-4xl lg:text-5xl font-semibold leading-tight ${tektur.className}`}
                >
                  <span className="bg-gradient-to-br from-white via-white/95 to-white/85 bg-clip-text text-transparent">
                    Try Neyrs for free and explore voice-driven AI
                  </span>
                </p>
                <p data-cta-item className={`mx-auto max-w-xl text-sm md:text-base leading-relaxed ${plusJakarta.className}`}>
                  <span className="text-white/75">
                    Start building with real-time voice synthesis, adaptive intelligence, and autonomous workflows.
                  </span>
                </p>
              </div>
            </div>
            <div
              data-feature-block
              className="absolute right-0 top-1/2 w-full -translate-y-1/2 px-6 sm:px-10 md:w-[50%] md:pr-[8vw] md:pl-0"
            >
              <FeatureBlock
                title="Neyrs // Intelligence Layer"
                subtitle="Simple analytics that surface what matters most"
                items={[
                  'Intent graph keeps priorities consistent across sessions',
                  'Adaptive mood engine responds to context in real time',
                  'Voice synthesis with dynamic prosody and tone control',
                  'Multimodal tools for images, summaries, and routing',
                ]}
              />
            </div>
            <div
              data-feature-block
              className="absolute left-0 top-1/2 w-full -translate-y-1/2 px-6 sm:px-10 md:w-[50%] md:pl-[8vw] md:pr-0"
            >
              <FeatureBlock
                title="Neyrs // AI Assistant"
                subtitle="Realtime intelligence that stays aligned"
                items={[
                  'Intent graph keeps priorities aligned across sessions',
                  'Adaptive mood engine reacts in real time',
                  'Voice synthesis with dynamic prosody control',
                  'Multimodal tools for images, summaries, routing',
                ]}
                align="left"
              />
            </div>
            <div
              data-feature-block
              className="absolute right-0 top-1/2 w-full -translate-y-1/2 px-6 sm:px-10 md:w-[50%] md:pr-[8vw] md:pl-0"
            >
              <FeatureBlock
                title="Neyrs // Smart Automation"
                subtitle="Workflows that adapt and execute autonomously"
                items={[
                  'Task scheduling with context-aware triggers',
                  'Auto-routing between tools based on intent',
                  'Memory-driven workflows that learn preferences',
                  'Seamless handoff between voice and text modes',
                ]}
              />
            </div>
            <div
              data-feature-block
              className="absolute inset-0 flex items-center justify-center px-6 sm:px-10"
            >
              <div className="relative w-full max-w-6xl h-full">
                {/* Título central superior */}
                <div className="absolute left-1/2 top-[8%] md:top-[12%] -translate-x-1/2 flex flex-col items-center text-center w-full px-4">
                  <p data-feature-item className={`text-[8px] md:text-xs uppercase tracking-[0.25em] md:tracking-[0.35em] ${orbitron.className}`}>
                    <span className="bg-gradient-to-r from-white/50 via-white/40 to-white/50 bg-clip-text text-transparent">
                      Neyrs // Emotion AI
                    </span>
                  </p>
                  <p className={`mt-0.5 md:mt-1 text-base md:text-2xl lg:text-3xl font-semibold leading-tight md:leading-normal ${tektur.className}`}>
                    {['Adaptive', 'mood', 'that', 'evolves'].map((word, index) => (
                      <span key={`${word}-${index}`} data-title-word className="inline-block pr-1 md:pr-2">
                        <span className="bg-gradient-to-br from-white via-white/95 to-white/85 bg-clip-text text-transparent">
                          {word}
                        </span>
                      </span>
                    ))}
                  </p>

                  {/* Center Icon (Removed as requested) */}
                </div>

                {/* Feature derecha */}
                <div className="absolute right-[2%] md:right-[8%] top-1/2 w-[35%] md:w-[28%] -translate-y-1/2 flex flex-col items-center text-center">
                  <h4 data-feature-item className={`text-[12px] md:text-[16px] uppercase font-bold tracking-[0.15em] mb-3 text-cyan-50 ${orbitron.className}`}>
                     Context Engine
                  </h4>
                  <p data-feature-item className={`text-[11px] md:text-[15px] leading-snug md:leading-relaxed ${plusJakarta.className}`}>
                     <span className="text-white/75">Emotional context tracking</span>
                  </p>
                  <p data-feature-item className={`mt-1 md:mt-2 text-[11px] md:text-[15px] leading-snug md:leading-relaxed ${plusJakarta.className}`}>
                     <span className="text-white/75">Tone adaptation in real time</span>
                  </p>
                  <div data-feature-item className="mt-4 flex justify-center opacity-80">
                    <Activity className="w-5 h-5 md:w-6 md:h-6 text-cyan-300 animate-pulse" strokeWidth={1.5} />
                  </div>
                </div>

                {/* Feature izquierda */}
                <div className="absolute left-[2%] md:left-[8%] top-1/2 w-[35%] md:w-[28%] -translate-y-1/2 flex flex-col items-center text-center">
                  <h4 data-feature-item className={`text-[12px] md:text-[16px] uppercase font-bold tracking-[0.15em] mb-3 text-rose-50 ${orbitron.className}`}>
                     Deep Empathy
                  </h4>
                  <p data-feature-item className={`text-[11px] md:text-[15px] leading-snug md:leading-relaxed ${plusJakarta.className}`}>
                     <span className="text-white/75">Sentiment-aware responses</span>
                  </p>
                  <p data-feature-item className={`mt-1 md:mt-2 text-[11px] md:text-[15px] leading-snug md:leading-relaxed ${plusJakarta.className}`}>
                     <span className="text-white/75">Empathy-driven interactions</span>
                  </p>
                  <div data-feature-item className="mt-4 flex justify-center opacity-80">
                    <Heart className="w-5 h-5 md:w-6 md:h-6 text-rose-400 animate-[pulse_2s_ease-in-out_infinite]" strokeWidth={1.5} />
                  </div>
                </div>

                {/* Feature inferior central */}
                <div className="absolute bottom-[10%] md:bottom-[15%] left-1/2 w-[80%] md:w-[40%] lg:w-[35%] -translate-x-1/2 flex flex-col items-center text-center pb-8 border-transparent">
                  <h4 data-feature-item className={`text-[12px] md:text-[16px] uppercase font-bold tracking-[0.15em] mb-3 text-purple-50 ${orbitron.className}`}>
                     Adaptive State
                  </h4>
                  <p data-feature-item className={`text-[11px] md:text-[15px] leading-snug md:leading-relaxed ${plusJakarta.className}`}>
                     <span className="text-white/75">Personality shifts based on conversation flow</span>
                  </p>
                  <div data-feature-item className="mt-4 flex justify-center opacity-80">
                    <Network className="w-5 h-5 md:w-6 md:h-6 text-purple-400 animate-[spin_6s_linear_infinite]" strokeWidth={1.5} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

function FeatureBlock({ title, subtitle, items, align = 'right' }) {
  const titleWords = subtitle.split(' ')
  return (
    <div
      className={`max-w-2xl ${align === 'right' ? 'text-right' : 'text-left'} ${spaceGrotesk.className}`}
    >
      <p data-feature-item className={`text-sm uppercase tracking-[0.32em] ${orbitron.className}`}>
        <span className="bg-gradient-to-r from-white/50 via-white/40 to-white/50 bg-clip-text text-transparent">
          {title}
        </span>
      </p>
      <p className={`text-4xl font-semibold leading-[1.05] md:text-5xl ${tektur.className}`}>
        {titleWords.map((word, index) => (
          <span key={`${word}-${index}`} data-title-word className="inline-block pr-2">
            <span className="bg-gradient-to-br from-white via-white/95 to-white/85 bg-clip-text text-transparent">
              {word}
            </span>
          </span>
        ))}
      </p>
      <div className={`mt-3 grid gap-1 text-[17px] leading-[1.45] md:text-[18px] ${plusJakarta.className}`}>
        {items.map((item) => (
          <p key={item} data-feature-item className="tracking-[0.01em]">
            <span className="text-white/75">
              {item}
            </span>
          </p>
        ))}
      </div>
    </div>
  )
}
