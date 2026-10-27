"use client";
import { useState, type ReactNode } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { TableKit } from "@tiptap/extension-table";
import TextAlign from "@tiptap/extension-text-align";
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  RemoveFormatting,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  TextQuote,
  SquareCode,
  Link2,
  Unlink,
  ImagePlus,
  Table2,
  Minus,
  Undo2,
  Redo2,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { BlogImageUpload } from "./image-upload";
export function RichEditor({
  content,
  onChange,
  readOnly = false,
}: {
  content: string;
  onChange: (html: string) => void;
  readOnly?: boolean;
}) {
  const [insert, setInsert] = useState<"link" | "image" | null>(null),
    [url, setUrl] = useState(""),
    [alt, setAlt] = useState(""),
    [error, setError] = useState("");
  const [linkText, setLinkText] = useState("");
  const [originalLinkText, setOriginalLinkText] = useState("");
  const [newTab, setNewTab] = useState(true);
  const [editingLink, setEditingLink] = useState(false);
  const [linkSelection, setLinkSelection] = useState({ from: 1, to: 1 });
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        link: { openOnClick: false, defaultProtocol: "https" },
      }),
      Image,
      TableKit.configure({ table: { resizable: true } }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content,
    editable: !readOnly,
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    editorProps: {
      attributes: {
        class: "blog-prose p-4 md:p-6 outline-none",
        "aria-label": "Article body",
        role: "textbox",
        "aria-multiline": "true",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });
  if (!editor)
    return <div className="h-96 rounded-xl bg-muted animate-pulse" />;
  const tool = (
    label: string,
    icon: ReactNode,
    action: () => void,
    active = false,
    disabled = false,
  ) => (
    <Button
      key={label}
      type="button"
      variant="ghost"
      size="icon"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={action}
      className="editor-icon h-8 w-8 rounded-md text-muted-foreground hover:text-foreground aria-pressed:bg-blue-50 aria-pressed:text-[#0052FF] dark:aria-pressed:bg-blue-950/50"
    >
      {icon}
    </Button>
  );
  const separator = (
    <span className="mx-1 h-5 w-px bg-border shrink-0" aria-hidden="true" />
  );
  const open = (kind: "link" | "image") => {
    if (kind === "link") {
      const active = editor.isActive("link");
      if (active) editor.chain().focus().extendMarkRange("link").run();
      const { from, to } = editor.state.selection;
      setLinkSelection({ from, to });
      const text = editor.state.doc.textBetween(from, to, " ");
      setLinkText(text);
      setOriginalLinkText(text);
      setEditingLink(active);
      setNewTab(
        active ? editor.getAttributes("link").target === "_blank" : true,
      );
    }
    setInsert(kind);
    setUrl(kind === "link" ? editor.getAttributes("link").href || "" : "");
    setAlt("");
    setError("");
  };
  const apply = () => {
    const destination = url.trim();
    let valid = false;
    try {
      valid = (
        insert === "image"
          ? ["http:", "https:"]
          : ["http:", "https:", "mailto:", "tel:"]
      ).includes(new URL(destination).protocol);
    } catch {}
    if (!valid || (insert === "image" && !alt.trim())) {
      setError(
        insert === "image"
          ? "Enter a valid image URL and descriptive alt text."
          : "Enter a valid https://, http://, mailto: or tel: URL.",
      );
      return;
    }
    if (insert === "image") {
      editor
        .chain()
        .focus()
        .setImage({ src: destination, alt: alt.trim() })
        .run();
    } else {
      const attributes = {
        href: destination,
        target: newTab ? "_blank" : null,
        rel: "noopener noreferrer",
      };
      const chain = editor.chain().focus().setTextSelection(linkSelection);
      if (
        linkText !== originalLinkText ||
        linkSelection.from === linkSelection.to
      ) {
        chain
          .insertContent({
            type: "text",
            text: linkText.trim() || destination,
            marks: [{ type: "link", attrs: attributes }],
          })
          .run();
      } else {
        chain.setLink(attributes).run();
      }
    }
    setInsert(null);
  };
  const heading = editor.isActive("heading")
    ? `Heading ${editor.getAttributes("heading").level}`
    : "Normal text";
  return (
    <div
      className="blog-editor rounded-xl border bg-background overflow-hidden focus-within:border-ring"
      onKeyDown={(event) => {
        if (
          !readOnly &&
          (event.ctrlKey || event.metaKey) &&
          event.key.toLowerCase() === "k"
        ) {
          event.preventDefault();
          open("link");
        }
      }}
    >
      {!readOnly && (
        <div
          role="toolbar"
          aria-label="Text formatting"
          className="flex flex-wrap items-center gap-y-1 px-3 py-2 bg-muted/30 border-b"
        >
          <div className="flex items-center" role="group" aria-label="History">
            {tool(
              "Undo",
              <Undo2 size={16} />,
              () => editor.chain().focus().undo().run(),
              false,
              !editor.can().undo(),
            )}
            {tool(
              "Redo",
              <Redo2 size={16} />,
              () => editor.chain().focus().redo().run(),
              false,
              !editor.can().redo(),
            )}
          </div>
          {separator}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  className="h-8 px-2 text-xs font-medium gap-2"
                  aria-label="Text style"
                />
              }
            >
              {heading}
              <ChevronDown size={14} />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem
                onClick={() => editor.chain().focus().setParagraph().run()}
              >
                Normal text
              </DropdownMenuItem>
              {([2, 3, 4] as const).map((level) => (
                <DropdownMenuItem
                  key={level}
                  onClick={() =>
                    editor.chain().focus().toggleHeading({ level }).run()
                  }
                >
                  Heading {level}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {separator}
          <div
            className="flex items-center"
            role="group"
            aria-label="Inline formatting"
          >
            {tool(
              "Bold",
              <Bold size={16} />,
              () => editor.chain().focus().toggleBold().run(),
              editor.isActive("bold"),
            )}
            {tool(
              "Italic",
              <Italic size={16} />,
              () => editor.chain().focus().toggleItalic().run(),
              editor.isActive("italic"),
            )}
            {tool(
              "Underline",
              <Underline size={16} />,
              () => editor.chain().focus().toggleUnderline().run(),
              editor.isActive("underline"),
            )}
            {tool(
              "Strikethrough",
              <Strikethrough size={16} />,
              () => editor.chain().focus().toggleStrike().run(),
              editor.isActive("strike"),
            )}
            {tool("Clear formatting", <RemoveFormatting size={16} />, () =>
              editor.chain().focus().unsetAllMarks().clearNodes().run(),
            )}
          </div>
          {separator}
          <div
            className="flex items-center"
            role="group"
            aria-label="Lists and blocks"
          >
            {tool(
              "Bullet list",
              <List size={16} />,
              () => editor.chain().focus().toggleBulletList().run(),
              editor.isActive("bulletList"),
            )}
            {tool(
              "Numbered list",
              <ListOrdered size={16} />,
              () => editor.chain().focus().toggleOrderedList().run(),
              editor.isActive("orderedList"),
            )}
            {tool(
              "Blockquote",
              <TextQuote size={16} />,
              () => editor.chain().focus().toggleBlockquote().run(),
              editor.isActive("blockquote"),
            )}
            {tool(
              "Code block",
              <SquareCode size={16} />,
              () => editor.chain().focus().toggleCodeBlock().run(),
              editor.isActive("codeBlock"),
            )}
          </div>
          {separator}
          <div
            className="flex items-center"
            role="group"
            aria-label="Alignment"
          >
            {tool(
              "Align left",
              <AlignLeft size={16} />,
              () => editor.chain().focus().setTextAlign("left").run(),
              editor.isActive({ textAlign: "left" }),
            )}
            {tool(
              "Align center",
              <AlignCenter size={16} />,
              () => editor.chain().focus().setTextAlign("center").run(),
              editor.isActive({ textAlign: "center" }),
            )}
            {tool(
              "Align right",
              <AlignRight size={16} />,
              () => editor.chain().focus().setTextAlign("right").run(),
              editor.isActive({ textAlign: "right" }),
            )}
            {tool(
              "Justify text",
              <AlignJustify size={16} />,
              () => editor.chain().focus().setTextAlign("justify").run(),
              editor.isActive({ textAlign: "justify" }),
            )}
          </div>
          {separator}
          <div
            className="flex items-center"
            role="group"
            aria-label="Insert content"
          >
            {tool(
              editor.isActive("link") ? "Edit link" : "Insert link",
              <Link2 size={16} />,
              () => open("link"),
              editor.isActive("link"),
            )}
            {editor.isActive("link") &&
              tool("Remove link", <Unlink size={16} />, () =>
                editor.chain().focus().unsetLink().run(),
              )}
            {tool("Insert image", <ImagePlus size={16} />, () => open("image"))}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    title="Table"
                    aria-label="Table"
                    className="h-8 w-8 text-muted-foreground"
                  />
                }
              >
                <Table2 size={16} />
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem
                  onClick={() =>
                    editor
                      .chain()
                      .focus()
                      .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                      .run()
                  }
                >
                  Insert table
                </DropdownMenuItem>
                {editor.isActive("table") && (
                  <>
                    <DropdownMenuItem
                      onClick={() => editor.chain().focus().addRowAfter().run()}
                    >
                      Add row
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() =>
                        editor.chain().focus().addColumnAfter().run()
                      }
                    >
                      Add column
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => editor.chain().focus().mergeCells().run()}
                    >
                      Merge cells
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => editor.chain().focus().splitCell().run()}
                    >
                      Split cell
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => editor.chain().focus().deleteRow().run()}
                    >
                      Delete row
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() =>
                        editor.chain().focus().deleteColumn().run()
                      }
                    >
                      Delete column
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => editor.chain().focus().deleteTable().run()}
                    >
                      Delete table
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            {tool("Insert divider", <Minus size={16} />, () =>
              editor.chain().focus().setHorizontalRule().run(),
            )}
          </div>
        </div>
      )}
      <EditorContent className="blog-editor-scroll" editor={editor} />
      {!readOnly && (
        <div className="px-4 py-2 border-t bg-muted/10 text-xs text-muted-foreground flex justify-between gap-4">
          <span>
            {editor.getText().trim().split(/\s+/).filter(Boolean).length} words
          </span>
          <span>Ctrl B · Bold &nbsp; Ctrl K · Link &nbsp; Ctrl Z · Undo</span>
        </div>
      )}
      <Dialog
        open={!!insert}
        onOpenChange={(value) => {
          if (!value) setInsert(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogTitle>
            {insert === "image"
              ? "Insert image"
              : editingLink
                ? "Edit link"
                : "Insert link"}
          </DialogTitle>
          <DialogDescription>
            {insert === "image"
              ? "Upload an image or paste its URL, then add a description."
              : "Add a URL to the selected text."}
          </DialogDescription>
          {insert === "link" && (
            <label className="grid gap-2 text-sm">
              Link text
              <Input
                value={linkText}
                onChange={(e) => setLinkText(e.target.value)}
                placeholder="Text to display"
              />
            </label>
          )}
          <label className="grid gap-2 text-sm">
            {insert === "image" ? "Image URL" : "Link URL"}
            <Input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </label>
          {insert === "image" && (
            <>
              <BlogImageUpload onUploaded={setUrl} />
              <label className="grid gap-2 text-sm">
                Image description
                <Input value={alt} onChange={(e) => setAlt(e.target.value)} />
              </label>
            </>
          )}
          {insert === "link" && (
            <label className="flex items-center gap-3 text-sm">
              <Checkbox
                checked={newTab}
                onCheckedChange={(checked) => setNewTab(!!checked)}
              />
              Open in a new tab
            </label>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            {insert === "link" && editingLink && (
              <Button
                variant="ghost"
                className="mr-auto"
                onClick={() => {
                  editor
                    .chain()
                    .focus()
                    .setTextSelection(linkSelection)
                    .unsetLink()
                    .run();
                  setInsert(null);
                }}
              >
                Remove link
              </Button>
            )}
            <Button variant="outline" onClick={() => setInsert(null)}>
              Cancel
            </Button>
            <Button onClick={apply}>
              {insert === "link" && editingLink ? "Save link" : "Insert"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
