import { useRef, useState } from "react";
import { api, authHeaders, requestMessage, isUnauthorized } from "../lib/api.js";
import { Field } from "../components/Field.jsx";
import { SelectInput } from "../components/Input.jsx";
import { PrimaryButton } from "../components/Button.jsx";
import { StatusMessage } from "../components/StatusMessage.jsx";
import { AdminLayout } from "../components/AdminLayout.jsx";

export function StudentRosterPage({ token, onLogout }) {
  const fileInputRef = useRef(null);
  const [mode, setMode] = useState("create_only");
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

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

  return (
    <AdminLayout
      title="学生花名册"
      description="通过 CSV 或 Excel 文件导入学生数据，供学生提交留言时身份校验使用。"
      onLogout={onLogout}
    >
      <div className="paper-panel rounded-[2.4rem] p-7 shadow-[0_20px_70px_rgba(48,34,17,0.08)]">
        <h3 className="font-display text-3xl text-stone-900">导入学生数据</h3>
        <p className="mt-2 text-sm text-stone-500">
          支持 .csv、.xls、.xlsx 格式。必填列：系统号、姓名、所在班级。
        </p>
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
              className="block w-full text-sm text-stone-700 file:mr-3 file:rounded-full file:border-0 file:bg-stone-100 file:px-4 file:py-2 file:text-sm file:font-medium file:text-stone-700 hover:file:bg-stone-200"
            />
          </Field>
          <div className="pt-1">
            <PrimaryButton type="submit" disabled={!file || importing}>
              {importing ? "导入中…" : "开始导入"}
            </PrimaryButton>
          </div>
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
              <div className="overflow-hidden rounded-2xl border border-stone-200">
                <table className="w-full text-sm">
                  <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
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
      </div>
    </AdminLayout>
  );
}
