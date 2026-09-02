"use client";

/**
 * VM3 App Shell — AppBar + nav responsif:
 * - Desktop: rail ikon ⇄ rail melebar (toggle, persist di localStorage)
 * - Mobile: bottom navbar + drawer (menu)
 * Protected: redirect ke /login bila belum autentikasi.
 */
import { useEffect, useState, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "@/lib/auth";
import { IconButton } from "@/components/vm3/IconButton";
import { Button } from "@/components/vm3/Button";
import { Dialog } from "@/components/vm3/Dialog";
import {
  AppBar,
  NavigationBar,
  NavigationRail,
  NavigationDrawer,
  NavItem,
  RailItem,
} from "@/components/vm3/Navigation";
import { List, ListItem } from "@/components/vm3/List";
import { CircularProgress } from "@/components/vm3/Progress";
import { useTheme } from "@/design-system/themes/ThemeProvider";
import { useVm3ReducedMotion } from "@/hooks/useVm3ReducedMotion";

const NAV = [
  { href: "/", label: "Dashboard", icon: "space_dashboard", exact: true },
  { href: "/regist", label: "Registrasi", icon: "assignment" },
  { href: "/scan", label: "Scan", icon: "qr_code_scanner" },
  { href: "/history", label: "Riwayat", icon: "history" },
  { href: "/master", label: "Master Data", icon: "database" },
];

// ppc (operator) hanya melihat alur kerjanya: registrasi + scan
const PPC_ONLY = new Set(["/regist", "/scan"]);

const RAIL_KEY = "vm3-rail-expanded";

interface NavLinkProps {
  item: (typeof NAV)[number];
  active: boolean;
  onNavigate: (href: string) => void;
  children: React.ReactNode;
}

/** Link sidebar dengan prefetch + penanganan klik (new-tab & halaman sama) — dipakai rail & navbar bawah. */
function NavLink({ item, active, onNavigate, children }: NavLinkProps) {
  return (
    <Link
      href={item.href}
      prefetch
      aria-current={active ? "page" : undefined}
      onClick={(e) => {
        // Hormati new-tab / modifier dan cegah navigasi ke halaman yang sama
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button !== 0) return;
        if (active) {
          e.preventDefault();
          return;
        }
        e.preventDefault();
        onNavigate(item.href);
      }}
    >
      {children}
    </Link>
  );
}

