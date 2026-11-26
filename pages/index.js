import { useState, useEffect, useRef } from 'react';

// Only posts with one of these Status values show in the preview.
// Draft is left out on purpose, so drafts stay hidden.
const ALLOWED_STATUSES = ['scheduled', 'posted', 'awaiting approval'];

// Notion column names this page reads. If a client's database uses a
// different name, add it to the list. The first one that exists is used.
const CAPTION_COLUMNS = ['Caption', 'Copy', 'Post Caption', 'Description'];
const AUDIO_COLUMNS = ['Audio', 'Sound', 'Song'];
// Reel cover: a Files & media column. This is what shows on the grid.
const COVER_COLUMNS = ['Cover', 'Reel Cover', 'Thumbnail'];
// Reel link: a URL (or text) column with a link to the video, for example
// a Google Drive or Dropbox share link, or a direct .mp4 link.
const VIDEO_LINK_COLUMNS = ['Reel Link', 'Video Link', 'Video URL', 'Video'];

const pickFiles = (props, names) => {
  for (const name of names) {
    const files = props[name]?.files || [];
    const urls = files.map((f) => f?.file?.url || f?.external?.url || '').filter(Boolean);
    if (urls.length) return urls;
  }
  return [];
};

const pickUrl = (props, names) => {
  for (const name of names) {
    const prop = props[name];
    const url = prop?.url || getText(prop) || prop?.files?.[0]?.external?.url || prop?.files?.[0]?.file?.url || '';
    if (url) return url.trim();
  }
  return '';
};

// Turns a share link into something the preview can play.
// Returns { kind: 'video' | 'embed' | 'link', url }
const playableFromLink = (link) => {
  if (!link) return null;
  if (isVideoUrl(link)) return { kind: 'video', url: link };
  // Google Drive: https://drive.google.com/file/d/FILE_ID/view
  const drive = link.match(/drive\.google\.com\/(?:file\/d\/|open\?id=)([\w-]+)/);
  if (drive) return { kind: 'embed', url: `https://drive.google.com/file/d/${drive[1]}/preview` };
  // Dropbox: switch the share link to a direct file link
  if (/dropbox\.com/.test(link)) {
    const direct = link.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace(/[?&]dl=0/, '');
    return { kind: 'video', url: direct };
  }
  // Canva: a "view" link can be embedded
  const canva = link.match(/canva\.com\/design\/([\w-]+)\/([\w-]+)/);
  if (canva) return { kind: 'embed', url: `https://www.canva.com/design/${canva[1]}/${canva[2]}/view?embed` };
  // Anything else opens in a new tab
  return { kind: 'link', url: link };
};

// Reads the text out of a Notion text or title property
const getText = (prop) => {
  if (!prop) return '';
  const parts = prop.rich_text || prop.title || [];
  return parts.map((p) => p.plain_text).join('');
};

const pickText = (props, names) => {
  for (const name of names) {
    const text = getText(props[name]);
    if (text) return text;
  }
  return '';
};

const isVideoUrl = (url) => /\.(mp4|mov|webm|m4v)(\?|$)/i.test(url || '');

