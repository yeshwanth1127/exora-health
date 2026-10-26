import { BRAND_NAME } from "../../lib/brand";
import ProductCard from "../components/product-card";
import ProductCard2 from "../components/product-card2";
import { ProductCard_meta, ProductCard2_meta } from "../ditto-meta";
import { ProductCard_styles } from "../_styles";
import { products as productsContent, products2 as products2Content } from "../content";
/** Product Grid section. */
export default function ProductGridSection({ products = productsContent, products2 = products2Content } = {}) {
  return (
    <div className="block py-24 px-[5.8rem] bg-background max-md:py-8 max-md:px-4 md:max-lg:px-[3.6rem] 2xl:px-[8.8rem] focus:outline-0" data-ditto-id="style-section-6">
      <div className="flex max-w-313 flex-col gap-8 mx-auto max-md:gap-4" data-ditto-id="style-article-8">
        <div className="flex justify-between items-end gap-6 max-lg:flex-col-reverse max-lg:items-start focus:outline-0" data-ditto-id="style-div-23">
          <div className="flex min-w-0 flex-col" data-ditto-id="style-div-137">
            <h2 className="block max-w-[55.75rem] text-foreground text-[3.375rem] font-bold leading-14 tracking-[-1.88px] text-balance max-lg:max-w-[528.5px] max-lg:text-[2rem] max-lg:leading-10 max-lg:tracking-[-0.75px]" data-component="heading">
              AI where your team works.
            </h2>
          </div>
        </div>
        <div className="w-full grid gap-6 max-lg:gap-4 focus:outline-0 grid-cols-1 lg:grid-cols-2" data-ditto-id="style-span-18">
          {products.map((d, i) => <ProductCard key={d.variant} d={d} meta={ProductCard_meta[i]} styles={ProductCard_styles[i]} />)}
        </div>
        <div className="flex flex-col gap-8 max-lg:gap-6">
          <section className="block" id="_R_e9abm_">
            <div className="flex flex-col justify-start items-stretch gap-2">
              <h3 className="block text-color-004 text-sm leading-5 text-balance" data-ditto-id="style-blockquote-6" data-component="heading">
                See what {BRAND_NAME} can do
              </h3>
              <div className="flex justify-start items-stretch gap-2 max-lg:flex-col grid-cols-1 lg:grid-cols-5" data-ditto-id="style-p-8">
                {products2.map((d, i) => <ProductCard2 key={d.variant} d={d} meta={ProductCard2_meta[i]} />)}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
