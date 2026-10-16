// Todoist holds chore definitions. Private storage holds independent dated checkmarks.
export function completionKey(project, task, date, person, slot = 'morning') {
  return 'chores/' + project + '/completions/' + task + '/' + date + '/' + person + '/' + slot;
}
export async function readHistory(bucket, project) {
  const imported = await bucket.get('chores/' + project + '/import.json');
  const records = new Map((imported ? await imported.json() : []).map(hit => [completionKey(project, hit.task, hit.date, hit.person, hit.slot), hit]));
  let cursor;
  do {
    const page = await bucket.list({ prefix: 'chores/' + project + '/completions/', include: ['customMetadata'], ...(cursor ? { cursor } : {}) });
    for (const object of page.objects) {
      const [, , , task, date, person, slot] = object.key.split('/');
      const meta = object.customMetadata;
      if (!meta || meta.done !== 'true') records.delete(completionKey(project, task, date, person, slot));
      else records.set(completionKey(project, task, date, person, slot), { task, date, person, slot: slot || 'morning', by: meta.by, stars: Number(meta.stars) });
    }
    cursor = page.truncated ? page.cursor : null;
  } while (cursor);
  return [...records.values()];
}
export async function writeCompletion(bucket, project, body, stars) {
  const key = completionKey(project, body.id, body.date, body.person, body.r);
  // One object per task/date/person/timeslot. Separate people's writes never overwrite each other.
  await bucket.put(key, '', { customMetadata: { done: String(body.action === 'complete'), by: body.by, stars: String(stars) } });
}
