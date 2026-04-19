import { useEffect, useRef, useState } from "react";
import { api, authHeaders, requestMessage, isUnauthorized } from "../lib/api.js";
import { formatDate, importStatusTone, importStatusLabel } from "../lib/helpers.js";
import { Badge } from "../components/Badge.jsx";
import { Field, FieldRow } from "../components/Field.jsx";
import { TextInput, SelectInput } from "../components/Input.jsx";
import { PrimaryButton, SecondaryButton } from "../components/Button.jsx";
import { StatusMessage } from "../components/StatusMessage.jsx";
import { EmptyState } from "../components/EmptyState.jsx";
import { AdminLayout } from "../components/AdminLayout.jsx";
import {
  AdminFileBox,
  AdminDefaultResourceSection,
  AdminList,
  AdminListItem,
  AdminMeta,
  AdminPagination,
  AdminSection,
  AdminToolbar,
} from "../components/AdminUI.jsx";

export function BooksPage({ token, onLogout }) {
  const fileInputRef = useRef(null);
  const [books, setBooks] = useState([]);
  const [batches, setBatches] = useState([]);
  const [defaultResources, setDefaultResources] = useState(null);
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
  const [defaultImporting, setDefaultImporting] = useState(false);
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
      return;
    }

    try {
      const defaultResourcesRes = await api.get("/admin/default-resources", {
        headers: authHeaders(token),
      });
      setDefaultResources(defaultResourcesRes.data.resources);
    } catch (requestError) {
      if (isUnauthorized(requestError)) {
        onLogout();
      }
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

  async function handleDefaultCatalogImport() {
    setDefaultImporting(true);
    setImportError("");
    setImportSuccess("");

    try {
      const response = await api.post(
        "/admin/imports/default-catalog",
        {},
        { headers: authHeaders(token) }
      );
      setImportSuccess(
        `默认目录导入完成：成功 ${response.data.batch.successRows} 行，失败 ${response.data.batch.failedRows} 行。`
      );
      await loadData({ keyword: query, page: 1 });
    } catch (requestError) {
      if (isUnauthorized(requestError)) {
        onLogout();
        return;
      }
      setImportError(requestMessage(requestError, "默认目录导入失败"));
    } finally {
      setDefaultImporting(false);
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
    <AdminLayout onLogout={onLogout} title="图书与导入">
      <StatusMessage error={loadError} />

      <div className="grid gap-6 xl:grid-cols-[0.76fr_1.24fr]">
        <div className="space-y-6">
          <AdminDefaultResourceSection
            title="默认图书目录"
            description="使用部署内置的 7 楼图书目录。"
            pathLabel="默认路径"
            pathValue={defaultResources?.bookCatalog?.path}
            fallbackValue="未配置"
            actionLabel="导入默认目录"
            loadingLabel="正在导入"
            loading={defaultImporting}
            onAction={handleDefaultCatalogImport}
            summary={
              defaultResources?.bookCatalog
                ? `当前馆藏 ${defaultResources.bookCatalog.bookCount} 本`
                : null
            }
          />

          <AdminSection title="导入书目目录">
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
                <p className="mt-2 text-xs leading-5 text-stone-500">
                  {importForm.importMode === "create_only"
                    ? "已存在的 book_id 不会被覆盖。"
                    : "已存在的 book_id 会更新。"}
                </p>
              </Field>
              <Field label="导入文件">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xls,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={(event) =>
                    setImportForm((current) => ({
                      ...current,
                      file: event.target.files?.[0] || null,
                    }))
                  }
                  className="hidden"
                />
                <AdminFileBox
                  label={importForm.file ? importForm.file.name : "尚未选择 CSV/XLS/XLSX 文件"}
                  actions={
                    <>
                      <SecondaryButton
                        type="button"
                        className="min-w-28"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        选择文件
                      </SecondaryButton>
                      <PrimaryButton type="submit" disabled={!importForm.file || importing} className="min-w-28">
                        {importing ? "正在导入" : "开始导入"}
                      </PrimaryButton>
                    </>
                  }
                />
              </Field>
            </form>

            <div className="mt-8">
              <h4 className="mb-3 font-display text-2xl text-stone-900">导入历史</h4>
              {batches.length === 0 ? (
                <EmptyState>暂无导入记录，先上传一份 CSV、XLS 或 XLSX 书目文件。</EmptyState>
              ) : (
                <AdminList>
                  {batches.map((batch) => (
                    <AdminListItem key={batch.id}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-stone-900">{batch.catalogName}</span>
                        <Badge tone={importStatusTone(batch.status)}>
                          {importStatusLabel(batch.status)}
                        </Badge>
                      </div>
                      <AdminMeta className="mt-2">
                        <span>{batch.fileName}</span>
                        <span>成功 {batch.successRows}</span>
                        <span>失败 {batch.failedRows}</span>
                        <span>{formatDate(batch.createdAt)}</span>
                      </AdminMeta>
                      <div className="mt-3">
                        <SecondaryButton
                          type="button"
                          className="px-3 py-1.5 text-xs"
                          disabled={deletingBatchId === batch.id}
                          onClick={() => handleDeleteBatch(batch)}
                        >
                          {deletingBatchId === batch.id ? "正在删除" : "删除该批次数据"}
                        </SecondaryButton>
                      </div>
                    </AdminListItem>
                  ))}
                </AdminList>
              )}
            </div>
          </AdminSection>
        </div>

        <AdminSection title="馆藏图书">
          <AdminToolbar>
            <span className="hidden sm:block" />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
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
                  className="sm:w-72"
                />
              </Field>
              <SecondaryButton
                type="button"
                className="shrink-0"
                onClick={() => loadData({ keyword: query, page: 1 })}
              >
                搜索
              </SecondaryButton>
              <SecondaryButton
                type="button"
                className="shrink-0"
                onClick={() => {
                  setQuery("");
                  loadData({ keyword: "", page: 1 });
                }}
              >
                重置
              </SecondaryButton>
            </div>
          </AdminToolbar>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-4">
              <AdminPagination
                page={pagination.page}
                totalPages={pagination.totalPages}
                totalLabel={`第 ${pagination.page} / ${pagination.totalPages} 页，共 ${pagination.total} 本`}
                prevDisabled={pagination.page <= 1}
                nextDisabled={pagination.page >= pagination.totalPages}
                onPrev={() => loadData({ keyword: query, page: Math.max(1, pagination.page - 1) })}
                onNext={() =>
                  loadData({
                    keyword: query,
                    page: Math.min(pagination.totalPages, pagination.page + 1),
                  })
                }
              />
              {books.length === 0 ? (
                <EmptyState>当前搜索条件下没有图书结果。</EmptyState>
              ) : (
                <AdminList>
                  {books.map((book) => (
                    <AdminListItem
                      key={book.id}
                      as="button"
                      type="button"
                      interactive
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
                    >
                      <span className="font-semibold text-stone-900">{book.title}</span>
                      <AdminMeta className="mt-2">
                        <span>{book.author}</span>
                        <span>{book.publisher}</span>
                        {book.publishDateText ? <span>出版日期 {book.publishDateText}</span> : null}
                      </AdminMeta>
                      {book.subtitle ? (
                        <p className="mt-2 text-sm text-stone-600">副标题：{book.subtitle}</p>
                      ) : null}
                    </AdminListItem>
                  ))}
                </AdminList>
              )}
            </div>

            <div className="rounded-[1.8rem] border border-stone-200 bg-white/70 p-5">
              <h4 className="font-display text-2xl text-stone-900">
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
                  <FieldRow>
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
                  </FieldRow>
                  <FieldRow>
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
                  </FieldRow>
                  <FieldRow>
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
                  </FieldRow>
                  <PrimaryButton type="submit" disabled={savingBook}>
                    {savingBook ? "正在保存" : "保存图书"}
                  </PrimaryButton>
                </form>
              ) : (
                <p className="mt-4 text-sm leading-7 text-stone-500">
                  从左侧选择一本图书以修订基本信息。
                </p>
              )}
            </div>
          </div>
        </AdminSection>
      </div>
    </AdminLayout>
  );
}
