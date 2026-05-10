/**
 * Top-left context for action rows: SimC list name + source line (find-in-editor).
 */
export function ActionPlacementEyebrow({
  actionListName,
  sourceLineNumber,
}: {
  actionListName: string;
  sourceLineNumber: number;
}) {
  const hint = `${actionListName}, line ${String(sourceLineNumber)}`;
  return (
    <div className="lc-node-eyebrow lc-node-eyebrow--placement" title={hint}>
      <span className="lc-node-eyebrow__list">{actionListName}</span>
      <span aria-hidden className="lc-node-eyebrow__sep">
        ·
      </span>
      <span className="lc-node-eyebrow__line">L{sourceLineNumber}</span>
    </div>
  );
}
