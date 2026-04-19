import clsx from "clsx";

export function Badge({ children, tone = "default" }) {
  return (
    <span
      className={clsx(
        "inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
        tone === "accent" && "bg-primary/10 text-primary",
        tone === "muted" && "bg-stone-900/6 text-stone-500",
        tone === "success" && "bg-emerald-700/10 text-emerald-700",
        tone === "warning" && "bg-amber-600/10 text-amber-700",
        tone === "danger" && "bg-rose-700/10 text-rose-700",
        tone === "default" && "bg-stone-200/70 text-stone-700"
      )}
    >
      {children}
    </span>
  );
}
