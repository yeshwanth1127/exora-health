// Single source of truth for clinic locations. Map (public/images/bangalore_real_map.svg) pins: IND, KOR, WFD, JYN.
export interface Branch {
  id: string;
  name: string;      // full name used in footer/cards
  area: string;      // neighbourhood used in nav, pickers, prose
  virtual?: boolean;
}

export const branches: Branch[] = [
  { id: 'indiranagar', name: 'Indiranagar Flagship Clinic', area: 'Indiranagar' },
  { id: 'koramangala', name: 'Koramangala Care Center', area: 'Koramangala' },
  { id: 'whitefield', name: 'Whitefield Technology Hub', area: 'Whitefield' },
  { id: 'jayanagar', name: 'Jayanagar Specialty OPD', area: 'Jayanagar' },
  { id: 'virtual', name: 'Virtual Care (Telehealth)', area: 'Virtual Care', virtual: true },
];

export const physicalBranches = branches.filter((b) => !b.virtual);

/** "Indiranagar, Koramangala, Whitefield, and Jayanagar" */
export const branchAreaList = physicalBranches
  .map((b) => b.area)
  .reduce((acc, area, i, arr) => (i === 0 ? area : i === arr.length - 1 ? `${acc}, and ${area}` : `${acc}, ${area}`), '');
