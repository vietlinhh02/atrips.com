"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { motion } from "framer-motion";
import { Sun, Moon, Monitor, Check } from "@phosphor-icons/react";

type ThemeOption = "light" | "dark" | "system";

interface ThemeCardProps {
  value: ThemeOption;
  label: string;
  icon: React.ElementType;
  selected: boolean;
  onSelect: (value: ThemeOption) => void;
  preview: React.ReactNode;
}

function ThemeCard({
  value,
  label,
  icon: Icon,
  selected,
  onSelect,
  preview,
}: ThemeCardProps) {
  return (
    <motion.button
      onClick={() => onSelect(value)}
      className={`
        relative flex flex-col items-center gap-3 rounded-xl border-2
        p-4 transition-colors cursor-pointer
        ${selected
          ? "border-[var(--primary-main)] bg-[var(--primary-surface)]"
          : "border-[var(--neutral-30)] bg-[var(--neutral-10)] hover:border-[var(--neutral-40)]"
        }
      `}
      whileTap={{ scale: 0.98 }}
    >
      {selected && (
        <motion.div
          className="absolute top-2.5 right-2.5 flex h-5 w-5 items-center
            justify-center rounded-full bg-[var(--primary-main)]"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        >
          <Check size={12} weight="bold" className="text-white" />
        </motion.div>
      )}

      {preview}

      <div className="flex items-center gap-2">
        <Icon
          size={18}
          weight={selected ? "fill" : "regular"}
          className={
            selected
              ? "text-[var(--primary-main)]"
              : "text-[var(--neutral-60)]"
          }
        />
        <span
          className={`text-sm font-medium ${
            selected
              ? "text-[var(--primary-main)]"
              : "text-[var(--neutral-100)]"
          }`}
        >
          {label}
        </span>
      </div>
    </motion.button>
  );
}

function LightPreview() {
  return (
    <div className="w-full h-20 rounded-lg overflow-hidden border
      border-neutral-200 bg-white"
    >
      <div className="h-3 bg-[#f5f5f5] border-b border-neutral-200
        flex items-center px-1.5 gap-0.5"
      >
        <div className="w-1 h-1 rounded-full bg-neutral-300" />
        <div className="w-1 h-1 rounded-full bg-neutral-300" />
        <div className="w-1 h-1 rounded-full bg-neutral-300" />
      </div>
      <div className="flex h-[calc(100%-12px)]">
        <div className="w-6 bg-white border-r border-neutral-200 p-1
          flex flex-col gap-0.5"
        >
          <div className="w-full h-1 rounded-full bg-[#073E71]" />
          <div className="w-full h-1 rounded-full bg-neutral-200" />
          <div className="w-full h-1 rounded-full bg-neutral-200" />
        </div>
        <div className="flex-1 p-1.5 flex flex-col gap-1">
          <div className="w-3/4 h-1.5 rounded bg-neutral-200" />
          <div className="w-1/2 h-1 rounded bg-neutral-100" />
          <div className="flex gap-1 mt-auto">
            <div className="w-6 h-2.5 rounded bg-[#073E71]" />
            <div className="w-6 h-2.5 rounded bg-neutral-100" />
          </div>
        </div>
      </div>
    </div>
  );
}

