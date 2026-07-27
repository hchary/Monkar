export const SUBJECT_TYPES = [
  { value: "groupe", label: "Groupe" },
  { value: "individuel", label: "Individuel" },
];

export function capitalizeSubject(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export default function NarrativeSubjectList({ subjects, onEdit, onDelete }) {
  return (
    <>
      {SUBJECT_TYPES.map((subjectType) => {
        const subjectsForType = subjects
          .filter((subject) => (subject.type || "groupe") === subjectType.value)
          .sort((a, b) => (a.nom || "").localeCompare(b.nom || "", "fr"));

        if (subjectsForType.length === 0) return null;

        return (
          <details key={subjectType.value} className="collapsible-group">
            <summary>
              {subjectType.label} ({subjectsForType.length})
            </summary>
            <ul className="creator-list">
              {subjectsForType.map((subject) => (
                <li key={subject.id}>
                  <strong>
                    {capitalizeSubject(subject.nom)} ({capitalizeSubject(subject.article)})
                  </strong>
                  <button type="button" onClick={() => onEdit(subject)}>
                    Modifier
                  </button>
                  <button type="button" onClick={() => onDelete(subject)}>
                    Supprimer
                  </button>
                </li>
              ))}
            </ul>
          </details>
        );
      })}
    </>
  );
}
