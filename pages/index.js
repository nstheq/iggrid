export async function getServerSideProps() {
  try {
    const res = await fetch(
      `https://api.notion.com/v1/databases/${process.env.NOTION_DATABASE_ID}/query`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sorts: [{ property: 'Order', direction: 'ascending' }],
        }),
      }
    );

    const data = await res.json();
    const results = data.results || [];

    const posts = results.map((page) => {
      const props = page.properties;
      const imageUrl =
        props.Image?.files?.[0]?.file?.url ||
        props.Image?.files?.[0]?.external?.url ||
        props['Image URL']?.url ||
        '';

      return {
        id: page.id,
        title: props.Name?.title?.[0]?.plain_text || 'Untitled',
        order: props.Order?.number || 0,
        imageUrl,
      };
    });

    return { props: { posts } };
  } catch (error) {
    return { props: { posts: [] } };
  }
}

export default function Home({ posts }) {
  const username = process.env.NEXT_PUBLIC_IG_USERNAME || 'rusesocials';

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#ccc' }} />
        <h2 style={{ fontSize: '18px', margin: 0 }}>@{username}</h2>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
        {posts.map((post) => (
          <div
            key={post.id}
            style={{
              position: 'relative',
              paddingTop: '100%',
              backgroundColor: '#f0f0f0',
            }}
          >
            {post.imageUrl ? (
              <img
                src={post.imageUrl}
                alt={post.title}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            ) : (
              <div style={{ position: 'absolute', top: '40%', left: '10%', fontSize: '12px' }}>
                {post.title}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
