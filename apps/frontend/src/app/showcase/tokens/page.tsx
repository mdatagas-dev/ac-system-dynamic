"use client";

/**
 * VM3 Tokens Showcase — menampilkan seluruh token (live dari CSS vars).
 * Dipakai sebagai gate visual Fase 1 (warna, tipografi, shape, elevasi, spacing).
 */
import { useEffect, useState } from "react";
import { colorRoles, roleToVar } from "@/design-system/themes/roles";
import { typography, type TypeVariant } from "@/design-system/tokens/core";

function useCssVars(): Record<string, string> {
  const [vars, setVars] = useState<Record<string, string>>({});
  useEffect(() => {
    // baca computed style setelah frame pertama — hindari sync setState di effect
    const raf = requestAnimationFrame(() => {
      const style = getComputedStyle(document.documentElement);
      const next: Record<string, string> = {};
      for (const role of colorRoles) next[roleToVar(role)] = style.getPropertyValue(roleToVar(role)).trim();
      setVars(next);
    });
    return () => cancelAnimationFrame(raf);
  }, []);
  return vars;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-12">
      <h2 className="mb-4 text-2xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export default function TokensShowcase() {
  const vars = useCssVars();

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="mb-2 text-4xl font-bold">VM3 Tokens</h1>
      <p className="mb-10 text-on-surface-variant">
        Semantic roles + core tokens. Beralih dark mode untuk lihat adaptasi otomatis.
      </p>

      <Section title="Warna — Semantic Roles">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {colorRoles.map((role) => (
            <div
              key={role}
              className="overflow-hidden rounded-md border border-outline-variant"
            >
              <div
                className="h-16"
                style={{ backgroundColor: `var(${roleToVar(role)})` }}
              />
              <div className="bg-surface-container p-2 text-xs">
                <div className="font-mono">{role}</div>
                <div className="text-on-surface-variant">{vars[roleToVar(role)] || "…"}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Tipografi — Type Scale M3">
        {(Object.keys(typography) as TypeVariant[]).map((variant) => (
          <div key={variant} className="mb-2 flex items-baseline justify-between gap-4 border-b border-outline-variant pb-2">
            <span className="text-on-surface-variant text-sm">{variant}</span>
            <span style={{ fontSize: typography[variant].fontSize, lineHeight: typography[variant].lineHeight, fontWeight: typography[variant].fontWeight, letterSpacing: typography[variant].letterSpacing }}>
              ABC abc 123
            </span>
          </div>
        ))}
      </Section>

      <Section title="Shape">
        <div className="flex flex-wrap gap-4">
          {(["none", "xs", "sm", "md", "lg", "xl", "full"] as const).map((s) => (
            <div key={s} className="flex flex-col items-center gap-2">
              <div className="h-16 w-16 bg-primary-container" style={{ borderRadius: `var(--vm3-shape-${s})` }} />
              <span className="text-sm text-on-surface-variant">{s}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Elevasi — Level 0-5">
        <div className="flex flex-wrap gap-6 bg-surface-container-lowest p-6">
          {[0, 1, 2, 3, 4, 5].map((l) => (
            <div key={l} className="flex flex-col items-center gap-2">
              <div
                className="h-20 w-20 rounded-lg bg-surface"
                style={{ boxShadow: `var(--vm3-elevation-${l}-shadow)` }}
              />
              <span className="text-sm text-on-surface-variant">level {l}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Spacing — Grid 4px">
        <div className="flex flex-wrap items-end gap-6">
          {(["2xs", "xs", "sm", "md", "lg", "xl", "2xl", "3xl", "4xl"] as const).map((s) => (
            <div key={s} className="flex flex-col items-center gap-2">
              <div className="bg-tertiary-container" style={{ width: `var(--vm3-space-${s})`, height: "24px" }} />
              <span className="text-sm text-on-surface-variant">{s}</span>
            </div>
          ))}
        </div>
      </Section>
    </main>
  );
}
