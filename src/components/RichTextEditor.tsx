import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import TextAlign from '@tiptap/extension-text-align'
import Placeholder from '@tiptap/extension-placeholder'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Eraser,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo2,
} from 'lucide-react'

type RichTextEditorProps = {
  value: string
  onChange: (nextValue: string) => void
  placeholder?: string
  minHeightClassName?: string
}

function RichTextEditor({
  value,
  onChange,
  placeholder = '',
  minHeightClassName = 'min-h-56',
}: RichTextEditorProps) {
  const { t } = useTranslation()
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: value || '',
    editorProps: {
      attributes: {
        class: `prose prose-sm max-w-none px-3 py-2 focus:outline-none ${minHeightClassName}`,
      },
    },
    onUpdate: ({ editor: nextEditor }) => {
      onChange(nextEditor.getHTML())
    },
  })

  useEffect(() => {
    if (!editor) {
      return
    }
    const current = editor.getHTML()
    if (current !== value) {
      editor.commands.setContent(value || '', { emitUpdate: false })
    }
  }, [editor, value])

  if (!editor) {
    return null
  }

  return (
    <div className="rounded-lg border border-base-300">
      <div className="flex flex-wrap gap-2 border-b border-base-300 p-2">
        <button
          type="button"
          className={`btn btn-ghost btn-xs ${editor.isActive('bold') ? 'btn-active' : ''}`}
          onClick={() => editor.chain().focus().toggleBold().run()}
          aria-label={t('editor.bold')}
          title={t('editor.bold')}
        >
          <Bold className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className={`btn btn-ghost btn-xs ${editor.isActive('italic') ? 'btn-active' : ''}`}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          aria-label={t('editor.italic')}
          title={t('editor.italic')}
        >
          <Italic className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className={`btn btn-ghost btn-xs ${editor.isActive('underline') ? 'btn-active' : ''}`}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          aria-label={t('editor.underline')}
          title={t('editor.underline')}
        >
          <UnderlineIcon className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className={`btn btn-ghost btn-xs ${editor.isActive('strike') ? 'btn-active' : ''}`}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          aria-label={t('editor.strike')}
          title={t('editor.strike')}
        >
          <Strikethrough className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className={`btn btn-ghost btn-xs ${editor.isActive('heading', { level: 2 }) ? 'btn-active' : ''}`}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          aria-label={t('editor.heading2')}
          title={t('editor.heading2')}
        >
          <Heading2 className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className={`btn btn-ghost btn-xs ${editor.isActive('heading', { level: 3 }) ? 'btn-active' : ''}`}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          aria-label={t('editor.heading3')}
          title={t('editor.heading3')}
        >
          <Heading3 className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className={`btn btn-ghost btn-xs ${editor.isActive('bulletList') ? 'btn-active' : ''}`}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          aria-label={t('editor.bullets')}
          title={t('editor.bullets')}
        >
          <List className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className={`btn btn-ghost btn-xs ${editor.isActive('orderedList') ? 'btn-active' : ''}`}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          aria-label={t('editor.numbers')}
          title={t('editor.numbers')}
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className={`btn btn-ghost btn-xs ${editor.isActive('blockquote') ? 'btn-active' : ''}`}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          aria-label={t('editor.quote')}
          title={t('editor.quote')}
        >
          <Quote className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className={`btn btn-ghost btn-xs ${editor.isActive({ textAlign: 'left' }) ? 'btn-active' : ''}`}
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          aria-label={t('editor.alignLeft')}
          title={t('editor.alignLeft')}
        >
          <AlignLeft className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className={`btn btn-ghost btn-xs ${editor.isActive({ textAlign: 'center' }) ? 'btn-active' : ''}`}
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          aria-label={t('editor.alignCenter')}
          title={t('editor.alignCenter')}
        >
          <AlignCenter className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className={`btn btn-ghost btn-xs ${editor.isActive({ textAlign: 'right' }) ? 'btn-active' : ''}`}
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          aria-label={t('editor.alignRight')}
          title={t('editor.alignRight')}
        >
          <AlignRight className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className={`btn btn-ghost btn-xs ${editor.isActive('link') ? 'btn-active' : ''}`}
          onClick={() => {
            const previous = editor.getAttributes('link').href as string | undefined
            const url = window.prompt(t('editor.linkPrompt'), previous ?? '')
            if (url === null) {
              return
            }
            if (!url.trim()) {
              editor.chain().focus().unsetLink().run()
              return
            }
            editor.chain().focus().setLink({ href: url.trim() }).run()
          }}
          aria-label={t('editor.link')}
          title={t('editor.link')}
        >
          <Link2 className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-xs"
          onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
          aria-label={t('editor.clear')}
          title={t('editor.clear')}
        >
          <Eraser className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-xs"
          onClick={() => editor.chain().focus().undo().run()}
          aria-label={t('editor.undo')}
          title={t('editor.undo')}
        >
          <Undo2 className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-xs"
          onClick={() => editor.chain().focus().redo().run()}
          aria-label={t('editor.redo')}
          title={t('editor.redo')}
        >
          <Redo2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <EditorContent editor={editor} />
    </div>
  )
}

export default RichTextEditor
