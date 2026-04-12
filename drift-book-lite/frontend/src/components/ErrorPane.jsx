export function ErrorPane({ title = "页面暂时不可用", message, action }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center px-6">
      <div className="paper-panel w-full max-w-2xl rounded-[2rem] p-10 shadow-[0_25px_80px_rgba(35,26,12,0.14)]">
        <p className="mb-3 text-xs uppercase tracking-[0.35em] text-primary">
          系统提示
        </p>
        <h2 className="font-display text-3xl text-stone-900">{title}</h2>
        <p className="mt-4 max-w-xl text-sm leading-7 text-stone-600">
          {message || "请稍后再试，或返回首页重新进入。"}
        </p>
        {action ? <div className="mt-6">{action}</div> : null}
      </div>
    </div>
  );
}
