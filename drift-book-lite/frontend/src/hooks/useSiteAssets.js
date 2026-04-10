import { useEffect, useState } from "react";
import { api } from "../lib/api.js";

export function useSiteAssets() {
  const [assets, setAssets] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api
      .get("/site-assets")
      .then((response) => {
        if (!active) return;
        setAssets(response.data);
      })
      .catch((requestError) => {
        if (!active) return;
        setError(requestError.response?.data?.message || "站点素材加载失败");
      });

    return () => {
      active = false;
    };
  }, []);

  return { assets, error };
}
