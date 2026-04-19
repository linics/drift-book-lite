import clsx from "clsx";

export function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs uppercase tracking-[0.25em] text-stone-500">
        {label}
      </span>
      {children}
      {hint ? <p className="mt-2 text-xs text-stone-500">{hint}</p> : null}
    </label>
  );
}

export function FieldRow({ children, className }) {
  return <div className={clsx("grid gap-4 md:grid-cols-2", className)}>{children}</div>;
}
