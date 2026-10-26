"use client";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { blogApi } from "@/lib/blog-api";
export function BlogImageUpload({
  onUploaded,
}: {
  onUploaded: (url: string) => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="grid gap-2 text-sm">
      <label className="grid gap-2">
        Upload an image
        <Input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={busy}
          className="h-12 rounded-xl bg-muted/30 px-4 py-3"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            e.target.value = "";
            setError("");
            if (
              file.size > 5 * 1024 * 1024 ||
              !["image/jpeg", "image/png", "image/webp"].includes(file.type)
            ) {
              setError("Choose a JPEG, PNG or WebP image up to 5 MB.");
              return;
            }
            setBusy(true);
            try {
              onUploaded((await blogApi.upload(file)).url);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        />
      </label>
      {busy && <p role="status">Uploading image…</p>}
      {error && (
        <p role="alert" className="text-red-600">
          {error}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        JPEG, PNG or WebP · Maximum 5 MB
      </p>
    </div>
  );
}
