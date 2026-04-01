import { Suspense } from "react";
import LoginClient from "./login-client";

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <LoginClient />
    </Suspense>
  );
}