import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api.js";
import { formatDate } from "../lib/helpers.js";
import { useSiteAssets } from "../hooks/useSiteAssets.js";
import { Badge } from "../components/Badge.jsx";
import { Field } from "../components/Field.jsx";
import { TextInput, TextArea } from "../components/Input.jsx";
import { PrimaryButton, SecondaryButton } from "../components/Button.jsx";
import { SectionHeading } from "../components/SectionHeading.jsx";
import { LoadingPane } from "../components/LoadingPane.jsx";
import { ErrorPane } from "../components/ErrorPane.jsx";
import { PublicShell } from "../components/PublicShell.jsx";

export function BookDetailPage() {
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
      setFormState({ systemId: "", studentName: "", idCardSuffix: "", content: "" });
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
    ["出版日期", book.publishDateTexts?.length ? book.publishDateTexts.join(" / ") : book.publishDateText],
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
            {detailFields.map(([label, value]) =>
              value ? (
                <div key={label} className="rounded-[1.8rem] border border-stone-200 bg-[#faf6ef] p-5">
                  <p className="text-xs uppercase tracking-[0.28em] text-stone-500">{label}</p>
                  <p className="mt-3 text-lg font-semibold text-stone-900">{value}</p>
                </div>
              ) : null
            )}
          </div>
          <div className="mt-6 rounded-[1.8rem] border border-stone-200 bg-[#faf6ef] p-5">
            <p className="text-xs uppercase tracking-[0.28em] text-stone-500">条形码列表</p>
            {book.barcodes?.length ? (
              <div className="mt-3 flex flex-wrap gap-3">
                {book.barcodes.map((barcode) => (
                  <Badge key={barcode} tone="muted">{barcode}</Badge>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-stone-500">暂无条形码信息</p>
            )}
          </div>
          <div className="mt-6 rounded-[1.8rem] border border-[#8b2f2a]/10 bg-[#8b2f2a]/5 p-5">
            <p className="text-xs uppercase tracking-[0.28em] text-[#8b2f2a]">留言规则</p>
            <p className="mt-3 text-sm leading-7 text-stone-700">
              你的留言经审核通过后，将成为这条接龙的下一层。
            </p>
          </div>
          <div className="mt-8 flex gap-3">
            <Link to="/"><SecondaryButton>返回首页</SecondaryButton></Link>
          </div>
        </section>

        <section className="flex flex-col gap-6">
          <div className="paper-panel rounded-[2.4rem] p-8 shadow-[0_30px_90px_rgba(58,39,18,0.12)]">
            <SectionHeading
              eyebrow="Public Thread"
              title="已公开接龙"
              description="来自同学们的阅读印记，一层一层，记录着这本书的旅程。"
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
                  onChange={(e) => setFormState((s) => ({ ...s, systemId: e.target.value }))}
                  disabled={submitting}
                  placeholder="例如 320250002"
                />
              </Field>
              <Field label="姓名">
                <TextInput
                  value={formState.studentName}
                  onChange={(e) => setFormState((s) => ({ ...s, studentName: e.target.value }))}
                  disabled={submitting}
                  placeholder="请输入学籍姓名"
                />
              </Field>
              <Field label="身份证后四位" hint="仅用于本次身份校验，不会在前台公开显示。">
                <TextInput
                  value={formState.idCardSuffix}
                  onChange={(e) => setFormState((s) => ({ ...s, idCardSuffix: e.target.value.toUpperCase() }))}
                  disabled={submitting}
                  placeholder="例如 3225"
                />
              </Field>
              <Field label="接龙内容" hint="请输入 1 到 500 字的阅读感受或回应。">
                <TextArea
                  rows={5}
                  value={formState.content}
                  onChange={(e) => setFormState((s) => ({ ...s, content: e.target.value }))}
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
