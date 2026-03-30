import {
  useCallback,
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import axios from "axios";
import { AnimatePresence, motion } from "framer-motion";
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import clsx from "clsx";

const api = axios.create({
  baseURL: "/api",
});

const MotionImage = motion.img;
const MotionDiv = motion.div;

const ADMIN_TOKEN_KEY = "drift-book-admin-token";

function getAdminToken() {
  return window.localStorage.getItem(ADMIN_TOKEN_KEY);
}

function setAdminToken(token) {
  if (!token) {
    window.localStorage.removeItem(ADMIN_TOKEN_KEY);
    return;
  }
  window.localStorage.setItem(ADMIN_TOKEN_KEY, token);
}

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function assetUrl(input) {
  if (!input) return null;
  if (input.startsWith("http")) return input;
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

function PublicShell({ children, assets }) {
  const location = useLocation();

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
          <nav className="flex flex-wrap items-center gap-3 text-sm text-stone-600">
            <Link
              to="/"
              className={clsx(
                "rounded-full px-4 py-2 transition",
                location.pathname === "/" ? "bg-stone-900 text-white" : "hover:bg-white/80"
              )}
            >
              论坛主页
            </Link>
            <Link
              to="/admin/pages"
              className="rounded-full border border-stone-300 px-4 py-2 hover:bg-white/80"
            >
              管理后台
            </Link>
          </nav>
        </header>
        {children}
      </div>
    </div>
  );
}

function HomePage() {
  const [assets, setAssets] = useState(null);
  const [error, setError] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    let isMounted = true;
    api
      .get("/site-assets")
      .then((response) => {
        if (!isMounted) return;
        setAssets(response.data);
      })
      .catch((requestError) => {
        if (!isMounted) return;
        setError(requestError.response?.data?.message || "站点素材加载失败");
      });

    return () => {
      isMounted = false;
    };
  }, []);

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
        <LoadingPane label="正在装载论坛主页" />
      </PublicShell>
    );
  }

  const activeSlide = slides[activeIndex];

  return (
    <PublicShell assets={assets}>
      <main className="grid flex-1 gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="paper-panel relative overflow-hidden rounded-[2.4rem] p-8 shadow-[0_30px_90px_rgba(58,39,18,0.12)] md:p-12">
          <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-[#8b2f2a]/10 blur-3xl" />
          <Badge tone="accent">漂流阅读计划</Badge>
          <h1 className="mt-6 max-w-3xl font-display text-5xl leading-[1.05] text-stone-900 md:text-7xl">
            让每一本书都留下
            <span className="text-[#8b2f2a]"> 接力式的回声。</span>
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-stone-600 md:text-lg">
            扫描贴在书后的二维码，直接进入对应书页，按顺序写下自己的评语、摘记与读后感。
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              ["100 本", "二维码独立映射", "每本书都是独立入口，不串页。"],
              ["10 层", "单链接龙", "审核通过一层，才开放下一层。"],
              ["校园化", "统一学校品牌", "主页使用校内图书馆影像与学校 logo。"],
            ].map(([value, title, desc]) => (
              <div key={title} className="rounded-[1.8rem] border border-stone-200/80 bg-white/75 p-5">
                <div className="font-display text-3xl text-stone-900">{value}</div>
                <div className="mt-2 text-sm font-semibold text-stone-800">{title}</div>
                <p className="mt-2 text-sm leading-6 text-stone-600">{desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 flex flex-wrap gap-4">
            <Link to="/admin/pages">
              <PrimaryButton>进入后台配置</PrimaryButton>
            </Link>
            <a href="#how-it-works">
              <SecondaryButton>查看流程说明</SecondaryButton>
            </a>
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
              图书馆日常，将成为这场漂流计划的舞台背景。
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-7 text-stone-200">
              后台可以从你已经准备好的本地素材中导入学校 logo 和轮播图，并调整展示顺序。首屏强调阅读氛围，而具体留言则回到每一本书自己的书页。
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

      <section
        id="how-it-works"
        className="mt-10 grid gap-6 rounded-[2.4rem] border border-stone-200/70 bg-white/75 p-8 shadow-[0_20px_60px_rgba(58,39,18,0.08)] md:grid-cols-[0.8fr_1.2fr] md:p-10"
      >
        <SectionHeading
          eyebrow="How It Works"
          title="阅读接龙不是论坛灌水，而是一条被严格控制节奏的链。"
          description="每位学生只在当前开放层级写下内容，管理员审核通过后才会推进到下一层。这样既能保证内容质量，也能让阅读痕迹一层层沉淀。"
        />
        <div className="grid gap-4">
          {[
            ["01", "扫码进入书页", "每本书背后都贴有唯一二维码，学生扫描后直接进入对应书页。"],
            ["02", "提交当前层留言", "系统只开放当前可写层级，并显示已经通过审核的留言链。"],
            ["03", "管理员审核", "后台待审核队列统一处理，通过则推进，驳回则同层重开。"],
            ["04", "形成完整书页档案", "第 10 层通过后页面锁定，形成这一轮阅读接龙的完整记录。"],
          ].map(([step, title, description]) => (
            <div
              key={step}
              className="flex gap-4 rounded-[1.8rem] border border-stone-200 bg-[#faf6ef] p-5"
            >
              <div className="font-display text-3xl text-[#8b2f2a]">{step}</div>
              <div>
                <h3 className="text-lg font-semibold text-stone-900">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-stone-600">{description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </PublicShell>
  );
}

function PublicPage() {
  const { qrCode } = useParams();
  const [assets, setAssets] = useState(null);
  const [page, setPage] = useState(null);
  const [formState, setFormState] = useState({ personalId: "", content: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadPage = async () => {
    const [assetRes, pageRes] = await Promise.all([
      api.get("/site-assets"),
      api.get(`/pages/${qrCode}`),
    ]);
    setAssets(assetRes.data);
    setPage(pageRes.data);
  };

  useEffect(() => {
    let active = true;
    setError("");
    setSuccess("");

    Promise.all([api.get("/site-assets"), api.get(`/pages/${qrCode}`)])
      .then(([assetRes, pageRes]) => {
        if (!active) return;
        setAssets(assetRes.data);
        setPage(pageRes.data);
      })
      .catch((requestError) => {
        if (!active) return;
        setError(requestError.response?.data?.message || "书页加载失败");
      });

    return () => {
      active = false;
    };
  }, [qrCode]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!page?.nextOpenLevel) return;

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const response = await api.post(`/pages/${qrCode}/messages`, formState);
      setSuccess(response.data.message);
      setFormState({ personalId: "", content: "" });
      await loadPage();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "提交失败");
    } finally {
      setSubmitting(false);
    }
  }

  if (!page && error) {
    return (
      <PublicShell assets={assets}>
        <ErrorPane title="书页加载失败" message={error} />
      </PublicShell>
    );
  }

  if (!page) {
    return (
      <PublicShell assets={assets}>
        <LoadingPane label="正在加载书页" />
      </PublicShell>
    );
  }

  const progress = Math.min((page.approvedMessages.length / 10) * 100, 100);

  return (
    <PublicShell assets={assets}>
      <main className="grid gap-8 lg:grid-cols-[0.96fr_1.04fr]">
        <section className="paper-panel relative overflow-hidden rounded-[2.4rem] p-8 shadow-[0_30px_90px_rgba(58,39,18,0.12)] md:p-10">
          <div className="absolute left-0 top-0 h-36 w-36 rounded-full bg-[#8b2f2a]/10 blur-3xl" />
          <Badge tone={page.status === "full" ? "warning" : "accent"}>
            {page.status === "full" ? "本轮已满" : `当前第 ${page.currentRoundNumber} 轮`}
          </Badge>
          <div className="mt-6 flex flex-col gap-6 md:flex-row">
            <div className="w-full md:max-w-[18rem]">
              {page.coverImagePath ? (
                <img
                  src={assetUrl(page.coverImagePath)}
                  alt={page.title}
                  className="aspect-[4/5] w-full rounded-[2rem] object-cover shadow-[0_18px_50px_rgba(45,29,12,0.18)]"
                />
              ) : (
                <div className="flex aspect-[4/5] w-full items-center justify-center rounded-[2rem] border border-dashed border-stone-300 bg-[#faf5ec] text-sm text-stone-500">
                  暂无封面
                </div>
              )}
            </div>
            <div className="flex-1">
              <h1 className="font-display text-4xl text-stone-900 md:text-5xl">
                {page.title}
              </h1>
              <p className="mt-3 text-sm uppercase tracking-[0.28em] text-stone-500">
                {page.author}
              </p>
              <p className="mt-6 text-sm leading-7 text-stone-600 md:text-base">
                {page.description}
              </p>

              <div className="mt-8 rounded-[1.8rem] border border-stone-200 bg-[#faf6ef] p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-[0.28em] text-stone-500">
                    链条进度
                  </span>
                  <span className="font-display text-2xl text-stone-900">
                    {page.approvedMessages.length}/10
                  </span>
                </div>
                <div className="mt-4 h-3 rounded-full bg-stone-200">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,#8b2f2a,#d39a65)]"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="mt-4 text-sm leading-6 text-stone-600">
                  {page.nextOpenLevel
                    ? `当前开放第 ${page.nextOpenLevel} 层留言。`
                    : page.pendingMessage
                      ? "当前有一条留言待审核，审核通过后才会继续开放。"
                      : "本轮接龙已经完成，等待管理员重置新一轮。"}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-6">
          <div className="paper-panel rounded-[2.4rem] p-8 shadow-[0_30px_90px_rgba(58,39,18,0.12)]">
            <SectionHeading
              eyebrow="Reading Relay"
              title="已通过审核的留言链"
              description="每一层都公开展示在这里，形成可追溯的阅读接龙。"
            />
            <div className="mt-8 space-y-5">
              {page.approvedMessages.length === 0 ? (
                <div className="rounded-[1.8rem] border border-dashed border-stone-300 bg-[#faf6ef] p-6 text-sm leading-7 text-stone-500">
                  这一页还没有公开留言。第 1 位读者将成为这条阅读接龙的起点。
                </div>
              ) : null}
              {page.approvedMessages.map((message, index) => (
                <div
                  key={message.id}
                  className="relative rounded-[1.8rem] border border-stone-200 bg-white/75 p-5"
                >
                  {index < page.approvedMessages.length - 1 ? (
                    <div className="absolute left-8 top-full h-5 w-px bg-stone-300" />
                  ) : null}
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#8b2f2a] font-sans text-sm font-semibold text-white">
                      {message.level}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="font-semibold text-stone-900">
                          学号 / ID {message.personalId}
                        </span>
                        <Badge tone="muted">{formatDate(message.createdAt)}</Badge>
                      </div>
                      <p className="mt-3 text-sm leading-7 text-stone-700">
                        {message.content}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="paper-panel rounded-[2.4rem] p-8 shadow-[0_30px_90px_rgba(58,39,18,0.12)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-[#8b2f2a]">
                  Submit Message
                </p>
                <h2 className="mt-2 font-display text-3xl text-stone-900">
                  写下你的这一层
                </h2>
              </div>
              <Badge tone={page.nextOpenLevel ? "success" : "warning"}>
                {page.nextOpenLevel ? `开放第 ${page.nextOpenLevel} 层` : "当前不可提交"}
              </Badge>
            </div>

            <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
              <Field label="个人 ID">
                <TextInput
                  value={formState.personalId}
                  disabled={!page.nextOpenLevel || submitting}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      personalId: event.target.value,
                    }))
                  }
                  placeholder="例如 20260018"
                />
              </Field>
              <Field
                label="留言内容"
                hint="建议写下短评、摘记或读后感，不超过 500 字。"
              >
                <TextArea
                  rows={5}
                  value={formState.content}
                  disabled={!page.nextOpenLevel || submitting}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      content: event.target.value,
                    }))
                  }
                  placeholder={
                    page.nextOpenLevel
                      ? `你将提交第 ${page.nextOpenLevel} 层留言`
                      : "当前层级未开放，暂时不可提交"
                  }
                />
              </Field>

              {page.pendingMessage ? (
                <div className="rounded-[1.8rem] border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
                  当前已有一条待审核留言，系统会在管理员处理后决定是否继续开放下一层。
                </div>
              ) : null}
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

              <PrimaryButton
                type="submit"
                disabled={!page.nextOpenLevel || submitting}
                className="w-full sm:w-auto"
              >
                {submitting ? "正在提交" : "提交本层留言"}
              </PrimaryButton>
            </form>
          </div>
        </section>
      </main>
    </PublicShell>
  );
}