export async function getServerSideProps() {
  // Client bio. Set these per client in Vercel: Project, Settings,
  // Environment Variables. Then redeploy so the change shows.
  const profile = {
    username: process.env.IG_USERNAME || process.env.NEXT_PUBLIC_IG_USERNAME || 'rusesocials',
    name: process.env.IG_NAME || '',
    category: process.env.IG_CATEGORY || '',
    // Type \n in the value wherever you want a new line in the bio
    bio: (process.env.IG_BIO || '').replace(/\\n/g, '\n'),
    link: process.env.IG_LINK || '',
    avatar: process.env.IG_AVATAR_URL || '',
    followers: process.env.IG_FOLLOWERS || '',
    following: process.env.IG_FOLLOWING || '',
  };

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
        const media = files
          .map((f) => f?.file?.url || f?.external?.url || '')
          .filter(Boolean)
          .map((url) => ({ url, video: isVideoUrl(url) }));
        if (!media.length && props['Image URL']?.url) {
          media.push({ url: props['Image URL'].url, video: isVideoUrl(props['Image URL'].url) });
        }
        // Grid thumbnail: the Cover column if it has a file, otherwise the first image
        const cover = pickFiles(props, COVER_COLUMNS)[0] || '';
        const firstImage = media.find((m) => !m.video);
        const imageUrl = cover || firstImage?.url || '';

        // Reel video sent as a link instead of an upload
        const videoLink = pickUrl(props, VIDEO_LINK_COLUMNS);

        // Determine if carousel
        const contentType = props['Content Type']?.select?.name || 'Post';
        const isCarousel = contentType === 'Carousel' || (contentType !== 'Reel' && files.length > 1);

        const statusProp = props['Status'];

        return {
          id: page.id,
          title: props.Name?.title?.[0]?.plain_text || 'Untitled',
          contentType,
          isCarousel,
          imageUrl,
          media,
          videoLink,
          caption: pickText(props, CAPTION_COLUMNS),
          audio: pickText(props, AUDIO_COLUMNS),
          status: statusProp?.status?.name || statusProp?.select?.name || '',
        };
      });

    return { props: { posts, profile } };
  } catch (error) {
    return { props: { posts: [], profile } };
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

// Icons for the post preview
const Svg = ({ size = 24, fill = 'none', children }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={fill}
    stroke={fill === 'none' ? 'currentColor' : 'none'}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);
const HeartIcon = (p) => <Svg {...p}><path d="M12 20s-7-4.4-9-9a5 5 0 0 1 9-4 5 5 0 0 1 9 4c-2 4.6-9 9-9 9Z" /></Svg>;
const CommentIcon = (p) => <Svg {...p}><path d="M20.7 16.5A9 9 0 1 0 17 20l4 1-.3-4.5Z" /></Svg>;
const SendIcon = (p) => <Svg {...p}><path d="M22 3 9.2 10.1M22 3l-7 18-5.8-10.9L2 7l20-4Z" /></Svg>;
const SaveIcon = (p) => <Svg {...p}><path d="M20 21l-8-7-8 7V3h16v18Z" /></Svg>;
const MoreIcon = (p) => (
  <Svg {...p} fill="currentColor">
    <circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" />
  </Svg>
);
const MusicIcon = (p) => (
  <Svg {...p} fill="currentColor">
    <path d="M9 6l11-2v12h-2V7.4L11 8.7V18H9Z" /><circle cx="6" cy="18" r="3" /><circle cx="17" cy="16" r="3" />
  </Svg>
);
const ChevronLeft = (p) => <Svg {...p}><path d="m15 5-7 7 7 7" /></Svg>;
const ChevronRight = (p) => <Svg {...p}><path d="m9 5 7 7-7 7" /></Svg>;
const CloseIcon = (p) => <Svg {...p}><path d="M6 6l12 12M18 6 6 18" /></Svg>;

// White icon with a soft shadow, placed in the tile's top right corner
const badgeStyle = {
  position: 'absolute',
  top: '8px',
  right: '8px',
  color: '#fff',
  display: 'flex',
  filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.55))',
};

// Status colours for the pill above the preview
const STATUS_COLOURS = {
  'awaiting approval': '#fde8b0',
  scheduled: '#d6e8f7',
  posted: '#dcefd0',
};

const Avatar = ({ profile, size }) =>
  profile.avatar ? (
    <img
      src={profile.avatar}
      alt=""
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flex: 'none' }}
    />
  ) : (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: '#dbdbdb',
        flex: 'none',
      }}
    />
  );

