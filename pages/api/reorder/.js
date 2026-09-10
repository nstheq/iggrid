export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { items } = req.body;

  try {
    await Promise.all(
      items.map((item) =>
        fetch(`https://api.notion.com/v1/pages/${item.id}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            properties: {
              Order: { number: item.order },
            },
          }),
        })
      )
    );
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
