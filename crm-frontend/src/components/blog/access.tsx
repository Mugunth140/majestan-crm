"use client";
import { useSyncExternalStore } from "react";
import { canOpen, readUser } from "@/components/layout/nav-items";

const subscribe = (onChange: () => void) => {
  window.addEventListener("storage", onChange);
  window.addEventListener("crm-user-updated", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener("crm-user-updated", onChange);
  };
};
const blogModule = () => canOpen("/blog", readUser());
const serverPermission = () => false;

/** Whether the signed-in user has the Blog module on their sidebar. */
export const useBlogAccess = () => useSyncExternalStore(subscribe, blogModule, serverPermission);

export function BlogNoAccess() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-semibold">Blog</h1>
      <p className="mt-4">Ask an administrator to turn on the Blog module on your Access tab.</p>
    </div>
  );
}
