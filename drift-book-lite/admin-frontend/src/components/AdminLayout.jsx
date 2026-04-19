import clsx from "clsx";
import { Navigate, NavLink } from "react-router-dom";
import { useAdminSession } from "../lib/auth.js";

export function AdminLayout({ title, description, onLogout, children }) {
  const links = [
    { to: "/books", label: "图书与导入" },
    { to: "/student-roster", label: "学生花名册" },
    { to: "/reviews", label: "留言审核" },
    { to: "/featured", label: "精选运营" },
    { to: "/sensitive-words", label: "敏感词库" },
    { to: "/assets", label: "站点素材" },
    { to: "/settings", label: "账号设置" },
  ];

  return (
    <div className="min-h-screen px-4 py-5 text-stone-900 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[16rem_1fr]">
        <aside className="rounded-[2.4rem] bg-[linear-gradient(180deg,#16110d,#231813_68%,#100d0a)] p-6 text-white shadow-[0_24px_90px_rgba(24,18,9,0.35)]">
          <p className="text-xs uppercase tracking-[0.34em] text-stone-400">Admin Console</p>
          <h1 className="mt-4 font-display text-4xl text-[#f5ead9]">一本书的漂流</h1>
          <nav className="mt-8 space-y-2">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end
                className={({ isActive }) =>
                  clsx(
                    "group relative block overflow-hidden rounded-[1.35rem] border px-4 py-3 text-sm transition-all duration-150",
                    isActive
                      ? "border-[#d7b58c]/35 bg-white/8 text-[#f8efdf] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                      : "border-transparent text-stone-300 hover:translate-x-0.5 hover:border-white/10 hover:bg-white/6 hover:text-[#f3e7d5]"
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={clsx(
                        "absolute inset-y-3 left-2 w-[3px] rounded-full transition",
                        isActive ? "bg-[#d7b58c]" : "bg-transparent group-hover:bg-white/12"
                      )}
                    />
                    <span className="relative pl-3">{link.label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>
          <div className="mt-8 border-t border-white/10 pt-6">
            <button
              type="button"
              onClick={onLogout}
              className="rounded-full border border-white/15 px-4 py-2 text-sm text-stone-200 transition hover:border-white/25 hover:bg-white/8"
            >
              退出登录
            </button>
          </div>
        </aside>

        <div className="space-y-6">
          <header className="rounded-[2.4rem] border border-stone-200/70 bg-white/80 p-8 shadow-[0_20px_70px_rgba(48,34,17,0.08)]">
            <p className="text-xs uppercase tracking-[0.34em] text-primary">Admin Panel</p>
            <h2 className="mt-3 font-display text-4xl text-stone-900">{title}</h2>
            {description ? (
              <p className="mt-4 max-w-3xl text-sm leading-7 text-stone-600">{description}</p>
            ) : null}
          </header>
          {children}
        </div>
      </div>
    </div>
  );
}

export function AdminGuard({ children }) {
  const { token, setToken } = useAdminSession();
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children({ token, setToken });
}
