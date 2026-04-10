import { useEffect, useState } from "react";
import { api, authHeaders, requestMessage, isUnauthorized } from "../lib/api.js";
import { Badge } from "../components/Badge.jsx";
import { Field } from "../components/Field.jsx";
import { TextArea, SelectInput } from "../components/Input.jsx";
import { PrimaryButton, SecondaryButton } from "../components/Button.jsx";
import { StatusMessage } from "../components/StatusMessage.jsx";
import { EmptyState } from "../components/EmptyState.jsx";
import { AdminLayout } from "../components/AdminLayout.jsx";

export function ReviewsPage({ token, onLogout }) {
  const [reviews, setReviews] = useState([]);
  const [status, setStatus] = useState("pending");
  const [drafts, setDrafts] = useState({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadReviews(nextStatus = status) {
    try {
      const response = await api.get("/admin/reviews", {
        headers: authHeaders(token),
        params: nextStatus ? { status: nextStatus } : {},
      });
      setReviews(response.data.reviews);
      setDrafts(
        Object.fromEntries(
          response.data.reviews.map((review) => [
            review.id,
            {
              finalContent: review.finalContent,
            },
          ])
        )
      );
    } catch (requestError) {
      if (isUnauthorized(requestError)) {
        onLogout();
        return;
      }
      setError(requestMessage(requestError, "评语列表加载失败"));
    }
  }

  useEffect(() => {
    loadReviews();
  }, [token, status]);

  function reviewStatusMeta(reviewStatus) {
    if (reviewStatus === "approved") {
      return { tone: "success", label: "已通过" };
    }
    if (reviewStatus === "hidden") {
      return { tone: "muted", label: "已下架" };
    }
    return { tone: "warning", label: "待审核" };
  }

  async function handleAction(reviewId, action) {
    setError("");
    setSuccess("");

    try {
      await api.patch(
        `/admin/reviews/${reviewId}`,
        {
          action,
          finalContent: drafts[reviewId]?.finalContent,
        },
        {
          headers: authHeaders(token),
        }
      );
      setSuccess(
        action === "approve"
          ? "留言已保存并公开。"
          : "留言已隐藏，前台不再显示。"
      );
      await loadReviews(status);
    } catch (requestError) {
      if (isUnauthorized(requestError)) {
        onLogout();
        return;
      }
      setError(requestMessage(requestError, "评语操作失败"));
    }
  }

  return (
    <AdminLayout
      onLogout={onLogout}
      title="留言审核"
      description="审核学生提交的接龙留言，查看实名信息与敏感词命中，决定公开或隐藏。"
    >
      <StatusMessage error={error} success={success} />
      <section className="paper-panel rounded-[2.4rem] p-7 shadow-[0_20px_70px_rgba(48,34,17,0.08)]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <Field label="状态筛选">
            <SelectInput
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="md:w-56"
            >
              <option value="pending">待审核</option>
              <option value="approved">已通过</option>
              <option value="hidden">已下架</option>
            </SelectInput>
          </Field>
        </div>
        <div className="mt-6 space-y-5">
          {reviews.length === 0 ? (
            <EmptyState>暂无符合条件的留言。</EmptyState>
          ) : (
            reviews.map((review) => {
              const statusMeta = reviewStatusMeta(review.status);

              return (
                <div
                  key={review.id}
                  className="rounded-[1.8rem] border border-stone-200 bg-white/85 p-5"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-semibold text-stone-900">
                      {review.groupedBook?.title || review.book?.title || "图书已删除"}
                    </span>
                    <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
                    {review.sequenceNumber ? (
                      <Badge tone="muted">第 {review.sequenceNumber} 层</Badge>
                    ) : null}
                    {review.isFeatured ? <Badge tone="accent">已精选</Badge> : null}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3 text-xs text-stone-500">
                    <span>公开显示：{review.displayName}</span>
                    {review.studentIdentity ? (
                      <>
                        <span>学号：{review.studentIdentity.systemId}</span>
                        <span>姓名：{review.studentIdentity.studentName}</span>
                        <span>班级：{review.studentIdentity.className}</span>
                        <span>身份证后四位：{review.studentIdentity.idCardSuffix}</span>
                      </>
                    ) : (
                      <span>来源：历史旧评语</span>
                    )}
                  </div>
                  {review.groupedBook ? (
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-stone-500">
                      <span>所在分组：共 {review.groupedBook.groupBookCount} 个副本</span>
                      <span>作者：{review.groupedBook.author || "暂无"}</span>
                      <span>出版社：{review.groupedBook.publisher || "暂无"}</span>
                    </div>
                  ) : null}
                  {review.sensitiveHit ? (
                    <div className="mt-3 rounded-[1.4rem] border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
                      命中敏感词：{review.matchedSensitiveWords.join("、")}
                    </div>
                  ) : null}
                  <p className="mt-3 text-sm leading-7 text-stone-500">
                    原文：{review.originalContent}
                  </p>
                  <Field label="最终展示文本">
                    <TextArea
                      rows={4}
                      value={drafts[review.id]?.finalContent || ""}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [review.id]: {
                            ...current[review.id],
                            finalContent: event.target.value,
                          },
                        }))
                      }
                    />
                  </Field>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <PrimaryButton
                      type="button"
                      onClick={() => handleAction(review.id, "approve")}
                    >
                      {review.status === "approved" ? "保存并保持公开" : "通过并公开"}
                    </PrimaryButton>
                    <SecondaryButton
                      type="button"
                      onClick={() => handleAction(review.id, "hide")}
                    >
                      {review.status === "hidden" ? "更新隐藏内容" : "隐藏不公开"}
                    </SecondaryButton>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </AdminLayout>
  );
}
