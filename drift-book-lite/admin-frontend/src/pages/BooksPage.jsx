import { useEffect, useRef, useState } from "react";
import { api, authHeaders, requestMessage, isUnauthorized } from "../lib/api.js";
import { formatDate, importStatusTone, importStatusLabel } from "../lib/helpers.js";
import { Badge } from "../components/Badge.jsx";
import { Field } from "../components/Field.jsx";
import { TextInput, SelectInput } from "../components/Input.jsx";
import { PrimaryButton, SecondaryButton } from "../components/Button.jsx";
import { StatusMessage } from "../components/StatusMessage.jsx";
import { EmptyState } from "../components/EmptyState.jsx";
import { AdminLayout } from "../components/AdminLayout.jsx";

export function BooksPage({ token, onLogout }) {
  const fileInputRef = useRef(null);
  const [books, setBooks] = useState([]);
  const [batches, setBatches] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 30,
    total: 0,
    totalPages: 1,
  });
  const [query, setQuery] = useState("");
  const [selectedBook, setSelectedBook] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [importForm, setImportForm] = useState({
    catalogName: "馆藏目录",
    importMode: "create_only",
    file: null,
  });
  const [loadError, setLoadError] = useState("");
  const [importError, setImportError] = useState("");
  const [importSuccess, setImportSuccess] = useState("");
  const [bookError, setBookError] = useState("");
  const [bookSuccess, setBookSuccess] = useState("");
  const [importing, setImporting] = useState(false);
  const [deletingBatchId, setDeletingBatchId] = useState(null);
  const [savingBook, setSavingBook] = useState(false);

  async function loadData({ keyword = query, page = pagination.page } = {}) {
    try {
      setLoadError("");
      const [booksRes, batchesRes] = await Promise.all([
        api.get("/admin/books", {
          headers: authHeaders(token),
          params: {
            ...(keyword ? { q: keyword } : {}),
            page,
            pageSize: pagination.pageSize,
          },
        }),
        api.get("/admin/imports", {
          headers: authHeaders(token),
        }),
      ]);
      setBooks(booksRes.data.books);
      setPagination(booksRes.data.pagination);
      setBatches(batchesRes.data.batches);
    } catch (requestError) {
      if (isUnauthorized(requestError)) {
        onLogout();
        return;
      }
      setLoadError(requestMessage(requestError, "后台数据加载失败"));
    }
  }

  useEffect(() => {
    loadData({ keyword: "", page: 1 });
  }, [token]);

  async function handleImport(event) {
    event.preventDefault();
    if (!importForm.file) return;

    const formData = new FormData();
    formData.append("catalogName", importForm.catalogName);
    formData.append("importMode", importForm.importMode);
    formData.append("file", importForm.file);

    setImporting(true);
    setImportError("");
    setImportSuccess("");

    try {
      const response = await api.post("/admin/imports", formData, {
        headers: authHeaders(token),
      });
      setImportSuccess(
        `导入完成：成功 ${response.data.batch.successRows} 行，失败 ${response.data.batch.failedRows} 行。`
      );
      setImportForm((current) => ({ ...current, file: null }));
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      await loadData({ keyword: query, page: 1 });
    } catch (requestError) {
      if (isUnauthorized(requestError)) {
        onLogout();
        return;
      }
      setImportError(requestMessage(requestError, "导入批次保存失败"));
    } finally {
      setImporting(false);
    }
  }

  async function handleBookSave(event) {
    event.preventDefault();
    if (!selectedBook || !editForm) return;

    setSavingBook(true);
    setBookError("");
    setBookSuccess("");

    try {
      await api.patch(`/admin/books/${selectedBook.id}`, editForm, {
        headers: authHeaders(token),
      });
      setBookSuccess("图书信息已更新。");
      await loadData({ keyword: query, page: pagination.page });
    } catch (requestError) {
      if (isUnauthorized(requestError)) {
        onLogout();
        return;
      }
      setBookError(requestMessage(requestError, "图书更新失败"));
    } finally {
      setSavingBook(false);
    }
  }

  async function handleDeleteBatch(batch) {
    if (
      !window.confirm(
        `确认删除批次"${batch.catalogName}"吗？该批次当前关联的图书和评语也会一并删除。`
      )
    ) {
      return;
    }

    setDeletingBatchId(batch.id);
    setImportError("");
    setImportSuccess("");

    try {
      const response = await api.delete(`/admin/imports/${batch.id}`, {
        headers: authHeaders(token),
      });
      if (selectedBook?.sourceImportBatch?.id === batch.id) {
        setSelectedBook(null);
        setEditForm(null);
      }
      setImportSuccess(
        `已删除批次"${batch.catalogName}"，同时移除 ${response.data.deletedBookCount} 本图书。`
      );
      await loadData({
        keyword: query,
        page: Math.min(pagination.page, Math.max(1, pagination.totalPages - 1)),
      });
    } catch (requestError) {
      if (isUnauthorized(requestError)) {
        onLogout();
        return;
      }
      setImportError(requestMessage(requestError, "导入批次删除失败"));
    } finally {
      setDeletingBatchId(null);
    }
  }

  return (
    <AdminLayout
      onLogout={onLogout}
      title="图书与导入"
      description="导入书目并维护图书信息。"
    >
      <StatusMessage error={loadError} />

      <div className="grid gap-6 xl:grid-cols-[0.76fr_1.24fr]">
        <section className="paper-panel rounded-[2.4rem] p-7 shadow-[0_20px_70px_rgba(48,34,17,0.08)]">
          <h3 className="font-display text-3xl text-stone-900">导入书目目录</h3>
          <StatusMessage error={importError} success={importSuccess} />
          <form className="mt-6 space-y-5" onSubmit={handleImport}>
            <Field label="批次名称">
              <TextInput
                value={importForm.catalogName}
                onChange={(event) =>
                  setImportForm((current) => ({ ...current, catalogName: event.target.value }))
                }
              />
            </Field>
            <Field label="导入模式">
              <SelectInput
                value={importForm.importMode}
                onChange={(event) =>
                  setImportForm((current) => ({ ...current, importMode: event.target.value }))
                }
              >
                <option value="create_only">只新增</option>
                <option value="upsert">新增或更新</option>
              </SelectInput>
              <p className="mt-2 text-xs leading-6 text-stone-500">
                {importForm.importMode === "create_only"
                  ? "只新增：若 book_id 已存在，该行会失败，不覆盖旧数据。"
                  : "新增或更新：若 book_id 已存在，会用新文件中的数据覆盖旧记录。"}
              </p>
            </Field>
            <Field
              label="导入文件"
              hint={`当前模式：${
                importForm.importMode === "create_only" ? "只新增" : "新增或更新"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx"
                onChange={(event) =>
                  setImportForm((current) => ({
                    ...current,
                    file: event.target.files?.[0] || null,
                  }))
                }
                className="hidden"
              />
              <div className="rounded-[1.8rem] border border-stone-200 bg-white/75 p-4">
                <p className="text-sm text-stone-700">
                  {importForm.file ? importForm.file.name : "尚未选择 CSV/XLSX 文件"}
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <SecondaryButton
                    type="button"
                    className="h-12 min-w-32"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    选择文件
                  </SecondaryButton>
                  <PrimaryButton type="submit" disabled={!importForm.file || importing} className="h-12 min-w-32">
                    {importing ? "正在导入" : "开始导入"}
                  </PrimaryButton>
                </div>
              </div>
            </Field>
          </form>

          <div className="mt-8 space-y-4">
            <h4 className="font-semibold text-stone-900">导入历史</h4>
            {batches.length === 0 ? (
              <EmptyState>暂无导入记录，先上传一份 CSV 或 XLSX 书目文件。</EmptyState>
            ) : (
              batches.map((batch) => (
                <div
                  key={batch.id}
                  className="rounded-[1.8rem] border border-stone-200 bg-white/80 p-4"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-semibold text-stone-900">{batch.catalogName}</span>
                    <Badge tone={importStatusTone(batch.status)}>
                      {importStatusLabel(batch.status)}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-stone-600">
                    {batch.fileName} · 成功 {batch.successRows} / 失败 {batch.failedRows}
                  </p>
                  <p className="mt-1 text-xs text-stone-500">{formatDate(batch.createdAt)}</p>
                  <div className="mt-3">
                    <SecondaryButton
                      type="button"
                      className="px-4 py-2 text-xs"
                      disabled={deletingBatchId === batch.id}
                      onClick={() => handleDeleteBatch(batch)}
                    >
                      {deletingBatchId === batch.id ? "正在删除" : "删除该批次数据"}
                    </SecondaryButton>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="paper-panel rounded-[2.4rem] p-7 shadow-[0_20px_70px_rgba(48,34,17,0.08)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.34em] text-primary">Books</p>
              <h3 className="mt-2 font-display text-4xl text-stone-900">馆藏图书</h3>
            </div>
            <div className="flex flex-col gap-3 md:flex-row md:items-end">
              <Field label="按书名搜索">
                <TextInput
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      loadData({ keyword: event.currentTarget.value, page: 1 });
                    }
                  }}
                  placeholder="输入书名后回车"
                  className="md:w-72"
                />
              </Field>
              <SecondaryButton
                type="button"
                className="h-12"
                onClick={() => loadData({ keyword: query, page: 1 })}
              >
                搜索
              </SecondaryButton>
              <SecondaryButton
                type="button"
                className="h-12"
                onClick={() => {
                  setQuery("");
                  loadData({ keyword: "", page: 1 });
                }}
              >
                重置
              </SecondaryButton>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.4rem] border border-stone-200 bg-white/65 px-4 py-3 text-sm text-stone-600">
                <span>
                  当前显示第 {pagination.page} / {pagination.totalPages} 页，共 {pagination.total} 本
                </span>
                <div className="flex gap-2">
                  <SecondaryButton
                    type="button"
                    className="px-4 py-2 text-xs"
                    disabled={pagination.page <= 1}
                    onClick={() =>
                      loadData({ keyword: query, page: Math.max(1, pagination.page - 1) })
                    }
                  >
                    上一页
                  </SecondaryButton>
                  <SecondaryButton
                    type="button"
                    className="px-4 py-2 text-xs"
                    disabled={pagination.page >= pagination.totalPages}
                    onClick={() =>
                      loadData({
                        keyword: query,
                        page: Math.min(pagination.totalPages, pagination.page + 1),
                      })
                    }
                  >
                    下一页
                  </SecondaryButton>
                </div>
              </div>
              {books.length === 0 ? (
                <EmptyState>当前搜索条件下没有图书结果。</EmptyState>
              ) : (
                books.map((book) => (
                  <button
                    key={book.id}
                    type="button"
                    onClick={() => {
                      setSelectedBook(book);
                      setEditForm({
                        title: book.title,
                        author: book.author,
                        publishPlace: book.publishPlace || "",
                        publisher: book.publisher,
                        publishDateText: book.publishDateText || "",
                        barcode: book.barcode || "",
                        subtitle: book.subtitle || "",
                      });
                      setBookError("");
                      setBookSuccess("");
                    }}
                    className="w-full rounded-[1.8rem] border border-stone-200 bg-white/80 p-5 text-left transition hover:border-primary/35"
                  >
                    <span className="font-semibold text-stone-900">{book.title}</span>
                    <p className="mt-2 text-sm text-stone-600">{book.author}</p>
                    <p className="mt-1 text-sm text-stone-500">{book.publisher}</p>
                    {book.publishDateText ? (
                      <p className="mt-1 text-xs text-stone-500">出版日期 {book.publishDateText}</p>
                    ) : null}
                    {book.subtitle ? (
                      <p className="mt-2 text-sm text-stone-600">副标题：{book.subtitle}</p>
                    ) : null}
                  </button>
                ))
              )}
            </div>

            <div className="rounded-[1.8rem] border border-stone-200 bg-surface p-5">
              <h4 className="font-semibold text-stone-900">
                {selectedBook ? "编辑图书" : "选择一本图书"}
              </h4>
              <StatusMessage error={bookError} success={bookSuccess} />
              {selectedBook && editForm ? (
                <form className="mt-4 space-y-4" onSubmit={handleBookSave}>
                  <Field label="书名">
                    <TextInput
                      value={editForm.title}
                      onChange={(event) =>
                        setEditForm((current) => ({ ...current, title: event.target.value }))
                      }
                    />
                  </Field>
                  <Field label="作者">
                    <TextInput
                      value={editForm.author}
                      onChange={(event) =>
                        setEditForm((current) => ({ ...current, author: event.target.value }))
                      }
                    />
                  </Field>
                  <Field label="出版地">
                    <TextInput
                      value={editForm.publishPlace}
                      onChange={(event) =>
                        setEditForm((current) => ({
                          ...current,
                          publishPlace: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="出版社">
                    <TextInput
                      value={editForm.publisher}
                      onChange={(event) =>
                        setEditForm((current) => ({ ...current, publisher: event.target.value }))
                      }
                    />
                  </Field>
                  <Field label="出版日期">
                    <TextInput
                      value={editForm.publishDateText}
                      onChange={(event) =>
                        setEditForm((current) => ({
                          ...current,
                          publishDateText: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="条形码">
                    <TextInput
                      value={editForm.barcode}
                      onChange={(event) =>
                        setEditForm((current) => ({
                          ...current,
                          barcode: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="副标题">
                    <TextInput
                      value={editForm.subtitle}
                      onChange={(event) =>
                        setEditForm((current) => ({
                          ...current,
                          subtitle: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <PrimaryButton type="submit" disabled={savingBook}>
                    {savingBook ? "正在保存" : "保存图书"}
                  </PrimaryButton>
                </form>
              ) : (
                <p className="mt-4 text-sm leading-7 text-stone-600">
                  从左侧选择一本图书以修订基本信息。
                </p>
              )}
            </div>
          </div>
        </section>
      </div>
    </AdminLayout>
  );
}
