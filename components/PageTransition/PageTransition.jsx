import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { gsap } from 'gsap';

/**
 * PageTransition — fullscreen cover transition
 *
 * Flow:
 * 1. navigateWithTransition(href) → overlay slides UP from bottom (label visible)
 * 2. Overlay fully covers screen → router.push() fires (page changes behind overlay)
 * 3. routeChangeComplete → label fades out
 * 4. Overlay slides UP off-screen → new page revealed
 *
 * IMPORTANT: GSAP-controlled properties (visibility, transform, opacity) are NOT
 * in React inline styles. This prevents React re-renders (triggered by route change)
 * from resetting GSAP's DOM mutations.
 */

let _triggerTransition = null;

const ROUTE_LABELS = {
  '/': 'Home',
  '/chat': 'Chat',
};

function getRouteLabel(href) {
  return ROUTE_LABELS[href] || href.replace('/', '').replace(/-/g, ' ') || 'Home';
}

export function usePageTransition() {
  const router = useRouter();

  const navigateWithTransition = useCallback((href) => {
    if (router.asPath === href) return;
    if (_triggerTransition) {
      _triggerTransition(href);
    } else {
      router.push(href);
    }
  }, [router]);

  return { navigateWithTransition };
}

export default function PageTransition() {
  const router = useRouter();
  const overlayRef = useRef(null);
  const labelRef = useRef(null);
  const animatingRef = useRef(false);

  // Initialize overlay as hidden via GSAP (not inline styles)
  useEffect(() => {
    if (overlayRef.current) {
      gsap.set(overlayRef.current, { visibility: 'hidden', yPercent: 100 });
      gsap.set(labelRef.current, { opacity: 0 });
    }
  }, []);

  // Register the shared trigger callback
  useEffect(() => {
    _triggerTransition = (href) => {
      if (animatingRef.current) return;
      animatingRef.current = true;

      const overlay = overlayRef.current;
      const label = labelRef.current;

      if (!overlay) {
        router.push(href);
        animatingRef.current = false;
        return;
      }

      // Set label text
      if (label) label.textContent = getRouteLabel(href);

      // Prepare: position below screen, make visible
      gsap.set(overlay, { visibility: 'visible', yPercent: 100 });
      gsap.set(label, { opacity: 1 });

      // Phase 1: Slide overlay up to cover the screen
      gsap.to(overlay, {
        yPercent: 0,
        duration: 0.45,
        ease: 'power3.inOut',
        onComplete: () => {
          // Screen fully covered — navigate behind the scenes
          gsap.set(overlay, { yPercent: 0 });
          router.push(href);
        },
      });
    };

    return () => { _triggerTransition = null; };
  }, [router]);

  // Listen for route change complete → reveal sequence
  useEffect(() => {
    const handleRouteComplete = () => {
      if (!animatingRef.current) return;

      const overlay = overlayRef.current;
      const label = labelRef.current;
      if (!overlay) {
        animatingRef.current = false;
        return;
      }

      // Safety: re-enforce overlay at full coverage (survives React re-render)
      gsap.set(overlay, { visibility: 'visible', yPercent: 0 });

      // Small settle time for new page to mount behind overlay
      gsap.delayedCall(0.12, () => {
        // Phase 2: Fade out label text
        gsap.to(label, {
          opacity: 0,
          duration: 0.18,
          ease: 'power2.in',
          onComplete: () => {
            // Phase 3: Slide overlay up off-screen (reveal new page)
            gsap.to(overlay, {
              yPercent: -100,
              duration: 0.45,
              ease: 'power3.inOut',
              onComplete: () => {
                // Reset to hidden, parked below screen
                gsap.set(overlay, { visibility: 'hidden', yPercent: 100 });
                animatingRef.current = false;
              },
            });
          },
        });
      });
    };

    const handleRouteError = () => {
      // Reset on navigation failure
      if (animatingRef.current) {
        const overlay = overlayRef.current;
        if (overlay) gsap.set(overlay, { visibility: 'hidden', yPercent: 100 });
        animatingRef.current = false;
      }
    };

    router.events.on('routeChangeComplete', handleRouteComplete);
    router.events.on('routeChangeError', handleRouteError);
    return () => {
      router.events.off('routeChangeComplete', handleRouteComplete);
      router.events.off('routeChangeError', handleRouteError);
    };
  }, [router]);

  /*
   * Only static layout styles in JSX — NO visibility, transform, or opacity.
   * GSAP exclusively controls those so React re-renders can't reset them.
   */
  return (
    <div
      ref={overlayRef}
      id="page-transition-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0A0A0A',
        willChange: 'transform',
      }}
    >
      <span
        ref={labelRef}
        id="page-transition-label"
        style={{
          fontFamily: '"Guti Regular", "Space Grotesk", sans-serif',
          fontSize: 'clamp(14px, 2vw, 18px)',
          letterSpacing: '0.45em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.55)',
        }}
      />
    </div>
  );
}
