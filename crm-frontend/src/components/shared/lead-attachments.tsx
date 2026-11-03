"use client";

import { apiFetch } from "@/lib/api-fetch";

import React, { useState, useRef, type ReactNode } from "react";
import { toast } from "sonner";
import { Download, FileImage, FileText, File as FileIcon, Loader2, Trash2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

interface Document {
  id: number;
  file_name: string;
  file_url: string;
  created_at: string;
}

interface LeadAttachmentsProps {
  leadId: string | number;
  documents?: Document[];
  onRefresh: () => void;
  /** Shown instead of the list when there are no files; receives the upload button. */
  empty?: (upload: ReactNode) => ReactNode;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";
const MAX_FILES = 2;
const MAX_BYTES = 10 * 1024 * 1024;

const kind = (name: string) => {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (["png", "jpg", "jpeg", "webp", "gif", "heic"].includes(ext)) return { icon: FileImage, tone: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400" };
  if (["pdf", "doc", "docx", "txt"].includes(ext)) return { icon: FileText, tone: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" };
  return { icon: FileIcon, tone: "bg-foreground/[0.07] text-foreground/70" };
};

export function LeadAttachments({ leadId, documents = [], onRefresh, empty }: LeadAttachmentsProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const full = documents.length >= MAX_FILES;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file) return;
    if (full) return toast.error(`You can attach up to ${MAX_FILES} files.`);
    if (file.size > MAX_BYTES) return toast.error("Files must be smaller than 10 MB.");

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await apiFetch(`${API_URL}/leads/${leadId}/documents`, { method: "POST", body: formData });
      const data = await res.json();
      if (data.success) {
        toast.success("File attached.");
        onRefresh();
      } else {
        toast.error(data.message || "Failed to upload the file");
      }
    } catch {
      toast.error("Failed to upload the file");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (docId: number) => {
    if (!confirm("Remove this file from the lead?")) return;
    setDeletingId(docId);
    try {
      const res = await apiFetch(`${API_URL}/leads/${leadId}/documents/${docId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast.success("File removed.");
        onRefresh();
      } else {
        toast.error(data.message || "Failed to remove the file");
      }
    } catch {
      toast.error("Failed to remove the file");
    } finally {
      setDeletingId(null);
    }
  };

  const upload = (
    <button
      type="button"
      onClick={() => fileInputRef.current?.click()}
      disabled={isUploading || full}
      title={full ? `Up to ${MAX_FILES} files. Remove one to add another.` : undefined}
      className="inline-flex h-8 items-center gap-1.5 rounded-md bg-foreground px-3 text-[13px] font-medium text-background transition-colors hover:bg-foreground/85 disabled:opacity-50"
    >
      {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
      {isUploading ? "Uploading…" : "Upload file"}
    </button>
  );

  const input = <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} disabled={isUploading} />;

  if (!documents.length && empty) {
    return <>{empty(upload)}{input}</>;
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <p className="flex-1 text-[13px] text-muted-foreground">
          {documents.length} of {MAX_FILES} files · up to 10 MB each
        </p>
        {upload}
      </div>
      {input}
      <ul className="divide-y overflow-hidden rounded-xl border">
        {documents.map((doc) => {
          const { icon: Icon, tone } = kind(doc.file_name);
          return (
            <li key={doc.id} className="group flex items-center gap-3 bg-card px-3.5 py-3">
              <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", tone)}>
                <Icon className="h-[18px] w-[18px]" />
              </span>
              <div className="min-w-0 flex-1">
                <a href={doc.file_url} target="_blank" rel="noopener noreferrer" title={doc.file_name} className="block truncate text-[14px] font-medium text-foreground hover:underline">
                  {doc.file_name}
                </a>
                <p className="text-[12px] text-muted-foreground">
                  Added {new Date(doc.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-0.5 md:opacity-0 md:transition-opacity md:group-hover:opacity-100 md:focus-within:opacity-100">
                <a
                  href={doc.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Download ${doc.file_name}`}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Download className="h-4 w-4" />
                </a>
                <button
                  type="button"
                  aria-label={`Remove ${doc.file_name}`}
                  onClick={() => handleDelete(doc.id)}
                  disabled={deletingId === doc.id}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                >
                  {deletingId === doc.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
