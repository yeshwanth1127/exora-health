/** Welbeck Way Welbeck section. */
export default function WelbeckWayWelbeckSection({name,city,image,story}:{name:string;city:string;image:string;story?:string}) {
  return (
    <div className="flow-2">
      <section className="flow-2">
        <div className="box-16 stack-7">
          <div className="box-48 stack-8" />
          <div className="box-49 flow-2 type-3">
            <div className="box-36 stack-6">
              <div className="box-50 grid-4">
                <div className="box-51 stack-9">
                  <div className="flow-2">
                    <h2 className="heading flow-2 type-33" data-component="heading">
                      Your neighbourhood.
Your hospital.
                    </h2>
                    <div className="flow-2 type-4">
                      <p className="flow-2 type-34">
                        {story || `Get to know ${name}${city ? ` in ${city}` : ""}. Meet the published care team, understand your options and speak with reception about your next step.`}
                      </p>
                    </div>
                  </div>
                  <div className="row-27">
                    <a className="link-16 row-19 type-35" data-component="link" aria-label="Our hospital" href="/about" target="_self">
                      <span className="text-15 row-4">
                        <span className="text-4 flow-4 type-36">
                          Our hospital
                        </span>
                      </span>
                    </a>
                    <a className="link-17 row-19 type-37" data-component="link" aria-label="Book now" href="/doctors" rel="noopener noreferrer" target="_self">
                      <span className="text-15 row-4">
                        <span className="text-4 flow-4 type-36">
                          Book now
                        </span>
                      </span>
                    </a>
                  </div>
                </div>
                <picture className="image-8 flow-4">
                  <img className="image-9 flow-12" data-component="image" alt="A consultation — illustrative image" height="491" src={image} width="491" />
                </picture>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
