import type { ValidationIssue } from "@/domain/scheduling";

export function ValidationPanel({ issues }: { readonly issues: readonly ValidationIssue[] }) {
  if (issues.length === 0) {
    return (
      <div className="validation-ok" role="status">
        <span>✓</span>
        <div><strong>Ciclo válido</strong><small>Todos los invariantes se cumplen.</small></div>
      </div>
    );
  }
  return (
    <div className="validation-list" aria-live="polite">
      {issues.map((issue, index) => (
        <article className={issue.severity.toLowerCase()} key={`${issue.code}-${index}`}>
          <span>{issue.severity === "ERROR" ? "!" : "i"}</span>
          <div>
            <strong>{issue.code.replaceAll("_", " ")}</strong>
            <p>{issue.message}</p>
          </div>
        </article>
      ))}
    </div>
  );
}
