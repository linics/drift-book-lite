export function LoadingPane({ label = "正在加载" }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center px-6">
      <div className="paper-panel w-full max-w-xl rounded-[2rem] p-8 shadow-[0_25px_80px_rgba(35,26,12,0.14)]">
        <div className="animate-pulse space-y-4">
          <div className="h-3 w-24 rounded-full bg-stone-200" />
          <div className="h-6 w-3/4 rounded-full bg-stone-200" />
          <div className="h-3 w-full rounded-full bg-stone-200" />
          <div className="h-3 w-5/6 rounded-full bg-stone-200" />
        </div>
        <p className="mt-6 font-sans text-sm uppercase tracking-[0.3em] text-stone-500">
          {label}
        </p>
      </div>
    </div>
  );
}
