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

function HomePage() {
  const navigate = useNavigate();
  const { assets, error } = useSiteAssets();
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

  if (error) {
    return (
      <PublicShell assets={assets}>
        <ErrorPane message={error} />
      </PublicShell>
    );
  }

  if (!assets) {
    return (
      <PublicShell assets={assets}>
        <LoadingPane label="正在装载活动主页" />
      </PublicShell>
    );
  }

  const activeSlide = slides[activeIndex];

  return (
    <PublicShell assets={assets}>
      <main className="grid flex-1 gap-10 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="paper-panel relative overflow-hidden rounded-[2.4rem] p-8 shadow-[0_30px_90px_rgba(58,39,18,0.12)] md:p-12">
          <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-[#8b2f2a]/10 blur-3xl" />
          <Badge tone="accent">馆内阅读活动</Badge>
          <h1 className="mt-6 max-w-3xl font-display text-5xl leading-[1.05] text-stone-900 md:text-7xl">
            开启阅读漂流，
            <span className="text-[#8b2f2a]"> 遇见下一本好书。</span>
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-stone-600 md:text-lg">
            在“一本书的漂流”里，你可以寻找感兴趣的藏书，阅读同学们的真实感悟，并留下独属于你的阅读足迹。
          </p>

          <SearchForm onSubmit={(value) => value && navigate(`/search?q=${encodeURIComponent(value)}`)} />

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              ["启程漂流", "随时出发", "只需轻轻一扫，即可随时进入这片阅读的海洋。"],
              ["寻觅好书", "一键探索", "输入书名线索，快速发现你心仪的那本读物。"],
              ["点滴笔触", "真诚分享", "看看大家的读后感，也欢迎留下你独一无二的见解。"],
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
              每一本书，都在静静等待它的下一位读者。
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-7 text-stone-200">
              图书馆是我们阅读漂流的共同起点。从这里出发，共同开启一段充满未知的阅读旅程。
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
      </main>

      <section className="mt-10 grid gap-6 rounded-[2.4rem] border border-stone-200/70 bg-white/75 p-8 shadow-[0_20px_60px_rgba(58,39,18,0.08)] md:grid-cols-[0.8fr_1.2fr] md:p-10">
        <SectionHeading
          eyebrow="How It Works"
          title="如何参与阅读漂流？轻松几步即可开启。"
          description="阅读从来不是一件孤独的事。跟随以下步骤，与大家分享你收获的书香与喜悦。"
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
  const [formState, setFormState] = useState({ displayName: "", content: "" });

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

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const response = await api.post(`/books/${bookId}/reviews`, formState);
      setSuccess(response.data.message);
      setFormState({ displayName: "", content: "" });
      await loadData();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "评语提交失败");
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

  return (
    <PublicShell assets={assets}>
      <main className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="paper-panel rounded-[2.4rem] p-8 shadow-[0_30px_90px_rgba(58,39,18,0.12)] md:p-10">
          <h1 className="mt-6 font-display text-5xl leading-tight text-stone-900">
            {book.title}
          </h1>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {[
              ["作者", book.author],
              ["出版地", book.publishPlace],
              ["出版社", book.publisher],
              ["出版日期", book.publishDateText],
              ["条形码", book.barcode],
              ["副标题", book.subtitle],
            ].map(([label, value]) => (
              value ? (
                <div key={label} className="rounded-[1.8rem] border border-stone-200 bg-[#faf6ef] p-5">
                  <p className="text-xs uppercase tracking-[0.28em] text-stone-500">{label}</p>
                  <p className="mt-3 text-lg font-semibold text-stone-900">{value}</p>
                </div>
              ) : null
            ))}
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
              eyebrow="Public Reviews"
              title="已公开评语"
              description="来自同学们的真实阅读感受，随时期待你的加入。"
            />
            <div className="mt-8 space-y-5">
              {reviews.length === 0 ? (
                <div className="rounded-[1.8rem] border border-dashed border-stone-300 bg-[#faf6ef] p-6 text-sm leading-7 text-stone-500">
                  这本书还没有公开评语，欢迎你成为第一位留下阅读感受的人。
                </div>
              ) : null}
              {reviews.map((review) => (
                <div key={review.id} className="rounded-[1.8rem] border border-stone-200 bg-white/75 p-5">
                  <div className="flex flex-wrap items-center gap-3">
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
                <p className="text-xs uppercase tracking-[0.3em] text-[#8b2f2a]">Submit Review</p>
                <h2 className="mt-2 font-display text-3xl text-stone-900">写下你的评语</h2>
              </div>
              <Badge tone="accent">审核后公开</Badge>
            </div>

            <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
              <Field label="姓名或昵称">
                <TextInput
                  value={formState.displayName}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      displayName: event.target.value,
                    }))
                  }
                  disabled={submitting}
                  placeholder="例如 小林"
                />
              </Field>
              <Field label="评语内容" hint="请输入 1 到 500 字的阅读感受。">
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
                  placeholder="写下你的阅读感受、喜欢的段落或推荐理由。"
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
                {submitting ? "正在提交" : "提交评语"}
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
