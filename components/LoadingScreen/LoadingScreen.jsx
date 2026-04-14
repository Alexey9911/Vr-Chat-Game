import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

/**
 * LoadingScreen — Nolvi visual design + Havn sync logic.
 *
 * Props (havn pattern):
 * - sceneProgress: 0-100 from ProgressReporter inside Canvas
 * - isSceneLoaded: true when 3D assets >= 75% threshold
 * - onComplete: called when exit animation finishes (remove loader)
 * - onIntroStart: called ~1.5s before exit finishes (start camera/scroll)
 *
 * Sync logic:
 * - Phase 1 (intro): header, marquee, footer flickers + counter "00" appears
 * - PAUSE at ~1.5s if scene < 50% loaded (marquee keeps animating)
 * - Phase 2 (counter jumps): 00 → 32 → 55 → 75 → 99 with progress bar
 * - Phase 3 (exit): synchronized flickers → fade out → bg fade → done
 */
export default function LoadingScreen({ sceneProgress = 0, isSceneLoaded = false, onComplete, onIntroStart }) {
  const containerRef = useRef(null);
  const counterRef = useRef(null);
  const bgRef = useRef(null);
  const marqueeTrackRef = useRef(null);
  const headerSmallRef = useRef(null);
  const headerBoldRef = useRef(null);
  const progressBarRef = useRef(null);
  const footerTextsRef = useRef([]);

  // Sync refs (havn pattern — avoids stale closures + prevents timeline re-creation)
  const mainTlRef = useRef(null);
  const marqueeTlRef = useRef(null);
  const isPausedAtGateRef = useRef(false);
  const hasPausedRef = useRef(false);
  const introStartFiredRef = useRef(false);
  const canResumeRef = useRef(false);
  const fallbackTimeoutRef = useRef(null);
  const onCompleteRef = useRef(onComplete);
  const onIntroStartRef = useRef(onIntroStart);

  // Keep callback refs fresh without re-creating timeline
  useEffect(() => {
    onCompleteRef.current = onComplete;
    onIntroStartRef.current = onIntroStart;
  }, [onComplete, onIntroStart]);

  // Update canResume ref and resume if paused at gate (havn pattern)
  useEffect(() => {
    canResumeRef.current = sceneProgress >= 50 || isSceneLoaded;

    if (canResumeRef.current && isPausedAtGateRef.current && mainTlRef.current) {
      isPausedAtGateRef.current = false;
      if (fallbackTimeoutRef.current) {
        clearTimeout(fallbackTimeoutRef.current);
        fallbackTimeoutRef.current = null;
      }
      // Small buffer for visual smoothness
      setTimeout(() => {
        if (mainTlRef.current) mainTlRef.current.play();
      }, 100);
    }
  }, [sceneProgress, isSceneLoaded]);

  // Visibility pause (havn pattern — prevent desynced animations when tab hidden)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        gsap.globalTimeline.pause();
      } else {
        gsap.globalTimeline.resume();
        // Re-pause main timeline if still waiting at gate
        // (globalTimeline.resume would have resumed it)
        if (isPausedAtGateRef.current && mainTlRef.current) {
          mainTlRef.current.pause();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      gsap.globalTimeline.resume();
    };
  }, []);

  // Main timeline — runs ONCE (empty deps prevents the re-creation bug)
  useEffect(() => {
    if (mainTlRef.current) return;

    let marqueeTl = null;

    // Add loading-active class for extra scroll protection
    document.documentElement.classList.add('loading-active');

    // Main GSAP timeline
    const tl = gsap.timeline({
      onComplete: () => {
        document.documentElement.classList.remove('loading-active');
        if (typeof onCompleteRef.current === 'function') {
          onCompleteRef.current();
        }
      },
      onUpdate: function () {
        // Fire onIntroStart ~1.35s before loading ends (at ~5.2s of ~6.56s total)
        if (this.time() >= 5.208 && !introStartFiredRef.current) {
          introStartFiredRef.current = true;
          if (typeof onIntroStartRef.current === 'function') {
            onIntroStartRef.current();
          }
        }

        // At ~1.5s, pause and wait for scene to load (if not already loaded)
        if (this.time() >= 1.5 && !hasPausedRef.current) {
          hasPausedRef.current = true;

          if (!canResumeRef.current) {
            this.pause();
            isPausedAtGateRef.current = true;

            // Fallback: continue after 8s even if scene hasn't loaded
            fallbackTimeoutRef.current = setTimeout(() => {
              if (isPausedAtGateRef.current && mainTlRef.current) {
                isPausedAtGateRef.current = false;
                mainTlRef.current.play();
              }
            }, 8000);
          }
          // If canResumeRef is already true (fast/cached load), don't pause at all
        }
      },
    });

    mainTlRef.current = tl;

    // Counter jump values and positions
    const dashValues = ['00', '32', '55', '75', '99'];

    const updateMarqueePercent = (value) => {
      if (marqueeTrackRef.current) {
        const marqueePercents = marqueeTrackRef.current.querySelectorAll('.marquee-percent');
        marqueePercents.forEach(el => {
          el.textContent = value;
        });
      }
    };

    const isMobile = window.innerWidth <= 768;
    const positions = isMobile
      ? ['18%', '34%', '50%', '66%', '82%']
      : ['12%', '31%', '50%', '69%', '88%'];

    // ─── MARQUEE: independent animation that NEVER pauses with main tl ───
    const marqueeTrack = marqueeTrackRef.current;
    if (marqueeTrack) {
      const allMarqueeItems = marqueeTrack.querySelectorAll('.marquee-item');
      gsap.set(allMarqueeItems, { opacity: 0 });

      const totalWidth = marqueeTrack.scrollWidth;
      const halfWidth = totalWidth / 2;

      marqueeTl = gsap.fromTo(marqueeTrack,
        { x: -halfWidth },
        { x: 0, duration: 35, ease: 'none', repeat: -1 }
      );
      marqueeTlRef.current = marqueeTl;
    }

    // ═══════════════════════════════════════════════════════
    // PHASE 1: INTRO ANIMATIONS (0s – 1.5s)
    // Header flickers, marquee items flicker in, footer, counter "00" appears
    // ═══════════════════════════════════════════════════════

    tl
      // Initial setup
      .set(counterRef.current, { left: positions[0], xPercent: -50 })
      .set(progressBarRef.current, { width: '0%', opacity: 0 })

      // HEADER FLICKERS
      .to({}, { duration: 0.4 }, 0)
      .set(headerSmallRef.current, { opacity: 0.7 }, 0.4)
      .set(headerSmallRef.current, { opacity: 0 }, 0.52)
      .set(headerSmallRef.current, { opacity: 0.7 }, 0.62)
      .to({}, { duration: 0.05 }, 0.62)
      .set(headerBoldRef.current, { opacity: 1 }, 0.67)
      .set(headerBoldRef.current, { opacity: 0 }, 0.79)
      .set(headerBoldRef.current, { opacity: 1 }, 0.89)

      // Set initial counter text
      .call(() => {
        if (counterRef.current) counterRef.current.textContent = dashValues[0];
        updateMarqueePercent(dashValues[0]);
      }, null, 0)

      // MARQUEE ITEMS FLICKER IN (staggered pairs, compressed before 1.5s)
      .call(() => {
        if (!marqueeTrackRef.current) return;
        const items = marqueeTrackRef.current.querySelectorAll('.marquee-item');
        [3, 9].forEach(i => {
          if (items[i]) gsap.timeline().set(items[i], { opacity: 1 }).set(items[i], { opacity: 0 }, '+=0.08').set(items[i], { opacity: 1 }, '+=0.06');
        });
        if (footerTextsRef.current[0]) {
          gsap.timeline().set(footerTextsRef.current[0], { opacity: 1 }).set(footerTextsRef.current[0], { opacity: 0 }, '+=0.08').set(footerTextsRef.current[0], { opacity: 1 }, '+=0.06');
        }
      }, null, 0.7)

      .call(() => {
        if (!marqueeTrackRef.current) return;
        const items = marqueeTrackRef.current.querySelectorAll('.marquee-item');
        [0, 6].forEach(i => {
          if (items[i]) gsap.timeline().set(items[i], { opacity: 1 }).set(items[i], { opacity: 0 }, '+=0.08').set(items[i], { opacity: 1 }, '+=0.06');
        });
        if (footerTextsRef.current[1]) {
          gsap.timeline().set(footerTextsRef.current[1], { opacity: 1 }).set(footerTextsRef.current[1], { opacity: 0 }, '+=0.08').set(footerTextsRef.current[1], { opacity: 1 }, '+=0.06');
        }
      }, null, 0.85)

      .call(() => {
        if (!marqueeTrackRef.current) return;
        const items = marqueeTrackRef.current.querySelectorAll('.marquee-item');
        [5, 11].forEach(i => {
          if (items[i]) gsap.timeline().set(items[i], { opacity: 1 }).set(items[i], { opacity: 0 }, '+=0.08').set(items[i], { opacity: 1 }, '+=0.06');
        });
        if (footerTextsRef.current[2]) {
          gsap.timeline().set(footerTextsRef.current[2], { opacity: 1 }).set(footerTextsRef.current[2], { opacity: 0 }, '+=0.08').set(footerTextsRef.current[2], { opacity: 1 }, '+=0.06');
        }
      }, null, 1.0)

      .call(() => {
        if (!marqueeTrackRef.current) return;
        const items = marqueeTrackRef.current.querySelectorAll('.marquee-item');
        [1, 7].forEach(i => {
          if (items[i]) gsap.timeline().set(items[i], { opacity: 1 }).set(items[i], { opacity: 0 }, '+=0.08').set(items[i], { opacity: 1 }, '+=0.06');
        });
      }, null, 1.15)

      .call(() => {
        if (!marqueeTrackRef.current) return;
        const items = marqueeTrackRef.current.querySelectorAll('.marquee-item');
        [4, 10].forEach(i => {
          if (items[i]) gsap.timeline().set(items[i], { opacity: 1 }).set(items[i], { opacity: 0 }, '+=0.08').set(items[i], { opacity: 1 }, '+=0.06');
        });
      }, null, 1.3)

      .call(() => {
        if (!marqueeTrackRef.current) return;
        const items = marqueeTrackRef.current.querySelectorAll('.marquee-item');
        [2, 8].forEach(i => {
          if (items[i]) gsap.timeline().set(items[i], { opacity: 1 }).set(items[i], { opacity: 0 }, '+=0.08').set(items[i], { opacity: 1 }, '+=0.06');
        });
      }, null, 1.45)

      // COUNTER "00" APPEARS WITH FLICKER
      .to({}, { duration: 1.2 }, 0)
      .set(counterRef.current, { opacity: 1 }, 1.2)
      .set(counterRef.current, { opacity: 0 }, 1.25)
      .set(counterRef.current, { opacity: 1 }, 1.32)
      .to({}, { duration: 0.4 }, 1.32)

    // ═══════════════════════════════════════════════════════
    // *** PAUSE POINT at ~1.5s (handled by onUpdate above) ***
    // Marquee keeps scrolling independently during pause
    // ═══════════════════════════════════════════════════════

    // ═══════════════════════════════════════════════════════
    // PHASE 2: COUNTER JUMPS + PROGRESS BAR (1.72s – 3.918s)
    // ═══════════════════════════════════════════════════════

      // Progress bar appears
      .set(progressBarRef.current, { opacity: 1 }, 1.72)

      // 00 position
      .to(counterRef.current, {
        left: positions[0], duration: 0.27, ease: 'power4.out',
        onStart: () => { counterRef.current.textContent = dashValues[0]; updateMarqueePercent(dashValues[0]); }
      }, 1.72)
      .to(progressBarRef.current, { width: '0%', duration: 0.27, ease: 'power4.out' }, 1.72)
      .to({}, { duration: 0.066 }, 1.99)

      // Jump to 32
      .to(counterRef.current, {
        left: positions[1], duration: 0.27, ease: 'power4.out',
        onStart: () => { counterRef.current.textContent = dashValues[1]; updateMarqueePercent(dashValues[1]); }
      }, 2.056)
      .to(progressBarRef.current, { width: '32%', duration: 0.27, ease: 'power4.out' }, 2.056)
      .to({}, { duration: 0.066 }, 2.326)

      // Jump to 55
      .to(counterRef.current, {
        left: positions[2], duration: 0.27, ease: 'power4.out',
        onStart: () => { counterRef.current.textContent = dashValues[2]; updateMarqueePercent(dashValues[2]); }
      }, 2.392)
      .to(progressBarRef.current, { width: '55%', duration: 0.27, ease: 'power4.out' }, 2.392)
      .to({}, { duration: 0.066 }, 2.662)

      // Jump to 75
      .to(counterRef.current, {
        left: positions[3], duration: 0.27, ease: 'power4.out',
        onStart: () => { counterRef.current.textContent = dashValues[3]; updateMarqueePercent(dashValues[3]); }
      }, 2.728)
      .to(progressBarRef.current, { width: '75%', duration: 0.27, ease: 'power4.out' }, 2.728)
      .to({}, { duration: 0.65 }, 2.998)

      // Jump to 99
      .to(counterRef.current, {
        left: positions[4], duration: 0.27, ease: 'power4.out',
        onStart: () => { counterRef.current.textContent = dashValues[4]; updateMarqueePercent(dashValues[4]); }
      }, 3.648)
      .to(progressBarRef.current, { width: '100%', duration: 0.27, ease: 'power4.out' }, 3.648)
      .to({}, { duration: 0.4 }, 3.918)

    // ═══════════════════════════════════════════════════════
    // PHASE 3: EXIT — SYNCHRONIZED FLICKERS + FADE OUT
    // ═══════════════════════════════════════════════════════

      // Flicker OFF
      .set([
        counterRef.current, headerSmallRef.current, headerBoldRef.current,
        progressBarRef.current, ...footerTextsRef.current.filter(Boolean)
      ], { opacity: 0 }, 4.318)
      .call(() => {
        if (!marqueeTrackRef.current) return;
        marqueeTrackRef.current.querySelectorAll('.marquee-item').forEach(item => gsap.set(item, { opacity: 0 }));
      }, null, 4.318)

      // Flicker ON
      .set(counterRef.current, { opacity: 1 }, 4.398)
      .set(headerSmallRef.current, { opacity: 0.7 }, 4.398)
      .set(headerBoldRef.current, { opacity: 1 }, 4.398)
      .set(progressBarRef.current, { opacity: 1 }, 4.398)
      .set(footerTextsRef.current.filter(Boolean), { opacity: 1 }, 4.398)
      .call(() => {
        if (!marqueeTrackRef.current) return;
        marqueeTrackRef.current.querySelectorAll('.marquee-item').forEach(item => gsap.set(item, { opacity: 1 }));
      }, null, 4.398)

      // Flicker OFF again
      .set([
        counterRef.current, headerSmallRef.current, headerBoldRef.current,
        progressBarRef.current, ...footerTextsRef.current.filter(Boolean)
      ], { opacity: 0 }, 4.478)
      .call(() => {
        if (!marqueeTrackRef.current) return;
        marqueeTrackRef.current.querySelectorAll('.marquee-item').forEach(item => gsap.set(item, { opacity: 0 }));
      }, null, 4.478)

      // Flicker ON final
      .set(counterRef.current, { opacity: 1 }, 4.558)
      .set(headerSmallRef.current, { opacity: 0.7 }, 4.558)
      .set(headerBoldRef.current, { opacity: 1 }, 4.558)
      .set(progressBarRef.current, { opacity: 1 }, 4.558)
      .set(footerTextsRef.current.filter(Boolean), { opacity: 1 }, 4.558)
      .call(() => {
        if (!marqueeTrackRef.current) return;
        marqueeTrackRef.current.querySelectorAll('.marquee-item').forEach(item => gsap.set(item, { opacity: 1 }));
      }, null, 4.558)

      // FINAL FADE OUT (all elements simultaneously)
      .to(counterRef.current, { opacity: 0, duration: 0.6, ease: 'power2.inOut' }, 4.558)
      .to([headerSmallRef.current, headerBoldRef.current], { opacity: 0, duration: 0.6, ease: 'power2.inOut' }, 4.558)
      .to(progressBarRef.current, { opacity: 0, duration: 0.6, ease: 'power2.inOut' }, 4.558)
      .to(footerTextsRef.current.filter(Boolean), { opacity: 0, duration: 0.6, ease: 'power2.inOut' }, 4.558)
      .call(() => {
        if (!marqueeTrackRef.current) return;
        gsap.to(marqueeTrackRef.current.querySelectorAll('.marquee-item'), { opacity: 0, duration: 0.6, ease: 'power2.inOut' });
      }, null, 4.558)

      // Background fade + container hide
      .to({}, { duration: 0.45 }, 5.158)
      .to(bgRef.current, { opacity: 0, duration: 0.95, ease: 'power2.inOut' }, 5.608)
      .to(containerRef.current, { autoAlpha: 0, duration: 0.15, ease: 'power2.in' }, 6.558);

    return () => {
      document.documentElement.classList.remove('loading-active');
      if (fallbackTimeoutRef.current) clearTimeout(fallbackTimeoutRef.current);
      tl.kill();
      if (marqueeTl) marqueeTl.kill();
      mainTlRef.current = null;
      marqueeTlRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={containerRef} className="loading-screen">
      <div ref={bgRef} className="loading-bg">
        <div className="counter-wrapper">
          <div className="loading-header">
            <span ref={headerSmallRef} className="loading-header-small">PLEASE WAIT /</span>
            <span ref={headerBoldRef} className="loading-header-bold">INITIALIZING DATA...</span>
          </div>
          <div className="loading-marquee">
            <div className="marquee-track" ref={marqueeTrackRef}>
              <span className="marquee-item">+        LOADING: <span className="marquee-percent">00</span>%        +</span>
              <span className="marquee-item">+        LOADING: <span className="marquee-percent">00</span>%        +</span>
              <span className="marquee-item">+        LOADING: <span className="marquee-percent">00</span>%        +</span>
              <span className="marquee-item">+        LOADING: <span className="marquee-percent">00</span>%        +</span>
              <span className="marquee-item">+        LOADING: <span className="marquee-percent">00</span>%        +</span>
              <span className="marquee-item">+        LOADING: <span className="marquee-percent">00</span>%        +</span>
              <span className="marquee-item">+        LOADING: <span className="marquee-percent">00</span>%        +</span>
              <span className="marquee-item">+        LOADING: <span className="marquee-percent">00</span>%        +</span>
              <span className="marquee-item">+        LOADING: <span className="marquee-percent">00</span>%        +</span>
              <span className="marquee-item">+        LOADING: <span className="marquee-percent">00</span>%        +</span>
              <span className="marquee-item">+        LOADING: <span className="marquee-percent">00</span>%        +</span>
              <span className="marquee-item">+        LOADING: <span className="marquee-percent">00</span>%        +</span>
            </div>
          </div>
          <span ref={counterRef} className="counter">00</span>
          <div ref={progressBarRef} className="progress-bar"></div>
          <div className="loading-footer">
            <span ref={el => footerTextsRef.current[0] = el} className="footer-text">// NEYRS.LOADING</span>
            <span ref={el => footerTextsRef.current[1] = el} className="footer-text footer-text-code">{'[F] SCRIPTS() {'}<br/>{'  INITSCENE();'}<br/>{'  INITSCROLL();'}<br/>{'}'}</span>
            <span ref={el => footerTextsRef.current[2] = el} className="footer-text">NEYRS + AI [1] v1.0</span>
          </div>
        </div>
      </div>
    </div>
  );
}
