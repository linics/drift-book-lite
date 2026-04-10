export function SectionHeading({ eyebrow, title, description }) {
  return (
    <div className="max-w-2xl">
      <p className="text-xs uppercase tracking-[0.38em] text-[#8b2f2a]">{eyebrow}</p>
      <h2 className="mt-3 font-display text-3xl leading-tight text-stone-900 md:text-5xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-5 text-sm leading-7 text-stone-600 md:text-base">
          {description}
        </p>
      ) : null}
    </div>
  );
}
