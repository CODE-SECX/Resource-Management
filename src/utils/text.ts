/** Plain-text preview of editor HTML. */
export function stripHtml(html: string | null | undefined) {
  return (html ?? '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}
