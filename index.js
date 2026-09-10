import { getGridPosts } from "../lib/notion";

export async function getServerSideProps() {
  try {
    const posts = await getGridPosts();
    return { props: { posts, error: null } };
  } catch (err) {
    return { props: { posts: [], error: err.message } };
  }
}

export default function Grid({ posts, error }) {
  const username = process.env.NEXT_PUBLIC_IG_USERNAME || "@yourbrand";

  if (error) {
    return (
      <div style={styles.page}>
        <p style={{ color: "#c0392b", fontFamily: "sans-serif" }}>
          Couldn't load the grid: {error}
        </p>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div style={styles.avatar} />
        <span style={styles.username}>{username}</span>
      </div>

      {posts.length === 0 ? (
        <p style={{ fontFamily: "sans-serif", color: "#888", padding: "24px" }}>
          No posts yet — add rows with an image to your Notion database.
        </p>
      ) : (
        <div style={styles.grid}>
          {posts.map((post) => (
            <div key={post.id} style={styles.tile}>
              <img src={post.image} alt={post.caption} style={styles.tileImg} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  page: {
    maxWidth: 470,
    margin: "0 auto",
    background: "#fff",
    fontFamily: "-apple-system, sans-serif",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "14px 12px",
    borderBottom: "1px solid #eee",
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: "50%",
    background: "#ddd",
  },
  username: { fontWeight: 600, fontSize: 14 },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 2,
  },
  tile: {
    position: "relative",
    width: "100%",
    aspectRatio: "1 / 1",
    overflow: "hidden",
    background: "#f2f2f2",
  },
  tileImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
};
