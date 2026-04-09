import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { AnimatePresence, motion } from "framer-motion";
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import clsx from "clsx";

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "/api").trim();
const apiOrigin = apiBaseUrl.startsWith("http") ? new URL(apiBaseUrl).origin : "";

const api = axios.create({
  baseURL: apiBaseUrl,
});

const MotionImage = motion.img;
const MotionDiv = motion.div;

function assetUrl(input) {
  if (!input) return null;
  if (input.startsWith("http")) return input;
  if (apiOrigin && input.startsWith("/")) return `${apiOrigin}${input}`;
  return input;
}

function formatDate(input) {
  if (!input) return "刚刚";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(input));
}

function sortCarousel(images = []) {
  return [...images]
    .filter((item) => item.enabled)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

function LoadingPane({ label = "正在加载" }) {
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

function ErrorPane({ title = "页面暂时不可用", message, action }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center px-6">
      <div className="paper-panel w-full max-w-2xl rounded-[2rem] p-10 shadow-[0_25px_80px_rgba(35,26,12,0.14)]">
        <p className="mb-3 text-xs uppercase tracking-[0.35em] text-[#8b2f2a]">
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

function Badge({ children, tone = "default" }) {
  return (
    <span
      className={clsx(
        "inline-flex rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.28em]",
        tone === "accent" && "bg-[#8b2f2a]/10 text-[#8b2f2a]",
        tone === "muted" && "bg-stone-900/6 text-stone-500",
        tone === "success" && "bg-emerald-700/10 text-emerald-700",
        tone === "warning" && "bg-amber-600/10 text-amber-700",
        tone === "default" && "bg-stone-200/70 text-stone-700"
      )}
    >
      {children}
    </span>
  );
}

function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs uppercase tracking-[0.25em] text-stone-500">
        {label}
      </span>
      {children}
      {hint ? <p className="mt-2 text-xs text-stone-500">{hint}</p> : null}
    </label>
  );
}

function TextInput(props) {
  return (
    <input
      {...props}
      className={clsx(
        "w-full rounded-2xl border border-stone-300/70 bg-white/80 px-4 py-3 text-sm text-stone-900 outline-none transition",
        "placeholder:text-stone-400 focus:border-[#8b2f2a] focus:ring-2 focus:ring-[#8b2f2a]/15",
        props.className
      )}
    />
  );
}

function TextArea(props) {
  return (
    <textarea
      {...props}
      className={clsx(
        "w-full rounded-3xl border border-stone-300/70 bg-white/80 px-4 py-3 text-sm leading-7 text-stone-900 outline-none transition",
        "placeholder:text-stone-400 focus:border-[#8b2f2a] focus:ring-2 focus:ring-[#8b2f2a]/15",
        props.className
      )}
    />
  );
}

function PrimaryButton({ className, children, ...props }) {
  return (
    <button
      {...props}
      className={clsx(
        "inline-flex items-center justify-center rounded-full bg-[#8b2f2a] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#6d221f] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    >
      {children}
    </button>
  );
}

function SecondaryButton({ className, children, ...props }) {
  return (
    <button
      {...props}
      className={clsx(
        "inline-flex items-center justify-center rounded-full border border-stone-300 bg-white/80 px-5 py-3 text-sm font-medium text-stone-700 transition hover:border-stone-400 hover:bg-white",
        className
      )}
    >
      {children}
    </button>
  );
}

function SectionHeading({ eyebrow, title, description }) {
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

function SearchForm({ initialValue = "", compact = false, onSubmit }) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit(value.trim());
  }

  return (
    <form
      className={clsx(
        "rounded-[2rem] border border-stone-200/70 bg-white/85 p-3 shadow-[0_18px_60px_rgba(47,33,15,0.08)]",
        compact ? "flex flex-col gap-3 md:flex-row" : "mt-8"
      )}
      onSubmit={handleSubmit}
    >
      <div className="flex-1">
        <TextInput
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="搜索书名，例如：共产党宣言"
          className="border-0 bg-transparent px-3 py-3 text-base shadow-none focus:ring-0"
        />
      </div>
      <PrimaryButton type="submit" className={compact ? "md:min-w-32" : "w-full md:w-auto"}>
        搜索图书
      </PrimaryButton>
    </form>
  );
}

function BookCard({ book }) {
  return (
    <Link
      to={`/books/${book.id}`}
      className="group rounded-[2rem] border border-stone-200/80 bg-white/80 p-6 shadow-[0_18px_60px_rgba(47,33,15,0.08)] transition hover:-translate-y-1 hover:shadow-[0_24px_70px_rgba(47,33,15,0.12)]"
    >
      <h3 className="mt-5 font-display text-3xl text-stone-900 transition group-hover:text-[#8b2f2a]">
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

function PublicShell({ children, assets }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f6f0e3] text-stone-900">
      <div className="grain-overlay" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(139,47,42,0.18),transparent_35%),linear-gradient(180deg,#f7f0e5,rgba(247,240,229,0.65))]" />
      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-4 pb-12 pt-5 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-6 rounded-full border border-white/60 bg-white/55 px-5 py-4 shadow-[0_15px_60px_rgba(64,44,19,0.08)] backdrop-blur">
          <div className="flex items-center gap-4">
            {assets?.schoolLogoPath ? (
              <img
                src={assetUrl(assets.schoolLogoPath)}
                alt="学校 logo"
                className="h-12 w-12 rounded-full border border-stone-200 object-cover shadow-sm"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-stone-200 bg-stone-100 text-xs text-stone-500">
                LOGO
              </div>
            )}
            <div>
              <p className="font-sans text-[11px] uppercase tracking-[0.32em] text-stone-500">
                上海市敬业中学
              </p>
              <Link to="/" className="font-display text-2xl tracking-[0.02em] text-stone-900">
                一本书的漂流
              </Link>
            </div>
          </div>
          <div className="text-sm text-stone-500">图书馆馆内统一入口</div>
        </header>
        {children}
      </div>
    </div>
  );
}

function useSiteAssets() {
  const [assets, setAssets] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api
      .get("/site-assets")
      .then((response) => {
        if (!active) return;
        setAssets(response.data);
      })
      .catch((requestError) => {
        if (!active) return;
        setError(requestError.response?.data?.message || "站点素材加载失败");
      });

    return () => {
      active = false;
    };
  }, []);

  return { assets, error };
}

