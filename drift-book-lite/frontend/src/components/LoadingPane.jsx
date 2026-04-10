export function LoadingPane({ label = "正在加载" }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center px-6">
      <div className="paper-panel w-full max-w-xl rounded-[2rem] p-8 text-center shadow-[0_25px_80px_rgba(35,26,12,0.14)]">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-2 border-stone-300 border-t-[#8b2f2a]" />
        <p className="font-sans text-sm uppercase tracking-[0.3em] text-stone-500">
          {label}
        </p>
      </div>
    </div>
  );
}
