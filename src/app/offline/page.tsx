export const metadata = { title: "Offline" };

export default function Offline() {
  return (
    <div className="grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <h1 className="text-[18px] font-semibold">You are offline</h1>
        <p className="mt-1 text-[13px] text-muted">Your last My Day list is shown when available. Changes need a connection.</p>
      </div>
    </div>
  );
}
