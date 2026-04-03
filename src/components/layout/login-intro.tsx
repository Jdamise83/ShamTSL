"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";

const INTRO_VISIBLE_MS = 2000;
const INTRO_HIDE_MS = 320;

interface LoginIntroProps {
  welcomeName: string;
}

type IntroState = "hidden" | "show" | "hide";

export function LoginIntro({ welcomeName }: LoginIntroProps) {
  const searchParams = useSearchParams();
  const [state, setState] = useState<IntroState>("hidden");

  const shouldShow = searchParams.get("intro") === "1";

  const safeWelcomeName = useMemo(() => {
    const trimmed = welcomeName.trim();
    return trimmed.length > 0 ? trimmed : "there";
  }, [welcomeName]);

  useEffect(() => {
    if (!shouldShow) {
      return;
    }

    setState("show");

    const url = new URL(window.location.href);
    url.searchParams.delete("intro");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);

    const hideTimer = window.setTimeout(() => {
      setState("hide");
    }, INTRO_VISIBLE_MS);

    const removeTimer = window.setTimeout(() => {
      setState("hidden");
    }, INTRO_VISIBLE_MS + INTRO_HIDE_MS);

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
      <div className="tsl-login-intro-panel">
        <p className="tsl-login-intro-greeting">
          Hi <span>{safeWelcomeName}</span>
        </p>
        <img
          src="/intro-pablo-welcome.png"
          alt="Pablo welcome visual"
          className="tsl-login-intro-image"
          loading="eager"
        />
      </div>
    </div>
  );
}
