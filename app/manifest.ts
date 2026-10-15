import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Project Hub",
    short_name: "Project Hub",
    description: "Capture first. Organise later.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f7f8fb",
    theme_color: "#182234",
    icons: [
      {
        src: "/app-icon?size=192",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/app-icon?size=512",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Quick Capture",
        short_name: "Capture",
        url: "/capture",
        icons: [{ src: "/app-icon?size=192", sizes: "192x192" }],
      },
    ],
  };
}
