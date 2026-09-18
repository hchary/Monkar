import useOwnCharacter from "../hooks/useOwnCharacter";

// Placeholder standing in for the character screen while the game is redesigned. It renders the
// raw `characters/{id}` document - the one game component that survived the reset - so the shell
// stays runnable and the player definition stays visible. Everything that used to live here
// (banner, tabs, action panel, creation form) was removed with the old direction.
export default function CharacterProfile() {
  const { character, checked } = useOwnCharacter();

  if (!checked) return <p>Chargement du personnage...</p>;
  if (!character) return <p>Aucun personnage. La creation de personnage est a refaire.</p>;

  return (
    <div className="character-page">
      <h1>{character.name}</h1>
      <pre>{JSON.stringify(character, null, 2)}</pre>
    </div>
  );
}
