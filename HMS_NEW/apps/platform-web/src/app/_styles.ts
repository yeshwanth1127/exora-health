// Per-instance class overrides, merged onto each component's shared base classes with cn().

export type LogoStyles = {
  className: string;
  className2?: string;
  className4?: string;
  className3?: string;
};
export type ProductCardStyles = {
  className2?: string;
  className5?: string;
  className?: string;
  className3?: string;
  className4?: string;
};
export type MediaLinkStyles = {
  className: string;
  className2?: string;
  className3?: string;
  className4?: string;
};
export type MediaTile2Styles = {
  className2?: string;
  className?: string;
};
export type ListRowStyles = {
  className: string;
  className2?: string;
};
export type ListRow2Styles = {
  className: string;
  className2?: string;
};

export const Logo_styles: LogoStyles[] = [
    { className: "row-start-2 max-lg:[animation-delay:-70s]", className2: "w-21", className4: "w-21" },
    { className: "w-29 h-9 row-start-2 max-lg:[animation-delay:-75s]", className2: "basis-full", className4: "w-15" },
    { className: "w-29 h-9 row-start-2 max-lg:[animation-delay:-80s]", className2: "w-21", className4: "w-21" },
    { className: "w-29 h-9 row-start-3 max-lg:[animation-delay:-85s]", className2: "basis-full", className3: "w-20", className4: "w-20" },
    { className: "w-29 h-9 row-start-3 max-lg:[animation-delay:-90s]", className2: "w-21", className4: "w-21" },
    { className: "w-29 h-9 row-start-3 max-lg:[animation-delay:-95s]", className2: "basis-full", className3: "w-19.5", className4: "w-19.5" },
    { className: "w-29 h-9 row-start-3 max-lg:[animation-delay:-100s]", className2: "w-21", className4: "w-21" }
];
export const ProductCard_styles: ProductCardStyles[] = [
    { className2: "flex-col", className5: "self-end md:max-lg:ml-[110.9px] 2xl:ml-[4.5rem]" },
    { className2: "flex-col", className5: "ml-[2.5375rem] self-end max-md:ml-0 md:max-lg:ml-[9.8875rem] 2xl:ml-[7.4625rem]" },
    { className: "col-span-full", className2: "max-lg:flex-col", className3: "max-w-125 max-lg:max-w-none", className4: "flex-col max-lg:[flex-direction:initial]", className5: "self-start max-lg:self-end md:max-lg:ml-[11.3625rem]" }
];
export const MediaLink_styles: MediaLinkStyles[] = [
    { className: "w-[21.8rem] aspect-[0.8] max-md:w-[281.3px] md:max-lg:w-90 2xl:w-[401.3px] hover:shadow-[var(--clr-10)_0px_0.170359px_1.01339px_0px,var(--clr-10)_0px_0.778784px_2.84743px_0px,var(--clr-10)_0px_1.9713px_7.6389px_0px,var(--clr-11)_0px_3.89392px_17.5226px_0px] focus:shadow-[var(--clr-0)_0px_0.0043041px_0.0256032px_0px,var(--clr-0)_0px_0.0196759px_0.0719399px_0px,var(--clr-0)_0px_0.0498045px_0.192996px_0px,var(--clr-0)_0px_0.0983794px_0.442707px_0px]", className2: "bg-clr-15", className3: "bg-clr-18", className4: "w-[5.4375rem] h-[1.5625rem] max-w-[5.4375rem] aspect-[auto_82/24]" },
    { className: "w-[21.8rem] aspect-[0.8] max-md:w-[281.3px] md:max-lg:w-90 2xl:w-[401.3px] hover:shadow-[var(--clr-10)_0px_0.170348px_1.01333px_0px,var(--clr-10)_0px_0.778735px_2.84725px_0px,var(--clr-10)_0px_1.97117px_7.63842px_0px,var(--clr-11)_0px_3.89368px_17.5215px_0px] focus:shadow-[var(--clr-0)_0px_0.0043068px_0.0256193px_0px,var(--clr-0)_0px_0.0196882px_0.0719851px_0px,var(--clr-0)_0px_0.0498358px_0.193117px_0px,var(--clr-0)_0px_0.0984412px_0.442985px_0px]", className2: "bg-accent", className3: "bg-clr-9", className4: "w-22.5 h-6 max-w-22.5 aspect-[auto_89/24]" },
    { className: "h-[clamp(436px,_46.5vh,_501.7px)] max-md:grid-rows-[351.6px] max-lg:h-auto md:max-lg:grid-rows-[450px] hover:shadow-[var(--clr-10)_0px_0.170369px_1.01345px_0px,var(--clr-10)_0px_0.77883px_2.8476px_0px,var(--clr-10)_0px_1.97141px_7.63935px_0px,var(--clr-11)_0px_3.89415px_17.5237px_0px] focus:shadow-[var(--clr-0)_0px_0.00430541px_0.025611px_0px,var(--clr-0)_0px_0.0196819px_0.0719618px_0px,var(--clr-0)_0px_0.0498197px_0.193055px_0px,var(--clr-0)_0px_0.0984093px_0.442842px_0px]", className2: "bg-clr-14", className3: "bg-clr-19", className4: "w-22.5 h-6 max-w-22.5 aspect-[auto_639/173]" }
];
export const MediaTile2_styles: MediaTile2Styles[] = [
    { className2: "w-6" },
    { className2: "w-auto" },
    { className2: "w-auto" },
    { className2: "w-auto" },
    { className: "focus:outline-muted focus:[outline-style:none] focus:outline-0", className2: "w-auto" },
    { className: "focus:outline-muted focus:[outline-style:none] focus:outline-0", className2: "w-auto" },
    { className: "focus:outline-muted focus:[outline-style:none] focus:outline-0", className2: "w-6" },
    { className: "focus:outline-muted focus:[outline-style:none] focus:outline-0", className2: "w-6" },
    { className: "focus:outline-muted focus:[outline-style:none] focus:outline-0", className2: "w-6" }
];
export const ListRow_styles: ListRowStyles[] = [
    { className: "w-[5.1375rem]", className2: "hover:[text-decoration-color:var(--clr-0)] focus:[text-decoration-color:var(--clr-0)]" },
    { className: "w-[6.4875rem]", className2: "whitespace-nowrap hover:[text-decoration-color:var(--clr-0)] focus:[text-decoration-color:var(--clr-0)]" },
    { className: "w-[85.7px]", className2: "whitespace-nowrap hover:[text-decoration-color:var(--clr-0)] focus:[text-decoration-color:var(--clr-0)]" },
    { className: "w-[70.3px]", className2: "hover:[text-decoration-color:var(--clr-0)] focus:[text-decoration-color:var(--clr-0)]" },
    { className: "w-[8.2625rem]", className2: "whitespace-nowrap" },
    { className: "w-[90.9px]", className2: "hover:[text-decoration-color:var(--clr-0)] focus:[text-decoration-color:var(--clr-0)]" }
];
export const ListRow_styles2: ListRowStyles[] = [
    { className: "w-[8.6875rem]", className2: "whitespace-nowrap hover:[text-decoration-color:var(--clr-0)] focus:[text-decoration-color:var(--clr-0)]" },
    { className: "w-[6.7875rem]", className2: "hover:[text-decoration-color:var(--clr-0)] focus:[text-decoration-color:var(--clr-0)]" },
    { className: "w-[6.6875rem]" },
    { className: "w-[6.5rem]", className2: "whitespace-nowrap hover:[text-decoration-color:var(--clr-0)] focus:[text-decoration-color:var(--clr-0)]" },
    { className: "w-[5.4125rem]", className2: "hover:[text-decoration-color:var(--clr-0)] focus:[text-decoration-color:var(--clr-0)]" },
    { className: "w-[6.3rem]", className2: "hover:[text-decoration-color:var(--clr-0)] focus:[text-decoration-color:var(--clr-0)]" }
];
export const ListRow2_styles: ListRow2Styles[] = [
    { className: "w-[5.25rem]", className2: "whitespace-nowrap" },
    { className: "w-[76.7px]" },
    { className: "w-[79.5px]" },
    { className: "w-[4.2rem]" },
    { className: "w-[8.1875rem]", className2: "whitespace-nowrap" },
    { className: "w-[149.5px]", className2: "whitespace-nowrap" }
];
export const ListRow_styles3: ListRowStyles[] = [
    { className: "w-[5.8rem]", className2: "hover:[text-decoration-color:var(--clr-0)] focus:[text-decoration-color:var(--clr-0)]" },
    { className: "w-[8.7125rem]", className2: "whitespace-nowrap" },
    { className: "w-[81.7px]", className2: "hover:[text-decoration-color:var(--clr-0)] focus:[text-decoration-color:var(--clr-0)]" },
    { className: "w-[99.7px]", className2: "hover:[text-decoration-color:var(--clr-0)] focus:[text-decoration-color:var(--clr-0)]" }
];

export type MediaCardStyles = { className?: string };
