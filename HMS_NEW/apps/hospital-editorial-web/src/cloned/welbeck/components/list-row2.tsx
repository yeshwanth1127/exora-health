export type ListRow2Data = {
  href: string;
  label: string;
};
/** A list row. */
export default function ListRow2({ d }: { d: ListRow2Data }) {
  return (
    <li className="list-item-3 flow-2">
      <a className="link-10 row-4" href={d.href}>
        {d.label}
      </a>
    </li>
  );
}
