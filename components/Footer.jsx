'use client'

import Link from 'next/link'
import { Twitter, Github, BookOpen, Send } from 'lucide-react'
import { orbitron, spaceGrotesk } from '@/lib/fonts'
import { motion } from 'framer-motion'
import NeyrsLogo from '@/components/NeyrsLogo'

export default function Footer() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.1,
      }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 40 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.7,
        ease: "easeOut"
      }
    }
  }

  const linkVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: (i) => ({
      opacity: 1,
      x: 0,
      transition: {
        duration: 0.5,
        delay: i * 0.1,
        ease: "easeOut"
      }
    })
  }

  const socialVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: (i) => ({
      opacity: 1,
      scale: 1,
      transition: {
        duration: 0.5,
        delay: i * 0.1,
        ease: "backOut"
      }
    })
  }

  return (
    <footer className="relative w-full border-t border-white/10 bg-black py-12 md:py-16">
      <motion.div 
        className="mx-auto max-w-7xl px-6 md:px-12"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
      >
        <div className="flex flex-col items-center justify-between gap-8 md:flex-row md:items-start">
          {/* Logo & Description */}
          <motion.div 
            variants={itemVariants}
            className="flex flex-col items-center gap-4 md:items-start"
          >
            <Link href="/" className="flex items-center gap-3 group">
              <motion.div
                whileHover={{ scale: 1.05, rotate: 5 }}
                transition={{ duration: 0.3 }}
                className="flex h-10 w-10 items-center justify-center rounded-lg transition-all duration-300"
                style={{
                  background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.06) 100%)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                }}
              >
                <NeyrsLogo width={24} height={18} className="text-white" />
              </motion.div>
              <div className={`text-base uppercase tracking-[0.35em] text-white/95 transition-colors duration-300 group-hover:text-white ${orbitron.className}`}>
                Neyrs
              </div>
            </Link>
            <p className={`max-w-xs text-center text-sm text-white/60 md:text-left ${spaceGrotesk.className}`}>
              Voice-driven AI assistant with real-time synthesis and adaptive intelligence.
            </p>
          </motion.div>

          {/* Links */}
          <motion.div 
            variants={itemVariants}
            className={`flex flex-col items-center gap-4 text-sm uppercase tracking-[0.32em] text-white/75 md:items-start ${spaceGrotesk.className}`}
          >
            <h4 className="text-xs text-white/50">Links</h4>
            {['Twitter', 'Telegram', 'Docs', 'Github'].map((link, i) => {
              const urls = {
                Twitter: 'https://x.com/ansemshouse',
                Telegram: 'https://t.me/NeyrsDeFI',
                Docs: 'https://docs.neyrs.cloud',
                Github: 'https://github.com/Neyrspmnd/neyrs-repo'
              }
              return (
                <motion.a
                  key={link}
                  href={urls[link]}
                  target="_blank"
                  rel="noopener noreferrer"
                  custom={i}
                  variants={linkVariants}
                  whileHover={{ x: 5, color: 'rgba(255, 255, 255, 0.95)' }}
                  className="transition-colors duration-300 hover:text-white/95"
                >
                  {link}
                </motion.a>
              )
            })}
          </motion.div>

          {/* Social Icons */}
          <motion.div 
            variants={itemVariants}
            className="flex flex-col items-center gap-4 md:items-end"
          >
            <h4 className={`text-xs uppercase tracking-[0.32em] text-white/50 ${spaceGrotesk.className}`}>Connect</h4>
            <div className="flex gap-3">
              {[
                { Icon: Twitter, url: 'https://x.com/ansemshouse' },
                { Icon: Send, url: 'https://t.me/NeyrsDeFI' },
                { Icon: Github, url: 'https://github.com/Neyrspmnd/neyrs-repo' },
                { Icon: BookOpen, url: 'https://docs.neyrs.cloud' }
              ].map(({ Icon, url }, i) => (
                <motion.a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  custom={i}
                  variants={socialVariants}
                  whileHover={{ scale: 1.15, rotate: 5 }}
                  whileTap={{ scale: 0.95 }}
                  className="group"
                >
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-lg bg-black transition-all duration-300"
                    style={{
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                    }}
                  >
                    <Icon size={18} className="text-white/70 transition-colors duration-300 group-hover:text-white/95" />
                  </div>
                </motion.a>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Bottom Bar */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.8, delay: 0.5, ease: "easeOut" }}
          className={`mt-12 border-t border-white/10 pt-8 text-center text-xs text-white/50 ${spaceGrotesk.className}`}
        >
          <p>© {new Date().getFullYear()} Neyrs. All rights reserved.</p>
        </motion.div>
      </motion.div>
    </footer>
  )
}
