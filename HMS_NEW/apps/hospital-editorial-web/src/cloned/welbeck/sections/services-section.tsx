import MediaCard from "../components/media-card";
import { MediaCard_styles } from "../_styles";
import type { MediaCardData } from "../components/media-card";
/** Services section. */
export default function ServicesSection({ cards, name }: {cards:MediaCardData[];name:string}) {
  return (
    <div className="flow-2">
      <div className="box-36 stack-6">
        <section className="box-35 flow-2">
          <div className="box-61 stack-7">
            <h2 className="flow-2 type-38" data-component="heading">
              Care, built around you.
            </h2>
            <p className="text-21 flow-2 type-41">
              {`Explore the published care team at ${name}, understand your options and plan your visit.`}
            </p>
          </div>
          <div className="box-64 grid-6">
            {cards.map((d, i) => <MediaCard key={i} d={d} styles={MediaCard_styles[i]} />)}
          </div>
        </section>
      </div>
    </div>
  );
}
