import { useEffect, useState } from "react";
import { api, authHeaders, requestMessage, isUnauthorized } from "../lib/api.js";
import { formatDate } from "../lib/helpers.js";
import { Badge } from "../components/Badge.jsx";
import { Field } from "../components/Field.jsx";
import { TextArea, TextInput, SelectInput } from "../components/Input.jsx";
import { PrimaryButton, SecondaryButton } from "../components/Button.jsx";
import { StatusMessage } from "../components/StatusMessage.jsx";
import { EmptyState } from "../components/EmptyState.jsx";
import { AdminLayout } from "../components/AdminLayout.jsx";
import {
  AdminList,
  AdminListItem,
  AdminMeta,
  AdminPagination,
  AdminSection,
  AdminToolbar,
} from "../components/AdminUI.jsx";

const REVIEW_PAGE_SIZE = 30;

export function ReviewsPage({ token, onLogout }) {
  const [reviews, setReviews] = useState([]);
  const [status, setStatus] = useState("pending");
  const [query, setQuery] = useState("");
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: REVIEW_PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });
  const [drafts, setDrafts] = useState({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [exporting, setExporting] = useState(false);

  async function loadReviews({
    nextStatus = status,
    keyword = query,
    page = pagination.page,
    fallbackPage = true,
  } = {}) {
    try {
      setError("");
      const response = await api.get("/admin/reviews", {
        headers: authHeaders(token),
        params: {
          ...(nextStatus ? { status: nextStatus } : {}),
          ...(keyword ? { q: keyword } : {}),
          page,
          pageSize: REVIEW_PAGE_SIZE,
        },
      });
      const nextReviews = response.data.reviews;
      const nextPagination = response.data.pagination || {
        page,
        pageSize: REVIEW_PAGE_SIZE,
        total: nextReviews.length,
        totalPages: 1,
      };

      if (fallbackPage && nextReviews.length === 0 && nextPagination.page > 1) {
        await loadReviews({
          nextStatus,
          keyword,
          page: nextPagination.page - 1,
          fallbackPage: false,
        });
        return;
      }

      setReviews(nextReviews);
      setPagination(nextPagination);
      setDrafts(
        Object.fromEntries(
          nextReviews.map((review) => [
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
      setError(requestMessage(requestError, "留言列表加载失败"));
    }
  }

  useEffect(() => {
    loadReviews({ nextStatus: status, keyword: query, page: pagination.page });
  }, [token]);

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
      await loadReviews({ nextStatus: status, keyword: query, page: pagination.page });
    } catch (requestError) {
      if (isUnauthorized(requestError)) {
        onLogout();
        return;
      }
      setError(requestMessage(requestError, "留言操作失败"));
    }
  }

  async function handleExport() {
    setExporting(true);
    setError("");
    setSuccess("");

    try {
      const response = await api.get("/admin/reviews/export", {
        headers: authHeaders(token),
        responseType: "blob",
      });
      const blob =
        response.data instanceof Blob
          ? response.data
          : new Blob([response.data], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `reviews-${Date.now()}.csv`;
      link.click();
      window.URL.revokeObjectURL(url);
      setSuccess("CSV 已开始下载。");
    } catch (requestError) {
      if (isUnauthorized(requestError)) {
        onLogout();
        return;
      }
      setError(requestMessage(requestError, "导出失败"));
    } finally {
      setExporting(false);
    }
  }

  return (
    <AdminLayout onLogout={onLogout} title="留言审核">
      <StatusMessage error={error} success={success} />
      <AdminSection
        title="审核列表"
        actions={
          <SecondaryButton type="button" onClick={handleExport} disabled={exporting}>
            {exporting ? "正在导出" : "导出全部 CSV"}
          </SecondaryButton>
        }
      >
        <AdminToolbar>
          <Field label="状态筛选">
            <SelectInput
              value={status}
              onChange={(event) => {
                const nextStatus = event.target.value;
                setStatus(nextStatus);
                loadReviews({ nextStatus, keyword: query, page: 1 });
              }}
              className="md:w-56"
            >
              <option value="pending">待审核</option>
              <option value="approved">已通过</option>
              <option value="hidden">已下架</option>
            </SelectInput>
          </Field>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Field label="综合检索">
              <TextInput
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    loadReviews({ keyword: event.currentTarget.value, page: 1 });
                  }
                }}
                placeholder="留言、姓名、学号或书名"
                className="sm:w-72"
              />
            </Field>
            <SecondaryButton
              type="button"
              className="shrink-0"
              onClick={() => loadReviews({ keyword: query, page: 1 })}
            >
              搜索
            </SecondaryButton>
            <SecondaryButton
              type="button"
              className="shrink-0"
              onClick={() => {
                setQuery("");
                loadReviews({ keyword: "", page: 1 });
              }}
            >
              重置
            </SecondaryButton>
          </div>
        </AdminToolbar>
        <div className="mt-5 space-y-4">
          <AdminPagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            totalLabel={`第 ${pagination.page} / ${pagination.totalPages} 页，共 ${pagination.total} 条`}
            prevDisabled={pagination.page <= 1}
            nextDisabled={pagination.page >= pagination.totalPages}
            onPrev={() =>
              loadReviews({ keyword: query, page: Math.max(1, pagination.page - 1) })
            }
            onNext={() =>
              loadReviews({
                keyword: query,
                page: Math.min(pagination.totalPages, pagination.page + 1),
              })
            }
          />
          {reviews.length === 0 ? (
            <EmptyState>暂无符合条件的留言。</EmptyState>
          ) : (
            <AdminList>
              {reviews.map((review) => {
                const statusMeta = reviewStatusMeta(review.status);

                return (
                  <AdminListItem key={review.id}>
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
                    <AdminMeta className="mt-3">
                      <span>提交时间：{formatDate(review.createdAt)}</span>
                      <span>公开显示：{review.displayName}</span>
                      {review.studentIdentity ? (
                        <>
                          <span>学号：{review.studentIdentity.systemId}</span>
                          <span>姓名：{review.studentIdentity.studentName}</span>
                          <span>届别：{review.studentIdentity.cohort || "未识别"}</span>
                          <span>班级：{review.studentIdentity.className}</span>
                          <span>身份证后四位：{review.studentIdentity.idCardSuffix || "未提供"}</span>
                        </>
                      ) : review.teacherIdentity ? (
                        <span>教师姓名：{review.teacherIdentity.teacherName}</span>
                      ) : (
                        <span>来源：历史旧留言</span>
                      )}
                    </AdminMeta>
                    {review.groupedBook ? (
                      <AdminMeta className="mt-2">
                        <span>所在分组：共 {review.groupedBook.groupBookCount} 个副本</span>
                        <span>作者：{review.groupedBook.author || "暂无"}</span>
                        <span>出版社：{review.groupedBook.publisher || "暂无"}</span>
                      </AdminMeta>
                    ) : null}
                    {review.sensitiveHit ? (
                      <div className="mt-3 rounded-[1.4rem] border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
                        命中敏感词：{review.matchedSensitiveWords.join("、")}
                      </div>
                    ) : null}
                    <p className="mt-3 text-sm leading-7 text-stone-600">
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
                    <div className="mt-4 flex flex-wrap gap-2">
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
                  </AdminListItem>
                );
              })}
            </AdminList>
          )}
        </div>
      </AdminSection>
    </AdminLayout>
  );
}
