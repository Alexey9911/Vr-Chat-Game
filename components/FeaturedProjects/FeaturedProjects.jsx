'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { orbitron, tektur } from '@/lib/fonts'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import styles from './FeaturedProjects.module.css'

const projects = [
  {
    image: '/posters/image1.png',
    title: 'Voice Synthesis',
    subtitle: 'Dynamic prosody and tone control',
  },
  {
    image: '/posters/image2.png',
    title: 'Emotion AI',
    subtitle: 'Mood-aware responses',
  },
  {
    image: '/posters/image3.png',
    title: 'Memory System',
    subtitle: 'Context-aware workflows',
  },
  {
    image: '/posters/image4.png',
    title: 'Real-time Tools',
    subtitle: 'Multimodal capabilities',
  },
]

export default function FeaturedProjects() {
  const containerRef = useRef(null)
  const [isReady, setIsReady] = useState(false)

  // Defer GSAP initialization until ScrollStory's 2000vh spacer finishes loading
  useEffect(() => {
    const handleReady = () => setIsReady(true)
    window.addEventListener('scrollstory-ready', handleReady)
    
    // Safety fallback just in case ScrollStory failed to fire the event
    const fallbackTimer = setTimeout(handleReady, 3000)

    return () => {
      window.removeEventListener('scrollstory-ready', handleReady)
      clearTimeout(fallbackTimer)
    }
  }, [])

  useEffect(() => {
    if (!isReady) return

    gsap.registerPlugin(ScrollTrigger)
    
    const ctx = gsap.context(() => {
      // Title Animation
      gsap.fromTo('.project-title-header',
        { opacity: 0, y: 50 },
        {
          opacity: 1, y: 0,
          duration: 0.8,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: '.project-title-header',
            start: 'top 85%',
          }
        }
      )

      // Project Cards Animation
      const cards = gsap.utils.toArray('.project-card-anim')
      
      cards.forEach((card) => {
        const image = card.querySelector('.project-img-anim')
        const text = card.querySelector('.project-text-anim')

        // Initial states
        gsap.set(image, { opacity: 0, y: 40 })
        gsap.set(text, { opacity: 0, y: 30 })

        // ScrollTrigger animation
        ScrollTrigger.create({
          trigger: card,
          start: 'top 85%',
          onEnter: () => {
            gsap.to(image, { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' })
            gsap.to(text, { opacity: 1, y: 0, duration: 0.8, delay: 0.15, ease: 'power3.out' })
          },
          once: true
        })
      })
    }, containerRef)

    return () => ctx.revert()
  }, [isReady])

  return (
    <section ref={containerRef} className="relative w-full bg-black py-20 md:py-32">
      {/* Container with gap-y-0 for tight stacking */}
      <div className={styles.gridLayout}>
        {/* Sticky Header Container - Contains title + first project */}
        <div className={`${styles.stickyHeader} col-span-full`} style={{ zIndex: 1 }}>
          <h2 className={`${styles.title} col-span-full project-title-header`}>
            <span className={tektur.className}>Core Features</span>
          </h2>
          
          {/* First project card - part of sticky header */}
          <div className={`${styles.projectCard} ${styles.gridLayout} col-span-full project-card-anim`}>
            <div className={`${styles.imageColumn} relative col-span-full lg:col-span-7 project-img-anim`}>
              <div className={styles.imageContainer}>
                <div className={styles.diagonalLines}></div>
                <div className={`${styles.dots} ${styles.imageInner}`}>
                  <Image
                    src={projects[0].image}
                    alt={projects[0].title}
                    fill
                    className="object-contain p-4"
                    sizes="(max-width: 1024px) 100vw, 58vw"
                  />
                </div>
              </div>
            </div>

            <div className={`${styles.textColumn} col-span-full lg:col-span-5 project-text-anim`}>
              <p className={`${styles.projectTitle} ${orbitron.className}`}>
                {projects[0].title}
              </p>
              <h3 className={`${styles.projectSubtitle} ${tektur.className}`}>
                {projects[0].subtitle}
              </h3>
            </div>
          </div>
        </div>

        {/* Remaining projects - Each one stacks on top with incremental z-index */}
        {projects.slice(1).map((project, index) => (
          <div
            key={project.title}
            className={`${styles.projectWrapper} col-span-full`}
            style={{ zIndex: index + 2 }}
          >
            <div className={`${styles.projectCard} ${styles.gridLayout} col-span-full project-card-anim`}>
              <div className={`${styles.imageColumn} relative col-span-full lg:col-span-7 project-img-anim`}>
                <div className={styles.imageContainer}>
                  <div className={styles.diagonalLines}></div>
                  <div className={`${styles.dots} ${styles.imageInner}`}>
                    <Image
                      src={project.image}
                      alt={project.title}
                      fill
                      className="object-contain p-4"
                      sizes="(max-width: 1024px) 100vw, 58vw"
                    />
                  </div>
                </div>
              </div>

              <div className={`${styles.textColumn} col-span-full lg:col-span-5 project-text-anim`}>
                <p className={`${styles.projectTitle} ${orbitron.className}`}>
                  {project.title}
                </p>
                <h3 className={`${styles.projectSubtitle} ${tektur.className}`}>
                  {project.subtitle}
                </h3>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
