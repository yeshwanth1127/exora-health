type TextLinkStyles={className:string};
export type TextLinkData = {
  href: string;
  label: string;
};
/** A text link. */
export default function TextLink({ d, styles }: { d: TextLinkData; styles: TextLinkStyles }) {
  return (
    <a className={styles.className} data-component="button" href={d.href} target="_self">
      {d.label}
    </a>
  );
}
