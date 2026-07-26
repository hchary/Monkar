export default function CharacterBanner({ character }) {
  return (
    <div className="character-banner">
      <h1>{character.name}</h1>
      {character.title && <p className="title">{character.title}</p>}
      <ul className="banner-stats">
        <li>Réputation : {character.reputation}</li>
        {character.legendLevel != null && <li>Niveau de légende : {character.legendLevel}</li>}
        <li>Âge : {character.age}</li>
        <li>Métier : {character.profession}</li>
      </ul>
    </div>
  );
}
