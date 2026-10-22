import type { ReactNode } from 'react';
import Navbar from '../sections/navbar';
import SiteFooter from './site-footer';
import './resource-pages.css';
export default function ResourceShell({children}:{children:ReactNode}){return <><Navbar/>{children}<SiteFooter/></>;}
