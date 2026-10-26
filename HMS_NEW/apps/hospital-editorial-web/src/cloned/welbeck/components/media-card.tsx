import type { MediaCardStyles } from "../_styles";
import { cn } from "../lib/utils";
export type MediaCardData = {
  imgSrc: string;
  title: string;
  href: string;
};
/** A card with media + heading. */
export default function MediaCard({ d, styles }: { d: MediaCardData; styles: MediaCardStyles }) {
  return (
    <div className={cn("stack-12 type-3", styles.className)}>
      <div className="box-66 flow-2">
        <picture className={cn("row-5", styles.className2)}>
          <img className="image-12 flow-12" data-component="image" alt="" src={d.imgSrc} />
        </picture>
        <div className="box-67 row-32">
          <svg className={cn("flow-4", styles.className3)} data-component="image" viewBox="0 0 343 133" fill="currentColor">
            <path d="M343 132.062H0V104.822C34.9306 122.132 74.2839 131.863 115.91 131.863C213.142 131.863 297.973 78.7725 343 0V132.062Z" fill="#08404F" />
          </svg>
        </div>
      </div>
      <div className="box-68 flow-18">
        <h2 className="heading-3 flow-2 type-46" data-component="heading">
          {d.title}
        </h2>
        <p className="flow-2 type-5" />
        <hr className={cn("flow-4 type-47", styles.className4)} />
        <ul className="list-5 stack-13 type-14">
          <li className="flow-2">
            <a className="btn-7 row-33 type-32" data-component="button" href={d.href}>
              See all
              <svg className="icon-8 flow-4" data-component="icon" height="16" viewBox="0 0 24 24" width="16" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
                <path d="M15.346 16.154 14.277 15.1l2.35-2.35H4.5v-1.5h12.127L14.292 8.9l1.07-1.054L19.5 12z" />
              </svg>
            </a>
          </li>
        </ul>
      </div>
    </div>
  );
}