function useAdminSession() {
  const [token, setTokenState] = useState(() => getAdminToken());

  function update(nextToken) {
    setAdminToken(nextToken);
    setTokenState(nextToken);
  }

  return { token, setToken: update };
}

function AdminLayout({ children, onLogout, title, description }) {
  const location = useLocation();
  const links = [
    { to: "/admin/pages", label: "页面管理" },
    { to: "/admin/messages", label: "审核队列" },
    { to: "/admin/assets", label: "素材中心" },
  ];

  return (
    <div className="min-h-screen bg-[#f3eee6] px-4 py-5 text-stone-900 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[17rem_1fr]">
        <aside className="rounded-[2.4rem] bg-stone-900 p-6 text-white shadow-[0_24px_90px_rgba(24,18,9,0.35)]">
          <p className="text-xs uppercase tracking-[0.34em] text-stone-400">
            Drift Book Admin
          </p>
          <h1 className="mt-4 font-display text-4xl">一本书的漂流</h1>
          <p className="mt-3 text-sm leading-7 text-stone-300">
            这里处理页面、审核和素材配置，控制每一轮阅读接龙的节奏。
          </p>

          <nav className="mt-8 space-y-2">
            {links.map((link) => {
              const active = location.pathname === link.to || location.pathname.startsWith(`${link.to}/`);
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={clsx(
                    "block rounded-2xl px-4 py-3 text-sm transition",
                    active ? "bg-white text-stone-900" : "text-stone-300 hover:bg-white/10"
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-10 rounded-[1.8rem] border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.26em] text-stone-500">Quick Entry</p>
            <div className="mt-3 flex flex-wrap gap-3">
              <Link
                to="/"
                className="rounded-full border border-white/20 px-4 py-2 text-sm text-stone-200 hover:bg-white/10"
              >
                返回主页
              </Link>
              <button
                type="button"
                onClick={onLogout}
                className="rounded-full border border-white/20 px-4 py-2 text-sm text-stone-200 hover:bg-white/10"
              >
                退出登录
              </button>
            </div>
          </div>
        </aside>

        <div className="space-y-6">
          <header className="rounded-[2.4rem] border border-stone-200/70 bg-white/80 p-8 shadow-[0_20px_70px_rgba(48,34,17,0.08)]">
            <p className="text-xs uppercase tracking-[0.34em] text-[#8b2f2a]">Admin Console</p>
            <h2 className="mt-3 font-display text-4xl text-stone-900">{title}</h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-stone-600">{description}</p>
          </header>
          {children}
        </div>
      </div>
    </div>
  );
}

function AdminGuard({ children }) {
  const { token, setToken } = useAdminSession();

  if (!token) {
    return <Navigate to="/admin/login" replace />;
  }

  return children({ token, setToken });
}

function AdminLoginPage() {
  const navigate = useNavigate();
  const { token, setToken } = useAdminSession();
  const [formState, setFormState] = useState({ username: "admin", password: "change-this-password" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (token) {
      navigate("/admin/pages", { replace: true });
    }
  }, [navigate, token]);

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await api.post("/admin/login", formState);
      setToken(response.data.token);
      navigate("/admin/pages", { replace: true });
    } catch (requestError) {
      setError(requestError.response?.data?.message || "登录失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#d7b58c,transparent_38%),linear-gradient(180deg,#17110c,#241913_65%,#0d0b09)] px-4 py-10">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-[2.6rem] border border-white/12 bg-white/[0.06] shadow-[0_40px_120px_rgba(0,0,0,0.42)] backdrop-blur md:grid-cols-[1.1fr_0.9fr]">
        <div className="hidden border-r border-white/10 p-10 text-white md:block">
          <p className="text-xs uppercase tracking-[0.36em] text-stone-300">
            Admin Access
          </p>
          <h1 className="mt-5 font-display text-6xl leading-[0.96]">
            管理的不只是页面，
            <span className="text-[#d7b58c]"> 也是阅读节奏。</span>
          </h1>
          <p className="mt-6 max-w-xl text-sm leading-8 text-stone-300">
            在这里导入 100 本书、审核每一层接龙、重置轮次，并整理首页轮播与学校品牌素材。
          </p>
        </div>

        <div className="bg-[#f8f3ea] p-8 md:p-10">
          <Badge tone="accent">管理员登录</Badge>
          <h2 className="mt-5 font-display text-4xl text-stone-900">进入后台</h2>
          <p className="mt-3 text-sm leading-7 text-stone-600">
            首版默认只保留一个管理员账号，后续如需多人协作再扩展。
          </p>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <Field label="用户名">
              <TextInput
                value={formState.username}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, username: event.target.value }))
                }
              />
            </Field>
            <Field label="密码">
              <TextInput
                type="password"
                value={formState.password}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, password: event.target.value }))
                }
              />
            </Field>

            {error ? (
              <div className="rounded-[1.8rem] border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                {error}
              </div>
            ) : null}

            <PrimaryButton type="submit" disabled={loading} className="w-full">
              {loading ? "正在登录" : "进入后台"}
            </PrimaryButton>
          </form>
        </div>
      </div>
    </div>
  );
}

