import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Aventus Realtors CRM",
    short_name: "Aventus",
    description: "Leads, follow ups and deals for Aventus Realtors",
    start_url: "/today",
    display: "standalone",
    background_color: "#f7f8fa",
    theme_color: "#1e40af",
    orientation: "portrait",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
