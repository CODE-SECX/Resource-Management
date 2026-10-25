import ReactQuill, { Quill } from 'react-quill-new';
import type { Delta } from 'quill';
import 'react-quill-new/dist/quill.snow.css';
import './RichTextEditor.css';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

// Quill 2.0.3 emits every space as &nbsp;, so saved descriptions never wrap.
// Turn single &nbsp; back into spaces; runs of them keep intentional spacing.
const originalGetSemanticHTML = Quill.prototype.getSemanticHTML;
Quill.prototype.getSemanticHTML = function (this: InstanceType<typeof Quill>, ...args: unknown[]) {
  return (originalGetSemanticHTML as (...a: unknown[]) => string)
    .apply(this, args)
    .replace(/(?<!&nbsp;)&nbsp;(?!&nbsp;)/g, ' ');
} as typeof originalGetSemanticHTML;

// Quill only treats <td> as a cell boundary, so a pasted header row
// (<th>, as ChatGPT/Markdown tables use) would collapse into one cell.
function matchHeaderCell(_node: Node, delta: Delta) {
  const last = delta.ops[delta.ops.length - 1];
  const endsWithNewline = typeof last?.insert === 'string' && last.insert.endsWith('\n');
  return endsWithNewline ? delta : delta.insert('\n');
}

// Defined at module scope: react-quill-new rebuilds the editor whenever
// `modules` or `formats` change, so they must keep a stable identity.
const modules = {
  toolbar: {
    container: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      ['blockquote', 'code-block'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'script': 'sub'}, { 'script': 'super' }],
      [{ 'indent': '-1'}, { 'indent': '+1' }],
      [{ 'size': ['small', false, 'large', 'huge'] }],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'align': [] }],
      ['link', 'image', 'table'],
      ['clean'],
    ],
    handlers: {
      table(this: { quill: InstanceType<typeof Quill> }) {
        const table = this.quill.getModule('table') as { insertTable: (rows: number, cols: number) => void };
        table.insertTable(3, 3);
      },
    },
  },
  // Quill 2's built-in table module; also lets pasted <table> HTML keep its rows/cells
  table: true,
  clipboard: {
    matchVisual: false,
    matchers: [['th', matchHeaderCell]],
  },
};

const formats = [
  'header',
  'bold', 'italic', 'underline', 'strike',
  'blockquote', 'code-block',
  'list',
  'script',
  'indent',
  'size',
  'color', 'background',
  'align',
  'link', 'image',
  'table',
];

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Start writing..."
}: RichTextEditorProps) {
  return (
    <div className="rich-text-editor h-full">
      <ReactQuill
        value={value}
        onChange={onChange}
        modules={modules}
        formats={formats}
        placeholder={placeholder}
        theme="snow"
        className="h-full flex flex-col"
      />
    </div>
  );
}