// Makes hashtags and @mentions blue, like Instagram
const Caption = ({ text, color = '#00376b' }) =>
  text.split(/([#@][\w.]+)/g).map((part, i) =>
    /^[#@][\w.]+$/.test(part) ? (
      <span key={i} style={{ color }}>{part}</span>
    ) : (
      <span key={i}>{part}</span>
    )
  );

const Media = ({ item, title, cover }) =>
  item.video ? (
    <video
      src={item.url}
      poster={cover || undefined}
      autoPlay
      muted
      loop
      playsInline
      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
    />
  ) : (
    <img
      src={item.url}
      alt={title}
      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
    />
  );

const Placeholder = ({ title, dark }) => (
  <div
    style={{
      width: '100%',
      height: '100%',
      display: 'grid',
      placeItems: 'center',
      background: dark ? '#222' : '#f0f0f0',
      color: dark ? '#aaa' : '#666',
      fontSize: '13px',
      padding: '20px',
      textAlign: 'center',
    }}
  >
    {title}
  </div>
);

// What a feed post or carousel looks like inside the Instagram app
function FeedView({ post, profile, slide, setSlide, trackRef }) {
  const [expanded, setExpanded] = useState(false);
  const slides = post.media.length ? post.media : [null];
  const count = slides.length;
  const caption = post.caption || '';
  const firstLine = caption.split('\n')[0];
  const isLong = caption.length > 90 || caption.includes('\n');

  const goTo = (i) => {
    const el = trackRef.current;
    if (!el) return;
    const k = Math.max(0, Math.min(count - 1, i));
    el.scrollTo({ left: k * el.clientWidth, behavior: 'smooth' });
  };

  const arrowStyle = (side) => ({
    position: 'absolute',
    top: '50%',
    [side]: '8px',
    transform: 'translateY(-50%)',
    width: '30px',
    height: '30px',
    borderRadius: '50%',
    border: 'none',
    background: 'rgba(255,255,255,0.85)',
    color: '#111',
    display: 'grid',
    placeItems: 'center',
    cursor: 'pointer',
  });

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: '#fff', color: '#111', fontSize: '14px' }}>
      {/* Post header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px' }}>
        <Avatar profile={profile} size={32} />
        <span style={{ fontWeight: 600 }}>{profile.username}</span>
        <span style={{ marginLeft: 'auto', display: 'flex' }}><MoreIcon /></span>
      </div>

      {/* Media: Instagram shows feed posts at 4:5 */}
      <div style={{ position: 'relative', aspectRatio: '4 / 5', background: '#000' }}>
        <div
          ref={trackRef}
          className="ig-track"
          onScroll={(e) => setSlide(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
          style={{ display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory', height: '100%' }}
        >
          {slides.map((item, i) => (
            <div key={i} style={{ flex: '0 0 100%', scrollSnapAlign: 'start', height: '100%' }}>
              {item ? <Media item={item} title={post.title} /> : <Placeholder title={post.title} />}
            </div>
          ))}
        </div>
        {count > 1 && (
          <>
            <span
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                background: 'rgba(18,18,18,0.7)',
                color: '#fff',
                fontSize: '12px',
                padding: '3px 9px',
                borderRadius: '99px',
              }}
            >
              {slide + 1}/{count}
            </span>
            {slide > 0 && (
              <button style={arrowStyle('left')} onClick={() => goTo(slide - 1)} aria-label="Previous slide">
                <ChevronLeft size={18} />
              </button>
            )}
            {slide < count - 1 && (
              <button style={arrowStyle('right')} onClick={() => goTo(slide + 1)} aria-label="Next slide">
                <ChevronRight size={18} />
              </button>
            )}
          </>
        )}
      </div>

      {/* Action row */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '14px', padding: '10px 12px 4px' }}>
        <HeartIcon /><CommentIcon /><SendIcon />
        {count > 1 && (
          <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '4px' }}>
            {slides.map((_, i) => (
              <span
                key={i}
                style={{ width: '6px', height: '6px', borderRadius: '50%', background: i === slide ? '#0095f6' : '#dbdbdb' }}
              />
            ))}
          </div>
        )}
        <span style={{ marginLeft: 'auto', display: 'flex' }}><SaveIcon /></span>
      </div>

      {/* Caption */}
      <div style={{ padding: '4px 12px', whiteSpace: 'pre-line', lineHeight: 1.45 }}>
        <span style={{ fontWeight: 600, marginRight: '4px' }}>{profile.username}</span>
        {!caption ? (
          <span style={{ color: '#8e8e8e' }}>No caption yet</span>
        ) : expanded || !isLong ? (
          <Caption text={caption} />
        ) : (
          <>
            <Caption text={firstLine.slice(0, 90)} />
            {'... '}
            <button
              onClick={() => setExpanded(true)}
              style={{ border: 'none', background: 'none', color: '#8e8e8e', padding: 0, cursor: 'pointer', font: 'inherit' }}
            >
              more
            </button>
          </>
        )}
      </div>
      <div style={{ padding: '2px 12px', color: '#8e8e8e' }}>View all comments</div>
      <div style={{ padding: '6px 12px 20px', color: '#8e8e8e', fontSize: '12px' }}>Preview</div>
    </div>
  );
}

