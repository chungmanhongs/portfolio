export const config = { runtime: 'edge' };

export default async function handler(req) {
  const token = process.env.NOTION_TOKEN;
  const dbId  = process.env.NOTION_DB_ID;

  if (!token || !dbId) {
    return new Response(JSON.stringify({ error: 'Missing env vars' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sorts: [{ property: 'year', direction: 'ascending' }]
      }),
    });

    const data = await res.json();

    const projects = await Promise.all(data.results.map(async page => {
      const p = page.properties;
      const get = (key, type = 'rich_text') => {
        if (!p[key]) return '';
        if (type === 'title')     return p[key].title?.[0]?.plain_text || '';
        if (type === 'rich_text') return p[key].rich_text?.[0]?.plain_text || '';
        return '';
      };

      // body 필드가 비어있으면 페이지 본문에서 읽기
      let body = get('body');
      if (!body) {
        try {
          const blockRes = await fetch(`https://api.notion.com/v1/blocks/${page.id}/children`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Notion-Version': '2022-06-28',
            },
          });
          const blockData = await blockRes.json();
          body = blockData.results
            ?.filter(b => b.type === 'paragraph')
            ?.map(b => b.paragraph?.rich_text?.[0]?.plain_text || '')
            ?.filter(Boolean)
            ?.join(' ') || '';
        } catch(e) {}
      }

      return {
        title:  get('이름', 'title'),
        year:   get('year'),
        color:  get('color'),
        desc:   get('desc'),
        role:   get('role'),
        cat:    get('cat'),
        client: get('client'),
        body,
        tags:   get('tags'),
        images: [],
      };
    }));

    return new Response(JSON.stringify(projects), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 's-maxage=60, stale-while-revalidate=300',
      },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
