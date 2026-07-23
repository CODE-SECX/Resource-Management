export interface ContentTarget {
  html_content?: string | null;
  url?: string | null;
}

export function getContentTarget(item: ContentTarget): { type: 'html' | 'url' | 'none'; value?: string } {
  const htmlContent = item.html_content?.trim();
  if (htmlContent) {
    return { type: 'html', value: htmlContent };
  }

  const url = item.url?.trim();
  if (url) {
    return { type: 'url', value: url };
  }

  return { type: 'none' };
}

export function openContentTarget(item: ContentTarget): boolean {
  const target = getContentTarget(item);

  if (target.type === 'html' && target.value) {
    const blob = new Blob([target.value], { type: 'text/html;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);
    window.open(blobUrl, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    return true;
  }

  if (target.type === 'url' && target.value) {
    window.open(target.value, '_blank', 'noopener,noreferrer');
    return true;
  }

  return false;
}
