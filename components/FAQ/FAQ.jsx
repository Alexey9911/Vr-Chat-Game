'use client'

import { useState, useEffect, useRef } from 'react'
import { orbitron, tektur, spaceGrotesk } from '@/lib/fonts'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus } from 'lucide-react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import styles from './FAQ.module.css'

const faqs = [
  {
    question: 'What is Neyrs AI?',
    answer: 'Neyrs is a next-generation AI agent framework designed to orchestrate complex on-chain interactions and real-time multimodal data synthesis across the Solana ecosystem.',
  },
  {
    question: 'How does Emotion AI work within the platform?',
    answer: 'Our proprietary Emotion AI utilizes advanced sentiment analysis and prosodic voice decoding to gauge user intent and mood, enabling the agent to adapt its response latency, tone, and action pathways dynamically.',
  },
  {
    question: 'Is the platform entirely decentralized?',
    answer: 'Yes, Neyrs leverages decentralized infrastructure for core computation and data verification. Key features are executed via smart contracts on Solana, ensuring transparent, immutable, and high-speed operations.',
  },
  {
    question: 'Can I integrate Neyrs into my own protocols?',
    answer: 'Absolutely. We provide a comprehensive developer SDK and robust documentation (accessible via neyrs.cloud) to allow seamless integration into existing decentralized applications, trading bots, and analytic dashboards.',
  },
]

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState(null)
  const [isReady, setIsReady] = useState(false)
  const containerRef = useRef(null)

  const toggleOpen = (index) => {
    setOpenIndex(openIndex === index ? null : index)
  }

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
      gsap.fromTo('.faq-title-anim',
        { opacity: 0, y: 50 },
        {
          opacity: 1, y: 0,
          duration: 0.8,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: '.faq-title-anim',
            start: 'top 85%',
          }
        }
      )

      // FAQ Items Animation (Staggered)
      const faqItems = gsap.utils.toArray('.faq-item-anim')
      
      ScrollTrigger.create({
        trigger: '.faq-list-container',
        start: 'top 85%',
        onEnter: () => {
          gsap.fromTo(faqItems,
            { opacity: 0, y: 30 },
            {
              opacity: 1, y: 0,
              duration: 0.6,
              stagger: 0.1,
              ease: 'power3.out',
            }
          )
        },
        once: true
      })
    }, containerRef)

    return () => ctx.revert()
  }, [isReady])

  return (
    <section ref={containerRef} className="relative w-full bg-black py-20 pb-40 md:py-32">
      {/* Container echoing the Featured Projects layout */}
      <div className={styles.gridLayout}>
        {/* Sticky Header Container */}
        <div className={`${styles.stickyHeader} col-span-full md:col-span-4`} style={{ zIndex: 10 }}>
          <h2 className={`${styles.title} faq-title-anim`}>
            <span className={tektur.className}>FAQ</span>
          </h2>
        </div>

        {/* Scrollable Questions List */}
        <div className={`${styles.faqList} col-span-full md:col-span-8 faq-list-container`}>
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index

            return (
              <div
                key={index}
                className={`${styles.faqItem} faq-item-anim`}
              >
                <button
                  onClick={() => toggleOpen(index)}
                  className={styles.questionButton}
                >
                  <span className={`${styles.questionText} ${orbitron.className}`}>
                     {faq.question}
                  </span>
                  <motion.div
                    animate={{ rotate: isOpen ? 45 : 0 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className={styles.iconContainer}
                  >
                    <Plus className="text-white/60" size={24} />
                  </motion.div>
                </button>
                
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden"
                    >
                      <p className={`${styles.answerText} ${spaceGrotesk.className}`}>
                        {faq.answer}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
