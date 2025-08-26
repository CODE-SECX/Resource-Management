
import React, { useRef, useEffect } from 'react';
import { Editor } from '@tinymce/tinymce-react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  height?: number;
}

export function RichTextEditor({ 
  value, 
  onChange, 
  placeholder = "Start writing...",
  height = 300
}: RichTextEditorProps) {
  const editorRef = useRef<any>(null);

  const handleEditorChange = (content: string) => {
    onChange(content);
  };

  return (
    <div className="rich-text-editor">
      <Editor
        apiKey="no17idvqooop2hz590huxkpthgsoutf3f5kb89qobgl0dkfl"
        onInit={(evt, editor) => editorRef.current = editor}
        value={value}
        onEditorChange={handleEditorChange}
        init={{
          height: height,
          menubar: false,
          skin: 'oxide-dark',
          content_css: 'dark',
          plugins: [
            'advlist', 'autolink', 'lists', 'link', 'image', 'charmap',
            'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
            'insertdatetime', 'media', 'table', 'preview', 'help', 'wordcount'
          ],
          toolbar: 
            'undo redo | blocks | bold italic forecolor | alignleft aligncenter ' +
            'alignright alignjustify | bullist numlist outdent indent | ' +
            'removeformat | help',
          placeholder: placeholder,
          content_style: `
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
              font-size: 14px; 
              line-height: 1.6;
              color: #f3f4f6;
              background-color: #1f2937;
            }
            .mce-content-body[data-mce-placeholder]:not(.mce-visualblocks)::before {
              color: #9ca3af;
            }
          `,
          setup: (editor) => {
            editor.on('init', () => {
              // Apply dark theme styles to editor
              const editorDoc = editor.getDoc();
              if (editorDoc) {
                editorDoc.body.style.backgroundColor = '#1f2937';
                editorDoc.body.style.color = '#f3f4f6';
              }
            });
          }
        }}
      />
    </div>
  );
}
