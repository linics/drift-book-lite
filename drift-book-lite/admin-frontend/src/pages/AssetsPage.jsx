import { useEffect, useRef, useState } from "react";
import { api, authHeaders, requestMessage, isUnauthorized, assetUrl } from "../lib/api.js";
import { Badge } from "../components/Badge.jsx";
import { Field } from "../components/Field.jsx";
import { TextInput } from "../components/Input.jsx";
import { PrimaryButton, SecondaryButton } from "../components/Button.jsx";
import { StatusMessage } from "../components/StatusMessage.jsx";
import { EmptyState } from "../components/EmptyState.jsx";
import { AdminLayout } from "../components/AdminLayout.jsx";

export function AssetsPage({ token, onLogout }) {
  const carouselInputRef = useRef(null);
  const [assets, setAssets] = useState(null);
  const [newCarouselLabel, setNewCarouselLabel] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [carouselUploading, setCarouselUploading] = useState(false);
  const [defaultAssetReloading, setDefaultAssetReloading] = useState(false);

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

  async function handleReloadDefaultAssets() {
    setDefaultAssetReloading(true);
    setError("");
    setSuccess("");

    try {
      const response = await api.post(
        "/admin/assets/reload-default-assets",
        {},
        {
          headers: authHeaders(token),
        }
      );
      setAssets(response.data);
      setSuccess("默认首页图片已重新载入，当前 Logo 与轮播图已更新。");
    } catch (requestError) {
      if (isUnauthorized(requestError)) {
        onLogout();
        return;
      }
      setError(requestMessage(requestError, "默认素材重载失败"));
    } finally {
      setDefaultAssetReloading(false);
    }
  }

  return (
    <AdminLayout
      onLogout={onLogout}
      title="站点素材"
      description="管理首页 Logo 和轮播图。"
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
              <div className="max-w-3xl">
                <p className="text-xs uppercase tracking-[0.34em] text-primary">Default Assets</p>
                <h3 className="mt-2 font-display text-3xl text-stone-900">默认首页图片</h3>
                <p className="mt-3 text-sm leading-7 text-stone-600">
                  重新载入默认目录中的首页图片。
                </p>
              </div>
              <PrimaryButton
                type="button"
                className="min-w-44"
                disabled={defaultAssetReloading}
                onClick={handleReloadDefaultAssets}
              >
                {defaultAssetReloading ? "正在重载" : "重新载入默认素材"}
              </PrimaryButton>
            </div>
            <div className="mt-6 rounded-[1.8rem] border border-stone-200 bg-white/85 p-5">
              <p className="text-xs uppercase tracking-[0.28em] text-stone-500">当前默认目录</p>
              <p className="mt-3 break-all rounded-2xl bg-surface px-4 py-3 font-mono text-xs text-stone-700">
                {assets.defaultSiteAssetsDir || "未配置"}
              </p>
              <p className="mt-3 text-sm leading-6 text-stone-500">
                识别规则：`logo.*` 作为学校 Logo，`carousel-01.*`、`carousel-02.*` 等按顺序作为首页轮播图。
              </p>
            </div>
          </section>

          <section className="paper-panel rounded-[2.4rem] p-7 shadow-[0_20px_70px_rgba(48,34,17,0.08)]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.34em] text-primary">Carousel</p>
                <h3 className="mt-2 font-display text-3xl text-stone-900">校园轮播图</h3>
                <p className="mt-3 text-sm leading-7 text-stone-600">
                  这里追加的是当前生效中的轮播图。
                </p>
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
                <EmptyState>尚无轮播图，上传后即可显示。</EmptyState>
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