function PagesDashboard({ token, onLogout }) {
  const [pages, setPages] = useState([]);
  const [error, setError] = useState("");
  const [csvFile, setCsvFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);

  const loadPages = useCallback(async () => {
    try {
      const response = await api.get("/admin/pages", {
        headers: authHeaders(token),
      });
      startTransition(() => {
        setPages(response.data.pages);
      });
    } catch (requestError) {
      if (requestError.response?.status === 401) {
        onLogout();
      } else {
        setError(requestError.response?.data?.message || "页面列表加载失败");
      }
    }
  }, [onLogout, token]);

  useEffect(() => {
    loadPages();
  }, [loadPages]);

  const visiblePages = useMemo(() => {
    const keyword = deferredQuery.trim().toLowerCase();
    if (!keyword) return pages;
    return pages.filter((page) => {
      return [page.title, page.author, page.qrCode].some((value) =>
        String(value).toLowerCase().includes(keyword)
      );
    });
  }, [deferredQuery, pages]);

  async function handleImport(event) {
    event.preventDefault();
    if (!csvFile) return;

    const formData = new FormData();
    formData.append("file", csvFile);
    setBusy(true);
    setError("");

    try {
      await api.post("/admin/pages/import", formData, {
        headers: {
          ...authHeaders(token),
        },
      });
      setCsvFile(null);
      await loadPages();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "CSV 导入失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminLayout
      onLogout={onLogout}
      title="页面管理"
      description="导入书目、查看每本书当前轮次状态，并进入单页详情处理封面、二维码下载和轮次重置。"
    >
      <div className="grid gap-6 xl:grid-cols-[0.7fr_1.3fr]">
        <section className="rounded-[2.4rem] border border-stone-200/70 bg-white/80 p-7 shadow-[0_20px_70px_rgba(48,34,17,0.08)]">
          <SectionHeading
            eyebrow="CSV Import"
            title="批量导入 100 个页面"
            description="上传包含 qr_code、title、author、description 的 CSV 文件，系统会自动初始化第 1 轮。"
          />
          <form className="mt-6 space-y-5" onSubmit={handleImport}>
            <Field label="CSV 文件">
              <input
                type="file"
                accept=".csv"
                onChange={(event) => setCsvFile(event.target.files?.[0] || null)}
                className="block w-full text-sm text-stone-600 file:mr-4 file:rounded-full file:border-0 file:bg-stone-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white"
              />
            </Field>
            <PrimaryButton type="submit" disabled={!csvFile || busy}>
              {busy ? "正在导入" : "导入页面"}
            </PrimaryButton>
          </form>
          {error ? (
            <div className="mt-5 rounded-[1.8rem] border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              {error}
            </div>
          ) : null}
        </section>

        <section className="rounded-[2.4rem] border border-stone-200/70 bg-white/80 p-7 shadow-[0_20px_70px_rgba(48,34,17,0.08)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <SectionHeading
              eyebrow="Pages"
              title={`已创建 ${pages.length} 个页面`}
              description="搜索二维码、书名或作者，进入详情页继续编辑。"
            />
            <Field label="搜索">
              <TextInput
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索书名 / 作者 / 二维码"
                className="md:w-72"
              />
            </Field>
          </div>

          <div className="mt-6 overflow-hidden rounded-[1.8rem] border border-stone-200">
            <div className="grid grid-cols-[1.2fr_0.9fr_0.7fr_0.7fr_0.6fr] gap-3 bg-[#f7f2ea] px-5 py-4 text-xs uppercase tracking-[0.22em] text-stone-500">
              <span>书籍</span>
              <span>二维码</span>
              <span>已通过</span>
              <span>待审核</span>
              <span>操作</span>
            </div>
            <div className="divide-y divide-stone-200">
              {visiblePages.map((page) => (
                <div
                  key={page.id}
                  className="grid grid-cols-1 gap-4 px-5 py-4 text-sm text-stone-700 md:grid-cols-[1.2fr_0.9fr_0.7fr_0.7fr_0.6fr] md:items-center"
                >
                  <div>
                    <div className="font-semibold text-stone-900">{page.title}</div>
                    <div className="mt-1 text-xs uppercase tracking-[0.22em] text-stone-500">
                      {page.author}
                    </div>
                  </div>
                  <div className="font-mono text-xs text-stone-600">{page.qrCode}</div>
                  <div>{page.approvedCount}</div>
                  <div>{page.pendingCount}</div>
                  <Link
                    to={`/admin/pages/${page.id}`}
                    className="inline-flex rounded-full border border-stone-300 px-4 py-2 text-center text-sm hover:bg-stone-50"
                  >
                    查看详情
                  </Link>
                </div>
              ))}
              {visiblePages.length === 0 ? (
                <div className="px-5 py-10 text-sm text-stone-500">暂无符合条件的页面。</div>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </AdminLayout>
  );
}

function PageDetailDashboard({ token, onLogout }) {
  const { id } = useParams();
  const [page, setPage] = useState(null);
  const [formState, setFormState] = useState({
    title: "",
    author: "",
    description: "",
    status: "open",
  });
  const [coverFile, setCoverFile] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const loadPage = useCallback(async () => {
    try {
      const response = await api.get(`/admin/pages/${id}`, {
        headers: authHeaders(token),
      });
      setPage(response.data);
      setFormState({
        title: response.data.title,
        author: response.data.author,
        description: response.data.description,
        status: response.data.status,
      });
    } catch (requestError) {
      if (requestError.response?.status === 401) {
        onLogout();
      } else {
        setError(requestError.response?.data?.message || "页面详情加载失败");
      }
    }
  }, [id, onLogout, token]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  async function handleSave(event) {
    event.preventDefault();
    const formData = new FormData();
    Object.entries(formState).forEach(([key, value]) => formData.append(key, value));
    if (coverFile) {
      formData.append("coverImage", coverFile);
    }
    setBusy(true);
    setError("");
    setNotice("");

    try {
      await api.patch(`/admin/pages/${id}`, formData, {
        headers: authHeaders(token),
      });
      setNotice("页面信息已更新");
      setCoverFile(null);
      await loadPage();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "保存失败");
    } finally {
      setBusy(false);
    }
  }

  async function handleReset() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api.post(
        `/admin/pages/${id}/reset`,
        {},
        { headers: authHeaders(token) }
      );
      setNotice("已开启新轮次");
      await loadPage();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "重置失败");
    } finally {
      setBusy(false);
    }
  }

  async function handleDownloadQr() {
    try {
      const response = await api.post(`/admin/pages/${id}/qrcode`, null, {
        headers: authHeaders(token),
        responseType: "blob",
      });
      const blobUrl = window.URL.createObjectURL(response.data);
      const anchor = document.createElement("a");
      anchor.href = blobUrl;
      anchor.download = `page-${id}.png`;
      anchor.click();
      window.URL.revokeObjectURL(blobUrl);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "二维码下载失败");
    }
  }

  if (!page && error) {
    return (
      <AdminLayout
        onLogout={onLogout}
        title="页面详情"
        description="单页配置不可用。"
      >
        <ErrorPane title="页面详情加载失败" message={error} />
      </AdminLayout>
    );
  }

  if (!page) {
    return (
      <AdminLayout
        onLogout={onLogout}
        title="页面详情"
        description="正在读取当前书页的详细信息。"
      >
        <LoadingPane label="正在加载单页详情" />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      onLogout={onLogout}
      title={page.title}
      description="维护书籍信息、当前轮次留言记录，以及这一页对应二维码的下载与重置。"
    >
      <div className="grid gap-6 xl:grid-cols-[0.88fr_1.12fr]">
        <section className="rounded-[2.4rem] border border-stone-200/70 bg-white/80 p-7 shadow-[0_20px_70px_rgba(48,34,17,0.08)]">
          <SectionHeading
            eyebrow="Page Settings"
            title="书页编辑"
            description="可以修改书名、作者、简介、封面和页面状态。"
          />

          <form className="mt-6 space-y-5" onSubmit={handleSave}>
            <Field label="书名">
              <TextInput
                value={formState.title}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, title: event.target.value }))
                }
              />
            </Field>
            <Field label="作者">
              <TextInput
                value={formState.author}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, author: event.target.value }))
                }
              />
            </Field>
            <Field label="简介">
              <TextArea
                rows={5}
                value={formState.description}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, description: event.target.value }))
                }
              />
            </Field>
            <Field label="状态">
              <select
                className="w-full rounded-2xl border border-stone-300/70 bg-white/80 px-4 py-3 text-sm text-stone-900 outline-none"
                value={formState.status}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, status: event.target.value }))
                }
              >
                <option value="open">开放</option>
                <option value="full">已满</option>
                <option value="inactive">停用</option>
              </select>
            </Field>
            <Field label="封面图片">
              <input
                type="file"
                accept="image/*"
                onChange={(event) => setCoverFile(event.target.files?.[0] || null)}
                className="block w-full text-sm text-stone-600 file:mr-4 file:rounded-full file:border-0 file:bg-stone-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white"
              />
            </Field>

            <div className="flex flex-wrap gap-3">
              <PrimaryButton type="submit" disabled={busy}>
                {busy ? "正在保存" : "保存页面"}
              </PrimaryButton>
              <SecondaryButton type="button" onClick={handleDownloadQr}>
                下载二维码
              </SecondaryButton>
              <SecondaryButton type="button" onClick={handleReset} disabled={busy}>
                重置轮次
              </SecondaryButton>
            </div>
          </form>

          {notice ? (
            <div className="mt-5 rounded-[1.8rem] border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
              {notice}
            </div>
          ) : null}
          {error ? (
            <div className="mt-5 rounded-[1.8rem] border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              {error}
            </div>
          ) : null}
        </section>

        <section className="rounded-[2.4rem] border border-stone-200/70 bg-white/80 p-7 shadow-[0_20px_70px_rgba(48,34,17,0.08)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <SectionHeading
              eyebrow="Current Round"
              title={`第 ${page.currentRoundNumber} 轮`}
              description="这里展示当前轮次的所有消息状态，帮助管理员快速判断推进到哪一层。"
            />
            <Badge tone={page.status === "open" ? "success" : "warning"}>
              {page.status}
            </Badge>
          </div>
          <div className="mt-6 space-y-4">
            {page.messages.length === 0 ? (
              <div className="rounded-[1.8rem] border border-dashed border-stone-300 bg-[#faf6ef] p-5 text-sm text-stone-500">
                当前轮次还没有留言。
              </div>
            ) : null}
            {page.messages.map((message) => (
              <div key={message.id} className="rounded-[1.8rem] border border-stone-200 bg-[#faf6ef] p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge tone="accent">第 {message.level} 层</Badge>
                  <Badge tone={message.status === "approved" ? "success" : message.status === "pending" ? "warning" : "muted"}>
                    {message.status}
                  </Badge>
                  <span className="text-sm font-medium text-stone-700">
                    ID {message.personalId}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-7 text-stone-700">{message.content}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AdminLayout>
  );
}

function MessagesDashboard({ token, onLogout }) {
  const [messages, setMessages] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [rejectReason, setRejectReason] = useState({});

  const loadMessages = useCallback(async () => {
    try {
      const response = await api.get("/admin/messages/pending", {
        headers: authHeaders(token),
      });
      setMessages(response.data.messages);
    } catch (requestError) {
      if (requestError.response?.status === 401) {
        onLogout();
      } else {
        setError(requestError.response?.data?.message || "待审核队列加载失败");
      }
    }
  }, [onLogout, token]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  async function handleAction(id, action) {
    setBusyId(id);
    setError("");
    try {
      await api.post(
        `/admin/messages/${id}/${action}`,
        action === "reject"
          ? { rejectionReason: rejectReason[id] || "" }
          : {},
        { headers: authHeaders(token) }
      );
      await loadMessages();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "审核操作失败");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AdminLayout
      onLogout={onLogout}
      title="待审核队列"
      description="所有新留言都会先进入这里，审核通过才会出现在公开书页里。"
    >
      <section className="rounded-[2.4rem] border border-stone-200/70 bg-white/80 p-7 shadow-[0_20px_70px_rgba(48,34,17,0.08)]">
        {error ? (
          <div className="mb-5 rounded-[1.8rem] border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="space-y-5">
          {messages.length === 0 ? (
            <div className="rounded-[1.8rem] border border-dashed border-stone-300 bg-[#faf6ef] p-6 text-sm text-stone-500">
              当前没有待审核留言。
            </div>
          ) : null}

          {messages.map((message) => (
            <div key={message.id} className="rounded-[2rem] border border-stone-200 bg-[#faf6ef] p-6">
              <div className="flex flex-wrap items-center gap-3">
                <Badge tone="accent">{message.page.title}</Badge>
                <Badge tone="warning">第 {message.level} 层</Badge>
                <Badge tone="muted">{message.page.qrCode}</Badge>
                <span className="text-sm text-stone-600">{formatDate(message.createdAt)}</span>
              </div>
              <div className="mt-4 text-sm leading-7 text-stone-700">
                <div className="font-semibold text-stone-900">学生 ID {message.personalId}</div>
                <p className="mt-2">{message.content}</p>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
                <Field label="驳回原因（可选）">
                  <TextArea
                    rows={3}
                    value={rejectReason[message.id] || ""}
                    onChange={(event) =>
                      setRejectReason((current) => ({
                        ...current,
                        [message.id]: event.target.value,
                      }))
                    }
                    placeholder="说明为什么不通过，便于后续重新提交。"
                  />
                </Field>
                <div className="flex flex-wrap gap-3">
                  <PrimaryButton
                    type="button"
                    disabled={busyId === message.id}
                    onClick={() => handleAction(message.id, "approve")}
                  >
                    通过
                  </PrimaryButton>
                  <SecondaryButton
                    type="button"
                    disabled={busyId === message.id}
                    onClick={() => handleAction(message.id, "reject")}
                  >
                    驳回
                  </SecondaryButton>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </AdminLayout>
  );
}

function AssetsDashboard({ token, onLogout }) {
  const [assets, setAssets] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const loadAssets = useCallback(async () => {
    try {
      const response = await api.get("/admin/assets", {
        headers: authHeaders(token),
      });
      setAssets(response.data);
    } catch (requestError) {
      if (requestError.response?.status === 401) {
        onLogout();
      } else {
        setError(requestError.response?.data?.message || "素材加载失败");
      }
    }
  }, [onLogout, token]);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  function updateCarousel(transform) {
    setAssets((current) => {
      if (!current) return current;
      const nextImages = transform([...current.carouselImages]).map((item, index) => ({
        ...item,
        sortOrder: index,
      }));
      return { ...current, carouselImages: nextImages };
    });
  }

  async function bootstrapAssets() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await api.post(
        "/admin/assets/bootstrap-from-materials",
        {},
        { headers: authHeaders(token) }
      );
      setAssets(response.data);
      setNotice("已从 materials 目录导入 logo 与轮播图");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "素材导入失败");
    } finally {
      setBusy(false);
    }
  }

  async function saveAssets() {
    if (!assets) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await api.patch("/admin/assets", assets, {
        headers: authHeaders(token),
      });
      setAssets(response.data);
      setNotice("素材设置已保存");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "素材保存失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminLayout
      onLogout={onLogout}
      title="素材中心"
      description="学校 logo 用于所有公开页头部，校园图片只用于论坛主页轮播，支持启停和排序。"
    >
      <div className="grid gap-6 xl:grid-cols-[0.78fr_1.22fr]">
        <section className="rounded-[2.4rem] border border-stone-200/70 bg-white/80 p-7 shadow-[0_20px_70px_rgba(48,34,17,0.08)]">
          <SectionHeading
            eyebrow="Bootstrap"
            title="从 materials 导入"
            description="点击后将读取项目根目录的 materials/logo.jpg 以及其余图片，并复制到运行时 uploads 目录。"
          />
          <div className="mt-6 flex flex-wrap gap-3">
            <PrimaryButton type="button" disabled={busy} onClick={bootstrapAssets}>
              {busy ? "正在导入" : "导入素材"}
            </PrimaryButton>
            <SecondaryButton type="button" disabled={!assets || busy} onClick={saveAssets}>
              保存当前排序
            </SecondaryButton>
          </div>
          {notice ? (
            <div className="mt-5 rounded-[1.8rem] border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
              {notice}
            </div>
          ) : null}
          {error ? (
            <div className="mt-5 rounded-[1.8rem] border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <div className="mt-8 rounded-[2rem] border border-stone-200 bg-[#faf6ef] p-5">
            <p className="text-xs uppercase tracking-[0.28em] text-stone-500">School Logo</p>
            {assets?.schoolLogoPath ? (
              <img
                src={assetUrl(assets.schoolLogoPath)}
                alt="学校 logo"
                className="mt-4 h-28 w-28 rounded-full border border-stone-200 object-cover"
              />
            ) : (
              <div className="mt-4 flex h-28 w-28 items-center justify-center rounded-full border border-dashed border-stone-300 text-sm text-stone-500">
                未导入
              </div>
            )}
          </div>
        </section>

        <section className="rounded-[2.4rem] border border-stone-200/70 bg-white/80 p-7 shadow-[0_20px_70px_rgba(48,34,17,0.08)]">
          <SectionHeading
            eyebrow="Carousel"
            title="论坛主页轮播顺序"
            description="这里的图片不会出现在二维码书页，只用于论坛主页。可以启停，也可以调整前后顺序。"
          />

          <div className="mt-6 space-y-4">
            {assets?.carouselImages?.length ? null : (
              <div className="rounded-[1.8rem] border border-dashed border-stone-300 bg-[#faf6ef] p-6 text-sm text-stone-500">
                还没有轮播图，先执行一次素材导入。
              </div>
            )}
            {assets?.carouselImages?.map((item, index) => (
              <div
                key={item.id}
                className="grid gap-4 rounded-[1.8rem] border border-stone-200 bg-[#faf6ef] p-4 md:grid-cols-[10rem_1fr_auto]"
              >
                <img
                  src={assetUrl(item.path)}
                  alt={item.label}
                  className="h-28 w-full rounded-[1.2rem] object-cover"
                />
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge tone={item.enabled ? "success" : "muted"}>
                      {item.enabled ? "启用中" : "已停用"}
                    </Badge>
                    <span className="text-sm font-semibold text-stone-900">{item.label}</span>
                  </div>
                  <p className="mt-3 font-mono text-xs text-stone-500">{item.path}</p>
                  <label className="mt-4 inline-flex items-center gap-3 text-sm text-stone-700">
                    <input
                      type="checkbox"
                      checked={item.enabled}
                      onChange={(event) =>
                        updateCarousel((items) =>
                          items.map((entry) =>
                            entry.id === item.id ? { ...entry, enabled: event.target.checked } : entry
                          )
                        )
                      }
                    />
                    启用此图片
                  </label>
                </div>
                <div className="flex gap-2 self-start">
                  <SecondaryButton
                    type="button"
                    onClick={() =>
                      updateCarousel((items) => {
                        if (index === 0) return items;
                        const next = [...items];
                        [next[index - 1], next[index]] = [next[index], next[index - 1]];
                        return next;
                      })
                    }
                  >
                    上移
                  </SecondaryButton>
                  <SecondaryButton
                    type="button"
                    onClick={() =>
                      updateCarousel((items) => {
                        if (index === items.length - 1) return items;
                        const next = [...items];
                        [next[index], next[index + 1]] = [next[index + 1], next[index]];
                        return next;
                      })
                    }
                  >
                    下移
                  </SecondaryButton>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AdminLayout>
  );
}

function AdminRoutes() {
  return (
    <AdminGuard>
      {({ token, setToken }) => {
        const handleLogout = () => setToken(null);
        return (
          <Routes>
            <Route path="/pages" element={<PagesDashboard token={token} onLogout={handleLogout} />} />
            <Route
              path="/pages/:id"
              element={<PageDetailDashboard token={token} onLogout={handleLogout} />}
            />
            <Route
              path="/messages"
              element={<MessagesDashboard token={token} onLogout={handleLogout} />}
            />
            <Route
              path="/assets"
              element={<AssetsDashboard token={token} onLogout={handleLogout} />}
            />
            <Route path="*" element={<Navigate to="/admin/pages" replace />} />
          </Routes>
        );
      }}
    </AdminGuard>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/pages/:qrCode" element={<PublicPage />} />
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/admin/*" element={<AdminRoutes />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
