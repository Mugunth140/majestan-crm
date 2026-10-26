import { apiJson } from "./api-fetch";
export type BlogPost = {
  id?: number;
  revision?: number;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  author_name: string;
  category: string;
  cover_image: string;
  cover_alt: string;
  meta_title: string;
  meta_description: string;
  social_image: string;
  noindex: boolean;
  status: "draft" | "published";
  published_at: string | null;
};
export const emptyPost = (): BlogPost => ({
  title: "",
  slug: "",
  excerpt: "",
  content: "",
  author_name: "Majestan Realty",
  category: "Property insights",
  cover_image: "",
  cover_alt: "",
  meta_title: "",
  meta_description: "",
  social_image: "",
  noindex: false,
  status: "draft",
  published_at: null,
});
const base = `${process.env.NEXT_PUBLIC_API_URL || "/api/v1"}/blog`;
async function call<T>(path: string, init?: RequestInit): Promise<T> {
  return (await apiJson<{ data: T }>(base + path, init)).data;
}
export const blogApi = {
  upload: (file: File) => {
    const form = new FormData();
    form.append("image", file);
    return call<{ url: string }>("/image", { method: "POST", body: form });
  },
  list: (page = 1) =>
    call<{ items: BlogPost[]; total: number }>(`?page=${page}`),
  get: (id: number) => call<BlogPost>(`/${id}`),
  save: (post: BlogPost) => {
    const {
      id,
      title,
      excerpt,
      content,
      category,
      cover_image,
      cover_alt,
      status,
      revision,
    } = post;
    const fields = {
      title,
      excerpt,
      content,
      category,
      cover_image,
      cover_alt,
      status,
      revision,
    };
    return call<BlogPost>(id ? `/${id}` : "", {
      method: id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
  },
  remove: (post: BlogPost) =>
    call(`/${post.id}?revision=${post.revision}`, { method: "DELETE" }),
};
