import { Client } from '@notionhq/client';

const notion = new Client({ auth: process.env.NOTION_TOKEN });

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { items } = req.body;

  try {
    await Promise.all(
      items.map((item) =>
        notion.pages.update({
          page_id: item.id,
          properties: {
            Order: { number: item.order },
          },
        })
      )
    );
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
