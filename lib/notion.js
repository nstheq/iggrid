const NOTION_VERSION = "2022-06-28";

// Pulls an image URL out of a Notion property, whatever shape it's in:
// - "Files & media" property (Notion-hosted upload)
// - "URL" property (external link, e.g. a Canva export link)
function extractImageUrl(prop) {
  if (!prop) return null;

  if (prop.type === "files" && prop.files.length > 0) {
    const file = prop.files[0];
    return file.type === "external" ? file.external.url : file.file.url;
  }

  if (prop.type === "url" && prop.url) {
    return prop.url;
  }

  return null;
}

function extractText(prop) {
  if (!prop) return "";
  if (prop.type === "title") return prop.title.map((t) => t.plain_text).join("");
  if (prop.type === "rich_text") return prop.rich_text.map((t) => t.plain_text).join("");
  return "";
}

function extractSelect(prop) {
  if (!prop || prop.type !== "select" || !prop.select) return null;
  return prop.select.name;
}

function extractNumber(prop) {
  if (!prop || prop.type !== "number") return null;
  return prop.number;
}

export async function getGridPosts() {
  const token = process.env.NOTION_TOKEN;
  const databaseId = process.env.NOTION_DATABASE_ID;

  if (!token || !databaseId) {
    throw new Error("Missing NOTION_TOKEN or NOTION_DATABASE_ID env vars");
  }

  const res = await fetch(
    `https://api.notion.com/v1/databases/${databaseId}/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
      },
      // Only pull posts marked Ready/Scheduled/Posted - tweak to match your Status options
      body: JSON.stringify({
        sorts: [{ property: "Order", direction: "ascending" }],
        filter: {
            property: "Status",
            select: { equals: "Scheduled"},
        },
      }),
      cache: "no-store",
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Notion API error ${res.status}: ${errText}`);
  }

  const data = await res.json();

  return data.results
    .map((page) => {
      const props = page.properties;
      return {
        id: page.id,
        caption: extractText(props["Name"]),
        image: extractImageUrl(props["Image"]) || extractImageUrl(props["Image URL"]),
        status: extractSelect(props["Status"]),
        order: extractNumber(props["Order"]),
      };
    })
    .filter((post) => post.image); // skip rows with no image yet
}
