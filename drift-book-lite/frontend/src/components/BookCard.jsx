import { Link } from "react-router-dom";
import { Badge } from "./Badge.jsx";

export function BookCard({ book }) {
  return (
    <Link
      to={`/books/${book.id}`}
      className="group block rounded-[2rem] border border-stone-200/80 bg-white/80 p-6 shadow-[0_18px_60px_rgba(47,33,15,0.08)] transition-all duration-200 hover:-translate-y-1 hover:border-primary/20 hover:shadow-[0_24px_70px_rgba(47,33,15,0.12)]"
    >
      <p className="text-xs uppercase tracking-[0.28em] text-stone-400">{book.publisher}</p>
      <h3 className="mt-2 font-display text-3xl text-stone-900 transition group-hover:text-primary">
        {book.title}
      </h3>
      <p className="mt-3 text-sm leading-7 text-stone-600">{book.author}</p>
      <p className="mt-1 text-sm leading-7 text-stone-500">{book.publisher}</p>
      {book.publishDateText ? (
        <p className="mt-1 text-sm leading-7 text-stone-500">出版日期：{book.publishDateText}</p>
      ) : null}
      {book.subtitle ? (
        <p className="mt-2 text-sm leading-7 text-stone-600">副标题：{book.subtitle}</p>
      ) : null}
      <div className="mt-5 flex flex-wrap gap-3">
        <Badge tone="success">馆藏 {book.totalCopies} 册</Badge>
        {book.groupBookCount > 1 ? (
          <Badge tone="muted">合并副本 {book.groupBookCount}</Badge>
        ) : null}
      </div>
    </Link>
  );
}
