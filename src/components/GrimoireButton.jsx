import { Link } from "react-router-dom";

export default function GrimoireButton() {
  return (
    <Link to="/xerotex" className="grimoire-button" title="Aller au Xerotex" aria-label="Aller au Xerotex">
      <svg className="grimoire-icon grimoire-closed" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M4 5 L4 19 L12 17.5 L20 19 L20 5 L12 6.5 Z" strokeLinejoin="round" />
        <line x1="12" y1="6.5" x2="12" y2="17.5" />
      </svg>
      <svg className="grimoire-icon grimoire-open" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path
          d="M12 6 C9 4.5 6 4.5 3 5.5 L3 18 C6 17 9 17 12 18.5 C15 17 18 17 21 18 L21 5.5 C18 4.5 15 4.5 12 6 Z"
          strokeLinejoin="round"
        />
        <line x1="12" y1="6" x2="12" y2="18.5" />
        <line x1="5" y1="8" x2="9.5" y2="8.7" />
        <line x1="5" y1="11" x2="9.5" y2="11.5" />
        <line x1="14.5" y1="8.7" x2="19" y2="8" />
        <line x1="14.5" y1="11.5" x2="19" y2="11" />
      </svg>
    </Link>
  );
}
