import clsx from "clsx";

export function TextInput(props) {
  return (
    <input
      {...props}
      className={clsx(
        "w-full rounded-2xl border border-stone-300/70 bg-white/90 px-4 py-3 text-sm text-stone-900 outline-none transition",
        "placeholder:text-stone-400 focus:border-primary focus:ring-2 focus:ring-primary/15",
        props.className
      )}
    />
  );
}

export function TextArea(props) {
  return (
    <textarea
      {...props}
      className={clsx(
        "w-full rounded-3xl border border-stone-300/70 bg-white/90 px-4 py-3 text-sm leading-7 text-stone-900 outline-none transition",
        "placeholder:text-stone-400 focus:border-primary focus:ring-2 focus:ring-primary/15",
        props.className
      )}
    />
  );
}

export function SelectInput({ className, ...props }) {
  return (
    <select
      {...props}
      className={clsx(
        "w-full rounded-2xl border border-stone-300/70 bg-white/90 px-4 py-3 text-sm text-stone-900 outline-none transition",
        "focus:border-primary focus:ring-2 focus:ring-primary/15",
        className
      )}
    />
  );
}
