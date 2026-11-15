import { lazy, Suspense, useState } from "react";
import { invitedRoom, rememberedRoom } from "./multiplayer/useRoom";
import type { RoomIntent } from "./multiplayer/RoomLobby";
import { PracticeApp } from "./PracticeApp";

// Multiplayer code loads only when someone opens a room.
const OnlineApp = lazy(() =>
  import("./multiplayer/OnlineApp").then((m) => ({ default: m.OnlineApp })),
);

/** Opens straight into a room for invite links and reloads; otherwise the
 * start screen (part of PracticeApp) offers solo play, create or join. */
export default function App() {
  const [online, setOnline] = useState<RoomIntent | null>(() =>
    invitedRoom() || rememberedRoom() ? "join" : null,
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
      <OnlineApp intent={online} onBack={() => setOnline(null)} />
    </Suspense>
  ) : (
    <PracticeApp onOnline={setOnline} />
  );
}
