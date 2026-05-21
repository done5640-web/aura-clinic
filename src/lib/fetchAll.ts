const PAGE = 1000;
const BATCH = 8; // pages fetched in parallel after the first

export async function fetchAll<T = any>(
  queryFn: (from: number, to: number) => any
): Promise<T[]> {
  // Round trip 1: first page
  const { data: first, error } = await queryFn(0, PAGE - 1);
  if (error || !first || first.length === 0) return [];
  if (first.length < PAGE) return first as T[];

  // First page was full — fetch the rest in parallel batches
  const all: T[] = [...(first as T[])];
  let offset = PAGE;

  while (true) {
    const results = await Promise.all(
      Array.from({ length: BATCH }, (_, i) =>
        queryFn(offset + i * PAGE, offset + (i + 1) * PAGE - 1)
      )
    );

    let done = false;
    for (const { data, error: e } of results) {
      if (e || !data || data.length === 0) { done = true; break; }
      all.push(...(data as T[]));
      if (data.length < PAGE) { done = true; break; }
    }
    if (done) break;
    offset += BATCH * PAGE;
  }

  return all;
}
