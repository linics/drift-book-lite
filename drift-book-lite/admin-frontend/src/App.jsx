import { useEffect, useRef, useState } from "react";
import axios from "axios";
import clsx from "clsx";
import {
  BrowserRouter,
  Navigate,
  NavLink,
  Route,
  Routes,
  useNavigate,
} from "react-router-dom";

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "/api").trim();
const apiOrigin = apiBaseUrl.startsWith("http") ? new URL(apiBaseUrl).origin : "";

const api = axios.create({
  baseURL: apiBaseUrl,
});

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

function requestMessage(error, fallback) {
  return error.response?.data?.message || fallback;
}

function isUnauthorized(error) {
  return error.response?.status === 401;
}

function assetUrl(input) {
  if (!input) return null;
  if (input.startsWith("http")) return input;
  if (apiOrigin && input.startsWith("/")) return `${apiOrigin}${input}`;
  return input;
}

function importStatusTone(status) {
  if (status === "completed") return "success";
  if (status === "partial" || status === "processing") return "warning";
  if (status === "failed") return "danger";
  return "muted";
}

function importStatusLabel(status) {
  return (
    {
      processing: "处理中",
      completed: "已完成",
      partial: "部分失败",
      failed: "导入失败",
    }[status] || status
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
        tone === "danger" && "bg-rose-700/10 text-rose-700",
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
        "w-full rounded-2xl border border-stone-300/70 bg-white/90 px-4 py-3 text-sm text-stone-900 outline-none transition",
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
        "w-full rounded-3xl border border-stone-300/70 bg-white/90 px-4 py-3 text-sm leading-7 text-stone-900 outline-none transition",
        "placeholder:text-stone-400 focus:border-[#8b2f2a] focus:ring-2 focus:ring-[#8b2f2a]/15",
        props.className
      )}
    />
  );
}

