import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import clsx from "clsx";
import { assetUrl } from "../lib/api.js";
import { sortCarousel, lineClampStyle } from "../lib/helpers.js";
import { useSiteAssets } from "../hooks/useSiteAssets.js";
import { useHomepageData } from "../hooks/useHomepageData.js";
import { Badge } from "../components/Badge.jsx";
import { SectionHeading } from "../components/SectionHeading.jsx";
import { SearchForm } from "../components/SearchForm.jsx";
import { LoadingPane } from "../components/LoadingPane.jsx";
import { ErrorPane } from "../components/ErrorPane.jsx";
import { PublicShell } from "../components/PublicShell.jsx";

const MotionImage = motion.img;
const MotionDiv = motion.div;
const rankingRowClasses = [
  "lg:row-start-2",
  "lg:row-start-3",
  "lg:row-start-4",
  "lg:row-start-5",
  "lg:row-start-6",
];
const activityOrderClasses = ["order-2", "order-3", "order-4", "order-5", "order-6"];
const featuredOrderClasses = ["order-8", "order-9", "order-10", "order-11", "order-12"];

export function HomePage() {
  const navigate = useNavigate();
  const { assets, error } = useSiteAssets();
  const { data: homepage, error: homepageError } = useHomepageData();
  const [activeIndex, setActiveIndex] = useState(0);
  const rankingPreviewLimit = 5;

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
  const activityPreview = (homepage.activityBooks || []).slice(0, rankingPreviewLimit);
  const featuredPreview = (homepage.featuredReviews || []).slice(0, rankingPreviewLimit);

  return (
    <PublicShell assets={assets}>
      <main className="flex flex-1 flex-col gap-10">
        <section
          data-testid="homepage-hero"
          className="grid gap-6 xl:min-h-[38rem] xl:grid-cols-[0.92fr_1.08fr]"
        >
          <section className="paper-panel relative flex h-full flex-col overflow-hidden rounded-[2.8rem] p-8 shadow-[0_30px_90px_rgba(58,39,18,0.12)] md:p-12">
            <div className="absolute left-0 top-0 h-52 w-52 rounded-full bg-[#8b2f2a]/10 blur-3xl" />
            <div className="relative z-10 flex h-full flex-col">
              <Badge tone="accent">馆内阅读活动</Badge>
              <h1 className="mt-6 max-w-3xl font-display text-5xl leading-[1.05] text-stone-900 md:text-7xl">
                让这本书，
                <span className="text-[#8b2f2a]"> 继续流向下一位读者。</span>
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-stone-600 md:text-lg">
                在"一本书的漂流"里，寻找一本书，留下你的那一层，看见阅读真正流动起来。
              </p>

              <SearchForm
                onSubmit={(value) => value && navigate(`/search?q=${encodeURIComponent(value)}`)}
              />

              <div className="mt-6 flex flex-wrap gap-3 text-xs uppercase tracking-[0.24em] text-stone-500">
                {["馆内阅读活动", "一本书一条接龙", "审核后公开展示"].map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-stone-200/80 bg-white/72 px-3 py-2"
                  >
                    {item}
                  </span>
                ))}
              </div>

              <p className="mt-auto pt-10 text-sm leading-7 text-stone-500">
                从一次搜索开始，找到那本正在流动的书。
              </p>
            </div>
          </section>

          <section className="relative flex min-h-[24rem] flex-col overflow-hidden rounded-[2.8rem] border border-white/60 bg-stone-900 shadow-[0_30px_100px_rgba(23,17,8,0.35)] xl:min-h-full">
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(22,16,9,0.08),rgba(22,16,9,0.78))]" />
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
              <h2 className="mt-4 max-w-2xl font-display text-4xl leading-tight md:text-5xl">
                每一本书，都在静静等待它的下一位读者。
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-7 text-stone-200">
                图书馆是我们阅读漂流的共同起点。从这里出发，留下属于你的那一层阅读印记。
              </p>
              <div className="mt-8 flex items-center gap-3">
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
                {activeSlide?.label ? (
                  <span className="ml-2 text-xs uppercase tracking-[0.24em] text-white/72">
                    {activeSlide.label}
                  </span>
                ) : null}
              </div>
            </div>
          </section>
        </section>

        <section
          data-testid="homepage-rankings"
          className="rounded-[2.5rem] border border-stone-200/80 bg-white/62 p-4 shadow-[0_24px_80px_rgba(47,33,15,0.08)] md:p-5"
        >
          <div
            data-testid="ranking-shared-grid"
            data-layout="shared-ranking-grid"
            className="grid gap-3 lg:grid-cols-2 lg:grid-rows-[auto_repeat(5,9rem)] lg:gap-x-6 lg:gap-y-3"
          >
            <div
              data-testid="activity-ranking-heading"
              className="order-1 flex h-full flex-wrap items-end justify-between gap-4 rounded-[2rem] border border-stone-200/80 bg-white/82 p-5 lg:order-none lg:col-start-1 lg:row-start-1"
            >
              <div>
                <p className="text-xs uppercase tracking-[0.34em] text-[#8b2f2a]">Activity Rank</p>
                <h2 className="mt-3 font-display text-3xl text-stone-900">留言量排行榜</h2>
                <p className="mt-3 max-w-xl text-sm leading-7 text-stone-600">
                  找一本正在流动的书，接上属于你的那一层。
                </p>
              </div>
              <span className="rounded-full bg-[#8b2f2a]/8 px-3 py-2 text-xs uppercase tracking-[0.24em] text-[#8b2f2a]">
                当前展示 {activityPreview.length} 条
              </span>
            </div>

            <div
              data-testid="featured-ranking-heading"
              className="order-7 flex h-full flex-wrap items-end justify-between gap-4 rounded-[2rem] border border-stone-200/80 bg-[#fffaf1]/90 p-5 lg:order-none lg:col-start-2 lg:row-start-1"
            >
              <div>
                <p className="text-xs uppercase tracking-[0.34em] text-[#8b2f2a]">Featured Lines</p>
                <h2 className="mt-3 font-display text-3xl text-stone-900">管理员精选留言</h2>
                <p className="mt-3 max-w-xl text-sm leading-7 text-stone-600">
                  先读几段有代表性的接龙片段，再决定从哪本书进入。
                </p>
              </div>
              <span className="rounded-full bg-stone-900/6 px-3 py-2 text-xs uppercase tracking-[0.24em] text-stone-600">
                当前展示 {featuredPreview.length} 条
              </span>
            </div>

            {activityPreview.length === 0 ? (
              <div className="order-2 rounded-[1.6rem] border border-dashed border-stone-300 bg-[#faf6ef] p-4 text-sm leading-7 text-stone-500 lg:order-none lg:col-start-1 lg:row-span-5 lg:row-start-2">
                当前还没有公开接龙，欢迎成为第一位留言的读者。
              </div>
            ) : null}

            {featuredPreview.length === 0 ? (
              <div className="order-8 rounded-[1.6rem] border border-dashed border-stone-300 bg-white/70 p-4 text-sm leading-7 text-stone-500 lg:order-none lg:col-start-2 lg:row-span-5 lg:row-start-2">
                还没有精选留言，管理员审核后会逐步补充。
              </div>
            ) : null}

            {Array.from({ length: rankingPreviewLimit }, (_, index) => {
              const book = activityPreview[index];
              const review = featuredPreview[index];

              return (
                <div key={`ranking-row-${index}`} data-testid="ranking-row-slot" className="contents">
                  {book ? (
                  <Link
                    key={book.id}
                    data-testid="activity-ranking-link"
                    to={`/books/${book.id}`}
                    className={clsx(
                      "group flex h-full min-h-[8.75rem] items-center justify-between gap-4 overflow-hidden rounded-[1.6rem] border border-stone-200 bg-[#faf6ef] px-4 py-4 transition hover:border-[#8b2f2a]/35 hover:bg-white lg:order-none lg:col-start-1 lg:h-36",
                      rankingRowClasses[index],
                      activityOrderClasses[index]
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[1.1rem] bg-white text-sm font-semibold text-[#8b2f2a] shadow-[0_10px_30px_rgba(47,33,15,0.06)]">
                        {String(index + 1).padStart(2, "0")}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs uppercase tracking-[0.22em] text-stone-500">
                          热门接龙书页
                        </p>
                        <h3
                          className="mt-1 text-base font-semibold text-stone-900 transition group-hover:text-[#8b2f2a]"
                          style={lineClampStyle(2)}
                        >
                          {book.title}
                        </h3>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-display text-3xl text-[#8b2f2a]">{book.messageCount}</div>
                      <p className="text-xs uppercase tracking-[0.18em] text-stone-500">层留言</p>
                    </div>
                  </Link>
                  ) : null}

                  {review ? (
                  <Link
                    key={review.id}
                    data-testid="featured-ranking-link"
                    to={`/books/${review.bookId}#review-${review.id}`}
                    className={clsx(
                      "group flex h-full min-h-[8.75rem] flex-col justify-between overflow-hidden rounded-[1.6rem] border border-stone-200 bg-white/80 p-4 transition hover:border-[#8b2f2a]/35 hover:bg-white lg:order-none lg:col-start-2 lg:h-36",
                      rankingRowClasses[index],
                      featuredOrderClasses[index]
                    )}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center justify-between gap-3">
                        <Badge tone="accent">精选 {String(index + 1).padStart(2, "0")}</Badge>
                        {review.sequenceNumber ? (
                          <Badge tone="muted">第 {review.sequenceNumber} 层</Badge>
                        ) : null}
                      </div>
                      <h3
                        className="mt-3 text-base font-semibold text-stone-900 transition group-hover:text-[#8b2f2a]"
                        style={lineClampStyle(1)}
                      >
                        {review.bookTitle}
                      </h3>
                      <p
                        className="mt-2 text-sm leading-6 text-stone-700"
                        style={lineClampStyle(2)}
                      >
                        {review.content}
                      </p>
                    </div>
                    <p className="mt-2 text-xs uppercase tracking-[0.18em] text-stone-500">
                      {review.displayName}
                    </p>
                  </Link>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>

        <section
          data-testid="homepage-process"
          className="grid gap-6 rounded-[2.4rem] border border-stone-200/70 bg-white/75 p-8 shadow-[0_20px_60px_rgba(58,39,18,0.08)] md:grid-cols-[0.8fr_1.2fr] md:p-10"
        >
          <SectionHeading
            eyebrow="How It Works"
            title="如何留下你的那一层？"
            description="阅读从来不是一件孤独的事。找到一本书，留下你的声音，让它继续流向下一位读者。"
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
      </main>
    </PublicShell>
  );
}
