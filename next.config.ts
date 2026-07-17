import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  // 開発中はSWのキャッシュがデバッグを阻害するため無効化。本番ビルドでのみ生成する
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  // workspace パッケージ(TSソースのまま参照)をビルド対象に含める
  transpilePackages: ["@pass-and-play/core"],
};

export default withSerwist(nextConfig);
