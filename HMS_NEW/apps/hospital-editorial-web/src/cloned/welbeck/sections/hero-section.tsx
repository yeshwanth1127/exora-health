import Illustration2 from "../svgs/svg-illustration2";
import Icon8 from "../svgs/svg-icon8";
import Card from "../components/card";
import { Card_styles } from "../_styles";
import type { CardData } from "../components/card";
/** Hero section — the page's lead block. */
export default function HeroSection({ cards, name, city, image, headline, introduction }: {cards:CardData[];name:string;city:string;image:string;headline?:string;introduction?:string}) {
  return (
    <div className="flow-2">
      <div className="flow-2">
        <div className="flow-2">
          <div className="box-19 flow-2">
            <section className="section-3 grid type-3">
              <div className="box-29 stack-4">
                <div className="box-30 flow-2">
                  <Illustration2 />
                </div>
                <h1 className="flow-2 type-17" data-component="heading">
                  {headline || "Specialist care.\nCloser to home."}
                </h1>
                <p className="text-13 flow-2 type-18">
                  {introduction || `${name}. Here for you and your family${city ? ` in ${city}` : ""}.`}
                </p>
                <div className="box-31 row-20">
                  <a className="link-11 row-19 type-6" data-component="link" aria-label="Book Appointment" href="/doctors" target="_self">
                    <span className="text-14 row-4">
                      <span className="text-6 flow-4 type-4">
                        Book Appointment
                      </span>
                    </span>
                  </a>
                  <a className="link-12 row-19 type-6" data-component="link" aria-label="Enquire" href="/contact" target="_self">
                    <span className="text-15 row-4">
                      <span className="text-4 flow-4 type-4">
                        Enquire
                      </span>
                    </span>
                  </a>
                  <button className="btn-6 row-21 type-19" data-component="button" onClick={()=>window.location.assign("/doctors")}>
                    Find your doctor
                    <span className="text-16 flow-2" aria-hidden="true">
                      <Icon8 />
                    </span>
                  </button>
                </div>
              </div>
              <div className="flow-10">
                <picture className="image-3 flow-2">
                  <img className="image-4 flow-12" data-component="image" alt="" height="450" src={image} width="720" />
                </picture>
              </div>
            </section>
            <div className="box-32 grid-2">
              {cards.map((d, i) => <Card key={i} d={d} styles={Card_styles[i]} />)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
