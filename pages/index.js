import { useState } from 'react';

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
          sorts: [{ property: 'Post Scheduled Date', direction: 'ascending' }],
        }),
      }
    );

    const data = await res.json();
    const results = data.results || [];

    const posts = results.map((page) => {
      const props = page.properties;
      
      // Extract uploaded files from Files & Media property
      const files = props.Content?.files || props.Image?.files || [];
      const imageUrl = files[0]?.file?.url || files[0]?.external?.url || props['Image URL']?.url || '';
      
      // Determine if carousel
      const contentType = props['Content Type']?.select?.name || 'Post';
      const isCarousel = contentType === 'Carousel' || files.length > 1;

      // Format date (e.g., "Feb 27")
      const rawDate = props['Post Scheduled Date']?.date?.start || '';
      let formattedDate = '';
      if (rawDate) {
        const d = new Date(rawDate);
        formattedDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }

      return {
        id: page.id,
        title: props.Name?.title?.[0]?.plain_text || 'Untitled',
        date: formattedDate,
        contentType,
        isCarousel,
        imageUrl,
      };
    });

    return { props: { posts } };
  } catch (error) {
    return { props: { posts: [] } };
  }
}

export default function Home({ posts }) {
  const [activeTab, setActiveTab] = useState('grid');
  const username = process.env.NEXT_PUBLIC_IG_USERNAME || 'rusesocials';

  // Filter posts based on active tab
  const displayedPosts = posts.filter((post) => {
    if (activeTab === 'reels') return post.contentType === 'Reel';
    if (activeTab === 'carousels') return post.isCarousel;
    return true; // 'grid' shows all
  });

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '16px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#dbdbdb' }} />
        <h2 style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>@{username}</h2>
      </header>

      {/* IG Tab Navigation Bar */}
      <div style={{ display: 'flex', borderTop: '1px solid #dbdbdb', borderBottom: '1px solid #dbdbdb', marginBottom: '16px' }}>
        <button
          onClick={() => setActiveTab('grid')}
          style={{
            flex: 1,
            padding: '10px 0',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'grid' ? '2px solid #000' : '2px solid transparent',
            fontWeight: activeTab === 'grid' ? '600' : 'normal',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          ▦
        </button>
        <button
          onClick={() => setActiveTab('reels')}
          style={{
            flex: 1,
            padding: '10px 0',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'reels' ? '2px solid #000' : '2px solid transparent',
            fontWeight: activeTab === 'reels' ? '600' : 'normal',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          🎬
        </button>
        <button
          onClick={() => setActiveTab('carousels')}
          style={{
            flex: 1,
            padding: '10px 0',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'carousels' ? '2px solid #000' : '2px solid transparent',
            fontWeight: activeTab === 'carousels' ? '600' : 'normal',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          🎴
        </button>
      </div>

      {/* 3-Column Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
        {displayedPosts.map((post) => (
          <div key={post.id} style={{ display: 'flex', flexDirection: 'column' }}>
            {/* Scheduled Date Badge Above Tile */}
            {post.date && (
              <div style={{ fontSize: '10px', color: '#8e8e8e', textAlign: 'center', marginBottom: '2px', fontWeight: '500' }}>
                {post.date}
              </div>
            )}

            {/* Media Box */}
            <div
              style={{
                position: 'relative',
                paddingTop: '100%',
                backgroundColor: '#f0f0f0',
                borderRadius: '2px',
                overflow: 'hidden',
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
                <div style={{ position: 'absolute', top: '35%', left: '8%', right: '8%', fontSize: '11px', color: '#666', textAlign: 'center' }}>
                  {post.title}
                </div>
              )}

              {/* Top-Right Badge Icons */}
              {post.isCarousel && (
                <div style={{ position: 'absolute', top: '6px', right: '6px', backgroundColor: 'rgba(0,0,0,0.6)', padding: '2px 4px', borderRadius: '3px', fontSize: '10px', color: '#fff' }}>
                  🎴
                </div>
              )}
              {post.contentType === 'Reel' && !post.isCarousel && (
                <div style={{ position: 'absolute', top: '6px', right: '6px', backgroundColor: 'rgba(0,0,0,0.6)', padding: '2px 4px', borderRadius: '3px', fontSize: '10px', color: '#fff' }}>
                  🎬
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
