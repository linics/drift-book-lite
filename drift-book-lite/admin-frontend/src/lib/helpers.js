export const DEFAULT_PAGE_SIZE = 30;

export function buildPaginationState({ page = 1, pageSize = DEFAULT_PAGE_SIZE, total = 0, totalPages } = {}) {
  const normalizedPage = Math.max(1, Number(page) || 1);
  const normalizedPageSize = Math.max(1, Number(pageSize) || DEFAULT_PAGE_SIZE);
  const normalizedTotal = Math.max(0, Number(total) || 0);
  const normalizedTotalPages =
    totalPages == null
      ? Math.max(1, Math.ceil(normalizedTotal / normalizedPageSize))
      : Math.max(1, Number(totalPages) || 1);

  return {
    page: Math.min(normalizedPage, normalizedTotalPages),
    pageSize: normalizedPageSize,
    total: normalizedTotal,
    totalPages: normalizedTotalPages,
  };
}

export function formatDate(input) {
  if (!input) return "刚刚";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(input));
}

export function importStatusTone(status) {
  if (status === "completed") return "success";
  if (status === "partial" || status === "processing") return "warning";
  if (status === "failed") return "danger";
  return "muted";
}

export function importStatusLabel(status) {
  return (
    {
      processing: "处理中",
      completed: "已完成",
      partial: "部分失败",
      failed: "导入失败",
    }[status] || status
  );
}
