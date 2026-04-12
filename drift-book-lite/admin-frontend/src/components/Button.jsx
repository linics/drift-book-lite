import clsx from "clsx";

export function PrimaryButton({ className, children, ...props }) {
  return (
    <button
      {...props}
      className={clsx(
        "inline-flex items-center justify-center rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(139,47,42,0.22)] transition-all duration-150 hover:bg-primary-dark hover:shadow-[0_6px_20px_rgba(139,47,42,0.32)] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({ className, children, ...props }) {
  return (
    <button
      {...props}
      className={clsx(
        "inline-flex items-center justify-center rounded-full border border-stone-300 bg-white/80 px-5 py-3 text-sm font-medium text-stone-700 transition-all duration-150 hover:border-stone-400 hover:bg-white hover:shadow-sm active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    >
      {children}
    </button>
  );
}
