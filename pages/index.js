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
          sorts: [{ property: 'Post Scheduled Date', direction: 'descending' }],
        }),
      }
    );

    const data = await res.json();
    const results = data.results || [];

    const posts = results
      .filter((page) => {
        const type =
          page.properties['Content Type']?.select?.name ||
          page.properties['Content Type']?.status?.name ||
          page.properties['Content Type']?.multi_select?.[0]?.name ||
          '';
        return type.toLowerCase() !== 'story';
      })
      .map((page) => {
        const props = page.properties;

        // Extract uploaded files from Files & Media property
        const files = props.Content?.files || props.Image?.files || [];
        const imageUrl =
          files[0]?.file?.url || files[0]?.external?.url || props['Image URL']?.url || '';

        // Determine if carousel
        const contentType = props['Content Type']?.select?.name || 'Post';
        const isCarousel = contentType === 'Carousel' || files.length > 1;

        return {
          id: page.id,
          title: props.Name?.title?.[0]?.plain_text || 'Untitled',
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

// Instagram's profile grid shows 3:4 tiles (height = 133.33% of width).
// The dedicated Reels tab shows full 9:16 tiles (height = 177.78% of width).
const TILE_RATIO = {
  grid: '133.3333%',
  carousels: '133.3333%',
  reels: '177.7778%',
};

export default function Home({ posts }) {
  const [activeTab, setActiveTab] = useState('grid');
  const username = process.env.NEXT_PUBLIC_IG_USERNAME || 'rusesocials';

  // Filter posts based on active tab
  const displayedPosts = posts.filter((post) => {
    if (activeTab === 'reels') return post.contentType === 'Reel';
    if (activeTab === 'carousels') return post.isCarousel;
    return true; // 'grid' shows all
  });

  const tabStyle = (name) => ({
    flex: 1,
    padding: '10px 0',
    background: 'none',
    border: 'none',
    borderBottom: activeTab === name ? '2px solid #000' : '2px solid transparent',
    fontWeight: activeTab === name ? '600' : 'normal',
    cursor: 'pointer',
    fontSize: '12px',
  });

  return (
    <div
      style={{
        maxWidth: '600px',
        margin: '0 auto',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      }}
    >
      {/* Header */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '16px',
        }}
      >
        <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#dbdbdb' }} />
        <h2 style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>@{username}</h2>
      </header>

      {/* IG Tab Navigation Bar */}
      <div style={{ display: 'flex', borderTop: '1px solid #dbdbdb' }}>
        <button onClick={() => setActiveTab('grid')} style={tabStyle('grid')}>
          ▦
        </button>
        <button onClick={() => setActiveTab('reels')} style={tabStyle('reels')}>
          🎬
        </button>
        <button onClick={() => setActiveTab('carousels')} style={tabStyle('carousels')}>
          🎴
        </button>
      </div>

      {/* 3-Column Grid, edge to edge with thin gaps like Instagram */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '2px',
          marginTop: '2px',
        }}
      >
        {displayedPosts.map((post) => (
          <div
            key={post.id}
            style={{
              position: 'relative',
              paddingTop: TILE_RATIO[activeTab],
              backgroundColor: '#f0f0f0',
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
                  objectPosition: 'center',
                }}
              />
            ) : (
              <div
                style={{
                  position: 'absolute',
                  top: '40%',
                  left: '8%',
                  right: '8%',
                  fontSize: '11px',
                  color: '#666',
                  textAlign: 'center',
                }}
              >
                {post.title}
              </div>
            )}

            {/* Top-Right Badge Icons */}
            {post.isCarousel && (
              <div
                style={{
                  position: 'absolute',
                  top: '6px',
                  right: '6px',
                  backgroundColor: 'rgba(0,0,0,0.6)',
                  padding: '2px 4px',
                  borderRadius: '3px',
                  fontSize: '10px',
                  color: '#fff',
                }}
              >
                🎴
              </div>
            )}
            {post.contentType === 'Reel' && !post.isCarousel && (
              <div
                style={{
                  position: 'absolute',
                  top: '6px',
                  right: '6px',
                  backgroundColor: 'rgba(0,0,0,0.6)',
                  padding: '2px 4px',
                  borderRadius: '3px',
                  fontSize: '10px',
                  color: '#fff',
                }}
              >
                🎬
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
