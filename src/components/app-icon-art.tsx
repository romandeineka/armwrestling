// Малюнок іконки для ImageResponse: темний фон сайту і «PR» (personal record) кольором акценту.
// Напис займає центр, щоб Android міг обрізати іконку в коло чи квадрат і нічого не зрізати.
export function AppIconArt({ size }: { size: number }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#12100e",
        color: "#e15a3a",
        fontSize: size * 0.38,
        fontWeight: 800,
        letterSpacing: -size * 0.01,
      }}
    >
      PR
    </div>
  );
}
