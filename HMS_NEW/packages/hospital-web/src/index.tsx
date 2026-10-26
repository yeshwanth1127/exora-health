/// <reference path="./arc-vendor.d.ts" />
import {WebsiteRuntimeProvider} from './ui/Runtime';
import App from './ui/App';
export function HospitalWebsite(){return <WebsiteRuntimeProvider><App/></WebsiteRuntimeProvider>}
export {WebsiteRuntimeProvider,useWebsite} from './ui/Runtime';
