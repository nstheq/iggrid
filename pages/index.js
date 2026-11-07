import { useState } from 'react';

// Only posts with one of these Status values show in the preview.
// Draft is left out on purpose, so drafts stay hidden.
const ALLOWED_STATUSES = ['scheduled', 'posted'];

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
        // Hide anything whose Status is not on the allowed list (for example Draft)
        const statusProp = page.properties['Status'];
        const status = (statusProp?.status?.name || statusProp?.select?.name || '').toLowerCase();
        if (!ALLOWED_STATUSES.includes(status)) return false;

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

// Simple Instagram-style icons. They use currentColor, so the parent's
// text color controls the icon color.
const GridIcon = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    {[3, 10, 17].map((x) =>
      [3, 10, 17].map((y) => <rect key={`${x}-${y}`} x={x} y={y} width="4" height="4" />)
    )}
  </svg>
);

const ReelIcon = ({ size = 24 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="3" y="3" width="18" height="18" rx="4" />
    <line x1="3" y1="8.5" x2="21" y2="8.5" />
    <line x1="9" y1="3" x2="11.5" y2="8.5" />
    <line x1="15" y1="3" x2="17.5" y2="8.5" />
    <path d="M10 12.5l5 3-5 3z" fill="currentColor" />
  </svg>
);

const CarouselIcon = ({ size = 24 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="3" y="8" width="13" height="13" rx="2.5" />
    <path d="M8 5.5A2.5 2.5 0 0 1 10.5 3H18.5A2.5 2.5 0 0 1 21 5.5V13.5A2.5 2.5 0 0 1 18.5 16" />
  </svg>
);

// White icon with a soft shadow, placed in the tile's top right corner
const badgeStyle = {
  position: 'absolute',
  top: '8px',
  right: '8px',
  color: '#fff',
  display: 'flex',
  filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.55))',
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
    color: activeTab === name ? '#000' : '#8e8e8e',
    display: 'flex',
    justifyContent: 'center',
    cursor: 'pointer',
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
        <button onClick={() => setActiveTab('grid')} style={tabStyle('grid')} aria-label="Grid">
          <GridIcon size={22} />
        </button>
        <button onClick={() => setActiveTab('reels')} style={tabStyle('reels')} aria-label="Reels">
          <ReelIcon size={22} />
        </button>
        <button
          onClick={() => setActiveTab('carousels')}
          style={tabStyle('carousels')}
          aria-label="Carousels"
        >
          <CarouselIcon size={22} />
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
              <div style={badgeStyle}>
                <CarouselIcon size={18} />
              </div>
            )}
            {post.contentType === 'Reel' && !post.isCarousel && (
              <div style={badgeStyle}>
                <ReelIcon size={18} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
