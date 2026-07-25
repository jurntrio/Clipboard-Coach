export function AddPlayerTile({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className="flex flex-col items-center justify-center gap-1.5 bg-transparent border-2 border-dashed border-border rounded-lg pt-3.5 px-2.5 pb-2.5 hover:border-accent hover:bg-cardAlt transition"
    >
      <span className="text-2xl leading-none text-borderButton">+</span>
      <span className="text-xs text-textMuted">{label}</span>
    </button>
  );
}
