import { useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../lib/api.js";
import { requestMessage } from "../lib/api.js";
import { useAdminSession } from "../lib/auth.js";
import { Badge } from "../components/Badge.jsx";
import { Field } from "../components/Field.jsx";
import { TextInput } from "../components/Input.jsx";
import { PrimaryButton } from "../components/Button.jsx";
import { StatusMessage } from "../components/StatusMessage.jsx";

const LOGIN_MESSAGE_KEY = "drift-book-admin-login-message";

export function AdminLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { token, setToken } = useAdminSession();
  const [sessionMessage] = useState(() => {
    const message = window.sessionStorage.getItem(LOGIN_MESSAGE_KEY) || "";
    window.sessionStorage.removeItem(LOGIN_MESSAGE_KEY);
    return message;
  });
  const [formState, setFormState] = useState({
    username: "admin1",
    password: "change-this-password",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const successMessage =
    location.state?.message ||
    sessionMessage ||
    (searchParams.get("passwordChanged") === "1" ? "密码已更新，请使用新密码登录。" : "");

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
            后台用于导入书目、审核留言和维护首页内容。
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
            <StatusMessage error={error} success={!error ? successMessage : ""} />
            <PrimaryButton type="submit" disabled={loading} className="w-full">
              {loading ? "正在登录" : "进入后台"}
            </PrimaryButton>
          </form>
        </div>
      </div>
    </div>
  );
}
