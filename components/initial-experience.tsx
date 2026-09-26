"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type ExperiencePhase = "booting" | "leaving" | "complete";
type InitialExperienceProps = { children: React.ReactNode };

const bootStages = [
  { after: 210, progress: 7, status: "INITIALIZING CONTROL PANEL" },
  { after: 470, progress: 24, status: "LOADING CONFIGURATION" },
  { after: 740, progress: 51, status: "CONNECTING SERVICES" },
  { after: 1_010, progress: 78, status: "PREPARING WORKSPACE" },
  { after: 1_280, progress: 94, status: "PREPARING WORKSPACE" },
] as const;

export function InitialExperience({ children }: InitialExperienceProps) {
  const pathname = usePathname();
  const previousPathname = useRef(pathname);
  const [routeTransition, setRouteTransition] = useState(false);
  const [phase, setPhase] = useState<ExperiencePhase>("booting");
  const [status, setStatus] = useState("INITIALIZING CONTROL PANEL");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timers: number[] = [];
    let disposed = false;
    let shellReady = false;
    let minimumElapsed = false;
    let maximumWaitElapsed = false;
    let finished = false;
    let fontsReady = document.fonts.status === "loaded";

    const beginExit = () => {
      if (disposed || finished || !shellReady || (!minimumElapsed && !maximumWaitElapsed)) return;
      finished = true;
      setProgress(100);
      setStatus("READY");
      timers.push(window.setTimeout(() => {
        if (disposed) return;
        setPhase("leaving");
        timers.push(window.setTimeout(() => {
          if (!disposed) setPhase("complete");
        }, reducedMotion ? 90 : 840));
      }, reducedMotion ? 30 : 180));
    };

    const checkReadiness = () => {
      if (disposed || !document.querySelector("main")) return;
      shellReady = true;
      if (maximumWaitElapsed) fontsReady = true;
      if (!fontsReady) return;
      beginExit();
    };

    const mainObserver = new MutationObserver(checkReadiness);
    if (document.body && !document.querySelector("main")) {
      mainObserver.observe(document.body, { childList: true, subtree: true });
    }

    if (!reducedMotion) {
      for (const stage of bootStages) {
        timers.push(window.setTimeout(() => {
          if (disposed || finished) return;
          setProgress(stage.progress);
          setStatus(stage.status);
        }, stage.after));
      }
    }

    const minimumDuration = reducedMotion ? 180 : 1_300;
    timers.push(window.setTimeout(() => {
      minimumElapsed = true;
      if (reducedMotion) {
        setProgress(94);
        setStatus("PREPARING WORKSPACE");
      }
      beginExit();
    }, minimumDuration));

    timers.push(window.setTimeout(() => {
      if (disposed || finished) return;
      maximumWaitElapsed = true;
      setStatus(shellReady ? "READY" : "LOADING CONTROL PANEL");
      setProgress(shellReady ? 100 : 96);
      if (shellReady) {
        fontsReady = true;
        beginExit();
      }
    }, reducedMotion ? 420 : 1_500));

    if (fontsReady) checkReadiness();
    else void document.fonts.ready.then(() => {
      fontsReady = true;
      checkReadiness();
    }).catch(() => {
      fontsReady = true;
      checkReadiness();
    });
    checkReadiness();

    return () => {
      disposed = true;
      mainObserver.disconnect();
      timers.forEach(window.clearTimeout);
    };
  }, []);

  useEffect(() => {
    if (phase !== "complete") {
      previousPathname.current = pathname;
      return;
    }
    if (previousPathname.current === pathname) return;
    previousPathname.current = pathname;
    setRouteTransition(true);
    const timer = window.setTimeout(() => setRouteTransition(false), 220);
    return () => window.clearTimeout(timer);
  }, [pathname, phase]);
  useEffect(() => {
    if (phase !== "complete") return;
    let timer: number | undefined;
    const handleInternalViewClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const link = event.target.closest<HTMLAnchorElement>("a[href]");
      if (!link || link.target === "_blank" || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const destination = new URL(link.href, window.location.href);
      if (destination.origin !== window.location.origin || destination.pathname !== window.location.pathname || destination.search === window.location.search) return;
      setRouteTransition(true);
      if (timer !== undefined) window.clearTimeout(timer);
      timer = window.setTimeout(() => setRouteTransition(false), 220);
    };
    document.addEventListener("click", handleInternalViewClick, true);
    return () => {
      document.removeEventListener("click", handleInternalViewClick, true);
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [phase]);
  useEffect(() => {
    if (phase !== "leaving" && phase !== "complete") return;
    const revealTargets = Array.from(document.querySelectorAll<HTMLElement>(
      ".landing-section .section-heading, .landing-section .feature-card, .landing-section .security-card, .landing-section .stat-card",
    ));
    revealTargets.forEach((element) => element.classList.add("scroll-reveal"));

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
      revealTargets.forEach((element) => element.classList.add("is-revealed"));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-revealed");
        observer.unobserve(entry.target);
      }
    }, { threshold: 0.12, rootMargin: "0px 0px -4% 0px" });

    revealTargets.filter((element) => !element.classList.contains("is-revealed")).forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [phase]);

  useEffect(() => {
    if (phase !== "complete" || window.matchMedia("(prefers-reduced-motion: reduce)").matches || !window.matchMedia("(pointer: fine)").matches) return;
    const landing = document.querySelector<HTMLElement>(".landing");
    const hero = landing?.querySelector<HTMLElement>(".hero");
    if (!landing || !hero) return;

    const moveAmbientLight = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const x = ((event.clientX / Math.max(window.innerWidth, 1)) - 0.5) * 6;
      const y = ((event.clientY / Math.max(window.innerHeight, 1)) - 0.5) * 6;
      landing.style.setProperty("--ambient-x", `${x.toFixed(1)}px`);
      landing.style.setProperty("--ambient-y", `${y.toFixed(1)}px`);
    };
    const resetAmbientLight = () => {
      landing.style.setProperty("--ambient-x", "0px");
      landing.style.setProperty("--ambient-y", "0px");
    };

    hero.addEventListener("pointermove", moveAmbientLight, { passive: true });
    hero.addEventListener("pointerleave", resetAmbientLight, { passive: true });
    return () => {
      hero.removeEventListener("pointermove", moveAmbientLight);
      hero.removeEventListener("pointerleave", resetAmbientLight);
      resetAmbientLight();
    };
  }, [phase]);

  const isLoading = phase === "booting";
  const isLeaving = phase === "leaving";

  return <div className={`initial-experience ${isLoading ? "experience-is-loading" : ""}`}>
    <div
      className={`experience-content ${phase === "booting" ? "is-loading" : isLeaving ? "is-revealing" : "is-visible"} ${routeTransition ? "is-route-transitioning" : ""}`}
      aria-hidden={isLoading || undefined}
      aria-busy={phase === "booting" || undefined}
      inert={isLoading || undefined}
    >
      {children}
    </div>
    {phase !== "complete" && <div className={`initial-loader ${isLeaving ? "is-leaving" : ""}`} role="region" aria-label="ELYRAX initialization" aria-hidden={isLeaving || undefined}>
      <div className="initial-loader-grid" aria-hidden="true"/>
      <div className="loader-meta loader-meta-top" aria-hidden="true"><span>ELYRAX CONTROL</span><span>01 / SYSTEM INITIALIZATION</span></div>
      <div className="loader-meta loader-meta-bottom" aria-hidden="true"><span>ELYRAX DASHBOARD</span><span>SECURE BY DESIGN</span></div>
      <div className="loader-lockup">
        <span className="wordmark-mark initial-loader-mark" aria-hidden="true">E</span>
        <div className="initial-loader-wordmark" aria-hidden="true">ELYRAX</div>
        <div className="initial-loader-readout">
          <div className="initial-loader-status" role="status" aria-live="polite" aria-atomic="true">
            <span className="initial-loader-status-dot" aria-hidden="true"/>
            <span>{status}</span>
          </div>
          <div className="initial-loader-progress-row">
            <div className="initial-loader-track" role="progressbar" aria-label="ELYRAX initialization progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
              <span className="initial-loader-fill" style={{ transform: `scaleX(${progress / 100})` }}/>
            </div>
            <span className="initial-loader-percent" aria-hidden="true">{String(progress).padStart(2, "0")}%</span>
          </div>
        </div>
      </div>
    </div>}
  </div>;
}
