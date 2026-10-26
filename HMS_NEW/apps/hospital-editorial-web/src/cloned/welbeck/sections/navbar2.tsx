import ListRow from "../components/list-row";
import {useEffect,useState} from "react";

import Icon5 from "../svgs/svg-icon5";
import Icon6 from "../svgs/svg-icon6";
import MediaTile, { type MediaTileData } from "../components/media-tile";
import Icon7 from "../svgs/svg-icon7";
import ListRow2 from "../components/list-row2";
import { ListRow_styles, MediaTile_styles } from "../_styles";

/** Navbar2 section. */
export default function Navbar2({ name, logoUrl, listRowData = [], listRow2Data = [] }: {name:string;logoUrl?:string;listRowData?:{href:string;label:string}[];listRow2Data?:{href:string;label:string}[]}) {
  const [menuOpen,setMenuOpen]=useState(false);
  useEffect(()=>{const close=()=>setMenuOpen(false);const keys=(e:KeyboardEvent)=>{if(e.key==='Escape'){setMenuOpen(false);document.getElementById('p-nav-menu-toggle')?.focus();}};addEventListener('popstate',close);addEventListener('keydown',keys);return()=>{removeEventListener('popstate',close);removeEventListener('keydown',keys);};},[]);
  return (
    <header data-menu-open={menuOpen} className="flow-2" id="site-header">
      <nav className="nav flow-5 type-3" data-component="nav" aria-label="Utility navigation">
        <div className="box-19 flow-2">
          <div className="box-20 flow-2">
            <ul className="list row-8 type-8">
              {listRowData.map((d, i) => <ListRow key={i} d={d} styles={ListRow_styles[i]} />)}
            </ul>
          </div>
        </div>
      </nav>
      <div className="box-21 flow-2">
        <div className="box-19 flow-2">
          <div className="box-22 row-10">
            <a className="link-6 flow-6 type-7" data-component="link" aria-label={`${name} home`} href="/">
              <span className="sl-brand">{logoUrl && <img className="sl-brand-logo" src={logoUrl} alt=""/>}<span>{name}</span></span>
            </a>
            <nav className="nav-2 row-11" data-component="nav" aria-label="Primary navigation">
              <div className="box-23 flow-8">
                <a className="link-7 row-12 type-12" aria-label="BOOK" href="/doctors">
                  <span className="text-7 row-4">
                    <span className="text-8 flow-4 type-13">
                      BOOK
                    </span>
                  </span>
                </a>
                <button className="btn-2 row-13 type-7" aria-label="Search" onClick={()=>window.location.assign("/doctors")} type="button">
                  <span className="box-23 row-5" aria-hidden="true">
                    <Icon5 />
                  </span>
                </button>
                <button className="btn-2 row-13 type-7" aria-controls="p-nav-drawer-root" aria-expanded={menuOpen} onClick={()=>setMenuOpen(!menuOpen)} aria-label={menuOpen?"Close menu":"Open menu"} id="p-nav-menu-toggle" type="button">
                  <span className="box-23 row-5" aria-hidden="true">
                    <Icon6 />
                  </span>
                </button>
              </div>
              <div className="box-24 flow-5" aria-label="Hospital navigation" id="p-nav-drawer-root">
                <div className="box-25 flow-2">
                  <div className="box-26 row-14">
                    <ul className="list-2 row-15 type-14">
                      <li className="list-item flow-2">
                        <a className="link-8 stack-2" data-component="link" href="/doctors">
                          <span className="text-9 flow-2 type-15">
                            Find a specialist
                          </span>
                        </a>
                      </li>
                      {[{href:"/departments",label:"Specialties"},{href:"/packages",label:"Health checks"},{href:"/facilities",label:"Our hospital"},{href:"/visit",label:"Plan your visit"}].map(d=><li key={d.href} className="list-item"><a className="link-8 stack-2" href={d.href}><span className="text-9 flow-2 type-15">{d.label}</span></a></li>)}
                    </ul>
                    <div className="box-27 row-18">
                      <a className="link-9 row-19 type-12" data-component="link" aria-label="BOOK AN APPOINTMENT" href="/doctors">
                        <span className="text-11 row-4">
                          <span className="text-12 flow-4 type-13">
                            BOOK AN APPOINTMENT
                          </span>
                        </span>
                      </a>
                      <button className="btn-5 row-17 type-7" data-component="button" aria-label="Search" onClick={()=>window.location.assign("/doctors")} type="button">
                        <span className="list-item-2 row-5" aria-hidden="true">
                          <Icon7 />
                        </span>
                      </button>
                    </div>
                    <div className="box-28 flow-9">
                      <ul className="list-3 stack-3 type-14">
                        {listRow2Data.map((d, i) => <ListRow2 key={i} d={d} />)}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
}
