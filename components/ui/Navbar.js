import { useState } from 'react'
import Link from 'next/link'
import { orbitron, spaceGrotesk } from '@/lib/fonts'
import { Twitter, Github, BookOpen, Menu, X, Send, ArrowRight } from 'lucide-react'
import NeyrsLogo from '@/components/NeyrsLogo'
import Image from 'next/image'
import { RainbowButton } from '@/components/ui/rainbow-button' // Replace border-gradient
import { usePageTransition } from '@/components/PageTransition/PageTransition'


export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { navigateWithTransition } = usePageTransition()

  return (
    <>
      {/* Desktop & Mobile Navbar */}
      <div className="pointer-events-none fixed left-0 right-0 top-0 z-[6]">
        <div 
          className="pointer-events-auto flex w-full items-center justify-between px-6 py-4 md:px-12 md:py-5"
          style={{
            background: 'linear-gradient(to bottom, rgba(0, 0, 0, 0.9) 0%, rgba(0, 0, 0, 0.6) 30%, rgba(0, 0, 0, 0) 100%)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
        >
          {/* Logo */}
          <Link href="/" data-nav-item className="flex items-center gap-3 cursor-pointer group">
            <div 
              className="btn-premium-shiny h-8 w-8 rounded-lg flex items-center justify-center p-[6px]"
            >
              <NeyrsLogo width={20} height={15} className="text-white relative z-10" />
              <span className="sweep-glass" style={{ animationDelay: '0s' }} />
            </div>
            <div className={`text-sm uppercase tracking-[0.35em] text-white/95 transition-colors duration-300 group-hover:text-white md:text-base ${orbitron.className}`}>
              Neyrs
            </div>
          </Link>
          
          {/* Desktop Links */}
          <div className={`hidden items-center gap-8 text-xs uppercase tracking-[0.32em] text-white/75 lg:flex ${spaceGrotesk.className}`}>
            <a 
              href="https://x.com/ansemshouse" 
              target="_blank" 
              rel="noopener noreferrer"
              data-nav-item
              className="cursor-pointer transition-all duration-300 hover:text-white/95"
            >
              Twitter
            </a>
            <a 
              href="https://t.me/NeyrsDeFI" 
              target="_blank" 
              rel="noopener noreferrer"
              data-nav-item
              className="cursor-pointer transition-all duration-300 hover:text-white/95"
            >
              Telegram
            </a>
            <a 
              href="https://docs.neyrs.cloud" 
              target="_blank" 
              rel="noopener noreferrer"
              data-nav-item
              className="cursor-pointer transition-all duration-300 hover:text-white/95"
            >
              Docs
            </a>
            <a 
              href="https://github.com/Neyrspmnd/neyrs-repo" 
              target="_blank" 
              rel="noopener noreferrer"
              data-nav-item
              className="cursor-pointer transition-all duration-300 hover:text-white/95"
            >
              Github
            </a>
          </div>
          
          {/* CTA Buttons - Desktop */}
          <div className="hidden items-center gap-3 lg:flex">
            <a
              href="https://pump.fun/coin/2ejHHqpgQUVeFCBXNB5sH8RdVC9BGeKP4MkAgc6Zpump"
              target="_blank"
              rel="noopener noreferrer"
              data-nav-item
            >
              <button
                 className="group relative flex items-center gap-2 rounded-md px-4 py-2.5 text-xs uppercase tracking-[0.28em] font-bold overflow-hidden transition-all duration-300 hover:scale-105"
                 style={{
                   background: 'linear-gradient(135deg, #5FCB87 0%, #84EFAB 100%)',
                   color: '#15161B',
                 }}
               >
                 <span className="relative z-10 transition-colors duration-300">
                   PUMP.FUN
                 </span>
                 <Image src="/pumpfun.png" alt="Pump.fun" width={16} height={16} className="relative z-10 transition-all duration-300 group-hover:scale-125" />
              </button>
            </a>

            <div
              onClick={() => navigateWithTransition('/chat')}
              data-nav-item
              className="cursor-pointer"
            >
              <RainbowButton
                 className="group flex items-center gap-2 rounded-md px-5 py-2.5 text-xs uppercase tracking-[0.3em] text-black font-bold"
               >
                 <span className="relative z-10 transition-colors duration-300">
                   Get Started
                 </span>
                 <ArrowRight size={16} className="relative z-10 transition-transform duration-300 group-hover:translate-x-1 text-black" />
              </RainbowButton>
            </div>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            data-nav-item
            className="lg:hidden text-white/80 transition-colors duration-300 hover:text-white"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div 
            className="pointer-events-auto lg:hidden"
            style={{
              background: 'linear-gradient(to bottom, rgba(0, 0, 0, 0.95) 0%, rgba(0, 0, 0, 0.85) 100%)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
            }}
          >
            <div className={`flex flex-col gap-6 px-6 py-8 text-sm uppercase tracking-[0.32em] text-white/75 ${spaceGrotesk.className}`}>
              <a 
                href="https://x.com/ansemshouse" 
                target="_blank" 
                rel="noopener noreferrer"
                className="transition-colors duration-300 hover:text-white/95"
                onClick={() => setMobileMenuOpen(false)}
              >
                Twitter
              </a>
              <a 
                href="https://t.me/NeyrsDeFI" 
                target="_blank" 
                rel="noopener noreferrer"
                className="transition-colors duration-300 hover:text-white/95"
                onClick={() => setMobileMenuOpen(false)}
              >
                Telegram
              </a>
              <a 
                href="https://docs.neyrs.cloud" 
                target="_blank" 
                rel="noopener noreferrer"
                className="transition-colors duration-300 hover:text-white/95"
                onClick={() => setMobileMenuOpen(false)}
              >
                Docs
              </a>
              <a 
                href="https://github.com/Neyrspmnd/neyrs-repo" 
                target="_blank" 
                rel="noopener noreferrer"
                className="transition-colors duration-300 hover:text-white/95"
                onClick={() => setMobileMenuOpen(false)}
              >
                Github
              </a>
              
              <a
                href="https://pump.fun/coin/2ejHHqpgQUVeFCBXNB5sH8RdVC9BGeKP4MkAgc6Zpump"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMobileMenuOpen(false)}
              >
               <button
                  className="group relative flex w-full items-center justify-center gap-2 rounded-lg px-6 py-3 text-center text-xs uppercase tracking-[0.28em] font-bold mt-4 overflow-hidden transition-all duration-300 hover:scale-105"
                  style={{
                    background: 'linear-gradient(135deg, #5FCB87 0%, #84EFAB 100%)',
                    color: '#15161B',
                  }}
                >
                  <span className="relative z-10">
                    PUMP.FUN
                  </span>
                  <Image src="/pumpfun.png" alt="Pump.fun" width={16} height={16} className="relative z-10 transition-all duration-300 group-hover:scale-125" />
               </button>
              </a>

              <div
                onClick={() => { setMobileMenuOpen(false); navigateWithTransition('/chat'); }}
                className="cursor-pointer"
              >
               <RainbowButton
                  className="group flex w-full items-center justify-center gap-2 rounded-lg px-6 py-3 text-center text-xs uppercase tracking-[0.3em] text-black font-bold"
                >
                  <span className="relative z-10 transition-colors duration-300">
                    Get Started
                  </span>
                  <ArrowRight size={16} className="relative z-10 transition-transform duration-300 group-hover:translate-x-1 text-black" />
               </RainbowButton>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Social Icons - Horizontal on Desktop, Vertical on Mobile */}
      <div className="pointer-events-none fixed bottom-6 right-6 z-[6] md:bottom-8 md:right-8">
        <div className="flex flex-col gap-3 md:flex-row md:gap-3">
          <a
            href="https://x.com/ansemshouse"
            target="_blank"
            rel="noopener noreferrer"
            data-social-icon
            className="pointer-events-auto group"
          >
            <div
              className="btn-premium-shiny flex h-10 w-10 items-center justify-center rounded-full"
            >
              <Twitter size={18} className="relative z-10 text-white/70 transition-colors duration-300 group-hover:text-white/95" />
              <span className="sweep-glass" style={{ animationDelay: '1s' }} />
            </div>
          </a>
          <a
            href="https://t.me/NeyrsDeFI"
            target="_blank"
            rel="noopener noreferrer"
            data-social-icon
            className="pointer-events-auto group"
          >
            <div
              className="btn-premium-shiny flex h-10 w-10 items-center justify-center rounded-full"
            >
              <Send size={18} className="relative z-10 text-white/70 transition-colors duration-300 group-hover:text-white/95" />
              <span className="sweep-glass" style={{ animationDelay: '2s' }} />
            </div>
          </a>
          <a
            href="https://github.com/Neyrspmnd/neyrs-repo"
            target="_blank"
            rel="noopener noreferrer"
            data-social-icon
            className="pointer-events-auto group"
          >
            <div
              className="btn-premium-shiny flex h-10 w-10 items-center justify-center rounded-full"
            >
              <Github size={18} className="relative z-10 text-white/70 transition-colors duration-300 group-hover:text-white/95" />
              <span className="sweep-glass" style={{ animationDelay: '3s' }} />
            </div>
          </a>
          <a
            href="https://docs.neyrs.cloud"
            target="_blank"
            rel="noopener noreferrer"
            data-social-icon
            className="pointer-events-auto group"
          >
            <div
              className="btn-premium-shiny flex h-10 w-10 items-center justify-center rounded-full"
            >
              <BookOpen size={18} className="relative z-10 text-white/70 transition-colors duration-300 group-hover:text-white/95" />
              <span className="sweep-glass" style={{ animationDelay: '4s' }} />
            </div>
          </a>
        </div>
      </div>
    </>
  )
}
