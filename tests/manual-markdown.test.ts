import assert from "node:assert/strict";
import test from "node:test";
import { parseManual } from "../src/lib/manual-markdown.ts";

test("le manuel conserve titres, listes, gras et lien interne", () => {
  const blocks = parseManual(`# Manuel

Un **prix** se calcule dans [Ventes](/ventes).

## Accueil

- Rester dans « À classer »
- Ne pas créer de projet

\`\`\`
npm run dev
\`\`\`
`);

  assert.equal(blocks[0]?.type, "heading");
  assert.equal(blocks[1]?.type, "paragraph");
  if (blocks[1]?.type === "paragraph") {
    assert.deepEqual(
      blocks[1].inlines.map((inline) => inline.type),
      ["text", "strong", "text", "link", "text"],
    );
    const link = blocks[1].inlines[3];
    assert.equal(link?.type, "link");
    if (link?.type === "link") {
      assert.equal(link.href, "/ventes");
    }
  }
  assert.equal(blocks[2]?.type, "heading");
  assert.equal(blocks[3]?.type, "list");
  if (blocks[3]?.type === "list") {
    assert.equal(blocks[3].items.length, 2);
  }
  assert.equal(blocks[4]?.type, "code");
});

test("un lien externe n’est pas rendu comme lien", () => {
  const blocks = parseManual("Voir [spec](https://example.com).");
  assert.equal(blocks[0]?.type, "paragraph");
  if (blocks[0]?.type === "paragraph") {
    assert.equal(blocks[0].inlines[1]?.type, "text");
  }
});
