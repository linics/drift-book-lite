import clsx from "clsx";
import { PrimaryButton } from "./Button.jsx";
import { SecondaryButton } from "./Button.jsx";

export function AdminSection({ title, actions, children, className }) {
  return (
    <section
      className={clsx(
        "paper-panel rounded-[2.4rem] p-7 shadow-[0_20px_70px_rgba(48,34,17,0.08)]",
        className
      )}
    >
      {(title || actions) ? (
        <div className="mb-6 flex flex-col gap-4 border-b border-stone-200/70 pb-5 sm:flex-row sm:items-center sm:justify-between">
          {title ? <h3 className="font-display text-3xl text-stone-900">{title}</h3> : <span />}
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function AdminToolbar({ children, className }) {
  return (
    <div
      className={clsx(
        "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between",
        className
      )}
    >
      {children}
    </div>
  );
}

export function AdminList({ children, className }) {
  return <div className={clsx("space-y-3", className)}>{children}</div>;
}

export function AdminListItem({
  as: Component = "div",
  interactive = false,
  children,
  className,
  ...props
}) {
  return (
    <Component
      {...props}
      className={clsx(
        "rounded-[1.8rem] border border-stone-200 bg-white/80 p-5",
        interactive && "w-full text-left transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-white hover:shadow-sm",
        className
      )}
    >
      {children}
    </Component>
  );
}

export function AdminMeta({ children, className }) {
  return (
    <div className={clsx("flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-500", className)}>
      {children}
    </div>
  );
}

export function AdminPagination({
  page,
  totalPages,
  totalLabel,
  onPrev,
  onNext,
  prevDisabled,
  nextDisabled,
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.4rem] border border-stone-200 bg-white/65 px-4 py-3 text-sm text-stone-600">
      <span>{totalLabel || `第 ${page} / ${totalPages} 页`}</span>
      <div className="flex gap-2">
        <SecondaryButton
          type="button"
          className="px-3 py-1.5 text-xs"
          disabled={prevDisabled}
          onClick={onPrev}
        >
          上一页
        </SecondaryButton>
        <SecondaryButton
          type="button"
          className="px-3 py-1.5 text-xs"
          disabled={nextDisabled}
          onClick={onNext}
        >
          下一页
        </SecondaryButton>
      </div>
    </div>
  );
}

export function AdminFileBox({ label, actions, children }) {
  return (
    <div className="rounded-[1.8rem] border border-stone-200 bg-white/70 p-5">
      <p className="text-sm text-stone-700">{label}</p>
      {children}
      {actions ? <div className="mt-3 flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function AdminDefaultResourceSection({
  title,
  description,
  pathLabel,
  pathValue,
  directoryLabel,
  directoryValue,
  fallbackValue = "使用后端当前默认目录",
  actionLabel,
  loadingLabel,
  loading,
  onAction,
  summary,
  children,
  className,
}) {
  const resolvedPathLabel = pathLabel || directoryLabel;
  const resolvedPathValue = pathValue || directoryValue;

  return (
    <AdminSection
      title={title}
      className={className}
      actions={
        <PrimaryButton
          type="button"
          className="min-w-36"
          disabled={loading}
          onClick={onAction}
        >
          {loading ? loadingLabel : actionLabel}
        </PrimaryButton>
      }
    >
      <div className="rounded-[1.8rem] border border-stone-200 bg-white/70 p-5">
        {description ? (
          <p className="mb-4 text-sm leading-6 text-stone-600">{description}</p>
        ) : null}
        <p className="text-xs uppercase tracking-[0.24em] text-stone-500">{resolvedPathLabel}</p>
        <p className="mt-3 break-all rounded-2xl bg-surface px-4 py-3 font-mono text-xs text-stone-700">
          {resolvedPathValue || fallbackValue}
        </p>
        {children}
      </div>
      {summary ? (
        <p className="mt-3 text-xs leading-5 text-stone-500">
          {summary}
        </p>
      ) : null}
    </AdminSection>
  );
}
