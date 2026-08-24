"use client";

/**
 * LoginForm — SpaceX clone (thatanjan/spaceX-landing-page-clone-yt)
 * Diterjemahkan ke Next.js + Tailwind — aset SpaceX logo sudah dihapus,
 * header kini hanya menampilkan tipografi AC SYSTEM.
 */
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";

export function LoginForm() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [headerBg, setHeaderBg] = useState(false);
  const [headerShow, setHeaderShow] = useState(true);
  const missionRef = useRef<HTMLElement>(null);
  const [onScreen, setOnScreen] = useState(false);
  const prevScroll = useRef(0);

  // observer ala clone: bottom_content fade-in
  useEffect(() => {
    const el = missionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => setOnScreen(e.isIntersecting),
      { threshold: 0.35 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // header scroll ala clone index.js (tanpa menu)
  useEffect(() => {
    prevScroll.current = window.pageYOffset;
    const onScroll = () => {
      const cur = window.pageYOffset;
      const half = Math.floor(window.innerHeight / 2);
      setHeaderBg(cur > half);
      if (cur > prevScroll.current) {
        setHeaderShow(false);
        setTimeout(() => setHeaderShow(true), 900);
      } else {
        setHeaderShow(true);
      }
      prevScroll.current = cur;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(username, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal masuk. Coba lagi.");
      setLoading(false);
    }
  };

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&display=swap');`}</style>
      <div className="spacex-login h-dvh overflow-hidden bg-black font-[Montserrat,sans-serif] text-white antialiased">
        {/* ===== HEADER clone ===== */}
        <header
          className={`header ${headerShow ? "show" : ""} ${headerBg ? "with__background" : ""}`}
        >
          <div className="background" />
          <div className="header__inner">
            <div className="header__logo">
              <a
                href="#"
                aria-label="AC System — beranda"
                className="text-sm font-semibold tracking-[0.32em] text-white"
              >
                AC SYSTEM
              </a>
            </div>
          </div>
        </header>

        {/* ===== MISSION HERO — CODEX background video (chatgpt.com/id-ID/codex) — hanya background video yang bergerak ===== */}
        <section ref={missionRef} className={`mission__container ${onScreen ? "on__screen" : ""}`}>
          <video
            aria-hidden
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            poster="https://openaiassets.blob.core.windows.net/$web/chatgpt/background-video-jan-28-first-frame.png"
            className="absolute inset-0 h-full w-full object-cover"
            crossOrigin="anonymous"
          >
            <source src="https://persistent.oaistatic.com/codex/background-video-jan-28.mp4" type="video/mp4" />
          </video>
          {/* overlay agar form tetap legible — sama seperti Codex */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "linear-gradient(to bottom, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0.22) 38%, rgba(0,0,0,0.62) 100%)",
            }}
          />

          {/* bottom_content ala clone — tapi isi form login */}
          <div className="bottom__content !opacity-100 !translate-y-0" style={{ opacity: onScreen ? 1 : 0, transform: onScreen ? "translateY(0)" : "translateY(14px)", transition: "opacity 1s, transform 1s" }}>
            <h4 className="bottom__content__subheader !mb-2">AC SYSTEM · SECURE ACCESS</h4>
            <h1 className="bottom__content__header !mb-6 !text-[2.1rem] !leading-none sm:!text-[2.6rem]">
              Selamat datang
              <br />
              kembali
            </h1>

            <form onSubmit={submit} noValidate className="mt-2 flex max-w-[360px] flex-col gap-3">
              {/* username */}
              <label className="group relative block">
                <span className="sr-only">Username</span>
                <span className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-white/50">
                  <span className="material-symbols-rounded text-[18px]" aria-hidden>person</span>
                </span>
                <input
                  name="username"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  placeholder="USERNAME"
                  className="h-[52px] w-full border border-white/25 bg-black/25 pl-10 pr-3 text-sm tracking-wide text-white placeholder:text-white/55 backdrop-blur-[2px] transition focus:border-white focus:bg-black/40 focus:outline-none"
                />
              </label>

              {/* password */}
              <label className="group relative block">
                <span className="sr-only">Password</span>
                <span className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-white/50">
                  <span className="material-symbols-rounded text-[18px]" aria-hidden>lock</span>
                </span>
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="PASSWORD"
                  className="h-[52px] w-full border border-white/25 bg-black/25 pl-10 pr-11 text-sm tracking-wide text-white placeholder:text-white/55 backdrop-blur-[2px] transition focus:border-white focus:bg-black/40 focus:outline-none"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Sembunyikan sandi" : "Tampilkan sandi"}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center text-white/70 hover:text-white"
                >
                  <span className="material-symbols-rounded text-[20px]" aria-hidden>
                    {showPassword ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </label>

              {error && (
                <div role="alert" className="border border-red-400/40 bg-red-500/10 px-3 py-2 text-xs leading-relaxed text-red-100">
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading} className="content__button mt-1 !border-white disabled:opacity-50">
                <span className="text">{loading ? "MEMPROSES…" : "MASUK"}</span>
                <div className="hover" />
              </button>

              <p className="pt-1 text-center text-xs leading-relaxed text-white/60">
                Produksi terpantau, data terpercaya.
                <br />
                <span className="text-white/35">© 2026 AC System · Terenkripsi</span>
              </p>
            </form>
          </div>

        </section>

        {/* ===== clone css (scoped) ===== */}
        <style>{`
          .spacex-login .header{height:5rem;position:fixed;top:0;left:0;width:100%;z-index:10;transform:translateY(-100%);transition:transform 0s 0s}
          .spacex-login .header.show{transform:translateY(0)}
          .spacex-login .header.show .header__inner{opacity:1}
          .spacex-login .header .background{background:black;position:absolute;top:0;left:0;width:100%;height:100%;z-index:-1;transform:translateY(-100%);transition:transform .5s cubic-bezier(0.19,1,0.22,1) .1s}
          .spacex-login .header.show.with__background .background{transform:translateY(0)}
          .spacex-login .header .header__inner{height:100%;width:100%;display:flex;opacity:0;transition:opacity .2s .6s}
          .spacex-login .header__logo{flex-grow:1;overflow:hidden;margin:auto 0;display:flex;align-items:center;gap:.5rem;padding-left:1.25rem}
          .spacex-login .header__logo a{display:inline-flex;align-items:center;width:auto;text-decoration:none}
          .spacex-login .header__navigation{flex-grow:2;display:none;justify-content:space-between;align-items:center}
          @media(min-width:960px){.spacex-login .header__navigation{display:flex}}
          .spacex-login .header__navigation ul li{margin:0 .7rem;display:inline-block}
          .spacex-login .header__navigation .nav__link{font-weight:700;font-size:.8rem;text-transform:uppercase;position:relative;color:#fff;text-decoration:none}
          .spacex-login .header__navigation .shop__container{flex-basis:5rem;text-align:center}
          .spacex-login .header__navigation .nav__link:after{content:'';position:absolute;bottom:0;left:0;width:100%;height:1px;background:#fff;transform:scaleX(0);transform-origin:right center;transition:transform .6s cubic-bezier(0.19,1,0.22,1)}
          .spacex-login .header__navigation .nav__link:hover:after{transform:scaleX(1);transform-origin:left center}
          .spacex-login .hamburger{display:grid;place-items:center;cursor:pointer;transition:opacity .15s linear;font:inherit;color:#fff;background:transparent;border:0;margin:0 1.5rem;overflow:visible}
          .spacex-login .hamburger:focus{outline:none}
          .spacex-login .hamburger:hover{opacity:.7}
          .spacex-login .hamburger-box{width:20px;height:20px;display:inline-block;position:relative}
          .spacex-login .hamburger-inner{top:50%;margin-top:-2px}
          .spacex-login .hamburger-inner,.spacex-login .hamburger-inner::before,.spacex-login .hamburger-inner::after{width:100%;height:2px;background:#fff;border-radius:4px;position:absolute;transition:transform .15s ease}
          .spacex-login .hamburger-inner::before,.spacex-login .hamburger-inner::after{content:'';display:block}
          .spacex-login .hamburger-inner::before{top:-7px}
          .spacex-login .hamburger-inner::after{bottom:-7px}
          .spacex-login .hamburger--emphatic{overflow:hidden}
          .spacex-login .hamburger--emphatic.is-active .hamburger-inner{background:transparent!important}
          .spacex-login .hamburger--emphatic.is-active .hamburger-inner::before{left:-80px;top:-80px;transform:translate3d(80px,80px,0) rotate(45deg)}
          .spacex-login .hamburger--emphatic.is-active .hamburger-inner::after{right:-80px;top:-80px;transform:translate3d(-80px,80px,0) rotate(-45deg)}
          .spacex-login .navigation__menu{position:fixed;top:0;right:0;background:#000;z-index:5;width:80%;max-width:20rem;height:100%;transform:translateX(100%);transition:transform .5s ease-in-out}
          .spacex-login .navigation__menu.open{transform:translateX(0)}
          .spacex-login .navigation__menu ul{width:80%;margin:8rem auto 0;text-align:right}
          .spacex-login .navigation__menu ul li{transform:translateY(100%);opacity:0;transition:all 1s .6s}
          .spacex-login .navigation__menu.open ul li{opacity:1;transform:translateY(0)}
          .spacex-login .navigation__menu ul li a{display:block;font-size:1rem;line-height:40px;font-weight:500;text-transform:uppercase;border-bottom:1pt solid #252525;color:#fff;text-decoration:none;transition:color .4s cubic-bezier(0.25,1,0.25,1)}
          .spacex-login .navigation__menu ul li a:hover{color:#8b939b}
          .spacex-login .mission__container{height:100dvh;min-height:100dvh;position:relative;overflow:hidden}
          .spacex-login .mission__container .background{height:100%;background-repeat:no-repeat;background-size:cover;background-position:center}
          .spacex-login .mission__container .background:after{content:'';position:absolute;inset:0;background:rgba(0,0,0,.2)}
          .spacex-login .mission__container .background.one{background-image:url(/spacex/media/1.webp)}
          .spacex-login .mission__container .background.two{background-image:url(/spacex/media/2.webp)}
          .spacex-login .footer{position:relative;margin:0 auto;text-align:center;text-transform:uppercase;font-size:.7rem;padding:1.5rem 0;background:#000;color:#979797}
          .spacex-login .footer__list{display:flex;flex-wrap:wrap;justify-content:space-evenly;align-items:center;padding:1rem 1rem 0;margin:0 auto}
          .spacex-login .footer__list li{margin:0 10px 10px 0}
          .spacex-login .footer__list__link{font-weight:600;color:#fff;text-decoration:none;transition:color 1s cubic-bezier(0.25,1,0.25,1)}
          .spacex-login .footer__list__link:hover{color:#8b939b}
          .spacex-login .mission__container .bottom__content{position:absolute;bottom:10%;left:1.5rem;width:90%;max-width:520px}
          @media(min-width:960px){.spacex-login .mission__container .bottom__content{left:3.5rem;bottom:12%}}
          .spacex-login .bottom__content__subheader{font-size:.95rem;letter-spacing:.02em;font-weight:400;color:#fff}
          .spacex-login .bottom__content__header{font-size:2rem;text-align:left;margin:0 0 1rem auto;font-weight:600;color:#fff;line-height:1.05}
          @media(min-width:640px){.spacex-login .bottom__content__header{font-size:2.6rem}}
          .spacex-login .content__button{border:2px solid #fff;display:inline-block;position:relative;z-index:2;margin-top:0;color:#fff;text-decoration:none;min-width:160px;text-align:center}
          .spacex-login .content__button .text{font-weight:700;font-size:.8rem;display:inline-block;text-transform:uppercase;padding:1.05rem 2.2rem;transition:color .5s cubic-bezier(0.19,1,0.22,1);position:relative;z-index:1}
          .spacex-login .content__button .hover{position:absolute;inset:0;background:#fff;height:100%;width:100%;z-index:0;transform:scale3d(1,0,1);transform-origin:top center;transition:transform .6s cubic-bezier(0.19,1,0.22,1)}
          .spacex-login .content__button:hover .hover{transform:scale3d(1,1,1);transform-origin:bottom center}
          .spacex-login .content__button:hover .text{color:#000}
        `}</style>
      </div>
    </>
  );
}
