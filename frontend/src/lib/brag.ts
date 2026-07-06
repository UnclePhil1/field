// Build a shareable "brag" link. The link unfurls on social apps as a branded
// card image (rendered by /api/og), and opens a small page that invites others
// to play. title = the headline, sub = the context line, tag = the pill.
export function buildBragUrl(p: { title: string; sub?: string; tag?: string }): string {
  const q = new URLSearchParams({ title: p.title });
  if (p.sub) q.set('sub', p.sub);
  if (p.tag) q.set('tag', p.tag);
  return `${window.location.origin}/brag?${q.toString()}`;
}
