"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";

const INTRO_HOLD_MS = 5000;
const INTRO_FADE_MS = 3000;

interface LoginIntroProps {
  welcomeName: string;
}

type IntroState = "hidden" | "show" | "hide";

export function LoginIntro({ welcomeName }: LoginIntroProps) {
  const searchParams = useSearchParams();
  const hasStartedRef = useRef(false);
  const [state, setState] = useState<IntroState>("hidden");

  const shouldShow = searchParams.get("intro") === "1";

  const safeWelcomeName = useMemo(() => {
    const trimmed = welcomeName.trim();
    return trimmed.length > 0 ? trimmed : "there";
  }, [welcomeName]);

  useEffect(() => {
    if (!shouldShow || hasStartedRef.current) {
      return;
    }
    hasStartedRef.current = true;

    setState("show");

    const hideTimer = window.setTimeout(() => {
      setState("hide");
    }, INTRO_HOLD_MS);

    const removeTimer = window.setTimeout(() => {
      setState("hidden");
      const url = new URL(window.location.href);
      url.searchParams.delete("intro");
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    }, INTRO_HOLD_MS + INTRO_FADE_MS);

    return () => {
      window.clearTimeout(hideTimer);
      window.clearTimeout(removeTimer);
    };
  }, [shouldShow]);

  if (state === "hidden") {
    return null;
  }

  return (
    <div className={cn("tsl-login-intro", state === "hide" && "tsl-login-intro--hide")}>
      <img
        src="/intro-beach-welcome.png"
        alt="Welcome intro background"
        className="tsl-login-intro-background"
        loading="eager"
      />
      <div className="tsl-login-intro-panel">
        <p className="tsl-login-intro-greeting">
          Hi <span>{safeWelcomeName}</span>
        </p>
      </div>
    </div>
  );
}
