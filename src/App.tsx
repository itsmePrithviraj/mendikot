import { lazy, Suspense, useState } from "react";
import { invitedRoom, rememberedRoom } from "./multiplayer/useRoom";
import { PracticeApp } from "./PracticeApp";

// Multiplayer code loads only when someone opens a room.
const OnlineApp = lazy(() =>
  import("./multiplayer/OnlineApp").then((m) => ({ default: m.OnlineApp })),
);

/** Opens straight into a room for invite links and reloads; otherwise practice. */
export default function App() {
  const [online, setOnline] = useState(
    () => !!invitedRoom() || !!rememberedRoom(),
  );
  return online ? (
    <Suspense
      fallback={
        <div className="app">
          <p className="loading-game" role="status">
            Opening the table…
          </p>
        </div>
      }
    >
      <OnlineApp onBack={() => setOnline(false)} />
    </Suspense>
  ) : (
    <PracticeApp onOnline={() => setOnline(true)} />
  );
}
