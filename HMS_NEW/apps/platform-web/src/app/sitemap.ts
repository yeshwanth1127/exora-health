import { posts } from "./blog/posts";
import type { MetadataRoute } from "next";
import { SITE_ORIGIN } from "../lib/site";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
  {url:SITE_ORIGIN+"/blog",changeFrequency:"monthly",priority:0.6},
  ...posts.map(p=>({url:SITE_ORIGIN+"/blog/"+p.slug,changeFrequency:"monthly" as const,priority:0.5})),
  {
    url: SITE_ORIGIN + "/",
    changeFrequency: "weekly",
    priority: 1,
  },
  {
    url: SITE_ORIGIN + "/product/features",
    changeFrequency: "weekly",
    priority: 0.7,
  },
  {
    url: SITE_ORIGIN + "/pricing",
    changeFrequency: "weekly",
    priority: 0.7,
  },
  {
    url: SITE_ORIGIN + "/teams",
    changeFrequency: "weekly",
    priority: 0.7,
  },
  {
    url: SITE_ORIGIN + "/enterprise",
    changeFrequency: "weekly",
    priority: 0.7,
  },
  {
    url: SITE_ORIGIN + "/contact-sales",
    changeFrequency: "weekly",
    priority: 0.7,
  },
  {url:SITE_ORIGIN+"/releases",changeFrequency:"monthly",priority:0.6},
  {url:SITE_ORIGIN+"/help",changeFrequency:"monthly",priority:0.6},
  ];
}
