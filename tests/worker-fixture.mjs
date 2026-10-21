import worker from '../cloudflare/worker.mjs';
export function fixture() {
  const entries = new Map(), writes = [];
  const env = { ADMIN_TOKEN: 'local-test-only', STATUS_KV: {
    async get(key, format) { const v = entries.get(key); return v == null ? null : format === 'json' ? JSON.parse(v) : v; },
    async put(key, value, options) { entries.set(key, value); writes.push({key, options}); },
    async delete(key) { entries.delete(key); },
    async list({prefix}) { return { keys: [...entries.keys()].filter(k => k.startsWith(prefix)).map(name => ({name})), list_complete: true }; }
  }};
  const request = (path, method='GET', body, auth=true) => worker.fetch(new Request('https://local.test'+path, {
    method, headers: auth ? {Authorization: 'Bearer local-test-only'} : {},
    ...(body === undefined ? {} : {body: JSON.stringify(body)})
  }), env);
  return { entries, writes, env, request };
}
