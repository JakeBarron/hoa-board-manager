import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // sanitize-html (used server-side to clean stored minutes HTML) depends on
  // htmlparser2 v12, which ships ESM only. Listing it here is also what lets
  // next/jest transform it — next/jest hardcodes `/node_modules/` into
  // transformIgnorePatterns and derives its exceptions from transpilePackages,
  // so a custom transformIgnorePatterns entry cannot un-ignore it.
  transpilePackages: [
    "sanitize-html",
    "htmlparser2",
    "domhandler",
    "domutils",
    "dom-serializer",
    "domelementtype",
    "entities",
  ],
};

export default nextConfig;
