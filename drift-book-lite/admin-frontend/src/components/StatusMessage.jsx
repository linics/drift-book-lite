export function StatusMessage({ error, success }) {
  if (success) {
    return (
      <div className="rounded-[1.8rem] border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-800">
        {success}
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-[1.8rem] border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-700">
        {error}
      </div>
    );
  }
  return null;
}
