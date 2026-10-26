import { clientAsset } from './clientAssets';

// Linked by the hospital's Video Gallery. Titles/channel checked through YouTube oEmbed.
// Group events and branch tours are labelled separately from KR Puram facilities.
export const hospitalVideos = [
  { id: '3HTtj5NBA4w', title: 'Our hospital story, with Dr. Sambashiva', category: 'From the founder', description: 'An introduction to the Sri Lakshmi Group of Hospitals by Dr. Sambashiva AC.', poster: '/clients/sri-lakshmi/videos/3HTtj5NBA4w.jpg' },
  { id: '4jvl0J9NKpY', title: 'Understanding kidney stone treatment', category: 'Doctor explains', description: 'Dr. Manjunath S discusses kidney stone treatment at Sri Lakshmi Hospital.', poster: '/clients/sri-lakshmi/videos/4jvl0J9NKpY.jpg' },
  { id: 'uT4a9oMj8dU', title: 'Arthroscopy & joint replacement', category: 'Doctor explains', description: 'Dr. G Krishna Naresh Goud introduces arthroscopy and joint replacement.', poster: '/clients/sri-lakshmi/videos/uT4a9oMj8dU.jpg' },
  { id: 'ZGpAgCYAy5k', title: 'International Day of Yoga', category: 'Community event', description: 'A community broadcast from the Sri Lakshmi Group of Hospitals.', poster: '/clients/sri-lakshmi/videos/ZGpAgCYAy5k.jpg' },
  { id: '63W1DaLcDKM', title: 'Madiwala branch inauguration', category: 'Across the group', description: 'A recording of the Sri Lakshmi Group’s Madiwala branch inauguration.', poster: '/clients/sri-lakshmi/videos/63W1DaLcDKM.jpg' },
  { id: 'sQihejx3qFU', title: 'Inside Sri Lakshmi Global Hospital', category: 'Group hospital tour', description: 'A tour of Sri Lakshmi Global Hospital, a separate hospital within the group.', poster: '/clients/sri-lakshmi/videos/sQihejx3qFU.jpg' },
];
export type HospitalVideo = typeof hospitalVideos[number];

export const hospitalPhotographs = [
  { id: 'kr-puram', src: clientAsset('2024/12/1-1.png'), title: 'Sri Lakshmi, KR Puram', category: 'Hospital' as const, caption: 'The exterior of Sri Lakshmi Super Speciality Hospital in KR Puram.', wide: true },
  { id: 'cath-lab', src: clientAsset('2024/12/1-3.png'), title: 'Inside the cardiac cath lab', category: 'Hospital' as const, caption: 'Cardiac catheterization equipment pictured in the hospital’s gallery.' },
  { id: 'care-spaces', src: clientAsset('2024/12/1-9.png'), title: 'Care spaces', category: 'Hospital' as const, caption: 'A patient room with beds and care equipment.' },
  { id: 'laboratory', src: clientAsset('2024/12/1-6.png'), title: 'The hospital laboratory', category: 'Hospital' as const, caption: 'Laboratory staff and diagnostic equipment at the hospital.' },
  { id: 'pharmacy', src: clientAsset('2024/12/6-6.png'), title: 'Pharmacy', category: 'Hospital' as const, caption: 'The hospital’s pharmacy counter.' },
  { id: 'ward', src: clientAsset('2024/12/1-8.png'), title: 'Inside the hospital', category: 'Hospital' as const, caption: 'A hospital ward photographed for the hospital’s gallery.' },
  { id: 'community', src: clientAsset('2024/12/19.png'), title: 'Coming together as a community', category: 'Community' as const, caption: 'A community gathering shared in the hospital’s Media & News gallery.', wide: true },
  { id: 'kaggadasapura', src: clientAsset('2024/12/20.png'), title: 'The Kaggadasapura team', category: 'Community' as const, caption: 'The hospital group pictured outside its Kaggadasapura location.' },
  { id: 'community-address', src: clientAsset('2024/12/17-1.png'), title: 'A conversation with the community', category: 'Community' as const, caption: 'A hospital group representative addresses a community gathering.' },
  { id: 'global-opening', src: clientAsset('2024/12/16-1.png'), title: 'A moment from the Global Hospital opening', category: 'Community' as const, caption: 'Guests and the hospital team at the Sri Lakshmi Global Hospital opening.' },
  { id: 'event-team', src: clientAsset('2024/12/22.png'), title: 'The hospital group at an event', category: 'Community' as const, caption: 'Hospital group representatives pictured at a Business Excellence event.' },
  { id: 'recognition', src: clientAsset('2024/12/21.png'), title: 'Shared moments of recognition', category: 'Community' as const, caption: 'Dr. Sambashiva and hospital group representatives at a Business Excellence event.' },
];