function DarkPreview() {
  return (
    <div className="w-full h-20 rounded-lg overflow-hidden border
      border-neutral-600 bg-[#0f1419]"
    >
      <div className="h-3 bg-[#1a1f26] border-b border-neutral-700
        flex items-center px-1.5 gap-0.5"
      >
        <div className="w-1 h-1 rounded-full bg-neutral-600" />
        <div className="w-1 h-1 rounded-full bg-neutral-600" />
        <div className="w-1 h-1 rounded-full bg-neutral-600" />
      </div>
      <div className="flex h-[calc(100%-12px)]">
        <div className="w-6 bg-[#1a1f26] border-r border-neutral-700 p-1
          flex flex-col gap-0.5"
        >
          <div className="w-full h-1 rounded-full bg-[#5B9BD5]" />
          <div className="w-full h-1 rounded-full bg-neutral-700" />
          <div className="w-full h-1 rounded-full bg-neutral-700" />
        </div>
        <div className="flex-1 p-1.5 flex flex-col gap-1">
          <div className="w-3/4 h-1.5 rounded bg-neutral-700" />
          <div className="w-1/2 h-1 rounded bg-neutral-800" />
          <div className="flex gap-1 mt-auto">
            <div className="w-6 h-2.5 rounded bg-[#5B9BD5]" />
            <div className="w-6 h-2.5 rounded bg-neutral-800" />
          </div>
        </div>
      </div>
    </div>
  );
}

function SystemPreview() {
  return (
    <div className="w-full h-20 rounded-lg overflow-hidden border
      border-neutral-300 dark:border-neutral-600"
    >
      <div className="flex h-full">
        {/* Light half */}
        <div className="w-1/2 bg-white">
          <div className="h-3 bg-[#f5f5f5] border-b border-neutral-200
            flex items-center px-1 gap-0.5"
          >
            <div className="w-1 h-1 rounded-full bg-neutral-300" />
            <div className="w-1 h-1 rounded-full bg-neutral-300" />
          </div>
          <div className="p-1 flex flex-col gap-0.5">
            <div className="w-3/4 h-1 rounded bg-neutral-200" />
            <div className="w-1/2 h-1 rounded bg-neutral-100" />
            <div className="w-5 h-2 rounded bg-[#073E71] mt-1" />
          </div>
        </div>
        {/* Dark half */}
        <div className="w-1/2 bg-[#0f1419]">
          <div className="h-3 bg-[#1a1f26] border-b border-neutral-700
            flex items-center px-1 gap-0.5"
          >
            <div className="w-1 h-1 rounded-full bg-neutral-600" />
            <div className="w-1 h-1 rounded-full bg-neutral-600" />
          </div>
          <div className="p-1 flex flex-col gap-0.5">
            <div className="w-3/4 h-1 rounded bg-neutral-700" />
            <div className="w-1/2 h-1 rounded bg-neutral-800" />
            <div className="w-5 h-2 rounded bg-[#5B9BD5] mt-1" />
          </div>
        </div>
      </div>
    </div>
  );
}

const ACCENT_COLORS = [
  { name: "Blue", value: "#073E71", ring: "#5B9BD5" },
  { name: "Teal", value: "#0d6e6e", ring: "#4dd0d0" },
  { name: "Purple", value: "#5b21b6", ring: "#a78bfa" },
  { name: "Rose", value: "#be123c", ring: "#fb7185" },
  { name: "Amber", value: "#b45309", ring: "#fbbf24" },
  { name: "Emerald", value: "#047857", ring: "#34d399" },
] as const;

function AppearanceContent() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [selectedAccent, setSelectedAccent] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="w-full px-6 py-8">
        <div className="max-w-2xl">
          <div className="h-8 w-48 rounded bg-[var(--neutral-30)]
            animate-pulse mb-2"
          />
          <div className="h-5 w-72 rounded bg-[var(--neutral-20)]
            animate-pulse"
          />
        </div>
      </div>
    );
  }

  const currentTheme = (theme ?? "light") as ThemeOption;

  return (
    <div className="w-full px-6 py-8">
      <div className="max-w-2xl">
        {/* Page Header */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-[var(--neutral-100)]">
            Appearance
          </h2>
          <p className="mt-1 text-sm text-[var(--neutral-60)]">
            Customize how atrips looks for you
          </p>
        </div>

        {/* Theme Section */}
        <section className="mb-10">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-[var(--neutral-100)]
              uppercase tracking-wide"
            >
              Theme
            </h3>
            <p className="mt-1 text-sm text-[var(--neutral-60)]">
              Select your preferred color scheme
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <ThemeCard
              value="light"
              label="Light"
              icon={Sun}
              selected={currentTheme === "light"}
              onSelect={setTheme as (v: ThemeOption) => void}
              preview={<LightPreview />}
            />
            <ThemeCard
              value="dark"
              label="Dark"
              icon={Moon}
              selected={currentTheme === "dark"}
              onSelect={setTheme as (v: ThemeOption) => void}
              preview={<DarkPreview />}
            />
            <ThemeCard
              value="system"
              label="System"
              icon={Monitor}
              selected={currentTheme === "system"}
              onSelect={setTheme as (v: ThemeOption) => void}
              preview={<SystemPreview />}
            />
          </div>

          {currentTheme === "system" && (
            <motion.p
              className="mt-3 text-xs text-[var(--neutral-60)]"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
            >
              Currently using{" "}
              <span className="font-medium text-[var(--neutral-100)]">
                {resolvedTheme}
              </span>{" "}
              mode based on your system settings
            </motion.p>
          )}
        </section>

        {/* Accent Color Section */}
        <section>
          <div className="mb-4">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-[var(--neutral-100)]
                uppercase tracking-wide"
              >
                Accent Color
              </h3>
              <span className="rounded-full bg-[var(--neutral-20)]
                px-2 py-0.5 text-[10px] font-medium text-[var(--neutral-60)]"
              >
                Coming Soon
              </span>
            </div>
            <p className="mt-1 text-sm text-[var(--neutral-60)]">
              Choose an accent color for buttons and highlights
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {ACCENT_COLORS.map((color, index) => (
              <button
                key={color.name}
                onClick={() => setSelectedAccent(index)}
                className="group relative flex flex-col items-center gap-1.5"
                title={color.name}
              >
                <div
                  className={`
                    h-10 w-10 rounded-full transition-all duration-200
                    ${selectedAccent === index
                      ? "ring-2 ring-offset-2 ring-offset-[var(--neutral-10)]"
                      : "hover:scale-110"
                    }
                  `}
                  style={{
                    backgroundColor: color.value,
                    ...(selectedAccent === index
                      ? { ["--tw-ring-color" as string]: color.ring }
                      : {}),
                  }}
                >
                  {selectedAccent === index && (
                    <motion.div
                      className="flex h-full w-full items-center
                        justify-center"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{
                        type: "spring",
                        stiffness: 500,
                        damping: 30,
                      }}
                    >
                      <Check
                        size={16}
                        weight="bold"
                        className="text-white"
                      />
                    </motion.div>
                  )}
                </div>
                <span className={`text-[11px] ${
                  selectedAccent === index
                    ? "font-medium text-[var(--neutral-100)]"
                    : "text-[var(--neutral-60)]"
                }`}>
                  {color.name}
                </span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export default function AppearancePage() {
  return <AppearanceContent />;
}
