
import React, { useRef, useEffect } from 'react';
import { Editor } from '@tinymce/tinymce-react';
import './RichTextEditor.css';

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
  const editorRef = useRef<any>(null);

  const handleEditorChange = (content: string) => {
    onChange(content);
  };

  return (
    <div className="rich-text-editor h-full">
      <Editor
        apiKey="no17idvqooop2hz590huxkpthgsoutf3f5kb89qobgl0dkfl"
        onInit={(evt, editor) => editorRef.current = editor}
        value={value}
        onEditorChange={handleEditorChange}
        init={{
          // Auto-resize configuration
          plugins: [
            'advlist', 'autolink', 'lists', 'link', 'image', 'charmap',
            'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
            'insertdatetime', 'media', 'table', 'preview', 'help', 'wordcount',
            'autoresize'  // Enable auto-resize plugin
          ],
          
          // Remove fixed height - let it auto-expand
          min_height: 300,
          max_height: 2000,
          autoresize_bottom_margin: 20,
          auto_focus: false,
          
          menubar: false,
          skin: 'oxide-dark',
          content_css: 'dark',
          
          toolbar: 
            'undo redo | blocks | bold italic forecolor backcolor | alignleft aligncenter ' +
            'alignright alignjustify | bullist numlist outdent indent | ' +
            'removeformat | help',
          
          placeholder: placeholder,
          
          // Ensure inline styles are preserved
          valid_elements: '*[*]',
          extended_valid_elements: '*[*]',
          keep_styles: true,
          verify_html: false,
          convert_urls: false,
          
          // Styling
          content_style: `
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
              font-size: 14px; 
              line-height: 1.6;
              color: #f3f4f6;
              background-color: #1f2937;
              margin: 10px;
              padding: 12px;
            }
            .mce-content-body {
              overflow: visible !important;
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
                editorDoc.body.style.overflow = 'visible';
              }
            });
            
            // Trigger auto-resize on content changes
            editor.on('change', () => {
              // The autoresize plugin handles this automatically
            });
            
            // Ensure no scrollbars appear
            editor.on('keyup', () => {
              const editorDoc = editor.getDoc();
              if (editorDoc && editorDoc.body) {
                editorDoc.body.style.overflow = 'visible';
              }
            });
          }
        }}
      />
    </div>
  );
}
