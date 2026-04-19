import { useEffect, useState } from "react";
import { api, authHeaders, requestMessage, isUnauthorized } from "../lib/api.js";
import { StatusMessage } from "../components/StatusMessage.jsx";
import { AdminLayout } from "../components/AdminLayout.jsx";
import { AdminDefaultResourceSection } from "../components/AdminUI.jsx";

export function SensitiveWordsPage({ token, onLogout }) {
  const [importSummary, setImportSummary] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [defaultImporting, setDefaultImporting] = useState(false);
  const [defaultResources, setDefaultResources] = useState(null);

  async function loadDefaultResources() {
    try {
      const response = await api.get("/admin/default-resources", {
        headers: authHeaders(token),
      });
      setDefaultResources(response.data.resources);
    } catch (requestError) {
      if (isUnauthorized(requestError)) {
        onLogout();
        return;
      }
      setError(requestMessage(requestError, "默认资源加载失败"));
    }
  }

  useEffect(() => {
    loadDefaultResources();
  }, [token]);

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
      await loadDefaultResources();
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
    <AdminLayout onLogout={onLogout} title="敏感词库">
      <StatusMessage error={error} success={success} />
      <AdminDefaultResourceSection
        title="导入内置词库"
        description="使用部署内置的敏感词文本目录。"
        pathLabel="默认词库目录"
        pathValue={defaultResources?.sensitiveWords?.path || importSummary?.defaultSensitiveWordsDir}
        actionLabel="导入内置词库"
        loadingLabel="正在导入"
        loading={defaultImporting}
        onAction={handleImportDefaults}
        summary={
          importSummary
            ? `共 ${importSummary.totalWords} 条，新增 ${importSummary.importedWords} 条，跳过 ${importSummary.skippedWords} 条`
            : null
        }
      />
    </AdminLayout>
  );
}
