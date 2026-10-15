import { ImageResponse } from "next/og";
export function GET(request: Request) {
  const size =
    new URL(request.url).searchParams.get("size") === "512" ? 512 : 192;
  return new ImageResponse(
    <div
      style={{
        background: "#182234",
        color: "white",
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.42,
        fontWeight: 700,
      }}
    >
      PH
    </div>,
    { width: size, height: size },
  );
}
