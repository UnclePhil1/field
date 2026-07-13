export function buildBragUrl(p: { title: string; sub?: string; tag?: string }): string {
  const q = new URLSearchParams({ title: p.title });
  if (p.sub) q.set('sub', p.sub);
  if (p.tag) q.set('tag', p.tag);
  return `${window.location.origin}/brag?${q.toString()}`;
}
