import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Febo AI CRM",
    short_name: "Febo AI",
    description: "Inbox interno de FEBECOS para WhatsApp y ventas.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f6f3",
    theme_color: "#1d7a52",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml"
      }
    ]
  };
}
