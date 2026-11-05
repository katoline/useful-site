/** 解説記事（content/<lang>/<slug>.mdx）の slug。並びはガイドの一覧の順 */
export const GUIDE_SLUGS = ["qr-tips", "qr-uses"] as const;
export type GuideSlug = (typeof GUIDE_SLUGS)[number];
