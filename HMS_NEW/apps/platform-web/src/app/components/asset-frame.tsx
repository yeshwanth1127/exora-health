"use client";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
export default function AssetFrame({width,height,children}:{width:number;height:number;children:ReactNode}) {
 const ref=useRef<HTMLDivElement>(null);
 const [scale,setScale]=useState<number>();
 useLayoutEffect(()=>{const el=ref.current;if(!el)return;const update=()=>setScale(el.getBoundingClientRect().width/width);update();const observer=new ResizeObserver(update);observer.observe(el);return()=>observer.disconnect();},[width]);
 return <div ref={ref} className="marketing-asset-frame" style={{aspectRatio:`${width}/${height}`}}><div className="marketing-asset-canvas" aria-hidden="true" style={{width,height,transform:`scale(${scale??1})`,visibility:scale===undefined?"hidden":"visible"}}>{children}</div></div>;
}
