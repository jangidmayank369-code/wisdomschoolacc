import { useEffect, useState } from "react";
import { SchoolLogo } from "./SchoolLogo";

export const WELCOME_EVENT = "wps:welcome";

export function BrandExperience() {
  const [screen, setScreen] = useState<"splash" | "welcome" | null>("splash");
  const [name, setName] = useState("");

  useEffect(() => {
    const welcome = (event: Event) => {
      setName((event as CustomEvent<string>).detail || "");
      setScreen("welcome");
    };
    const reopen = (event: PageTransitionEvent) => { if (event.persisted) setScreen("splash"); };
    window.addEventListener(WELCOME_EVENT, welcome);
    window.addEventListener("pageshow", reopen);
    return () => {
      window.removeEventListener(WELCOME_EVENT, welcome);
      window.removeEventListener("pageshow", reopen);
    };
  }, []);

  useEffect(() => {
    if (!screen) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => setScreen(null), reduced ? 250 : 1450);
    return () => window.clearTimeout(timer);
  }, [screen]);

  if (!screen) return null;
  return (
    <div key={screen} className="brand-screen no-print" role="status" aria-live="polite" aria-label={screen === "splash" ? "WPS Doomra splash" : "Personalized welcome"}>
      <div className="brand-screen-content">
        <SchoolLogo className="brand-splash-logo" />
        {screen === "splash" ? <><h1 className="mt-5 text-2xl font-extrabold">WPS DOOMRA</h1><p className="mt-2 text-sm font-medium">School Management ERP</p></> : <><h1 className="mt-4 break-words text-2xl font-bold">Welcome{name ? `, ${name}` : ""} 👋</h1><p className="mt-3 text-sm">WPS Doomra ERP</p></>}
      </div>
    </div>
  );
}