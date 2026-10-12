import { useContext, useEffect, useState } from "react";
import { OriginalResourceContext } from "./resource-source";
import { assetUrl } from "@/lib/api";
/** A private image/link only obtains a blob after bearer authorization and loses it on scope change. */
export function useAssetUrl(id: string | null | undefined) {
  const source = useContext(OriginalResourceContext);
  const key = `${source?.scope ?? "legacy"}:${id ?? ""}`;
  const [result, setResult] = useState<{
    key: string;
    url: string;
    error: string;
  }>({ key: "", url: "", error: "" });
  useEffect(() => {
    if (!id || !source?.asset) return;
    const controller = new AbortController();
    let alive = true,
      url = "";
    source
      .asset(id, controller.signal)
      .then((blob) => {
        url = URL.createObjectURL(blob);
        if (alive) setResult({ key, url, error: "" });
        else URL.revokeObjectURL(url);
      })
      .catch(() => {
        if (alive)
          setResult({
            key,
            url: "",
            error: "Private preview is unavailable or access was refused.",
          });
      });
    return () => {
      alive = false;
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [id, key, source]);
  if (source && !source.asset)
    return { url: "", error: "Private preview is unavailable." };
  return !source && id
    ? { url: assetUrl(id), error: "" }
    : result.key === key
      ? result
      : { url: "", error: "" };
}
