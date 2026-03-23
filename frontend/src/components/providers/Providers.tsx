"use client";

import { HeroUIProvider } from "@heroui/react";
import { ThemeProvider } from "next-themes";
import AuthProvider from "@/src/components/providers/AuthProvider";
import { Toaster } from "@/src/components/ui/sonner";
import { OfflineBanner } from "@/src/components/common";
import KeyboardShortcutsModal from "@/src/components/common/KeyboardShortcutsModal";
import { useKeyboardShortcuts } from "@/src/hooks/useKeyboardShortcuts";

function GlobalShortcuts() {
  const { showHelp, setShowHelp } = useKeyboardShortcuts();
  return (
    <KeyboardShortcutsModal
      open={showHelp}
      onClose={() => setShowHelp(false)}
    />
  );
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
    >
      <HeroUIProvider>
        <AuthProvider>
          <OfflineBanner />
          {children}
          <GlobalShortcuts />
        </AuthProvider>
        <Toaster />
      </HeroUIProvider>
    </ThemeProvider>
  );
}
