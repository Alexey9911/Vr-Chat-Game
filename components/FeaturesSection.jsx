'use client'

import Image from 'next/image'
import { orbitron, tektur, plusJakarta } from '@/lib/fonts'
import { motion } from 'framer-motion'

const features = [
  {
    image: '/posters/image1.png',
    title: 'Voice Synthesis',
    subtitle: 'Dynamic prosody and tone control',
    description: 'Natural voice generation with real-time emotion and context adaptation.',
    align: 'left',
  },
  {
    image: '/posters/image2.png',
    title: 'Emotion AI',
    subtitle: 'Mood-aware responses',
    description: 'Adaptive intelligence that understands and responds to emotional context.',
    align: 'right',
  },
  {
    image: '/posters/image3.png',
    title: 'Memory System',
    subtitle: 'Context-aware workflows',
    description: 'Persistent memory that learns preferences and maintains conversation history.',
    align: 'left',
  },
  {
    image: '/posters/image4.png',
    title: 'Real-time Tools',
    subtitle: 'Multimodal capabilities',
    description: 'Image generation, task routing, and autonomous tool orchestration.',
    align: 'right',
  },
]

function FeatureItem({ feature, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.6, delay: index * 0.1, ease: "easeOut" }}
      className={`mb-20 flex flex-col items-center gap-8 md:mb-32 md:flex-row md:gap-16 ${
        feature.align === 'right' ? 'md:flex-row-reverse' : ''
      }`}
    >
      {/* Image */}
      <motion.div 
        initial={{ opacity: 0, x: feature.align === 'left' ? -40 : 40 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.7, delay: index * 0.1 + 0.2, ease: "easeOut" }}
        className="w-full md:w-1/2"
      >
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-white/10 bg-black/40">
          <Image
            src={feature.image}
            alt={feature.title}
            fill
            className="object-contain p-4"
            sizes="(max-width: 768px) 100vw, 50vw"
          />
        </div>
      </motion.div>

      {/* Text */}
      <motion.div 
        initial={{ opacity: 0, x: feature.align === 'left' ? 40 : -40 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.7, delay: index * 0.1 + 0.3, ease: "easeOut" }}
        className={`w-full md:w-1/2 ${feature.align === 'right' ? 'md:text-right' : ''}`}
      >
        <p className={`text-xs uppercase tracking-[0.35em] ${orbitron.className}`}>
          <span className="bg-gradient-to-r from-white/50 via-white/40 to-white/50 bg-clip-text text-transparent">
            {feature.title}
          </span>
        </p>
        <h3 className={`mt-3 text-3xl font-semibold leading-tight md:text-4xl ${tektur.className}`}>
          <span className="bg-gradient-to-br from-white via-white/95 to-white/85 bg-clip-text text-transparent">
            {feature.subtitle}
          </span>
        </h3>
        <p className={`mt-4 text-base leading-relaxed md:text-lg ${plusJakarta.className}`}>
          <span className="text-white/75">{feature.description}</span>
        </p>
      </motion.div>
    </motion.div>
  )
}

export default function FeaturesSection() {
  return (
    <section className="relative w-full bg-black py-20 md:py-32">
      <div className="mx-auto max-w-7xl px-6 md:px-12">
        {features.map((feature, index) => (
          <FeatureItem key={feature.title} feature={feature} index={index} />
        ))}
      </div>
    </section>
  )
}
