import clsx from "clsx";

export function StatusMessage({ error, success, className }) {
  if (success) {
    return (
      <div className={clsx("rounded-[1.6rem] border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-800", className)}>
        {success}
      </div>
    );
  }
  if (error) {
    return (
      <div className={clsx("rounded-[1.6rem] border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-700", className)}>
        {error}
      </div>
    );
  }
  return null;
}
