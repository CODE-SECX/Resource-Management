
import ReactQuill, { Quill } from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import 'quill-better-table/dist/quill-better-table.css';
import './RichTextEditor.css';
import QuillBetterTable from 'quill-better-table';

Quill.register(
  {
    'modules/better-table': QuillBetterTable,
  },
  true
);

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function RichTextEditor({ 
  value, 
  onChange, 
  placeholder = "Start writing..."
}: RichTextEditorProps) {
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
        ['link', 'image'],
        ['insertTable'],
        ['clean'],
      ],
      handlers: {
        insertTable: function (this: any) {
          const tableModule = this.quill.getModule('better-table');
          if (tableModule) {
            tableModule.insertTable(3, 3);
          }
        },
      },
    },
    'better-table': {
      operationMenu: {
        items: {
          addRowAbove: { text: 'Add row above' },
          addRowBelow: { text: 'Add row below' },
          addColumnLeft: { text: 'Add column left' },
          addColumnRight: { text: 'Add column right' },
          deleteRow: { text: 'Delete row' },
          deleteColumn: { text: 'Delete column' },
          deleteTable: { text: 'Delete table' },
        },
      },
    },
    keyboard: {
      bindings: QuillBetterTable.keyboardBindings,
    },
    clipboard: {
      matchVisual: false,
    },
    table: false,
  };

  const formats = [
    'header',
    'bold', 'italic', 'underline', 'strike',
    'blockquote', 'code-block',
    'list', 'bullet',
    'script',
    'indent',
    'size',
    'color', 'background',
    'align',
    'link', 'image',
    'table',
  ];

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
