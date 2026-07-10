"use client";

import React, { useState, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Paperclip, Download, Trash2, File, Loader2, UploadCloud } from "lucide-react";

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
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export function LeadAttachments({ leadId, documents = [], onRefresh }: LeadAttachmentsProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const maxFiles = 2;
  const maxSizeBytes = 10 * 1024 * 1024; // 10MB

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (documents.length >= maxFiles) {
      toast.error(`You can only attach up to ${maxFiles} documents.`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (file.size > maxSizeBytes) {
      toast.error("File size must be less than 10MB.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${API_URL}/leads/${leadId}/documents`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Document uploaded successfully.");
        onRefresh();
      } else {
        toast.error(data.message || "Failed to upload document");
      }
    } catch (err) {
      toast.error("An error occurred while uploading.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (docId: number) => {
    if (!confirm("Are you sure you want to delete this document?")) return;
    setDeletingId(docId);
    try {
      const res = await fetch(`${API_URL}/leads/${leadId}/documents/${docId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Document deleted.");
        onRefresh();
      } else {
        toast.error(data.message || "Failed to delete document");
      }
    } catch (err) {
      toast.error("An error occurred while deleting.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="bg-card border rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between border-b pb-3 mb-5">
        <h3 className="text-base font-bold text-foreground flex items-center gap-2">
          <Paperclip className="h-4 w-4 text-muted-foreground" /> Documents & Attachments
        </h3>
        <span className="text-xs font-semibold text-muted-foreground bg-muted/40 px-2 py-1 rounded-md">
          {documents.length} / {maxFiles} Files
        </span>
      </div>

      <div className="space-y-4">
        {/* Upload Area */}
        {documents.length < maxFiles && (
          <div 
            onClick={() => !isUploading && fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-3 transition-colors ${isUploading ? 'bg-muted/50 border-muted opacity-70 cursor-not-allowed' : 'bg-muted/20 border-border hover:bg-muted/40 hover:border-[#0052FF]/50 cursor-pointer'}`}
          >
            {isUploading ? (
              <Loader2 className="h-8 w-8 text-[#0052FF] animate-spin" />
            ) : (
              <UploadCloud className="h-8 w-8 text-muted-foreground" />
            )}
            <div className="text-center">
              <p className="text-sm font-semibold text-foreground">
                {isUploading ? "Uploading..." : "Click to upload document"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Max file size: 10MB
              </p>
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              onChange={handleFileChange}
              disabled={isUploading}
            />
          </div>
        )}

        {documents.length >= maxFiles && (
          <div className="text-sm text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400 p-3 rounded-xl border border-amber-200 dark:border-amber-900/50 flex items-center gap-2 font-medium">
            Maximum of {maxFiles} documents reached. Please delete an existing document to upload a new one.
          </div>
        )}

        {/* Document List */}
        {documents.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
            {documents.map(doc => (
              <div key={doc.id} className="flex items-center gap-3 p-3 border rounded-xl bg-background shadow-sm group">
                <div className="h-10 w-10 shrink-0 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-center text-[#0052FF] dark:text-blue-400">
                  <File className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate" title={doc.file_name}>
                    {doc.file_name}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {new Date(doc.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-[#0052FF] hover:bg-blue-50 dark:hover:bg-blue-900/20">
                      <Download className="h-4 w-4" />
                    </Button>
                  </a>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                    onClick={() => handleDelete(doc.id)}
                    disabled={deletingId === doc.id}
                  >
                    {deletingId === doc.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