function useHomepageData() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api
      .get("/homepage")
      .then((response) => {
        if (!active) return;
        setData(response.data);
      })
      .catch((requestError) => {
        if (!active) return;
        setError(requestError.response?.data?.message || "首页榜单加载失败");
      });

    return () => {
      active = false;
    };
  }, []);

  return { data, error };
}

function HomePage() {
  const navigate = useNavigate();
  const { assets, error } = useSiteAssets();
  const { data: homepage, error: homepageError } = useHomepageData();
  const [activeIndex, setActiveIndex] = useState(0);

  const slides = useMemo(
    () => sortCarousel(assets?.carouselImages || []),
    [assets?.carouselImages]
  );

  useEffect(() => {
    if (slides.length <= 1) return undefined;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % slides.length);
    }, 4200);
    return () => window.clearInterval(timer);
  }, [slides.length]);

  if (error || homepageError) {
    return (
      <PublicShell assets={assets}>
        <ErrorPane message={error || homepageError} />
      </PublicShell>
    );
  }

  if (!assets || !homepage) {
    return (
      <PublicShell assets={assets}>
        <LoadingPane label="正在装载活动主页" />
      </PublicShell>
    );
  }

  const activeSlide = slides[activeIndex];

  return (
    <PublicShell assets={assets}>
      <main className="grid flex-1 gap-8 xl:grid-cols-[0.78fr_1.32fr_0.9fr]">
        <section className="space-y-5">
          <div className="rounded-[2.2rem] border border-stone-200/80 bg-white/80 p-6 shadow-[0_22px_70px_rgba(47,33,15,0.08)]">
            <p className="text-xs uppercase tracking-[0.34em] text-[#8b2f2a]">Activity Rank</p>
            <h2 className="mt-3 font-display text-3xl text-stone-900">留言量排行榜</h2>
            <p className="mt-3 text-sm leading-7 text-stone-600">
              仅统计已审核公开的接龙层数，点击即可进入对应书页继续阅读。
            </p>
            <div className="mt-6 space-y-3">
              {(homepage.activityBooks || []).length === 0 ? (
                <div className="rounded-[1.6rem] border border-dashed border-stone-300 bg-[#faf6ef] p-4 text-sm leading-7 text-stone-500">
                  当前还没有公开接龙，欢迎成为第一位留言的读者。
                </div>
              ) : (
                homepage.activityBooks.map((book, index) => (
                  <Link
                    key={book.id}
                    to={`/books/${book.id}`}
                    className="block rounded-[1.6rem] border border-stone-200 bg-[#faf6ef] p-4 transition hover:border-[#8b2f2a]/35 hover:bg-white"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.24em] text-stone-500">
                          No.{String(index + 1).padStart(2, "0")}
                        </p>
                        <h3 className="mt-2 text-base font-semibold text-stone-900">
                          {book.title}
                        </h3>
                      </div>
                      <div className="text-right">
                        <div className="font-display text-3xl text-[#8b2f2a]">
                          {book.messageCount}
                        </div>
                        <p className="text-xs text-stone-500">层留言</p>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="space-y-8">
          <section className="paper-panel relative overflow-hidden rounded-[2.4rem] p-8 shadow-[0_30px_90px_rgba(58,39,18,0.12)] md:p-12">
            <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-[#8b2f2a]/10 blur-3xl" />
            <Badge tone="accent">馆内阅读活动</Badge>
            <h1 className="mt-6 max-w-3xl font-display text-5xl leading-[1.05] text-stone-900 md:text-7xl">
              一条接龙，
              <span className="text-[#8b2f2a]"> 把一本到下一位读者手里。</span>
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-stone-600 md:text-lg">
              搜索一本书，进入它的专属接龙页。每位同学都能在审核后留下自己的那一层阅读回声。
            </p>

            <SearchForm
              onSubmit={(value) => value && navigate(`/search?q=${encodeURIComponent(value)}`)}
            />

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {[
                ["实名校验", "更稳妥", "每次留言都要重新核验学号、姓名和身份证后四位。"],
                ["单链接龙", "更清晰", "每本书只有一条持续延伸的阅读链，不做分叉讨论。"],
                ["精选摘录", "更聚焦", "管理员会把有代表性的留言放到首页，帮助更多人进入好书。"],
              ].map(([value, title, desc]) => (
                <div key={title} className="rounded-[1.8rem] border border-stone-200/80 bg-white/75 p-5">
                  <div className="font-display text-2xl text-stone-900">{value}</div>
                  <div className="mt-2 text-sm font-semibold text-stone-800">{title}</div>
                  <p className="mt-2 text-sm leading-6 text-stone-600">{desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="relative flex min-h-[28rem] flex-col overflow-hidden rounded-[2.4rem] border border-white/60 bg-stone-900 shadow-[0_30px_100px_rgba(23,17,8,0.35)]">
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(22,16,9,0.1),rgba(22,16,9,0.8))]" />
            <AnimatePresence mode="wait">
              {activeSlide ? (
                <MotionImage
                  key={activeSlide.id}
                  src={assetUrl(activeSlide.path)}
                  alt={activeSlide.label}
                  className="absolute inset-0 h-full w-full object-cover"
                  initial={{ scale: 1.08, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.98, opacity: 0 }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
              ) : (
                <MotionDiv
                  key="placeholder"
                  className="absolute inset-0 bg-[linear-gradient(135deg,#5b201f,#19130f)]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                />
              )}
            </AnimatePresence>
            <div className="relative z-10 mt-auto p-8 text-white md:p-10">
              <Badge tone="warning">校园轮播</Badge>
              <h2 className="mt-4 font-display text-4xl leading-tight md:text-5xl">
                每一层接龙，都是下一位读者的入场券。
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-7 text-stone-200">
                从图书馆七楼出发，在同一本书下留下连续的阅读痕迹，让阅读真正流动起来。
              </p>
              <div className="mt-8 flex gap-3">
                {slides.map((slide, index) => (
                  <button
                    key={slide.id}
                    type="button"
                    onClick={() => setActiveIndex(index)}
                    className={clsx(
                      "h-2.5 rounded-full transition-all",
                      activeIndex === index ? "w-12 bg-white" : "w-5 bg-white/35"
                    )}
                    aria-label={`切换到 ${slide.label}`}
                  />
                ))}
              </div>
            </div>
          </section>
        </section>

        <section className="space-y-5">
          <div className="rounded-[2.2rem] border border-stone-200/80 bg-white/80 p-6 shadow-[0_22px_70px_rgba(47,33,15,0.08)]">
            <p className="text-xs uppercase tracking-[0.34em] text-[#8b2f2a]">Featured Lines</p>
            <h2 className="mt-3 font-display text-3xl text-stone-900">管理员精选留言</h2>
            <p className="mt-3 text-sm leading-7 text-stone-600">
              选取已经公开的接龙片段，点击后直接跳到对应图书与层级。
            </p>
            <div className="mt-6 space-y-3">
              {(homepage.featuredReviews || []).length === 0 ? (
                <div className="rounded-[1.6rem] border border-dashed border-stone-300 bg-[#faf6ef] p-4 text-sm leading-7 text-stone-500">
                  还没有精选留言，管理员审核后会逐步补充。
                </div>
              ) : (
                homepage.featuredReviews.map((review, index) => (
                  <Link
                    key={review.id}
                    to={`/books/${review.bookId}#review-${review.id}`}
                    className="block rounded-[1.6rem] border border-stone-200 bg-[#faf6ef] p-4 transition hover:border-[#8b2f2a]/35 hover:bg-white"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <Badge tone="accent">精选 {String(index + 1).padStart(2, "0")}</Badge>
                      {review.sequenceNumber ? (
                        <Badge tone="muted">第 {review.sequenceNumber} 层</Badge>
                      ) : null}
                    </div>
                    <h3 className="mt-4 text-base font-semibold text-stone-900">
                      {review.bookTitle}
                    </h3>
                    <p className="mt-3 max-h-[11rem] overflow-hidden text-sm leading-7 text-stone-700">
                      {review.content}
                    </p>
                    <p className="mt-3 text-xs text-stone-500">{review.displayName}</p>
                  </Link>
                ))
              )}
            </div>
          </div>
        </section>
      </main>

      <section className="mt-10 grid gap-6 rounded-[2.4rem] border border-stone-200/70 bg-white/75 p-8 shadow-[0_20px_60px_rgba(58,39,18,0.08)] md:grid-cols-[0.8fr_1.2fr] md:p-10">
        <SectionHeading
          eyebrow="How It Works"
          title="如何加入这一条接龙？"
          description="流程被刻意压得很短，但每一步都更明确：先找书，再实名核验，最后把你的那一层接上去。"
        />
        <div className="grid gap-4">
          {(assets.processContent || []).map((step, index) => (
            <div
              key={step.id}
              className="flex gap-4 rounded-[1.8rem] border border-stone-200 bg-[#faf6ef] p-5"
            >
              <div className="font-display text-3xl text-[#8b2f2a]">
                {String(index + 1).padStart(2, "0")}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-stone-900">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-stone-600">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </PublicShell>
  );
}

function SearchPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const query = searchParams.get("q") || "";
  const { assets, error: assetError } = useSiteAssets();
  const [books, setBooks] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!query.trim()) {
      setBooks([]);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError("");

    api
      .get("/books/search", {
        params: { q: query },
      })
      .then((response) => {
        if (!active) return;
        setBooks(response.data.books);
      })
      .catch((requestError) => {
        if (!active) return;
        setError(requestError.response?.data?.message || "图书搜索失败");
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [query]);

  if (assetError) {
    return (
      <PublicShell assets={assets}>
        <ErrorPane message={assetError} />
      </PublicShell>
    );
  }

  return (
    <PublicShell assets={assets}>
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
        {loading ? <LoadingPane label="正在搜索图书" /> : null}
        {!loading && error ? (
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
        {!loading && !error ? (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.34em] text-[#8b2f2a]">
                  Search Result
                </p>
                <h2 className="mt-2 font-display text-4xl text-stone-900">
                  共找到 {books.length} 本相关图书
                </h2>
                <p className="mt-3 text-sm leading-7 text-stone-600">
                  当前关键词：{query || "未输入"}
                </p>
              </div>
              <Link to="/">
                <SecondaryButton>返回首页</SecondaryButton>
              </Link>
            </div>

            {books.length === 0 ? (
              <div className="paper-panel rounded-[2rem] p-8 text-sm leading-7 text-stone-600 shadow-[0_24px_70px_rgba(47,33,15,0.08)]">
                未找到相关图书，请尝试更换关键词，或回到首页重新搜索。
              </div>
            ) : (
              <div className="grid gap-5 md:grid-cols-2">
                {books.map((book) => (
                  <BookCard key={book.id} book={book} />
                ))}
              </div>
            )}
          </div>
        ) : null}
      </section>
    </PublicShell>
  );
}

function BookDetailPage() {
  const { bookId } = useParams();
  const { assets, error: assetError } = useSiteAssets();
  const [book, setBook] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");
  const [formState, setFormState] = useState({
    systemId: "",
    studentName: "",
    idCardSuffix: "",
    content: "",
  });

  async function loadData() {
    const [bookRes, reviewsRes] = await Promise.all([
      api.get(`/books/${bookId}`),
      api.get(`/books/${bookId}/reviews`),
    ]);
    setBook(bookRes.data.book);
    setReviews(reviewsRes.data.reviews);
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    Promise.all([api.get(`/books/${bookId}`), api.get(`/books/${bookId}/reviews`)])
      .then(([bookRes, reviewsRes]) => {
        if (!active) return;
        setBook(bookRes.data.book);
        setReviews(reviewsRes.data.reviews);
      })
      .catch((requestError) => {
        if (!active) return;
        setError(requestError.response?.data?.message || "图书详情加载失败");
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [bookId]);

  useEffect(() => {
    if (!reviews.length || !window.location.hash) return;
    const target = document.getElementById(window.location.hash.slice(1));
    if (!target) return;
    window.setTimeout(() => {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
  }, [reviews]);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const response = await api.post(`/books/${bookId}/reviews`, formState);
      setSuccess(response.data.message);
      setFormState({
        systemId: "",
        studentName: "",
        idCardSuffix: "",
        content: "",
      });
      await loadData();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "留言提交失败");
    } finally {
      setSubmitting(false);
    }
  }

  if (assetError) {
    return (
      <PublicShell assets={assets}>
        <ErrorPane message={assetError} />
      </PublicShell>
    );
  }

  if (loading) {
    return (
      <PublicShell assets={assets}>
        <LoadingPane label="正在加载图书详情" />
      </PublicShell>
    );
  }

  if (!book) {
    return (
      <PublicShell assets={assets}>
        <ErrorPane title="图书不存在" message={error || "请返回首页重新搜索。"} />
      </PublicShell>
    );
  }

  const detailFields = [
    ["作者", book.authors?.length ? book.authors.join(" / ") : book.author],
    ["出版地", book.publishPlace],
    ["出版社", book.publishers?.length ? book.publishers.join(" / ") : book.publisher],
    [
      "出版日期",
      book.publishDateTexts?.length ? book.publishDateTexts.join(" / ") : book.publishDateText,
    ],
    ["馆藏总册数", `${book.totalCopies} 册`],
    ["副标题", book.subtitle],
  ];

  return (
    <PublicShell assets={assets}>
      <main className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="paper-panel rounded-[2.4rem] p-8 shadow-[0_30px_90px_rgba(58,39,18,0.12)] md:p-10">
          <Badge tone="accent">单书接龙页</Badge>
          <h1 className="mt-6 font-display text-5xl leading-tight text-stone-900">
            {book.title}
          </h1>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {detailFields.map(([label, value]) => (
              value ? (
                <div key={label} className="rounded-[1.8rem] border border-stone-200 bg-[#faf6ef] p-5">
                  <p className="text-xs uppercase tracking-[0.28em] text-stone-500">{label}</p>
                  <p className="mt-3 text-lg font-semibold text-stone-900">{value}</p>
                </div>
              ) : null
            ))}
          </div>
          <div className="mt-6 rounded-[1.8rem] border border-stone-200 bg-[#faf6ef] p-5">
            <p className="text-xs uppercase tracking-[0.28em] text-stone-500">条形码列表</p>
            {book.barcodes?.length ? (
              <div className="mt-3 flex flex-wrap gap-3">
                {book.barcodes.map((barcode) => (
                  <Badge key={barcode} tone="muted">
                    {barcode}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-stone-500">暂无条形码信息</p>
            )}
          </div>
          <div className="mt-6 rounded-[1.8rem] border border-[#8b2f2a]/10 bg-[#8b2f2a]/5 p-5">
            <p className="text-xs uppercase tracking-[0.28em] text-[#8b2f2a]">留言规则</p>
            <p className="mt-3 text-sm leading-7 text-stone-700">
              这本书只有一条连续接龙。你提交的内容会先进入待审核队列，审核通过后才会作为下一层公开显示。
            </p>
          </div>
          <div className="mt-8 flex gap-3">
            <Link to="/">
              <SecondaryButton>返回首页</SecondaryButton>
            </Link>
          </div>
        </section>

        <section className="flex flex-col gap-6">
          <div className="paper-panel rounded-[2.4rem] p-8 shadow-[0_30px_90px_rgba(58,39,18,0.12)]">
            <SectionHeading
              eyebrow="Public Thread"
              title="已公开接龙"
              description="这里只展示已经审核公开的层级。顺序越靠后，表示越接近当前最新一层。"
            />
            <div className="mt-8 space-y-5">
              {reviews.length === 0 ? (
                <div className="rounded-[1.8rem] border border-dashed border-stone-300 bg-[#faf6ef] p-6 text-sm leading-7 text-stone-500">
                  这本书还没有公开接龙，欢迎你成为第一位接上去的读者。
                </div>
              ) : null}
              {reviews.map((review) => (
                <div
                  key={review.id}
                  id={`review-${review.id}`}
                  className="rounded-[1.8rem] border border-stone-200 bg-white/75 p-5 scroll-mt-28"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    {review.sequenceNumber ? (
                      <Badge tone="accent">第 {review.sequenceNumber} 层</Badge>
                    ) : null}
                    <span className="font-semibold text-stone-900">{review.displayName}</span>
                    <Badge tone="muted">{formatDate(review.reviewedAt || review.createdAt)}</Badge>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-stone-700">{review.content}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="paper-panel rounded-[2.4rem] p-8 shadow-[0_30px_90px_rgba(58,39,18,0.12)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-[#8b2f2a]">Join The Chain</p>
                <h2 className="mt-2 font-display text-3xl text-stone-900">接上你的这一层</h2>
              </div>
              <Badge tone="accent">审核后公开</Badge>
            </div>

            <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
              <Field label="学号">
                <TextInput
                  value={formState.systemId}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      systemId: event.target.value,
                    }))
                  }
                  disabled={submitting}
                  placeholder="例如 320250002"
                />
              </Field>
              <Field label="姓名">
                <TextInput
                  value={formState.studentName}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      studentName: event.target.value,
                    }))
                  }
                  disabled={submitting}
                  placeholder="请输入学籍姓名"
                />
              </Field>
              <Field label="身份证后四位" hint="仅用于本次身份校验，不会在前台公开显示。">
                <TextInput
                  value={formState.idCardSuffix}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      idCardSuffix: event.target.value.toUpperCase(),
                    }))
                  }
                  disabled={submitting}
                  placeholder="例如 3225"
                />
              </Field>
              <Field label="接龙内容" hint="请输入 1 到 500 字的阅读感受或回应。">
                <TextArea
                  rows={5}
                  value={formState.content}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      content: event.target.value,
                    }))
                  }
                  disabled={submitting}
                  placeholder="写下你想接上的这一层内容。"
                />
              </Field>

              {success ? (
                <div className="rounded-[1.8rem] border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-800">
                  {success}
                </div>
              ) : null}
              {error ? (
                <div className="rounded-[1.8rem] border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-700">
                  {error}
                </div>
              ) : null}

              <PrimaryButton type="submit" disabled={submitting} className="w-full sm:w-auto">
                {submitting ? "正在提交" : "提交并进入审核"}
              </PrimaryButton>
            </form>
          </div>
        </section>
      </main>
    </PublicShell>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/books/:bookId" element={<BookDetailPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
