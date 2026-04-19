import { useEffect, useRef, useState } from "react";
import { api, authHeaders, requestMessage, isUnauthorized } from "../lib/api.js";
import { Field } from "../components/Field.jsx";
import { SelectInput } from "../components/Input.jsx";
import { PrimaryButton, SecondaryButton } from "../components/Button.jsx";
import { StatusMessage } from "../components/StatusMessage.jsx";
import { AdminLayout } from "../components/AdminLayout.jsx";
import { AdminDefaultResourceSection, AdminFileBox, AdminSection } from "../components/AdminUI.jsx";

export function StudentRosterPage({ token, onLogout }) {
  const fileInputRef = useRef(null);
  const [mode, setMode] = useState("create_only");
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [defaultImporting, setDefaultImporting] = useState(false);
  const [defaultResources, setDefaultResources] = useState(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

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

  async function handleSubmit(event) {
    event.preventDefault();
    if (!file) return;

    const formData = new FormData();
    formData.append("mode", mode);
    formData.append("file", file);

    setImporting(true);
    setError("");
    setResult(null);

    try {
      const response = await api.post("/admin/student-roster/import", formData, {
        headers: authHeaders(token),
      });
      setResult(response.data);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (requestError) {
      if (isUnauthorized(requestError)) {
        onLogout();
        return;
      }
      setError(requestMessage(requestError, "导入失败"));
    } finally {
      setImporting(false);
    }
  }

  async function handleDefaultImport() {
    setDefaultImporting(true);
    setError("");
    setResult(null);

    try {
      const response = await api.post(
        "/admin/student-roster/import-default",
        {},
        { headers: authHeaders(token) }
      );
      setResult(response.data);
      await loadDefaultResources();
    } catch (requestError) {
      if (isUnauthorized(requestError)) {
        onLogout();
        return;
      }
      setError(requestMessage(requestError, "默认名册导入失败"));
    } finally {
      setDefaultImporting(false);
    }
  }

  return (
    <AdminLayout
      title="学生花名册"
      onLogout={onLogout}
    >
      <div className="max-w-3xl space-y-6">
        <AdminDefaultResourceSection
          title="默认学生名册"
          description="使用部署内置的学生名册。"
          pathLabel="默认路径"
          pathValue={defaultResources?.studentRoster?.path}
          fallbackValue="未配置"
          actionLabel="导入默认名册"
          loadingLabel="正在导入"
          loading={defaultImporting}
          onAction={handleDefaultImport}
          summary={
            defaultResources?.studentRoster
              ? `当前名册 ${defaultResources.studentRoster.studentCount} 人`
              : null
          }
        />

        <AdminSection title="导入学生数据">
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <Field label="导入模式">
              <SelectInput
                value={mode}
                onChange={(e) => setMode(e.target.value)}
              >
                <option value="create_only">仅新增（已存在的学号跳过）</option>
                <option value="upsert">新增 + 覆盖更新</option>
              </SelectInput>
            </Field>
            <Field label="选择文件">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xls,.xlsx"
                onChange={(e) => setFile(e.target.files[0] ?? null)}
                className="hidden"
              />
              <AdminFileBox
                label={file ? file.name : "尚未选择 CSV/XLS/XLSX 文件"}
                actions={
                  <SecondaryButton type="button" onClick={() => fileInputRef.current?.click()}>
                    选择文件
                  </SecondaryButton>
                }
              >
                <p className="mt-2 text-xs leading-5 text-stone-500">
                  必填列：系统号、姓名、所在班级。
                </p>
              </AdminFileBox>
            </Field>
            <PrimaryButton type="submit" disabled={!file || importing}>
              {importing ? "正在导入" : "开始导入"}
            </PrimaryButton>
          </form>

          {error ? <StatusMessage error={error} className="mt-6" /> : null}

          {result ? (
            <div className="mt-6 space-y-4">
              <StatusMessage
                success={result.failedRows === 0
                  ? `导入完成：共 ${result.totalRows} 行，全部成功。`
                  : undefined}
                error={result.failedRows > 0
                  ? `导入完成：共 ${result.totalRows} 行，成功 ${result.successRows} 行，失败 ${result.failedRows} 行。`
                  : undefined}
              />
              {result.failures.length > 0 ? (
                <div className="overflow-hidden rounded-[1.6rem] border border-stone-200 bg-white/70">
                  <table className="w-full text-sm">
                    <thead className="bg-surface text-left text-xs text-stone-500">
                      <tr>
                        <th className="px-4 py-3">行号</th>
                        <th className="px-4 py-3">系统号</th>
                        <th className="px-4 py-3">原因</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {result.failures.slice(0, 100).map((f) => (
                        <tr key={`${f.rowNumber}-${f.systemId}`} className="text-stone-700">
                          <td className="px-4 py-2">{f.rowNumber}</td>
                          <td className="px-4 py-2 font-mono">{f.systemId || "—"}</td>
                          <td className="px-4 py-2">{f.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {result.failures.length > 100 ? (
                    <p className="px-4 py-2 text-xs text-stone-400">
                      仅显示前 100 条失败记录，共 {result.failures.length} 条。
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </AdminSection>
      </div>
    </AdminLayout>
  );
}
