import { useEffect, useRef, useState } from "react";
import { api, authHeaders, requestMessage, isUnauthorized, assetUrl } from "../lib/api.js";
import { Badge } from "../components/Badge.jsx";
import { Field } from "../components/Field.jsx";
import { TextInput } from "../components/Input.jsx";
import { SecondaryButton } from "../components/Button.jsx";
import { StatusMessage } from "../components/StatusMessage.jsx";
import { EmptyState } from "../components/EmptyState.jsx";
import { AdminLayout } from "../components/AdminLayout.jsx";
import {
  AdminDefaultResourceSection,
  AdminList,
  AdminListItem,
  AdminMeta,
  AdminSection,
  AdminToolbar,
} from "../components/AdminUI.jsx";

export function AssetsPage({ token, onLogout }) {
  const carouselInputRef = useRef(null);
  const [assets, setAssets] = useState(null);
  const [defaultResources, setDefaultResources] = useState(null);
  const [newCarouselLabel, setNewCarouselLabel] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [carouselUploading, setCarouselUploading] = useState(false);
  const [defaultAssetReloading, setDefaultAssetReloading] = useState(false);
  const [deletingCarouselId, setDeletingCarouselId] = useState("");

  async function loadAssets() {
    try {
      const assetsResponse = await api.get("/admin/assets", {
        headers: authHeaders(token),
      });
      setAssets(assetsResponse.data);
    } catch (requestError) {
      if (isUnauthorized(requestError)) {
        onLogout();
        return;
      }
      setError(requestMessage(requestError, "素材加载失败"));
      return;
    }

    try {
      const defaultResourcesResponse = await api.get("/admin/default-resources", {
        headers: authHeaders(token),
      });
      setDefaultResources(defaultResourcesResponse.data.resources);
    } catch (requestError) {
      if (isUnauthorized(requestError)) {
        onLogout();
      }
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

  async function handleDeleteCarousel(image) {
    const confirmed = window.confirm(`确认删除轮播图“${image.label}”吗？`);
    if (!confirmed) return;

    setDeletingCarouselId(image.id);
    setError("");
    setSuccess("");

    try {
      const response = await api.delete(`/admin/assets/carousel/${image.id}`, {
        headers: authHeaders(token),
      });
      setAssets(response.data);
      setSuccess("轮播图已删除。");
    } catch (requestError) {
      if (isUnauthorized(requestError)) {
        onLogout();
        return;
      }
      setError(requestMessage(requestError, "轮播图删除失败"));
    } finally {
      setDeletingCarouselId("");
    }
  }

  return (
    <AdminLayout onLogout={onLogout} title="站点素材">
      <StatusMessage error={error} success={success} />
      {!assets ? (
        <div className="paper-panel rounded-[2.4rem] p-7 shadow-[0_20px_70px_rgba(48,34,17,0.08)]">
          正在加载素材...
        </div>
      ) : (
        <div className="space-y-6">
          <AdminDefaultResourceSection
            title="默认首页图片"
            description="使用部署内置的首页 Logo 和轮播图。"
            pathLabel="当前默认目录"
            pathValue={defaultResources?.siteAssets?.path || assets.defaultSiteAssetsDir}
            fallbackValue="未配置"
            actionLabel="重新载入默认素材"
            loadingLabel="正在重载"
            loading={defaultAssetReloading}
            onAction={handleReloadDefaultAssets}
          >
            <p className="mt-2 text-xs leading-5 text-stone-500">
              识别规则：`logo.*` 作为学校 Logo，`carousel-01.*`、`carousel-02.*` 等按顺序作为首页轮播图。
            </p>
          </AdminDefaultResourceSection>

          <AdminSection title="校园轮播图">
            <AdminToolbar>
              <span className="hidden sm:block" />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <Field label="新轮播标题">
                  <TextInput
                    value={newCarouselLabel}
                    onChange={(event) => setNewCarouselLabel(event.target.value)}
                    className="sm:w-64"
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
                  className="shrink-0"
                  disabled={carouselUploading}
                  onClick={() => carouselInputRef.current?.click()}
                >
                  {carouselUploading ? "正在上传" : "新增轮播图"}
                </SecondaryButton>
              </div>
            </AdminToolbar>

            <div className="mt-6 space-y-4">
              {assets.carouselImages.length === 0 ? (
                <EmptyState>尚无轮播图，上传后即可显示。</EmptyState>
              ) : (
                <AdminList>
                  {assets.carouselImages.map((image, index) => (
                    <AdminListItem
                      key={image.id}
                      className="grid gap-4 lg:grid-cols-[160px_1fr]"
                    >
                      <img
                        src={assetUrl(image.path)}
                        alt={image.label}
                        className="h-28 w-full rounded-[1.4rem] object-cover"
                      />
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone="muted">顺序 {index + 1}</Badge>
                          {image.enabled === false ? <Badge tone="warning">未启用</Badge> : null}
                        </div>
                        <p className="text-sm font-semibold text-stone-900">{image.label}</p>
                        <AdminMeta>
                          <span>{image.path}</span>
                        </AdminMeta>
                        <SecondaryButton
                          type="button"
                          className="px-3 py-1.5 text-xs text-red-700"
                          disabled={deletingCarouselId === image.id}
                          onClick={() => handleDeleteCarousel(image)}
                        >
                          {deletingCarouselId === image.id ? "正在删除" : "删除轮播图"}
                        </SecondaryButton>
                      </div>
                    </AdminListItem>
                  ))}
                </AdminList>
              )}
            </div>
          </AdminSection>
        </div>
      )}
    </AdminLayout>
  );
}