function SelectInput({ className, ...props }) {
  return (
    <select
      {...props}
      className={clsx(
        "w-full rounded-2xl border border-stone-300/70 bg-white/90 px-4 py-3 text-sm text-stone-900 outline-none transition",
        "focus:border-[#8b2f2a] focus:ring-2 focus:ring-[#8b2f2a]/15",
        className
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
        "inline-flex items-center justify-center rounded-full border border-stone-300 bg-white/80 px-5 py-3 text-sm font-medium text-stone-700 transition hover:border-stone-400 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    >
      {children}
    </button>
  );
}

function StatusMessage({ error, success }) {
  if (success) {
    return (
      <div className="rounded-[1.8rem] border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-800">
        {success}
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-[1.8rem] border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-700">
        {error}
      </div>
    );
  }
  return null;
}

function EmptyState({ children }) {
  return (
    <div className="rounded-[1.8rem] border border-dashed border-stone-300 bg-white/65 p-5 text-sm leading-7 text-stone-500">
      {children}
    </div>
  );
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

function useAdminSession() {
  const [token, setTokenState] = useState(() => getAdminToken());

  function update(nextToken) {
    setAdminToken(nextToken);
    setTokenState(nextToken);
  }

  return { token, setToken: update };
}

function AdminLayout({ title, description, onLogout, children }) {
  const links = [
    { to: "/books", label: "图书与导入" },
    { to: "/reviews", label: "留言审核" },
    { to: "/featured", label: "精选运营" },
    { to: "/sensitive-words", label: "敏感词库" },
    { to: "/assets", label: "站点素材" },
  ];

  return (
    <div className="min-h-screen px-4 py-5 text-stone-900 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[16rem_1fr]">
        <aside className="rounded-[2.4rem] bg-[linear-gradient(180deg,#16110d,#231813_68%,#100d0a)] p-6 text-white shadow-[0_24px_90px_rgba(24,18,9,0.35)]">
          <p className="text-xs uppercase tracking-[0.34em] text-stone-400">Admin Console</p>
          <h1 className="mt-4 font-display text-4xl text-[#f5ead9]">一本书的漂流</h1>
          <p className="mt-3 text-sm leading-7 text-stone-300">
            管理端独立运行在馆内端口，负责图书目录、评语审核与首页素材维护。
          </p>
          <nav className="mt-8 space-y-2">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end
                className={({ isActive }) =>
                  clsx(
                    "group relative block overflow-hidden rounded-[1.35rem] border px-4 py-3 text-sm transition",
                    isActive
                      ? "border-[#d7b58c]/35 bg-white/8 text-[#f8efdf] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                      : "border-transparent text-stone-300 hover:border-white/10 hover:bg-white/6 hover:text-[#f3e7d5]"
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={clsx(
                        "absolute inset-y-3 left-2 w-[3px] rounded-full transition",
                        isActive ? "bg-[#d7b58c]" : "bg-transparent group-hover:bg-white/12"
                      )}
                    />
                    <span className="relative pl-3">{link.label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>
          <div className="mt-8 border-t border-white/10 pt-6">
            <button
              type="button"
              onClick={onLogout}
              className="rounded-full border border-white/15 px-4 py-2 text-sm text-stone-200 transition hover:border-white/25 hover:bg-white/8"
            >
              退出登录
            </button>
          </div>
        </aside>

        <div className="space-y-6">
          <header className="rounded-[2.4rem] border border-stone-200/70 bg-white/80 p-8 shadow-[0_20px_70px_rgba(48,34,17,0.08)]">
            <p className="text-xs uppercase tracking-[0.34em] text-[#8b2f2a]">Admin Panel</p>
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
    return <Navigate to="/login" replace />;
  }
  return children({ token, setToken });
}

function AdminLoginPage() {
  const navigate = useNavigate();
  const { token, setToken } = useAdminSession();
  const [formState, setFormState] = useState({
    username: "admin1",
    password: "change-this-password",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (token) {
      navigate("/books", { replace: true });
    }
  }, [navigate, token]);

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await api.post("/admin/login", formState);
      setToken(response.data.token);
      navigate("/books", { replace: true });
    } catch (requestError) {
      setError(requestMessage(requestError, "登录失败"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#d7b58c,transparent_38%),linear-gradient(180deg,#17110c,#241913_65%,#0d0b09)] px-4 py-10">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-[2.6rem] border border-white/12 bg-white/[0.06] shadow-[0_40px_120px_rgba(0,0,0,0.42)] backdrop-blur md:grid-cols-[1.1fr_0.9fr]">
        <div className="hidden border-r border-white/10 p-10 text-white md:block">
          <p className="text-xs uppercase tracking-[0.36em] text-stone-300">Admin Access</p>
          <h1 className="mt-5 font-display text-6xl leading-[0.96]">
            管理书目，
            <span className="text-[#d7b58c]"> 管理评语。</span>
          </h1>
          <p className="mt-6 max-w-xl text-sm leading-8 text-stone-300">
            新版后台独立于学生端运行，不在学生首页显示，专门用于导入书目和审核内容。
          </p>
        </div>

        <div className="bg-[#f8f3ea] p-8 md:p-10">
          <Badge tone="accent">管理员登录</Badge>
          <h2 className="mt-5 font-display text-4xl text-stone-900">进入后台</h2>
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
            <StatusMessage error={error} />
            <PrimaryButton type="submit" disabled={loading} className="w-full">
              {loading ? "正在登录" : "进入后台"}
            </PrimaryButton>
          </form>
        </div>
      </div>
    </div>
  );
}

function BooksPage({ token, onLogout }) {
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
        `确认删除批次“${batch.catalogName}”吗？该批次当前关联的图书和评语也会一并删除。`
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
        `已删除批次“${batch.catalogName}”，同时移除 ${response.data.deletedBookCount} 本图书。`
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
      description="导入新的 CSV 或 XLSX 书目目录，查看历史批次，并对单本图书做必要修订。"
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
              <EmptyState>暂无导入批次，先上传一份 CSV 书目目录。</EmptyState>
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
              <p className="text-xs uppercase tracking-[0.34em] text-[#8b2f2a]">Books</p>
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
                    className="w-full rounded-[1.8rem] border border-stone-200 bg-white/80 p-5 text-left transition hover:border-[#8b2f2a]/35"
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

            <div className="rounded-[1.8rem] border border-stone-200 bg-[#faf6ef] p-5">
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
                  从左侧列表中选择一本图书后，可在这里修订书名、作者、出版信息与副标题。
                </p>
              )}
            </div>
          </div>
        </section>
      </div>
    </AdminLayout>
  );
}

function ReviewsPage({ token, onLogout }) {
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
      description="审核实名接龙留言，查看学生身份、敏感词命中情况，并决定公开或隐藏。"
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
            <EmptyState>当前筛选条件下没有评语。</EmptyState>
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

function FeaturedReviewsPage({ token, onLogout }) {
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
    <AdminLayout
      onLogout={onLogout}
      title="精选运营"
      description="从已公开留言中挑选首页精选内容，并手动调整展示顺序。"
    >
      <StatusMessage error={error} success={success} />
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="paper-panel rounded-[2.4rem] p-7 shadow-[0_20px_70px_rgba(48,34,17,0.08)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.34em] text-[#8b2f2a]">Selected</p>
              <h3 className="mt-2 font-display text-3xl text-stone-900">当前精选</h3>
            </div>
            <PrimaryButton type="button" onClick={handleSave} disabled={saving}>
              {saving ? "正在保存" : "保存顺序"}
            </PrimaryButton>
          </div>
          <div className="mt-6 space-y-4">
            {selectedReviews.length === 0 ? (
              <EmptyState>当前还没有精选留言。</EmptyState>
            ) : (
              selectedReviews.map((review, index) => (
                <div
                  key={review.id}
                  className="rounded-[1.8rem] border border-stone-200 bg-white/85 p-5"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge tone="accent">精选 {index + 1}</Badge>
                    <span className="font-semibold text-stone-900">
                      {review.groupedBook?.title || review.book?.title}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-stone-700">{review.finalContent}</p>
                  <p className="mt-2 text-xs text-stone-500">{review.displayName}</p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <SecondaryButton
                      type="button"
                      className="px-4 py-2 text-xs"
                      onClick={() => moveSelected(review.id, -1)}
                      disabled={index === 0}
                    >
                      上移
                    </SecondaryButton>
                    <SecondaryButton
                      type="button"
                      className="px-4 py-2 text-xs"
                      onClick={() => moveSelected(review.id, 1)}
                      disabled={index === selectedReviews.length - 1}
                    >
                      下移
                    </SecondaryButton>
                    <SecondaryButton
                      type="button"
                      className="px-4 py-2 text-xs"
                      onClick={() => removeSelected(review.id)}
                    >
                      移出精选
                    </SecondaryButton>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="paper-panel rounded-[2.4rem] p-7 shadow-[0_20px_70px_rgba(48,34,17,0.08)]">
          <p className="text-xs uppercase tracking-[0.34em] text-[#8b2f2a]">Approved</p>
          <h3 className="mt-2 font-display text-3xl text-stone-900">可选公开留言</h3>
          <div className="mt-6 space-y-4">
            {availableReviews.length === 0 ? (
              <EmptyState>没有更多可加入精选的公开留言。</EmptyState>
            ) : (
              availableReviews.map((review) => (
                <div
                  key={review.id}
                  className="rounded-[1.8rem] border border-stone-200 bg-white/85 p-5"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-semibold text-stone-900">
                      {review.groupedBook?.title || review.book?.title}
                    </span>
                    {review.sequenceNumber ? (
                      <Badge tone="muted">第 {review.sequenceNumber} 层</Badge>
                    ) : null}
                  </div>
                  <p className="mt-3 text-sm leading-7 text-stone-700">{review.finalContent}</p>
                  <p className="mt-2 text-xs text-stone-500">{review.displayName}</p>
                  <div className="mt-4">
                    <PrimaryButton
                      type="button"
                      className="px-4 py-2 text-xs"
                      disabled={selectedIds.length >= 10}
                      onClick={() => setSelectedIds((current) => [...current, review.id])}
                    >
                      加入精选
                    </PrimaryButton>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </AdminLayout>
  );
}

function SensitiveWordsPage({ token, onLogout }) {
  const [words, setWords] = useState([]);
  const [newWord, setNewWord] = useState("");
  const [drafts, setDrafts] = useState({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadWords() {
    try {
      const response = await api.get("/admin/sensitive-words", {
        headers: authHeaders(token),
      });
      setWords(response.data.words);
      setDrafts(
        Object.fromEntries(response.data.words.map((word) => [word.id, word.word]))
      );
    } catch (requestError) {
      if (isUnauthorized(requestError)) {
        onLogout();
        return;
      }
      setError(requestMessage(requestError, "敏感词库加载失败"));
    }
  }

  useEffect(() => {
    loadWords();
  }, [token]);

  async function handleCreate(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    try {
      await api.post(
        "/admin/sensitive-words",
        { word: newWord },
        { headers: authHeaders(token) }
      );
      setNewWord("");
      setSuccess("敏感词已添加。");
      await loadWords();
    } catch (requestError) {
      if (isUnauthorized(requestError)) {
        onLogout();
        return;
      }
      setError(requestMessage(requestError, "敏感词新增失败"));
    }
  }

  async function handleUpdate(wordId) {
    setError("");
    setSuccess("");
    try {
      await api.patch(
        `/admin/sensitive-words/${wordId}`,
        { word: drafts[wordId] },
        { headers: authHeaders(token) }
      );
      setSuccess("敏感词已更新。");
      await loadWords();
    } catch (requestError) {
      if (isUnauthorized(requestError)) {
        onLogout();
        return;
      }
      setError(requestMessage(requestError, "敏感词更新失败"));
    }
  }

  async function handleDelete(wordId) {
    setError("");
    setSuccess("");
    try {
      await api.delete(`/admin/sensitive-words/${wordId}`, {
        headers: authHeaders(token),
      });
      setSuccess("敏感词已删除。");
      await loadWords();
    } catch (requestError) {
      if (isUnauthorized(requestError)) {
        onLogout();
        return;
      }
      setError(requestMessage(requestError, "敏感词删除失败"));
    }
  }

  return (
    <AdminLayout
      onLogout={onLogout}
      title="敏感词库"
      description="维护审核辅助词库。命中敏感词的留言仍可提交，但会在后台高亮提示。"
    >
      <StatusMessage error={error} success={success} />
      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <section className="paper-panel rounded-[2.4rem] p-7 shadow-[0_20px_70px_rgba(48,34,17,0.08)]">
          <h3 className="font-display text-3xl text-stone-900">新增敏感词</h3>
          <form className="mt-6 space-y-4" onSubmit={handleCreate}>
            <Field label="词条">
              <TextInput
                value={newWord}
                onChange={(event) => setNewWord(event.target.value)}
                placeholder="例如：禁词"
              />
            </Field>
            <PrimaryButton type="submit" disabled={!newWord.trim()}>
              添加词条
            </PrimaryButton>
          </form>
        </section>
        <section className="paper-panel rounded-[2.4rem] p-7 shadow-[0_20px_70px_rgba(48,34,17,0.08)]">
          <h3 className="font-display text-3xl text-stone-900">现有词库</h3>
          <div className="mt-6 space-y-4">
            {words.length === 0 ? (
              <EmptyState>当前词库为空。</EmptyState>
            ) : (
              words.map((word) => (
                <div
                  key={word.id}
                  className="rounded-[1.8rem] border border-stone-200 bg-white/85 p-5"
                >
                  <Field label="词条内容">
                    <TextInput
                      value={drafts[word.id] || ""}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [word.id]: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <PrimaryButton
                      type="button"
                      className="px-4 py-2 text-xs"
                      onClick={() => handleUpdate(word.id)}
                    >
                      保存修改
                    </PrimaryButton>
                    <SecondaryButton
                      type="button"
                      className="px-4 py-2 text-xs"
                      onClick={() => handleDelete(word.id)}
                    >
                      删除
                    </SecondaryButton>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </AdminLayout>
  );
}

function AssetsPage({ token, onLogout }) {
  const carouselInputRef = useRef(null);
  const [assets, setAssets] = useState(null);
  const [newCarouselLabel, setNewCarouselLabel] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [carouselUploading, setCarouselUploading] = useState(false);

  async function loadAssets() {
    try {
      const response = await api.get("/admin/assets", {
        headers: authHeaders(token),
      });
      setAssets(response.data);
    } catch (requestError) {
      if (isUnauthorized(requestError)) {
        onLogout();
        return;
      }
      setError(requestMessage(requestError, "素材加载失败"));
    }
  }

  useEffect(() => {
    loadAssets();
  }, [token]);

  async function handleCarouselUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("label", newCarouselLabel);

    setCarouselUploading(true);
    setError("");
    setSuccess("");
    try {
      await api.post("/admin/assets/carousel", formData, {
        headers: authHeaders(token),
      });
      await loadAssets();
      setNewCarouselLabel("");
      setSuccess("轮播图已添加。");
    } catch (requestError) {
      if (isUnauthorized(requestError)) {
        onLogout();
        return;
      }
      setError(requestMessage(requestError, "轮播图上传失败"));
    } finally {
      event.target.value = "";
      setCarouselUploading(false);
    }
  }

  return (
    <AdminLayout
      onLogout={onLogout}
      title="站点素材"
      description="这里只保留校园轮播图添加入口，用于向学生端首页追加新的轮播图片。"
    >
      <StatusMessage error={error} success={success} />
      {!assets ? (
        <div className="paper-panel rounded-[2.4rem] p-8 shadow-[0_20px_70px_rgba(48,34,17,0.08)]">
          正在加载素材...
        </div>
      ) : (
        <div className="space-y-6">
          <section className="paper-panel rounded-[2.4rem] p-7 shadow-[0_20px_70px_rgba(48,34,17,0.08)]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.34em] text-[#8b2f2a]">Carousel</p>
                <h3 className="mt-2 font-display text-3xl text-stone-900">校园轮播图</h3>
              </div>
              <div className="flex flex-col gap-3 md:flex-row md:items-end">
                <Field label="新轮播标题">
                  <TextInput
                    value={newCarouselLabel}
                    onChange={(event) => setNewCarouselLabel(event.target.value)}
                    placeholder="可留空，系统自动命名"
                    className="md:w-64"
                  />
                </Field>
                <input
                  ref={carouselInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleCarouselUpload}
                  className="hidden"
                />
                <SecondaryButton
                  type="button"
                  className="h-12"
                  disabled={carouselUploading}
                  onClick={() => carouselInputRef.current?.click()}
                >
                  {carouselUploading ? "正在上传" : "新增轮播图"}
                </SecondaryButton>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              {assets.carouselImages.length === 0 ? (
                <EmptyState>当前没有轮播图，直接新增即可。</EmptyState>
              ) : (
                assets.carouselImages.map((image, index) => (
                  <div
                    key={image.id}
                    className="grid gap-4 rounded-[1.8rem] border border-stone-200 bg-white/85 p-5 lg:grid-cols-[180px_1fr]"
                  >
                    <img
                      src={assetUrl(image.path)}
                      alt={image.label}
                      className="h-32 w-full rounded-[1.4rem] object-cover"
                    />
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <Badge tone="muted">顺序 {index + 1}</Badge>
                        {image.enabled === false ? <Badge tone="warning">未启用</Badge> : null}
                      </div>
                      <p className="text-sm font-semibold text-stone-900">{image.label}</p>
                      <p className="text-xs text-stone-500">{image.path}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      )}
    </AdminLayout>
  );
}

function AdminRoutes() {
  return (
    <AdminGuard>
      {({ token, setToken }) => (
        <Routes>
          <Route path="/books" element={<BooksPage token={token} onLogout={() => setToken("")} />} />
          <Route
            path="/reviews"
            element={<ReviewsPage token={token} onLogout={() => setToken("")} />}
          />
          <Route
            path="/featured"
            element={<FeaturedReviewsPage token={token} onLogout={() => setToken("")} />}
          />
          <Route
            path="/sensitive-words"
            element={<SensitiveWordsPage token={token} onLogout={() => setToken("")} />}
          />
          <Route path="/assets" element={<AssetsPage token={token} onLogout={() => setToken("")} />} />
          <Route path="*" element={<Navigate to="/books" replace />} />
        </Routes>
      )}
    </AdminGuard>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<AdminLoginPage />} />
        <Route path="/*" element={<AdminRoutes />} />
      </Routes>
    </BrowserRouter>
  );
}
