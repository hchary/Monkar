import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { RARITIES } from "./creator/TalentsManager";

function useRegionSightings(regionId) {
  const [sightings, setSightings] = useState([]);
  useEffect(() => {
    if (!regionId) {
      setSightings([]);
      return undefined;
    }
    return onSnapshot(collection(db, "worldData", "regions", "items", regionId, "rumorSightings"), (snap) => {
      setSightings(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, [regionId]);
  return sightings;
}

function useRumors() {
  const [rumors, setRumors] = useState([]);
  useEffect(() => {
    return onSnapshot(collection(db, "worldData", "rumors", "items"), (snap) => {
      setRumors(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);
  return rumors;
}

// A flat floor on the shared 8-tier scale, not scaled to whatever the rumor is about - per
// docs/TODO.md "Rumor and mission system" 's "Rumor banner" bullet.
const CALLOUT_RARITY_INDEX = RARITIES.findIndex((r) => r.value === "rare");

// The scrolling rumor banner at the bottom of the screen, above ClimateBanner: the character's
// current region's worldData/regions/items/{regionId}/rumorSightings, joined against the
// worldData/rumors/items catalog for their text. Every sighting scrolls through; one at or above
// "rare" is additionally styled as called out.
export default function RumorBanner({ regionId }) {
  const sightings = useRegionSightings(regionId);
  const rumors = useRumors();

  const entries = sightings
    .map((sighting) => {
      const rumor = rumors.find((r) => r.id === sighting.id);
      if (!rumor) return null; // content gap - a sighting whose catalog entry was deleted
      return { id: sighting.id, text: rumor.text, rarity: sighting.rarity };
    })
    .filter(Boolean);

  if (entries.length === 0) return null;

  return (
    <div className="rumor-banner">
      {entries.map((entry) => {
        const calledOut = RARITIES.findIndex((r) => r.value === entry.rarity) >= CALLOUT_RARITY_INDEX;
        return (
          <span key={entry.id} className={`rumor-entry${calledOut ? " rumor-called-out" : ""}`}>
            {entry.text}
          </span>
        );
      })}
    </div>
  );
}
