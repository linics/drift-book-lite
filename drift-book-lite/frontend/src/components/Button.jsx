import clsx from "clsx";

export function PrimaryButton({ className, children, ...props }) {
  return (
    <button
      {...props}
      className={clsx(
        "inline-flex items-center justify-center rounded-full bg-[#8b2f2a] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#6d221f] disabled:cursor-not-allowed disabled:opacity-50",
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
        "inline-flex items-center justify-center rounded-full border border-stone-300 bg-white/80 px-5 py-3 text-sm font-medium text-stone-700 transition hover:border-stone-400 hover:bg-white",
        className
      )}
    >
      {children}
    </button>
  );
}
