import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pass & Play Poker",
    short_name: "P&P Poker",
    description: "1台のスマホを手渡しして遊ぶオフラインのテキサスホールデム",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#18181b",
    theme_color: "#059669",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
