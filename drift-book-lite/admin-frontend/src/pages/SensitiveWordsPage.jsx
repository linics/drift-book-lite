import { useEffect, useState } from "react";
import { api, authHeaders, requestMessage, isUnauthorized } from "../lib/api.js";
import { buildPaginationState, DEFAULT_PAGE_SIZE } from "../lib/helpers.js";
import { Field } from "../components/Field.jsx";
import { TextInput } from "../components/Input.jsx";
import { PrimaryButton, SecondaryButton } from "../components/Button.jsx";
import { StatusMessage } from "../components/StatusMessage.jsx";
import { EmptyState } from "../components/EmptyState.jsx";
import { AdminLayout } from "../components/AdminLayout.jsx";

export function SensitiveWordsPage({ token, onLogout }) {
  const [words, setWords] = useState([]);
  const [pagination, setPagination] = useState(
    buildPaginationState({ page: 1, pageSize: DEFAULT_PAGE_SIZE, total: 0, totalPages: 1 })
  );
  const [query, setQuery] = useState("");
  const [newWord, setNewWord] = useState("");
  const [drafts, setDrafts] = useState({});
  const [importSummary, setImportSummary] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [defaultImporting, setDefaultImporting] = useState(false);

  async function loadWords({ keyword = query, page = pagination.page } = {}) {
    try {
      const response = await api.get("/admin/sensitive-words", {
        headers: authHeaders(token),
        params: {
          ...(keyword ? { q: keyword } : {}),
          page,
          pageSize: pagination.pageSize,
        },
      });
      const rawWords = Array.isArray(response.data?.words) ? response.data.words : [];
      const hasPagination = response.data?.pagination && typeof response.data.pagination === "object";
      const nextWords = hasPagination
        ? rawWords
        : rawWords.slice((page - 1) * pagination.pageSize, page * pagination.pageSize);
      const fallbackTotal = rawWords.length;
      setWords(nextWords);
      setPagination(
        buildPaginationState({
          page,
          pageSize: pagination.pageSize,
          total: fallbackTotal,
          totalPages: response.data?.pagination?.totalPages,
          ...response.data?.pagination,
        })
      );
      setDrafts(
        Object.fromEntries(nextWords.map((word) => [word.id, word.word]))
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
    loadWords({ keyword: "", page: 1 });
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
      await loadWords({ keyword: query, page: 1 });
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
      await loadWords({ keyword: query, page: pagination.page });
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
      await loadWords({
        keyword: query,
        page: Math.min(pagination.page, Math.max(1, pagination.totalPages - 1)),
      });
    } catch (requestError) {
      if (isUnauthorized(requestError)) {
        onLogout();
        return;
      }
      setError(requestMessage(requestError, "敏感词删除失败"));
    }
  }

  async function handleImportDefaults() {
    setError("");
    setSuccess("");
    setDefaultImporting(true);
    try {
      const response = await api.post(
        "/admin/sensitive-words/import-defaults",
        {},
        { headers: authHeaders(token) }
      );
      setImportSummary(response.data);
      setSuccess(
        `内置词库导入完成：新增 ${response.data.importedWords} 条，跳过 ${response.data.skippedWords} 条。`
      );
      await loadWords({ keyword: query, page: 1 });
    } catch (requestError) {
      if (isUnauthorized(requestError)) {
        onLogout();
        return;
      }
      setError(requestMessage(requestError, "内置敏感词导入失败"));
    } finally {
      setDefaultImporting(false);
    }
  }

  return (
    <AdminLayout
      onLogout={onLogout}
      title="敏感词库"
      description="维护审核辅助词库。"
    >
      <StatusMessage error={error} success={success} />
      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="space-y-6">
          <section className="paper-panel rounded-[2.4rem] p-7 shadow-[0_20px_70px_rgba(48,34,17,0.08)]">
            <h3 className="font-display text-3xl text-stone-900">导入内置词库</h3>
            <p className="mt-3 text-sm leading-7 text-stone-600">
              内置 7 类默认词库，导入时会自动去重并跳过已有词条。
            </p>
            <div className="mt-5 rounded-[1.8rem] border border-stone-200 bg-white/85 p-5">
              <p className="text-xs uppercase tracking-[0.28em] text-stone-500">默认词库目录</p>
              <p className="mt-3 break-all rounded-2xl bg-surface px-4 py-3 font-mono text-xs text-stone-700">
                {importSummary?.defaultSensitiveWordsDir || "使用后端当前默认目录"}
              </p>
              <p className="mt-3 text-sm leading-6 text-stone-500">
                词库文件随项目部署。
              </p>
              <p className="mt-3 text-xs leading-6 text-stone-500">
                默认词库不含政治类、GFW 补充、腾讯/网易大杂包等高误判类别。
              </p>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <PrimaryButton
                type="button"
                disabled={defaultImporting}
                onClick={handleImportDefaults}
              >
                {defaultImporting ? "正在导入" : "导入内置词库"}
              </PrimaryButton>
              {importSummary ? (
                <span className="text-xs text-stone-500">
                  共 {importSummary.totalWords} 条，新增 {importSummary.importedWords} 条，跳过{" "}
                  {importSummary.skippedWords} 条
                </span>
              ) : null}
            </div>
          </section>
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
        </div>
        <section className="paper-panel rounded-[2.4rem] p-7 shadow-[0_20px_70px_rgba(48,34,17,0.08)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h3 className="font-display text-3xl text-stone-900">现有词库</h3>
              <p className="mt-2 text-sm text-stone-500">
                当前显示第 {pagination.page} / {pagination.totalPages} 页，共 {pagination.total} 条
              </p>
            </div>
            <div className="flex flex-col gap-3 md:flex-row md:items-end">
              <Field label="搜索词条">
                <TextInput
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      loadWords({ keyword: event.currentTarget.value, page: 1 });
                    }
                  }}
                  placeholder="输入敏感词后回车"
                  className="md:w-64"
                />
              </Field>
              <SecondaryButton
                type="button"
                className="h-12"
                onClick={() => loadWords({ keyword: query, page: 1 })}
              >
                搜索
              </SecondaryButton>
              <SecondaryButton
                type="button"
                className="h-12"
                onClick={() => {
                  setQuery("");
                  loadWords({ keyword: "", page: 1 });
                }}
              >
                重置
              </SecondaryButton>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-[1.4rem] border border-stone-200 bg-white/65 px-4 py-3 text-sm text-stone-600">
            <span>分页加载可避免词库扩大后一次性读取全部词条。</span>
            <div className="flex gap-2">
              <SecondaryButton
                type="button"
                className="px-4 py-2 text-xs"
                disabled={pagination.page <= 1}
                onClick={() =>
                  loadWords({ keyword: query, page: Math.max(1, pagination.page - 1) })
                }
              >
                上一页
              </SecondaryButton>
              <SecondaryButton
                type="button"
                className="px-4 py-2 text-xs"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() =>
                  loadWords({
                    keyword: query,
                    page: Math.min(pagination.totalPages, pagination.page + 1),
                  })
                }
              >
                下一页
              </SecondaryButton>
            </div>
          </div>
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
