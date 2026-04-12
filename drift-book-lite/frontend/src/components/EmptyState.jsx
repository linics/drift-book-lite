export function EmptyState({ children }) {
  return (
    <div className="rounded-[1.8rem] border border-dashed border-stone-300 bg-surface p-6 text-sm leading-7 text-stone-500">
      {children}
    </div>
  );
}
