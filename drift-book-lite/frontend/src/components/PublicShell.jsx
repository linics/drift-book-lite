import { Link, NavLink } from "react-router-dom";
import { assetUrl } from "../lib/api.js";
import { Footer } from "./Footer.jsx";

export function PublicShell({ children, assets }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f6f0e3] text-stone-900">
      <div className="grain-overlay" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(139,47,42,0.18),transparent_35%),linear-gradient(180deg,#f7f0e5,rgba(247,240,229,0.65))]" />
      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-4 pb-12 pt-5 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-6 rounded-full border border-white/60 bg-white/55 px-5 py-4 shadow-[0_15px_60px_rgba(64,44,19,0.08)] backdrop-blur">
          <div className="flex items-center gap-4">
            {assets?.schoolLogoPath ? (
              <img
                src={assetUrl(assets.schoolLogoPath)}
                alt="学校 logo"
                className="h-12 w-12 rounded-full border border-stone-200 object-cover shadow-sm"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-stone-200 bg-stone-100 text-xs text-stone-500">
                LOGO
              </div>
            )}
            <div>
              <p className="font-sans text-[11px] uppercase tracking-[0.32em] text-stone-500">
                上海市敬业中学
              </p>
              <Link to="/" className="font-display text-2xl tracking-[0.02em] text-stone-900">
                一本书的旅行
              </Link>
            </div>
          </div>
          <nav className="flex items-center gap-5 text-sm">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                isActive ? "text-primary font-medium" : "text-stone-500 hover:text-stone-800 transition-colors"
              }
            >
              首页
            </NavLink>
            <NavLink
              to="/search"
              className={({ isActive }) =>
                isActive ? "text-primary font-medium" : "text-stone-500 hover:text-stone-800 transition-colors"
              }
            >
              搜索图书
            </NavLink>
          </nav>
        </header>
        {children}
        <Footer />
      </div>
    </div>
  );
}
