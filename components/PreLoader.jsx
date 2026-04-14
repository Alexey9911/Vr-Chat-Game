import React, { useEffect, useRef, useState } from "react";
import gsap from "gsap";

/**
 * PreLoader — Loading screen with bouncing bar animation.
 * 
 * Props:
 * - sceneProgress: 0-100 from ProgressReporter inside Canvas
 * - isSceneLoaded: true when 3D assets >= 75% threshold
 * - onComplete: called when exit animation finishes (remove loader)
 * - onIntroStart: called ~250ms before exit finishes (start camera/scroll)
 */
export default function PreLoader({ sceneProgress = 0, isSceneLoaded = false, onComplete, onIntroStart }) {
  const [isComplete, setIsComplete] = useState(false);
  
  // Refs
  const overlayRef = useRef(null);
  const barRef = useRef(null);
  const tlRef = useRef(null);
  const isPausedRef = useRef(false);
  
  // Whether the timeline has been paused at the gate point
  const isPausedAtGateRef = useRef(false);
  
  // Track if we've already checked initial load state
  const hasCheckedInitialLoad = useRef(false);

  // Can resume: scene is at least 50% loaded OR fully loaded
  const canResume = sceneProgress >= 50 || isSceneLoaded;

  // Resume the timeline when the gate condition is met
  useEffect(() => {
    if (canResume && isPausedAtGateRef.current && tlRef.current) {
      isPausedAtGateRef.current = false;
      // Small buffer for visual smoothness
      setTimeout(() => {
        if (tlRef.current) tlRef.current.resume();
      }, 100);
    }
  }, [canResume]);

  // Visibility pause — prevent desync when tab is hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      isPausedRef.current = document.hidden;
      document.hidden
        ? gsap.globalTimeline.pause()
        : gsap.globalTimeline.resume();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      gsap.globalTimeline.resume(); // Always resume on cleanup
    };
  }, []);

  useEffect(() => {
    // Prevent multiple timelines on hot-reload
    if (tlRef.current) return;

    // Check if assets are already loaded from cache (instant load scenario)
    const isInstantLoad = sceneProgress >= 50 || isSceneLoaded;
    hasCheckedInitialLoad.current = true;

    const tl = gsap.timeline({
      onComplete: () => {
        setIsComplete(true);
        if (onComplete) onComplete();
      }
    });
    
    tlRef.current = tl;

    // Initial bar setup
    gsap.set(barRef.current, { width: 2, height: 0 });

    // Jump 1
    tl.to(barRef.current, { height: "12vh", duration: 0.1, ease: "power1.out" })
      .to(barRef.current, { height: "8vh", duration: 0.05, ease: "power1.in" })
      .to({}, { duration: 0.1 }); // pause

    // Jump 2
    tl.to(barRef.current, { height: "25vh", duration: 0.1, ease: "power1.out" })
      .to(barRef.current, { height: "22vh", duration: 0.05, ease: "power1.in" })
      .to({}, { duration: 0.15 }); // pause
      
    // Jump 3
    tl.to(barRef.current, { height: "42vh", duration: 0.1, ease: "power1.out" })
      .to(barRef.current, { height: "38vh", duration: 0.05, ease: "power1.in" })
      .to({}, { duration: 0.2 }); // pause

    // Jump 4 — ~50% of the visual timeline
    tl.to(barRef.current, { height: "58vh", duration: 0.15, ease: "power1.out" })
      .to(barRef.current, { height: "54vh", duration: 0.05, ease: "power1.in" })
      // === GATE: Pause here if 3D scene is not 50% loaded yet ===
      .add(() => {
        // If instant load (from cache), skip the gate entirely
        if (isInstantLoad) {
          return;
        }
        // Otherwise check current state
        const currentProgress = sceneProgress;
        const currentLoaded = isSceneLoaded;
        if (currentProgress < 50 && !currentLoaded) {
          tl.pause();
          isPausedAtGateRef.current = true;
          // The useEffect above will resume when canResume becomes true
        }
      })
      .to({}, { duration: 0.3 }); // pause

    // === CONTINUES AFTER 50% GATE ===
    
    // Jump 5
    tl.to(barRef.current, { height: "75vh", duration: 0.15, ease: "power1.out" })
      .to(barRef.current, { height: "72vh", duration: 0.05, ease: "power1.in" })
      .to({}, { duration: 0.3 }); // pause

    // Jump 6
    tl.to(barRef.current, { height: "90vh", duration: 0.15, ease: "power1.out" })
      .to(barRef.current, { height: "87vh", duration: 0.05, ease: "power1.in" })
      .to({}, { duration: 0.15 }); // pause

    // Final Jump
    tl.to(barRef.current, { height: "100vh", duration: 0.1, ease: "power1.in" });

    // Horizontal expansion
    tl.to(barRef.current, { 
      width: "100vw", 
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      backdropFilter: "blur(6px)",
      duration: 0.7, 
      ease: "expo.inOut" 
    });

    // Fire onIntroStart ~250ms before fade-out ends (camera can start animating)
    tl.add(() => {
      if (onIntroStart) onIntroStart();
    }, "-=0.25");

    // Final reveal (fade out)
    tl.to(overlayRef.current, { 
      opacity: 0, 
      duration: 1.0, 
      ease: "power2.inOut" 
    }, "-=0.2");

    return () => {
      if (tlRef.current) {
        tlRef.current.kill();
        tlRef.current = null;
      }
    };
  }, [onComplete, onIntroStart, sceneProgress, isSceneLoaded]);

  if (isComplete) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[99999] flex items-center justify-center overflow-hidden"
      style={{ backgroundColor: "black" }}
    >
      <div 
        ref={barRef}
        className="bg-white"
        style={{ 
          transformOrigin: "50% 50%",
          willChange: "width, height, background-color, backdrop-filter"
        }} 
      />
    </div>
  );
}
