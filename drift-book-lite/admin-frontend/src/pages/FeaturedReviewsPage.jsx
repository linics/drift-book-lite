import { useEffect, useState } from "react";
import { api, authHeaders, requestMessage, isUnauthorized } from "../lib/api.js";
import { Badge } from "../components/Badge.jsx";
import { PrimaryButton, SecondaryButton } from "../components/Button.jsx";
import { StatusMessage } from "../components/StatusMessage.jsx";
import { EmptyState } from "../components/EmptyState.jsx";
import { AdminLayout } from "../components/AdminLayout.jsx";
import { AdminList, AdminListItem, AdminMeta, AdminSection } from "../components/AdminUI.jsx";

export function FeaturedReviewsPage({ token, onLogout }) {
  const [reviews, setReviews] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadData() {
    try {
      const [approvedRes, featuredRes] = await Promise.all([
        api.get("/admin/reviews", {
          headers: authHeaders(token),
          params: { status: "approved" },
        }),
        api.get("/admin/featured-reviews", {
          headers: authHeaders(token),
        }),
      ]);

      setReviews(approvedRes.data.reviews);
      setSelectedIds(featuredRes.data.reviews.map((review) => review.id));
    } catch (requestError) {
      if (isUnauthorized(requestError)) {
        onLogout();
        return;
      }
      setError(requestMessage(requestError, "精选留言加载失败"));
    }
  }

  useEffect(() => {
    loadData();
  }, [token]);

  const selectedReviews = selectedIds
    .map((id) => reviews.find((review) => review.id === id))
    .filter(Boolean);
  const availableReviews = reviews.filter((review) => !selectedIds.includes(review.id));

  function removeSelected(reviewId) {
    setSelectedIds((current) => current.filter((id) => id !== reviewId));
  }

  function moveSelected(reviewId, direction) {
    setSelectedIds((current) => {
      const index = current.indexOf(reviewId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  }

  async function handleSave() {
    if (reviews.length >= 3 && selectedIds.length < 3) {
      setError("至少保留 3 条精选留言。");
      setSuccess("");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await api.put(
        "/admin/featured-reviews",
        { reviewIds: selectedIds },
        { headers: authHeaders(token) }
      );
      setSuccess("精选留言顺序已保存。");
      await loadData();
    } catch (requestError) {
      if (isUnauthorized(requestError)) {
        onLogout();
        return;
      }
      setError(requestMessage(requestError, "精选留言保存失败"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminLayout onLogout={onLogout} title="精选运营">
      <StatusMessage error={error} success={success} />
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <AdminSection
          title="当前精选"
          actions={
            <PrimaryButton type="button" onClick={handleSave} disabled={saving}>
              {saving ? "正在保存" : "保存顺序"}
            </PrimaryButton>
          }
        >
          <div className="mt-1">
            {selectedReviews.length === 0 ? (
              <EmptyState>尚无精选留言，从右侧列表中选取。</EmptyState>
            ) : (
              <AdminList>
                {selectedReviews.map((review, index) => (
                  <AdminListItem key={review.id}>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="accent">精选 {index + 1}</Badge>
                      <span className="font-semibold text-stone-900">
                        {review.groupedBook?.title || review.book?.title}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-7 text-stone-700">{review.finalContent}</p>
                    <AdminMeta className="mt-2">
                      <span>{review.displayName}</span>
                    </AdminMeta>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <SecondaryButton
                        type="button"
                        className="px-3 py-1.5 text-xs"
                        onClick={() => moveSelected(review.id, -1)}
                        disabled={index === 0}
                      >
                        上移
                      </SecondaryButton>
                      <SecondaryButton
                        type="button"
                        className="px-3 py-1.5 text-xs"
                        onClick={() => moveSelected(review.id, 1)}
                        disabled={index === selectedReviews.length - 1}
                      >
                        下移
                      </SecondaryButton>
                      <SecondaryButton
                        type="button"
                        className="px-3 py-1.5 text-xs"
                        onClick={() => removeSelected(review.id)}
                      >
                        移出精选
                      </SecondaryButton>
                    </div>
                  </AdminListItem>
                ))}
              </AdminList>
            )}
          </div>
        </AdminSection>

        <AdminSection title="可选公开留言">
          <div className="mt-6 space-y-4">
            {availableReviews.length === 0 ? (
              <EmptyState>暂无可加入精选的公开留言。</EmptyState>
            ) : (
              <AdminList>
                {availableReviews.map((review) => (
                  <AdminListItem key={review.id}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-stone-900">
                        {review.groupedBook?.title || review.book?.title}
                      </span>
                      {review.sequenceNumber ? (
                        <Badge tone="muted">第 {review.sequenceNumber} 层</Badge>
                      ) : null}
                    </div>
                    <p className="mt-3 text-sm leading-7 text-stone-700">{review.finalContent}</p>
                    <AdminMeta className="mt-2">
                      <span>{review.displayName}</span>
                    </AdminMeta>
                    <div className="mt-3">
                      <PrimaryButton
                        type="button"
                        className="px-3 py-1.5 text-xs"
                        disabled={selectedIds.length >= 10}
                        onClick={() => setSelectedIds((current) => [...current, review.id])}
                      >
                        加入精选
                      </PrimaryButton>
                    </div>
                  </AdminListItem>
                ))}
              </AdminList>
            )}
          </div>
        </AdminSection>
      </div>
    </AdminLayout>
  );
}
