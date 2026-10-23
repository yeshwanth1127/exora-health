/** Public marketing routes only. Shared by menus, footer and audience discovery. */
export const organisationLinks = [
 {label:'For clinics',href:'/teams',description:'A calmer day for independent practices.',icon:'clinic'},
 {label:'For hospitals',href:'/enterprise',description:'Connected workflows for larger care teams.',icon:'hospital'},
 {label:'Labs & diagnostic centres',href:'/labs-diagnostics',description:'Keep enquiries, appointments and visits connected.',icon:'labs'},
] as const;
export const specialtyLinks = [
 {label:'Dental',href:'/specialties/dental',description:'From the first enquiry to the next recall.',icon:'dental'},
 {label:'Physiotherapy',href:'/specialties/physiotherapy',description:'Keep every session connected.',icon:'physiotherapy'},
] as const;
export const supportingModules = [
 {label:'Appointments & queue',href:'/product/features#appointments-queue'},
 {label:'Teleconsultations',href:'/solutions/teleconsultations'},
] as const;
export const resourceLinks = [{label:'Blog',href:'/blog'},{label:'Help centre',href:'/help'},{label:'What’s new',href:'/releases'}] as const;
