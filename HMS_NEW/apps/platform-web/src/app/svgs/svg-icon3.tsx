export default function Icon3({ dittoId }: { dittoId?: string }) {
  return (
    <svg className="w-auto h-full block min-w-0 shrink-0 overflow-hidden max-lg:h-5.5" viewBox="0 0 30 30" fill="currentColor" data-ditto-id={dittoId}>
      <path d="M2,4v2h26V4H2z M2,16h26v-2H2V16z M2,26h26v-2H2V26z" />
    </svg>
  );
}
