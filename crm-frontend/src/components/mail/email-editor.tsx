"use client";

import { useEffect, useState, type ReactNode } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Heading2, Italic, Link2, List, ListOrdered, Quote, Underline as UnderlineIcon, Unlink } from "lucide-react";
import type { MailVariableDoc } from "@/lib/mail-templates-api";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { setVariableKeys, VariableHighlight } from "./variable-highlight";
import { VariablePicker } from "./variable-picker";

type Props = {
  value: string;
  onChange: (html: string) => void;
  variables: MailVariableDoc[];
  readOnly?: boolean;
  /** Called once with the editor, so a parent can insert text at the cursor. */
  onReady?: (editor: Editor) => void;
  minHeight?: number;
};

/**
 * Email body editor: Tiptap cut down to email-safe formatting, plus a picker that
 * inserts {{variables}}. The server cleans the HTML again before it is saved or sent.
 */
export function EmailEditor({ value, onChange, variables, readOnly = false, onReady, minHeight = 260 }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        code: false,
        codeBlock: false,
        link: { openOnClick: false, autolink: true, defaultProtocol: "https" },
      }),
      VariableHighlight,
    ],
    content: value,
    editable: !readOnly,
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    editorProps: {
      attributes: {
        class: "email-prose px-4 py-3 outline-none",
        style: `min-height:${minHeight}px`,
        "aria-label": "Email message",
        role: "textbox",
        "aria-multiline": "true",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  useEffect(() => { if (editor) onReady?.(editor); }, [editor, onReady]);

  // The field list often loads after the editor; recolour the chips when it does.
  useEffect(() => {
    if (editor) setVariableKeys(editor, { blockKeys: variables.filter((v) => v.block).map((v) => v.key), knownKeys: variables.map((v) => v.key) });
  }, [editor, variables]);

  // Load a different template into the same editor instance (e.g. switching items).
  useEffect(() => {
    if (editor && value !== editor.getHTML()) editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);

  // `false`: switching read-only must not fire onUpdate (it would mark the template as edited).
  useEffect(() => { editor?.setEditable(!readOnly, false); }, [editor, readOnly]);

  if (!editor) return <div className="rounded-xl border bg-muted/30 animate-pulse" style={{ height: minHeight + 44 }} />;

  const tool = (label: string, icon: ReactNode, action: () => void, active = false) => (
    <Button
      key={label}
      type="button"
      variant="ghost"
      size="icon"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={readOnly}
      onClick={action}
      className="h-8 w-8 rounded-md text-muted-foreground hover:text-foreground aria-pressed:bg-blue-50 aria-pressed:text-[#0052FF] dark:aria-pressed:bg-blue-950/50"
    >
      {icon}
    </Button>
  );

  const insertVariable = (token: string, doc: MailVariableDoc) => {
    const chain = editor.chain().focus();
    // Blocks become their own paragraph so they render as a full-width section.
    if (doc.block) chain.insertContent(`<p>${token}</p>`).run();
    else chain.insertContent(token).run();
  };

  return (
    <div className="rounded-xl border bg-background overflow-hidden focus-within:ring-2 focus-within:ring-[#0052FF]/20 focus-within:border-[#0052FF]/40 transition-shadow">
      <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/30 px-2 py-1.5">
        {tool("Bold", <Bold className="h-4 w-4" />, () => editor.chain().focus().toggleBold().run(), editor.isActive("bold"))}
        {tool("Italic", <Italic className="h-4 w-4" />, () => editor.chain().focus().toggleItalic().run(), editor.isActive("italic"))}
        {tool("Underline", <UnderlineIcon className="h-4 w-4" />, () => editor.chain().focus().toggleUnderline().run(), editor.isActive("underline"))}
        <span className="mx-1 h-5 w-px bg-border" />
        {tool("Heading", <Heading2 className="h-4 w-4" />, () => editor.chain().focus().toggleHeading({ level: 2 }).run(), editor.isActive("heading"))}
        {tool("Bulleted list", <List className="h-4 w-4" />, () => editor.chain().focus().toggleBulletList().run(), editor.isActive("bulletList"))}
        {tool("Numbered list", <ListOrdered className="h-4 w-4" />, () => editor.chain().focus().toggleOrderedList().run(), editor.isActive("orderedList"))}
        {tool("Quote", <Quote className="h-4 w-4" />, () => editor.chain().focus().toggleBlockquote().run(), editor.isActive("blockquote"))}
        <span className="mx-1 h-5 w-px bg-border" />
        <LinkTool editor={editor} disabled={readOnly} />
        {editor.isActive("link") && tool("Remove link", <Unlink className="h-4 w-4" />, () => editor.chain().focus().unsetLink().run())}
        <div className="ml-auto">
          <VariablePicker variables={variables} onPick={insertVariable} disabled={readOnly} />
        </div>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

function LinkTool({ editor, disabled }: { editor: Editor; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const apply = () => {
    const href = url.trim();
    if (!href) return;
    const safe = /^(https?:\/\/|mailto:|tel:)/i.test(href) ? href : `https://${href}`;
    editor.chain().focus().extendMarkRange("link").setLink({ href: safe }).run();
    setOpen(false);
  };
  return (
    <Popover open={open} onOpenChange={(next) => { setOpen(next); if (next) setUrl(editor.getAttributes("link").href ?? ""); }}>
      <PopoverTrigger
        render={
          <Button type="button" variant="ghost" size="icon" title="Link" aria-label="Link" disabled={disabled}
            aria-pressed={editor.isActive("link")}
            className="h-8 w-8 rounded-md text-muted-foreground hover:text-foreground aria-pressed:bg-blue-50 aria-pressed:text-[#0052FF] dark:aria-pressed:bg-blue-950/50" />
        }
      >
        <Link2 className="h-4 w-4" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-3">
        <form onSubmit={(e) => { e.preventDefault(); apply(); }} className="flex gap-2">
          <input
            autoFocus
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
            className="h-9 flex-1 rounded-lg border bg-background px-3 text-sm outline-none focus:border-[#0052FF]/50"
          />
          <Button type="submit" size="sm" className="h-9 rounded-lg bg-[#0052FF] text-white hover:bg-[#0040CC]">Add</Button>
        </form>
        <p className="mt-2 text-[11px] text-muted-foreground">Select text first to turn it into a link.</p>
      </PopoverContent>
    </Popover>
  );
}
