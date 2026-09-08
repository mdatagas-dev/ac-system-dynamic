"use client";

/**
 * VM3 Theme Runtime — mode light/dark + custom seed color.
 * - data-theme="dark" di <html> untuk tema gelap
 * - seed != default → palette dihitung runtime, vars di-inline ke <html>
 * - persisted di localStorage; no-flash via inline script di layout
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  DEFAULT_SEED,
  generatePalette,
  paletteToVarRecord,
  type ThemeMode,
} from "./palette";
import { argbFromHex, hexFromArgb } from "@material/material-color-utilities";

const THEME_KEY = "vm3-theme";
const SEED_KEY = "vm3-seed";

/** Hex default seed (huruf kecil) untuk pembandingan */
const DEFAULT_SEED_HEX = hexFromArgb(DEFAULT_SEED).toLowerCase();
/** Seeds from earlier themes — migrate them to the PT GAS blue default. */
const LEGACY_SEEDS = new Set(["#000000", "#0b57d0", "#7cb342"]);

interface ThemeContextValue {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
  seed: string;
  setSeed: (hex: string) => void;
  /** true jika seed = default (CSS statis sudah cukup) */
  isDefaultSeed: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function initialMode(): ThemeMode {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function initialSeed(): string {
  if (typeof window === "undefined") return hexFromArgb(DEFAULT_SEED);
  const stored = window.localStorage.getItem(SEED_KEY);
  if (!stored) return hexFromArgb(DEFAULT_SEED);
  // Migrate old black, blue, and green themes to the PT GAS blue default
  if (LEGACY_SEEDS.has(stored.trim().toLowerCase())) {
    try {
      window.localStorage.setItem(SEED_KEY, hexFromArgb(DEFAULT_SEED));
    } catch {}
    return hexFromArgb(DEFAULT_SEED);
  }
  return stored;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(initialMode);
  const [seed, setSeedState] = useState<string>(initialSeed);

  // Sinkron mode → <html data-theme>
  useEffect(() => {
    document.documentElement.dataset.theme = mode;
    window.localStorage.setItem(THEME_KEY, mode);
  }, [mode]);

  const isDefaultSeed = useMemo(
    () => seed.trim().toLowerCase() === DEFAULT_SEED_HEX,
    [seed],
  );

  // Custom seed → hitung palette runtime, override vars di <html>
  useEffect(() => {
    window.localStorage.setItem(SEED_KEY, seed);
    if (isDefaultSeed) {
      // hapus override inline → kembali ke default.css statis
      const el = document.documentElement;
      for (const name of el.style
        .getPropertyValue("--vm3-seed")
        .split(",")
        .filter(Boolean)) {
        el.style.removeProperty(name);
      }
      el.style.removeProperty("--vm3-seed");
      return;
    }
    const argb = argbFromHex(seed);
    const light = generatePalette(argb, "light");
    const dark = generatePalette(argb, "dark");
    const vars = paletteToVarRecord(light);
    Object.assign(vars, paletteToVarRecord(dark));
    const el = document.documentElement;
    for (const [name, value] of Object.entries(vars)) {
      el.style.setProperty(name, value);
    }
    el.style.setProperty(
      "--vm3-seed",
      Object.keys(vars).join(","),
    );
  }, [seed, isDefaultSeed]);

  const setMode = useCallback((m: ThemeMode) => setModeState(m), []);
  const toggleMode = useCallback(
    () => setModeState((m) => (m === "light" ? "dark" : "light")),
    [],
  );
  const setSeed = useCallback((hex: string) => setSeedState(hex), []);

  const value = useMemo(
    () => ({ mode, setMode, toggleMode, seed, setSeed, isDefaultSeed }),
    [mode, setMode, toggleMode, seed, setSeed, isDefaultSeed],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme harus dipakai di dalam ThemeProvider");
  return ctx;
}
