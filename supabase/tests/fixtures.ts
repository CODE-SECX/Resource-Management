import type { Db } from './db';

export const ADMIN = '00000000-0000-0000-0000-00000000000a';
export const OTHER = '00000000-0000-0000-0000-00000000000b';

/** Two users (ADMIN is an admin) and a deliberately messy library for ADMIN. Returns record ids. */
export async function seedLibrary(db: Db): Promise<Record<string, string>> {
  await db.admin(`INSERT INTO auth.users VALUES ('${ADMIN}', 'admin@x'), ('${OTHER}', 'other@x')`);
  await db.admin(`INSERT INTO user_roles VALUES ('${ADMIN}', 'admin')`);

  // A deliberately messy library: two Azure categories, duplicate subcategory/tag names, legacy tag shape.
  const ins = async (sql: string, params: unknown[]) => (await db.admin<{ id: string }>(sql + ' RETURNING id', params))[0].id;
  const cat = (name: string, user = ADMIN) => ins('INSERT INTO categories (user_id, name) VALUES ($1, $2)', [user, name]);
  const sub = (category: string, name: string) => ins('INSERT INTO subcategories (user_id, category_id, name) VALUES ($1, $2, $3)', [ADMIN, category, name]);
  const tag = (name: string, subcategory: string | null, category: string | null) =>
    ins('INSERT INTO tags (user_id, name, subcategory_id, category_id) VALUES ($1, $2, $3, $4)', [ADMIN, name, subcategory, category]);

  const azure = await cat('Azure');
  const mac = await cat('Microsoft Azure Cloud');
  const k8s = await cat('Kubernetes');
  const otherCat = await cat('Other user category', OTHER);
  const fnAzure = await sub(azure, 'Functions');
  const fnMac = await sub(mac, ' functions ');
  const aks = await sub(mac, 'AKS');
  const ids: Record<string, string> = {
    azure, mac, k8s, otherCat, fnAzure, fnMac, aks,
    tServerless: await tag('serverless', fnAzure, null),
    tServerlessDup: await tag('Serverless ', fnMac, null),
    tK8sLegacy: await tag('k8s', aks, mac),             // legacy: both subcategory_id and category_id
    tCloudAzure: await tag('Cloud', null, azure),
    tCloudMac: await tag('cloud', null, mac),
  };
  ids.l1 = await ins(`INSERT INTO learning (user_id, title, tags, subcategories) VALUES ($1, 'Durable Functions', '{Serverless }', $2)`, [ADMIN, `{${fnMac}}`]);
  ids.r1 = await ins(`INSERT INTO resources (user_id, title, tags, subcategories) VALUES ($1, 'AKS networking', '{k8s}', $2)`, [ADMIN, `{${aks}}`]);
  ids.r2 = await ins(`INSERT INTO resources (user_id, title, tags, subcategories) VALUES ($1, 'Functions pricing', '{serverless}', $2)`, [ADMIN, `{${fnAzure}}`]);
  ids.rOther = await ins(`INSERT INTO resources (user_id, title) VALUES ($1, 'Not yours')`, [OTHER]);
  await db.exec(`
    INSERT INTO learning_categories (learning_id, category_id) VALUES ('${ids.l1}', '${mac}');
    INSERT INTO learning_subcategories VALUES ('${ids.l1}', '${fnMac}');
    INSERT INTO learning_tags VALUES ('${ids.l1}', '${ids.tServerlessDup}');
    INSERT INTO resource_categories (resource_id, category_id) VALUES ('${ids.r1}', '${mac}'), ('${ids.r2}', '${azure}');
    INSERT INTO resource_subcategories VALUES ('${ids.r1}', '${aks}'), ('${ids.r2}', '${fnAzure}');
    INSERT INTO resource_tags VALUES ('${ids.r1}', '${ids.tK8sLegacy}'), ('${ids.r2}', '${ids.tServerless}');
  `);
  return ids;
}
