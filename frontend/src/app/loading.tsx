export default function Loading() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="h-8 w-8 rounded-full border-[3px] border-[var(--primary-surface)] border-t-[var(--primary-main)] animate-spin" />
    </div>
  );
}
