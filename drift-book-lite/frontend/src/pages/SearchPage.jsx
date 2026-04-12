import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../lib/api.js";
import { useSiteAssets } from "../hooks/useSiteAssets.js";
import { SectionHeading } from "../components/SectionHeading.jsx";
import { SearchForm } from "../components/SearchForm.jsx";
import { BookCard } from "../components/BookCard.jsx";
import { SecondaryButton } from "../components/Button.jsx";
import { LoadingPane } from "../components/LoadingPane.jsx";
import { ErrorPane } from "../components/ErrorPane.jsx";
import { PublicShell } from "../components/PublicShell.jsx";
import { AnimatedPage } from "../components/AnimatedPage.jsx";

export function SearchPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const query = searchParams.get("q") || "";
  const hasQuery = Boolean(query.trim());
  const { assets, error: assetError } = useSiteAssets();
  const [books, setBooks] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(hasQuery);
  const visibleBooks = hasQuery ? books : [];

  useEffect(() => {
    if (!hasQuery) return undefined;

    let active = true;
    async function loadBooks() {
      setLoading(true);
      setError("");

      try {
        const response = await api.get("/books/search", { params: { q: query } });
        if (!active) return;
        setBooks(response.data.books);
      } catch (requestError) {
        if (!active) return;
        setError(requestError.response?.data?.message || "图书搜索失败");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadBooks();

    return () => {
      active = false;
    };
  }, [hasQuery, query]);

  if (assetError) {
    return (
      <PublicShell assets={assets}>
        <ErrorPane message={assetError} />
      </PublicShell>
    );
  }

  return (
    <PublicShell assets={assets}>
      <AnimatedPage>
      <section className="paper-panel rounded-[2.4rem] p-8 shadow-[0_30px_90px_rgba(58,39,18,0.12)] md:p-10">
        <SectionHeading
          eyebrow="Search Books"
          title="探索书海"
          description="输入书名，发掘更多馆藏好书。"
        />
        <SearchForm
          initialValue={query}
          compact
          onSubmit={(value) => value && navigate(`/search?q=${encodeURIComponent(value)}`)}
        />
      </section>

      <section className="mt-8">
        {hasQuery && loading ? <LoadingPane label="正在搜索图书" /> : null}
        {hasQuery && !loading && error ? (
          <ErrorPane
            title="搜索失败"
            message={error}
            action={
              <Link to="/">
                <SecondaryButton>返回首页</SecondaryButton>
              </Link>
            }
          />
        ) : null}
        {(!hasQuery || !loading) && !error ? (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.34em] text-primary">
                  Search Result
                </p>
                <h2 className="mt-2 font-display text-4xl text-stone-900">
                  共找到 {visibleBooks.length} 本相关图书
                </h2>
                <p className="mt-3 text-sm leading-7 text-stone-600">
                  当前关键词：{hasQuery ? query : "未输入"}
                </p>
              </div>
              <Link to="/">
                <SecondaryButton>返回首页</SecondaryButton>
              </Link>
            </div>

            {visibleBooks.length === 0 ? (
              <div className="paper-panel rounded-[2rem] p-8 text-sm leading-7 text-stone-600 shadow-[0_24px_70px_rgba(47,33,15,0.08)]">
                未找到相关图书，请尝试更换关键词，或回到首页重新搜索。
              </div>
            ) : (
              <div className="grid gap-5 md:grid-cols-2">
                {visibleBooks.map((book, index) => (
                  <div
                    key={book.id}
                    style={{
                      animation: "fadeInUp 0.3s ease both",
                      animationDelay: `${index * 0.04}s`,
                    }}
                  >
                    <BookCard book={book} />
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </section>
      </AnimatedPage>
    </PublicShell>
  );
}
