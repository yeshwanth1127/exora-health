import { BRAND_NAME } from "../../lib/brand";
import MarketingAsset from "./marketing-asset";
import { audiencePages, type AudienceKey } from "../../lib/audience-pages";
import IllustrationSlot from "./illustration-slot";
import FaqSection from "./faq";
import AudienceExplorer from "./audience-explorer";
import ResearchBenchmarks from "./research-benchmarks";
import "./care-team-page.css";


export default function CareTeamPage({audience}:{audience:AudienceKey}) {
 const copy=audiencePages[audience];
 return <main className="care-team-page" data-audience={audience}>
<section className="block relative py-20 bg-background max-lg:py-10" data-ditto-id="style-div-21" aria-labelledby="_R_2kkbm_">
              <div className="block" data-ditto-id="style-header">
                <header className="block" data-ditto-id="style-div-86">
                  <div className="grid grid-cols-[[full-bleed-start]_0px_[full-start]_0px_[content-start]_8px_24px_[center-start]_468px_[center-mid-start]_24px_[center-mid-end]_468px_[center-end]_24px_8px_[content-end]_0px_[full-end]_0px_[full-bleed-end]] col-span-full max-lg:grid-cols-[auto_1fr_12px_1fr_auto]" data-capture-enterprise-hero="true">
                    <div className="grid min-w-0 justify-items-start [grid-column-start:content-start] [grid-column-end:center-mid-start] row-start-2 grid-cols-[minmax(0,_1fr)] max-lg:max-w-210 max-lg:justify-items-center max-lg:[grid-column-end:content-end] max-lg:text-center max-lg:[grid-row-start:initial]" data-ditto-id="style-p-10">
                      <p className="audience-eyebrow">{copy.eyebrow}</p>
<h1 className="block mb-3 text-foreground text-[4rem] font-bold leading-16 tracking-[-2.13px] text-balance [font-feature-settings:'lnum',_'locl'_0] max-md:text-[2.625rem] max-md:leading-12 max-md:tracking-[-1.5px] md:max-lg:text-[3.375rem] md:max-lg:leading-14 md:max-lg:tracking-[-1.88px]" data-component="heading" id="_R_2kkbm_">
                        {copy.hero}
                      </h1>
                      <p className="block mb-5 text-xl leading-7 tracking-[-0.12px] [font-feature-settings:'lnum',_'locl'_0] max-lg:text-balance max-md:[font-size:inherit] max-md:leading-[inherit] max-md:tracking-[inherit]">
                        {copy.intro}
                      </p>
                      <div className="flex max-w-full flex-wrap justify-start items-stretch gap-3">
                        <a className="h-12 min-h-11.5 border border-solid border-clr-0 flex py-[0.6875rem] px-5 rounded-lg justify-center items-center grow text-background font-medium text-center bg-primary cursor-pointer max-lg:[text-align:inherit]" data-ditto-id="style-button-10" data-component="button" href="/product/features">
                          Explore the product
                        </a>
                        <a className="h-12 min-h-11.5 border border-solid border-clr-0 flex py-[0.6875rem] px-5 rounded-lg justify-center items-center grow text-color-010 font-medium text-center bg-color-011 cursor-pointer max-lg:[text-align:inherit]" data-ditto-id="style-div-130" data-component="button" href="/contact-sales">
                          Request a demo
                        </a>
                      </div>
                    </div>
                    <div className="grid min-w-0 items-center justify-items-center [grid-column-start:center-mid-end] [grid-column-end:content-end] row-span-full grid-cols-[minmax(0,_1fr)] max-lg:mb-5 max-lg:order-[-1] max-lg:[grid-column-start:content-start] max-lg:[grid-row-start:initial] max-lg:[grid-row-end:initial]" data-ditto-id="style-div-131">
                      <div className="block max-w-98 max-lg:max-w-full" data-ditto-id="style-image-19">
                        {copy.artworkPrefix ? <IllustrationSlot name={`${copy.artworkPrefix}-hero`} /> : <img className="w-98 h-64.5 block max-w-full overflow-clip aspect-[auto_6342/4166] max-md:w-[21.4375rem] max-md:h-[14.0625rem] max-lg:max-h-77.5 md:max-lg:w-118 md:max-lg:h-77.5" data-ditto-id="style-div-58" data-component="image" alt={copy.heroAlt} height="4166" src={copy.heroArt} width="6342" />}
                      </div>
                    </div>
                  </div>
                </header>
              </div>
            </section>

<section data-audience-row="0" className="block relative py-20 bg-background max-lg:py-10" aria-labelledby="_R_4kkbm_">
              <article className="block" data-ditto-id="style-picture-5">
                <div className="grid justify-center content-center gap-y-8 gap-x-12 grid-cols-[540px_436px] max-lg:gap-y-6 max-lg:grid-cols-1 max-lg:[justify-content:initial] max-lg:[align-content:initial]">
                  <div className="flex flex-col justify-center col-start-1 row-start-1 max-lg:[grid-column-start:initial] max-lg:[grid-row-start:initial]">
                    <h2 id="_R_4kkbm_" className="block text-[2.625rem] font-bold leading-12 tracking-[-1.5px] text-balance max-md:text-[2rem] max-md:leading-10 max-md:tracking-[-0.75px]" data-component="heading">
                      <span className="inline text-foreground [font-feature-settings:'lnum',_'locl'_0] md:max-lg:text-[2rem] md:max-lg:leading-10 md:max-lg:tracking-[-0.75px]" data-ditto-id="style-div-88">
                        {copy.rows[0].title}
                      </span>
                    </h2>
                    <p className="block mt-3 [font-feature-settings:'lnum',_'locl'_0]" data-ditto-id="style-video">
                      {copy.rows[0].body}
                    </p>
                  </div>
                  <div className="border border-solid border-color-006 block rounded-[10px] col-start-2 row-start-1 shadow-[var(--color-006)_0px_0.175px_1.041px_0px,var(--color-006)_0px_0.8px_2.925px_0px,var(--color-006)_0px_2.025px_7.847px_0px,var(--color-006)_0px_4px_18px_0px] max-lg:[grid-column-start:initial] max-lg:[grid-row-start:initial]" data-ditto-id="style-source-3">
                    {copy.artworkPrefix ? <IllustrationSlot name={`${copy.artworkPrefix}-workflow-1`} /> : <MarketingAsset name={"1a"} />}
                  </div>
                </div>
              </article>
            </section>

<section data-audience-row="1" className="block relative py-20 bg-background max-lg:py-10" data-ditto-id="style-openai-2" aria-labelledby="_R_6kkbm_">
              <article className="block" data-ditto-id="style-span-13">
                <div className="grid justify-center content-center gap-y-8 gap-x-12 grid-cols-[436px_540px] max-lg:gap-y-6 max-lg:grid-cols-1 max-lg:[justify-content:initial] max-lg:[align-content:initial]" data-ditto-id="style-image-2">
                  <div className="flex flex-col justify-center col-start-2 row-start-1 max-lg:[grid-column-start:initial] max-lg:[grid-row-start:initial]" data-ditto-id="style-span-81">
                    <h2 id="_R_6kkbm_" className="block text-[2.625rem] font-bold leading-12 tracking-[-1.5px] text-balance max-md:text-[2rem] max-md:leading-10 max-md:tracking-[-0.75px]" data-ditto-id="style-a24" data-component="heading">
                      <span className="inline text-foreground [font-feature-settings:'lnum',_'locl'_0] md:max-lg:text-[2rem] md:max-lg:leading-10 md:max-lg:tracking-[-0.75px]" data-ditto-id="style-span-82">
                        {copy.rows[1].title}
                      </span>
                    </h2>
                    <p className="block mt-3 [font-feature-settings:'lnum',_'locl'_0]">
                      {copy.rows[1].body}
                    </p>
                  </div>
                  <div className="border border-solid border-color-006 block rounded-[10px] col-start-1 row-start-1 shadow-[var(--color-006)_0px_0.175px_1.041px_0px,var(--color-006)_0px_0.8px_2.925px_0px,var(--color-006)_0px_2.025px_7.847px_0px,var(--color-006)_0px_4px_18px_0px] max-lg:[grid-column-start:initial] max-lg:[grid-row-start:initial]" data-ditto-id="style-figma">
                    {copy.artworkPrefix ? <IllustrationSlot name={`${copy.artworkPrefix}-workflow-2`} /> : <MarketingAsset name={"3a"} />}
                  </div>
                </div>
              </article>
            </section>

<section data-audience-row="2" className="block relative py-20 bg-background max-lg:py-10" data-ditto-id="style-figure-2" aria-labelledby="_R_8kkbm_">
              <article className="block" data-ditto-id="style-r-sr4kkbm">
                <div className="grid justify-center content-center gap-y-8 gap-x-12 grid-cols-[540px_436px] max-lg:gap-y-6 max-lg:grid-cols-1 max-lg:[justify-content:initial] max-lg:[align-content:initial]">
                  <div className="flex flex-col justify-center col-start-1 row-start-1 max-lg:[grid-column-start:initial] max-lg:[grid-row-start:initial]">
                    <h2 id="_R_8kkbm_" className="block text-[2.625rem] font-bold leading-12 tracking-[-1.5px] text-balance max-md:text-[2rem] max-md:leading-10 max-md:tracking-[-0.75px]" data-ditto-id="style-r-1b4kkbm" data-component="heading">
                      <span className="inline text-foreground [font-feature-settings:'lnum',_'locl'_0] md:max-lg:text-[2rem] md:max-lg:leading-10 md:max-lg:tracking-[-0.75px]" data-ditto-id="style-figure-5">
                        {copy.rows[2].title}
                      </span>
                    </h2>
                    <p className="block mt-3 [font-feature-settings:'lnum',_'locl'_0]" data-ditto-id="style-r-tb4kkbm">
                      {copy.rows[2].body}
                    </p>
                  </div>
                  <div className="border border-solid border-color-006 block rounded-[10px] col-start-2 row-start-1 shadow-[var(--color-006)_0px_0.175px_1.041px_0px,var(--color-006)_0px_0.8px_2.925px_0px,var(--color-006)_0px_2.025px_7.847px_0px,var(--color-006)_0px_4px_18px_0px] max-lg:[grid-column-start:initial] max-lg:[grid-row-start:initial]" data-ditto-id="style-image-20">
                    {copy.artworkPrefix ? <IllustrationSlot name={`${copy.artworkPrefix}-workflow-3`} /> : <MarketingAsset name={audience === "enterprise" ? "1d" : "1b"} />}
                  </div>
                </div>
              </article>
            </section>

<section className="block relative pb-20 bg-background max-lg:pb-10" data-cid="n142" aria-labelledby="audience-services">
              <div className="flex mb-8 flex-col-reverse justify-center items-center gap-6 text-center max-lg:mb-6" data-ditto-id="style-div-59">
                <div className="flex min-w-0 flex-col items-center" data-cid="n144">
                  <h2 className="block max-w-[693.7px] text-foreground text-[2.625rem] font-bold leading-12 tracking-[-1.5px] text-balance [font-feature-settings:'lnum',_'locl'_0] max-lg:max-w-[528.5px] max-lg:text-[2rem] max-lg:leading-10 max-lg:tracking-[-0.75px]" data-cid="n145" data-component="heading" id="audience-services">
                    <span className="inline" data-cid="n146">
                      One platform, built around your practice.
                    </span>
                  </h2>
                </div>
              </div>
              <div className="flex my-6 flex-wrap gap-6" data-ditto-id="style-div-60" role="group">
                <article className="border-2 border-solid border-border block relative rounded-xl grow basis-[calc(50%_-_12px)] bg-border max-lg:basis-full" data-cid="n148">
                  <div className="h-full flex rounded-xl flex-col overflow-clip" data-cid="n149">
                    <div className="flex py-7 px-8 flex-col grow basis-[fit-content] gap-1" data-cid="n150">
                      <h3 className="block text-color-002 text-lg font-bold leading-7 tracking-[-0.12px] text-balance [font-feature-settings:'lnum',_'locl'_0]" data-cid="n151" data-component="heading">
                        AI reception & call handling
                      </h3>
                      <p className="block text-foreground [font-feature-settings:'lnum',_'locl'_0]" data-cid="n152">
                        Answer routine questions and capture booking requests, with a clear handoff to your front desk.
                      </p>
                    </div>
                    <div className="block ml-8 rounded-tl-xl overflow-clip shadow-[var(--color-006)_0px_0.175px_1.041px_0px,var(--color-006)_0px_0.8px_2.925px_0px,var(--color-006)_0px_2.025px_7.847px_0px,var(--color-006)_0px_4px_18px_0px]" data-cid="n153">
                      <img className="enterprise-service-art" src="/assets/capture-product-art/ai-reception.webp" alt="AI receptionist illustration" width="1254" height="1254" />
                    </div>
                  </div>
                </article>
                <article className="border-2 border-solid border-border block relative rounded-xl grow basis-[calc(50%_-_12px)] bg-border max-lg:basis-full" data-cid="n155">
                  <div className="h-full flex rounded-xl flex-col overflow-clip" data-cid="n156">
                    <div className="flex py-7 px-8 flex-col grow basis-[fit-content] gap-1" data-cid="n157">
                      <h3 className="block text-color-002 text-lg font-bold leading-7 tracking-[-0.12px] text-balance [font-feature-settings:'lnum',_'locl'_0]" data-cid="n158" data-component="heading">
                        WhatsApp outreach
                      </h3>
                      <p className="block text-foreground [font-feature-settings:'lnum',_'locl'_0]" data-cid="n159">
                        Keep patients in the conversation with timely follow-ups and personalised outreach.
                      </p>
                    </div>
                    <div className="block overflow-clip" data-cid="n160">
                      <img className="enterprise-service-art" src="/assets/capture-product-art/whatsapp-outreach.webp" alt="Patient outreach illustration" width="1254" height="1254" />
                    </div>
                  </div>
                </article>
              </div>
              <div className="flex mt-6 flex-wrap gap-6" data-cid="n162" role="group">
                <article className="border-2 border-solid border-border block relative rounded-xl grow basis-[calc(50%_-_12px)] bg-border max-lg:basis-full" data-cid="n163">
                  <div className="h-full flex rounded-xl flex-col overflow-clip" data-cid="n164">
                    <div className="flex py-7 px-8 flex-col grow basis-[fit-content] gap-1" data-cid="n165">
                      <h3 className="block text-color-002 text-lg font-bold leading-7 tracking-[-0.12px] text-balance [font-feature-settings:'lnum',_'locl'_0]" data-cid="n166" data-component="heading">
                        Google Business management
                      </h3>
                      <p className="block text-foreground [font-feature-settings:'lnum',_'locl'_0]" data-cid="n167">
                        Keep your location profile current and help nearby patients find the right information.
                      </p>
                    </div>
                    <div className="block overflow-clip" data-cid="n168">
                      <img className="enterprise-service-art" src="/assets/capture-product-art/google-business.webp" alt="Clinic discovery illustration" width="1254" height="1254" />
                    </div>
                  </div>
                </article>
                <article className="border-2 border-solid border-border block relative rounded-xl grow basis-[calc(50%_-_12px)] bg-border max-lg:basis-full" data-cid="n170">
                  <div className="h-full flex rounded-xl flex-col overflow-clip" data-cid="n171">
                    <div className="flex py-7 px-8 flex-col grow basis-[fit-content] gap-1" data-cid="n172">
                      <h3 className="block text-color-002 text-lg font-bold leading-7 tracking-[-0.12px] text-balance [font-feature-settings:'lnum',_'locl'_0]" data-cid="n173" data-component="heading">
                        Clinic analytics
                      </h3>
                      <p className="block text-foreground [font-feature-settings:'lnum',_'locl'_0]" data-cid="n174">
                        See enquiries, bookings and appointment trends to understand what brings patients to your team.
                      </p>
                    </div>
                    <div className="block ml-8 rounded-tl-xl overflow-clip shadow-[var(--color-006)_0px_0.175px_1.041px_0px,var(--color-006)_0px_0.8px_2.925px_0px,var(--color-006)_0px_2.025px_7.847px_0px,var(--color-006)_0px_4px_18px_0px]" data-cid="n175">
                      <img className="enterprise-service-art" src="/assets/capture-product-art/clinic-analytics.webp" alt="Clinic analytics illustration" width="1254" height="1254" />
                    </div>
                  </div>
                </article>
              </div>
            </section>
<section className="block relative pb-20 bg-background max-lg:pb-10" data-ditto-id="style-div-142" aria-labelledby="_R_ckkbm_">
              <div className="flex mb-8 flex-col-reverse justify-center items-center gap-6 text-center max-lg:mb-6">
                <div className="flex min-w-0 flex-col items-center">
                  <h2 className="block max-w-[693.7px] text-foreground text-[2.625rem] font-bold leading-12 tracking-[-1.5px] text-balance [font-feature-settings:'lnum',_'locl'_0] max-lg:max-w-[528.5px] max-lg:text-[2rem] max-lg:leading-10 max-lg:tracking-[-0.75px]" data-ditto-id="style-r-ckkbm" data-component="heading" id="_R_ckkbm_">
                    <span className="inline">
                      Start with the workflow that matters most.
                    </span>
                  </h2>
                  <p className="block max-w-140 mt-4 [font-feature-settings:'lnum',_'locl'_0]">
                    {copy.starterIntro}
                  </p>
                </div>
              </div>
              <div className="flex mt-6 flex-wrap gap-6" data-ditto-id="style-div-143" role="group">
                <article className="border-2 border-solid border-border block relative rounded-xl grow basis-[calc(50%_-_12px)] bg-border max-lg:basis-full" data-ditto-id="style-article-10">
                  <div className="h-full flex rounded-xl flex-col overflow-clip" data-ditto-id="style-div-62">
                    <div className="flex py-7 px-8 flex-col grow basis-[fit-content] gap-1">
                      <h3 className="block text-color-002 text-lg font-bold leading-7 tracking-[-0.12px] text-balance [font-feature-settings:'lnum',_'locl'_0]" data-component="heading">
                        {copy.starters[0].title}
                      </h3>
                      <p className="block text-foreground [font-feature-settings:'lnum',_'locl'_0]" data-ditto-id="style-p-34">
                        {copy.starters[0].body}
                      </p>
                      <a className="h-6 flex items-center gap-1 text-primary cursor-pointer" data-ditto-id="style-link-19" data-component="link" href="/product/features#capture">
                        <span className="flex items-center gap-2" data-ditto-id="style-span-90">
                          Explore this workflow
                        </span>
                        <span className="block" data-ditto-id="style-span-91" aria-hidden="true">
                          →
                        </span>
                      </a>
                    </div>
                    <div className="block ml-8 rounded-tl-xl overflow-clip shadow-[var(--color-006)_0px_0.175px_1.041px_0px,var(--color-006)_0px_0.8px_2.925px_0px,var(--color-006)_0px_2.025px_7.847px_0px,var(--color-006)_0px_4px_18px_0px]" data-ditto-id="style-div-144">
                      {copy.artworkPrefix ? <IllustrationSlot name={`${copy.artworkPrefix}-starter-1`} /> : <MarketingAsset name="3b" />}
                    </div>
                  </div>
                </article>
                <article className="border-2 border-solid border-border block relative rounded-xl grow basis-[calc(50%_-_12px)] bg-border max-lg:basis-full" data-ditto-id="style-div-145">
                  <div className="h-full flex rounded-xl flex-col overflow-clip">
                    <div className="flex py-7 px-8 flex-col grow basis-[fit-content] gap-1" data-ditto-id="style-div-63">
                      <h3 className="block text-color-002 text-lg font-bold leading-7 tracking-[-0.12px] text-balance [font-feature-settings:'lnum',_'locl'_0]" data-component="heading">
                        {copy.starters[1].title}
                      </h3>
                      <p className="block text-foreground [font-feature-settings:'lnum',_'locl'_0]">
                        {copy.starters[1].body}
                      </p>
                      <a className="h-6 flex items-center gap-1 text-primary cursor-pointer" data-ditto-id="style-link-20" data-component="link" href="/product/features#find">
                        <span className="flex items-center gap-2" data-ditto-id="style-span-89">
                          Explore this workflow
                        </span>
                        <span className="block" data-ditto-id="style-span-49" aria-hidden="true">
                          →
                        </span>
                      </a>
                    </div>
                    <div className="block ml-8 rounded-tl-xl overflow-clip shadow-[var(--color-006)_0px_0.175px_1.041px_0px,var(--color-006)_0px_0.8px_2.925px_0px,var(--color-006)_0px_2.025px_7.847px_0px,var(--color-006)_0px_4px_18px_0px]" data-ditto-id="style-div-146">
                      {copy.artworkPrefix ? <IllustrationSlot name={`${copy.artworkPrefix}-starter-2`} /> : <MarketingAsset name="3c" />}
                    </div>
                  </div>
                </article>
              </div>
            </section>
<ResearchBenchmarks />
<section className="audience-additional" aria-labelledby="audience-extra-title">
<div className="audience-additional-copy"><h2 id="audience-extra-title">Care beyond the front desk.</h2>
<p>Keep in-person and remote appointments connected to the team coordinating the day.</p>
<a className="audience-text-link" href="/solutions/teleconsultations">Explore teleconsultation workflows <span aria-hidden="true">→</span></a></div>
<IllustrationSlot name="teleconsultations-callout" />
</section>
{copy.faqs && <FaqSection className="audience-faq" id="audience-faq-title" items={copy.faqs}/>}
<AudienceExplorer compact />
<section className="min-h-140 flex -mx-32 py-16 px-8 flex-col justify-center items-center gap-3 text-center bg-border max-md:-mx-4 max-lg:min-h-0 md:max-lg:-mx-16.5 2xl:min-h-180 2xl:-mx-112" data-ditto-id="style-blockquote" aria-labelledby="_R_ekkbm_">
              <h2 className="block mb-1 text-foreground text-[2.625rem] font-bold leading-12 tracking-[-1.5px] text-balance [font-feature-settings:'lnum',_'locl'_0] max-lg:text-[1.625rem] max-lg:leading-8 max-lg:tracking-[-0.62px]" data-ditto-id="style-br-2" data-component="heading" id="_R_ekkbm_">
                See {BRAND_NAME} at your practice.
              </h2>
              <p className="block mb-3 text-xl leading-7 tracking-[-0.12px] [font-feature-settings:'lnum',_'locl'_0] max-md:[font-size:inherit] max-md:leading-[inherit] max-md:tracking-[inherit]" data-ditto-id="style-figcaption-2">
                {copy.cta}
              </p>
              <div className="flex justify-start items-stretch gap-2" data-ditto-id="style-span-50">
                <a className="border border-solid border-clr-0 flex py-1.5 px-[0.9375rem] rounded-lg justify-center items-center gap-3 text-background font-medium [font-feature-settings:'lnum',_'locl'_0] bg-primary cursor-pointer" data-ditto-id="style-footer-3" data-component="button" href="/product/features">
                  Explore the product
                </a>
                <a className="border border-solid border-clr-0 flex py-1.5 px-[0.9375rem] rounded-lg justify-center items-center gap-3 text-accent font-medium [font-feature-settings:'lnum',_'locl'_0] bg-background cursor-pointer" data-ditto-id="style-ul-3" data-component="button" href="/contact-sales">
                  Request a demo
                </a>
              </div>
            </section>
</main>;
}
