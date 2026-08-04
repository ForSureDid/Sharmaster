import type { MetadataRoute } from "next";

const BASE_URL = "https://www.sharmaster.kz";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api/", "/account", "/cart", "/liked", "/order", "/login", "/register"],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