// What a reel looks like in the Reels viewer
function ReelView({ post, profile }) {
  // Which video to play, in order: an uploaded video file, then the Reel Link,
  // then fall back to the cover or first image.
  const uploaded = post.media.find((m) => m.video);
  const linked = uploaded ? null : playableFromLink(post.videoLink);
  const image = post.imageUrl ? { url: post.imageUrl, video: false } : post.media[0];
  const firstLine = (post.caption || '').split('\n')[0];

  let player;
  if (uploaded) {
    player = <Media item={uploaded} title={post.title} cover={post.imageUrl} />;
  } else if (linked?.kind === 'video') {
    player = <Media item={{ url: linked.url, video: true }} title={post.title} cover={post.imageUrl} />;
  } else if (linked?.kind === 'embed') {
    player = (
      <iframe
        src={linked.url}
        title={post.title}
        allow="autoplay; fullscreen"
        allowFullScreen
        style={{ width: '100%', height: '100%', border: 0, display: 'block' }}
      />
    );
  } else if (image) {
    player = <Media item={image} title={post.title} />;
  } else {
    player = <Placeholder title={post.title} dark />;
  }
  const embedded = linked?.kind === 'embed';

  return (
    <div style={{ position: 'relative', flex: 1, background: '#000', color: '#fff', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0 }}>{player}</div>

      {/* A link we can't play inside the page gets a button to open it */}
      {linked?.kind === 'link' && (
        <a
          href={linked.url}
          target="_blank"
          rel="noreferrer"
          style={{
            position: 'absolute',
            top: '45%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(0,0,0,0.6)',
            color: '#fff',
            padding: '12px 20px',
            borderRadius: '99px',
            fontWeight: 600,
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <ReelIcon size={18} /> Watch reel
        </a>
      )}

      {/* Instagram style overlay. Clicks pass through it to the player and the Watch reel button */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: embedded ? 0.9 : 1 }}>
      <div style={{ position: 'absolute', inset: 'auto 0 0 0', height: '45%', background: 'linear-gradient(transparent, rgba(0,0,0,0.75))' }} />
      <div style={{ position: 'absolute', top: '16px', left: '16px', fontWeight: 600, fontSize: '18px' }}>Reels</div>

      {/* Right side icons */}
      <div style={{ position: 'absolute', right: '12px', bottom: '90px', display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>
        <HeartIcon size={28} /><CommentIcon size={28} /><SendIcon size={28} /><MoreIcon size={28} />
      </div>

      {/* Account, caption and audio */}
      <div style={{ position: 'absolute', left: '14px', right: '70px', bottom: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
          <Avatar profile={profile} size={32} />
          {profile.username}
          <span style={{ border: '1px solid rgba(255,255,255,0.7)', borderRadius: '8px', padding: '3px 10px', fontSize: '12px' }}>Follow</span>
        </div>
        {firstLine && (
          <div style={{ fontSize: '13px' }}>
            <Caption text={firstLine.length > 80 ? firstLine.slice(0, 80) + '...' : firstLine} color="#fff" />
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
          <MusicIcon size={14} />
          <span>{profile.username} · {post.audio || 'Original audio'}</span>
        </div>
      </div>
      </div>
    </div>
  );
}

// The pop up that opens when you click a tile
function PostPreview({ posts, index, profile, onClose, onNav }) {
  const post = posts[index];
  const [slide, setSlide] = useState(0);
  const trackRef = useRef(null);
  const closeRef = useRef(null);
  const isReel = post.contentType === 'Reel' && !post.isCarousel;
  const slideCount = post.media.length;

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  // Keyboard: Esc closes. Arrows flip carousel slides first, then move to the next post.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const dir = e.key === 'ArrowRight' ? 1 : -1;
      const el = trackRef.current;
      const next = slide + dir;
      if (!isReel && el && next >= 0 && next < slideCount) {
        el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' });
      } else {
        onNav(index + dir);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [slide, index, isReel, slideCount, onClose, onNav]);

  const navBtn = (disabled) => ({
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    border: 'none',
    background: 'rgba(255,255,255,0.92)',
    color: '#111',
    display: 'grid',
    placeItems: 'center',
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.3 : 1,
    flex: 'none',
  });
  const status = (post.status || '').toLowerCase();

  return (
    <div
      className="ig-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`Preview of ${post.title}`}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <button className="ig-side" style={navBtn(index === 0)} disabled={index === 0} onClick={() => onNav(index - 1)} aria-label="Previous post">
        <ChevronLeft size={20} />
      </button>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', maxHeight: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontSize: '13px', flexWrap: 'wrap', justifyContent: 'center' }}>
          {post.status && (
            <span style={{ padding: '4px 10px', borderRadius: '99px', background: STATUS_COLOURS[status] || '#fff', color: '#111', fontWeight: 500 }}>
              {post.status}
            </span>
          )}
          <span>{post.title}</span>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Close preview"
            style={{ ...navBtn(false), background: 'rgba(255,255,255,0.15)', color: '#fff', width: '40px', height: '40px' }}
          >
            <CloseIcon size={20} />
          </button>
        </div>

        <div className="ig-phone" key={post.id}>
          {isReel ? (
            <ReelView post={post} profile={profile} />
          ) : (
            <FeedView post={post} profile={profile} slide={slide} setSlide={setSlide} trackRef={trackRef} />
          )}
        </div>

        {/* On phones the side arrows are hidden, so show them under the preview */}
        <div className="ig-bottom-nav">
          <button style={navBtn(index === 0)} disabled={index === 0} onClick={() => onNav(index - 1)} aria-label="Previous post">
            <ChevronLeft size={20} />
          </button>
          <button style={navBtn(index === posts.length - 1)} disabled={index === posts.length - 1} onClick={() => onNav(index + 1)} aria-label="Next post">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <button className="ig-side" style={navBtn(index === posts.length - 1)} disabled={index === posts.length - 1} onClick={() => onNav(index + 1)} aria-label="Next post">
        <ChevronRight size={20} />
      </button>
    </div>
  );
}

// Styles that need class names (overlay layout, phone frame, mobile layout)
const previewCss = `
.ig-overlay{position:fixed;inset:0;z-index:50;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;gap:16px;padding:16px}
.ig-phone{width:min(390px,calc(100vw - 32px));height:min(780px,calc(100vh - 80px));border-radius:32px;overflow:hidden;display:flex;flex-direction:column;background:#fff;box-shadow:0 0 0 10px #111,0 30px 80px rgba(0,0,0,.5)}
.ig-track{scrollbar-width:none}
.ig-track::-webkit-scrollbar{display:none}
.ig-bottom-nav{display:none;gap:12px}
.ig-tile{cursor:pointer}
.ig-tile:hover img{filter:brightness(.85)}
.ig-tile:focus-visible{outline:2px solid #0095f6;outline-offset:-2px}
@media (max-width:600px){
  .ig-overlay{padding:8px 0;gap:0}
  .ig-side{display:none!important}
  .ig-phone{width:100vw;height:calc(100vh - 120px);border-radius:0;box-shadow:none}
  .ig-bottom-nav{display:flex}
}
`;

export default function Home({ posts, profile }) {
  const [activeTab, setActiveTab] = useState('grid');
  const [openIndex, setOpenIndex] = useState(null);
  const username = profile.username;

  // Filter posts based on active tab
  const displayedPosts = posts.filter((post) => {
    if (activeTab === 'reels') return post.contentType === 'Reel';
    if (activeTab === 'carousels') return post.isCarousel;
    return true; // 'grid' shows all
  });

  // Stop the page behind the preview from scrolling
  useEffect(() => {
    document.body.style.overflow = openIndex === null ? '' : 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [openIndex]);

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

  const switchTab = (name) => {
    setOpenIndex(null);
    setActiveTab(name);
  };

  const stat = (value, label) =>
    value !== '' && value !== undefined ? (
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontWeight: 600, fontSize: '16px' }}>{value}</div>
        <div style={{ fontSize: '13px', color: '#737373' }}>{label}</div>
      </div>
    ) : null;

  return (
    <div
      style={{
        maxWidth: '600px',
        margin: '0 auto',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      }}
    >
      <style>{previewCss}</style>

      {/* Profile header with the client's bio */}
      <header style={{ padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <Avatar profile={profile} size={80} />
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: '18px', fontWeight: '600', margin: '0 0 10px' }}>{username}</h2>
            <div style={{ display: 'flex', justifyContent: 'space-around', gap: '8px' }}>
              {stat(posts.length, 'posts')}
              {stat(profile.followers, 'followers')}
              {stat(profile.following, 'following')}
            </div>
          </div>
        </div>

        <div style={{ marginTop: '12px', fontSize: '14px', lineHeight: 1.4 }}>
          {profile.name && <div style={{ fontWeight: 600 }}>{profile.name}</div>}
          {profile.category && <div style={{ color: '#737373' }}>{profile.category}</div>}
          {profile.bio && <div style={{ whiteSpace: 'pre-line' }}>{profile.bio}</div>}
          {profile.link && (
            <a
              href={profile.link.startsWith('http') ? profile.link : `https://${profile.link}`}
              target="_blank"
              rel="noreferrer"
              style={{ color: '#00376b', fontWeight: 600, textDecoration: 'none' }}
            >
              {profile.link.replace(/^https?:\/\//, '')}
            </a>
          )}
        </div>
      </header>

      {/* IG Tab Navigation Bar */}
      <div style={{ display: 'flex', borderTop: '1px solid #dbdbdb' }}>
        <button onClick={() => switchTab('grid')} style={tabStyle('grid')} aria-label="Grid">
          <GridIcon size={22} />
        </button>
        <button onClick={() => switchTab('reels')} style={tabStyle('reels')} aria-label="Reels">
          <ReelIcon size={22} />
        </button>
        <button
          onClick={() => switchTab('carousels')}
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
        {displayedPosts.map((post, i) => (
          <div
            key={post.id}
            className="ig-tile"
            role="button"
            tabIndex={0}
            aria-label={`Preview ${post.title}`}
            onClick={() => setOpenIndex(i)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setOpenIndex(i);
              }
            }}
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

      {openIndex !== null && displayedPosts[openIndex] && (
        <PostPreview
          key={displayedPosts[openIndex].id}
          posts={displayedPosts}
          index={openIndex}
          profile={profile}
          onClose={() => setOpenIndex(null)}
          onNav={(i) => {
            if (i >= 0 && i < displayedPosts.length) setOpenIndex(i);
          }}
        />
      )}
    </div>
  );
}
