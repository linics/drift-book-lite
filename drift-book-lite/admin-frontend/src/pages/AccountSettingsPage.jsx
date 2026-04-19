import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "../components/AdminLayout.jsx";
import { PrimaryButton } from "../components/Button.jsx";
import { Field } from "../components/Field.jsx";
import { TextInput } from "../components/Input.jsx";
import { StatusMessage } from "../components/StatusMessage.jsx";
import { api, authHeaders, requestMessage } from "../lib/api.js";
import { AdminSection } from "../components/AdminUI.jsx";

const initialFormState = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

export function AccountSettingsPage({ token, onLogout }) {
  const navigate = useNavigate();
  const [formState, setFormState] = useState(initialFormState);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function updateField(field, value) {
    setFormState((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (formState.newPassword.length < 8) {
      setError("新密码至少需要 8 位。");
      return;
    }
    if (formState.newPassword !== formState.confirmPassword) {
      setError("两次输入的新密码不一致。");
      return;
    }
    if (formState.currentPassword === formState.newPassword) {
      setError("新密码不能与当前密码相同。");
      return;
    }

    setLoading(true);
    try {
      await api.patch(
        "/admin/me/password",
        {
          currentPassword: formState.currentPassword,
          newPassword: formState.newPassword,
        },
        { headers: authHeaders(token) }
      );
      window.sessionStorage.setItem(
        "drift-book-admin-login-message",
        "密码已更新，请使用新密码登录。"
      );
      navigate("/login?passwordChanged=1", { replace: true });
      onLogout();
    } catch (requestError) {
      setError(requestMessage(requestError, "密码更新失败"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AdminLayout
      title="账号设置"
      onLogout={onLogout}
    >
      <AdminSection title="更新密码" className="max-w-2xl">
        <form className="space-y-5" onSubmit={handleSubmit}>
          <Field label="当前密码">
            <TextInput
              type="password"
              aria-label="当前密码"
              autoComplete="current-password"
              value={formState.currentPassword}
              onChange={(event) => updateField("currentPassword", event.target.value)}
            />
          </Field>
          <Field label="新密码" hint="至少 8 位。">
            <TextInput
              type="password"
              aria-label="新密码"
              autoComplete="new-password"
              value={formState.newPassword}
              onChange={(event) => updateField("newPassword", event.target.value)}
            />
          </Field>
          <Field label="确认新密码">
            <TextInput
              type="password"
              aria-label="确认新密码"
              autoComplete="new-password"
              value={formState.confirmPassword}
              onChange={(event) => updateField("confirmPassword", event.target.value)}
            />
          </Field>
          <StatusMessage error={error} />
          <PrimaryButton type="submit" disabled={loading} className="w-full sm:w-auto">
            {loading ? "正在更新" : "更新密码"}
          </PrimaryButton>
        </form>
      </AdminSection>
    </AdminLayout>
  );
}
