import type { CardStyles } from "../_styles";
import { cn } from "../lib/utils";
export type CardData = {
  href: string;
  imgSrc: string;
  label2: string;
  label3: string;
  title: string;
};
/** A card. */
export default function Card({ d, styles }: { d: CardData; styles: CardStyles }) {
  return (
    <a className={cn("grid-3", styles.className)} data-component="link" href={d.href} rel="noopener noreferrer" target="_self">
      <picture className={cn("flow-4", styles.className2)}>
        <img className="image-6 flow-12" data-component="image" alt="" height="372" src={d.imgSrc} width="248" />
      </picture>
      <div className={cn("stack-5", styles.className3)}>
        <span className="text-17 flow-2 type-20">
          {d.title}
        </span>
        <span className="flow-13">
          {d.label2}
        </span>
        <span className={cn("row-22 type-21", styles.className4)}>
          <span className={cn("flow-2", styles.className5)}>
            {d.label3}
          </span>
          <span className="flow-2" aria-hidden="true">
            <svg className="icon-6 flow-7" data-component="icon" aria-hidden="true" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
              <path d="M15.346 16.154 14.277 15.1l2.35-2.35H4.5v-1.5h12.127L14.292 8.9l1.07-1.054L19.5 12z" />
            </svg>
          </span>
        </span>
      </div>
    </a>
  );
}