export default function AppShellLayout({ children }: { children: React.ReactNode }) {
  const { user, initializing, logout } = useAuth();
  const { mode, toggleMode } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [railExpanded, setRailExpanded] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const reducedMotion = useVm3ReducedMotion();

  // Pulihkan preferensi lebar rail (defer — hindari setState sinkron di effect)
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        setRailExpanded(localStorage.getItem(RAIL_KEY) === "true");
      } catch {
        /* localStorage tidak tersedia */
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const toggleRail = () =>
    setRailExpanded((v) => {
      const next = !v;
      try {
        localStorage.setItem(RAIL_KEY, String(next));
      } catch {
        /* abaikan */
      }
      return next;
    });

  // ppc (operator) hanya melihat alur kerjanya: registrasi + scan
  const navItems =
    user?.roleuser?.toLowerCase() === "ppc"
      ? NAV.filter((n) => PPC_ONLY.has(n.href))
      : NAV;

  // Elevasi appbar saat digulir
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    const t = setTimeout(onScroll, 0); // defer initial check
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      clearTimeout(t);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  useEffect(() => {
    if (!initializing && !user) router.replace("/login");
  }, [initializing, user, router]);

  // Prefetch semua rute sidebar agar perpindahan instant (saat idle)
  useEffect(() => {
    navItems.forEach((n) => {
      try {
        router.prefetch(n.href);
      } catch {
        /* prefetch gagal — abaikan */
      }
    });
  }, [router, navItems]);

  if (initializing || !user) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <CircularProgress label="Memuat" />
      </div>
    );
  }

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  const activeNav = [...navItems].reverse().find((n) => isActive(n.href, n.exact));

  const navigate = (href: string) => {
    setDrawerOpen(false);
    if (href === pathname) return;
    startTransition(() => {
      router.push(href);
    });
  };

  const vtName =
    pathname === "/" ? "main-root" : `main-${pathname.slice(1).replace(/[^a-zA-Z0-9]/g, "-")}`;

  return (
    <div className="min-h-dvh">
      {/* Skip link — lompat langsung ke konten utama untuk navigasi keyboard */}
      <a
        href="#konten-utama"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-on-primary"
      >
        Lewati ke konten utama
      </a>
      <AppBar
        title={activeNav?.label ?? "AC System"}
        scrolled={scrolled}
        leading={
          /* Drawer hanya untuk mobile — desktop memakai rail yang bisa dilebarkan */
          <IconButton
            icon="menu"
            label="Buka menu"
            onClick={() => setDrawerOpen(true)}
            className="lg:hidden"
          />
        }
        actions={
          <>
            <IconButton
              icon={mode === "dark" ? "light_mode" : "dark_mode"}
              label="Ganti tema"
              onClick={toggleMode}
            />
            <span className="hidden px-2 text-sm text-on-surface-variant sm:block">
              {user.username}
            </span>
            <IconButton icon="logout" label="Keluar" onClick={() => setLogoutOpen(true)} />
          </>
        }
      />

      {/* Konten — SATU main (children sekali), nav rail di samping */}
      <div className="flex">
        <div className="hidden lg:block">
          <NavigationRail expanded={railExpanded}>
            {/* Toggle lebar rail */}
            <button
              type="button"
              aria-label={railExpanded ? "Ciutkan navigasi" : "Lebarkan navigasi"}
              aria-expanded={railExpanded}
              onClick={toggleRail}
              className="mb-2 flex h-10 w-full items-center gap-3 rounded-full px-3 text-on-surface-variant transition-colors hover:bg-on-surface/8 lg:justify-center lg:px-0"
              title={railExpanded ? "Ciutkan navigasi" : "Lebarkan navigasi"}
            >
              <span
                className={`material-symbols-rounded transition-transform duration-200 ${railExpanded ? "rotate-180" : ""}`}
                aria-hidden
              >
                chevron_right
              </span>
              <span
                className={`text-sm font-medium whitespace-nowrap ${railExpanded ? "lg:inline" : "lg:hidden"}`}
              >
                Ciutkan
              </span>
            </button>

            {navItems.map((item) => (
              <NavLink key={item.href} item={item} active={isActive(item.href, item.exact)} onNavigate={navigate}>
                <RailItem
                  icon={item.icon}
                  label={item.label}
                  active={isActive(item.href, item.exact)}
                />
              </NavLink>
            ))}
          </NavigationRail>
        </div>
        <div className="relative min-w-0 flex-1">
          {/* Progress tipis saat perpindahan — feedback instant */}
          <div
            className="vm3-nav-progress"
            data-pending={isPending ? "true" : undefined}
            aria-hidden
          />
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.main
              key={pathname}
              id="konten-utama"
              tabIndex={-1}
              initial={reducedMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
              transition={
                reducedMotion
                  ? { duration: 0 }
                  : { duration: 0.18, ease: [0.2, 0, 0, 1] }
              }
              className="min-h-[calc(100dvh-64px)] p-4 pb-24 lg:p-6 lg:pb-6 focus:outline-none"
              style={{ viewTransitionName: vtName } as React.CSSProperties}
            >
              {children}
            </motion.main>
          </AnimatePresence>
        </div>
      </div>

      {/* Navbar bawah (mobile) */}
      <div className="lg:hidden">
        <NavigationBar>
          {navItems.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item.href, item.exact)} onNavigate={navigate}>
              <NavItem
                icon={item.icon}
                label={item.label}
                active={isActive(item.href, item.exact)}
              />
            </NavLink>
          ))}
        </NavigationBar>
      </div>

      <NavigationDrawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <div className="mb-4 flex items-center gap-3 px-4 pt-2">
          <span className="material-symbols-rounded text-3xl text-primary" aria-hidden>
            ac_unit
          </span>
          <div>
            <div className="font-semibold">{user.username}</div>
            <div className="text-sm text-on-surface-variant">{user.roleuser}</div>
          </div>
        </div>
        <List>
          {navItems.map((item) => (
            <ListItem
              key={item.href}
              leadingIcon={item.icon}
              primary={item.label}
              onClick={() => navigate(item.href)}
            />
          ))}
        </List>
      </NavigationDrawer>

      {/* Konfirmasi logout — popup smooth (Dialog CSS) */}
      <Dialog
        open={logoutOpen}
        onOpenChange={setLogoutOpen}
        title="Keluar dari AC System?"
        description="Sesi akan diakhiri dan Anda perlu masuk kembali untuk melanjutkan."
        actions={
          <>
            <Button variant="text" onClick={() => setLogoutOpen(false)}>
              Batal
            </Button>
            <Button
              onClick={() => {
                setLogoutOpen(false);
                logout();
              }}
            >
              Keluar
            </Button>
          </>
        }
      />
    </div>
  );
}
