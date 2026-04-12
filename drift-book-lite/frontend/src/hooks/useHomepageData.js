import { useEffect, useState } from "react";
import { api } from "../lib/api.js";

export function useHomepageData() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api
      .get("/homepage")
      .then((response) => {
        if (!active) return;
        setData(response.data);
      })
      .catch((requestError) => {
        if (!active) return;
        setError(requestError.response?.data?.message || "首页榜单加载失败");
      });

    return () => {
      active = false;
    };
  }, []);

  return { data, error };
}
