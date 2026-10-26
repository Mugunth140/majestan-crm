import { describe, expect, it, vi } from "vitest";
vi.mock("./api-fetch", () => ({ apiJson: vi.fn(async () => ({ data: {} })) }));
import { apiJson } from "./api-fetch";
import { blogApi, emptyPost } from "./blog-api";
describe("Blog API", () => {
  it("sends only editable fields and revision when saving a server record", async () => {
    const record = {
      ...emptyPost(),
      id: 7,
      revision: 3,
      created_at: "2026-10-01",
      updated_at: "2026-10-02",
    };
    await blogApi.save(record);
    const [url, init] = vi.mocked(apiJson).mock.calls.at(-1)!;
    expect(url).toMatch(/\/blog\/7$/);
    expect(init?.method).toBe("PUT");
    const body = JSON.parse(String(init?.body));
    expect(body.revision).toBe(3);
    expect(body).not.toHaveProperty("id");
    expect(body).not.toHaveProperty("created_at");
    expect(body).not.toHaveProperty("updated_at");
    for (const key of [
      "slug",
      "meta_title",
      "meta_description",
      "social_image",
      "noindex",
      "author_name",
      "published_at",
    ])
      expect(body).not.toHaveProperty(key);
  });
});
