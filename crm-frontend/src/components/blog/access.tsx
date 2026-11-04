"use client";
import { useSyncExternalStore } from "react";
import { can } from "@/lib/permissions";

const subscribe = (onChange: () => void) => {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
};
const blogPermission = () => can("blog.manage");
const serverPermission = () => false;

/** Whether the signed-in user may manage the blog (`blog.manage`). */
export const useBlogAccess = () => useSyncExternalStore(subscribe, blogPermission, serverPermission);

export function BlogNoAccess() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-semibold">Blog</h1>
      <p className="mt-4">Ask an administrator to grant blog.manage permission to manage articles.</p>
    </div>
  );
}
