"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Button } from "@/components/ui/button";

interface RichTextEditorProps {
  /** Initial HTML content to load into the editor */
  initialContent?: string;
  /** Called with the current HTML whenever content changes */
  onChange?: (html: string) => void;
  /** When false, renders read-only prose (no toolbar) */
  editable?: boolean;
}

/**
 * WYSIWYG rich text editor backed by Tiptap + StarterKit.
 * Supports headings, bold, italic, lists, blockquote, and horizontal rule.
 * When editable=false, renders content as styled read-only prose.
 *
 * @param initialContent - HTML string to pre-populate the editor
 * @param onChange       - Callback fired on every content change
 * @param editable       - Whether the editor is interactive (default true)
 */
export function RichTextEditor({
  initialContent = "",
  onChange,
  editable = true,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: initialContent,
    editable,
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: editable
          ? "min-h-[240px] rounded-b-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
          : "px-1 py-2 text-sm",
      },
    },
  });

  if (!editor) return null;

  return (
    <div className="flex flex-col gap-0">
      {editable && (
        <div className="flex flex-wrap gap-1 rounded-t-md border border-b-0 border-input bg-muted px-2 py-1.5">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive("bold")}
            title="Bold"
          >
            <strong>B</strong>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive("italic")}
            title="Italic"
          >
            <em>I</em>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            active={editor.isActive("heading", { level: 2 })}
            title="Heading 2"
          >
            H2
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            active={editor.isActive("heading", { level: 3 })}
            title="Heading 3"
          >
            H3
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            active={editor.isActive("bulletList")}
            title="Bullet list"
          >
            • List
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            active={editor.isActive("orderedList")}
            title="Ordered list"
          >
            1. List
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            active={editor.isActive("blockquote")}
            title="Blockquote"
          >
            ❝
          </ToolbarButton>
          <div className="ml-auto flex gap-1">
            <ToolbarButton
              onClick={() => editor.chain().focus().undo().run()}
              disabled={!editor.can().undo()}
              title="Undo"
            >
              ↩
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().redo().run()}
              disabled={!editor.can().redo()}
              title="Redo"
            >
              ↪
            </ToolbarButton>
          </div>
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}

interface ToolbarButtonProps {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title?: string;
  children: React.ReactNode;
}

function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: ToolbarButtonProps) {
  return (
    <Button
      type="button"
      variant={active ? "secondary" : "ghost"}
      size="sm"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="h-7 px-2 text-xs"
    >
      {children}
    </Button>
  );
}
