import type { RankPreview } from "../../business-report/local-rank-map";

// Names and locations from OpenStreetMap (© OpenStreetMap contributors), fetched 23 Oct 2026.
// `prominence` only drives the illustrative ranks below; it is not a measured value.
export const rankPreview: RankPreview = {
  query: "hospital near me",
  targetId: "manipal",
  hospitals: [
    { id: "manipal", name: "Manipal Hospital", lat: 12.95871, lng: 77.64903, prominence: 7 },
    { id: "chinmaya", name: "Chinmaya Mission Hospital", lat: 12.97793, lng: 77.64619, prominence: 8 },
    { id: "cloudnine", name: "Cloudnine Hospital", lat: 12.95978, lng: 77.65691, prominence: 7.4 },
    { id: "hosmat", name: "Hosmat Hospitals", lat: 12.96447, lng: 77.6143, prominence: 8 },
    { id: "motherhood", name: "Motherhood Hospital", lat: 12.97844, lng: 77.63758, prominence: 6.6 },
    { id: "ojus", name: "OJUS Multi Speciality Hospital", lat: 12.95727, lng: 77.65394, prominence: 5.4 },
    { id: "medihope", name: "Medihope Super Specialty Hospital", lat: 12.97364, lng: 77.67519, prominence: 6.2 },
    { id: "axon", name: "Axon Speciality Hospital", lat: 12.97389, lng: 77.64609, prominence: 5 },
    { id: "life", name: "Life Hospital", lat: 12.97562, lng: 77.64706, prominence: 4.8 },
    { id: "athoz", name: "Athoz Hospitals", lat: 12.96734, lng: 77.6425, prominence: 4.6 },
    { id: "swasthya", name: "Swasthya Hospitals", lat: 12.9545, lng: 77.64016, prominence: 4.6 },
    { id: "shree-sai", name: "Shree Sai Speciality Hospital", lat: 12.95559, lng: 77.6418, prominence: 4.4 },
    { id: "lohitha", name: "Lohitha Hospital", lat: 12.96395, lng: 77.64308, prominence: 4.2 },
    { id: "magdum", name: "Magdum Hospital", lat: 12.95895, lng: 77.66038, prominence: 4 },
    { id: "miracle", name: "Miracle Hospital", lat: 12.95886, lng: 77.65432, prominence: 3.8 },
    { id: "hal", name: "HAL Hospital", lat: 12.96237, lng: 77.6664, prominence: 4.5 },
    { id: "bhargavi", name: "Dr. Bhargavi Reddy Women & Children Hospital", lat: 12.9754, lng: 77.64706, prominence: 4.2 },
    { id: "ayaans", name: "Ayaans Hospital", lat: 12.97826, lng: 77.64359, prominence: 4 },
    { id: "rashmi", name: "Rashmi Hospital", lat: 12.9767, lng: 77.63623, prominence: 4 },
    { id: "sujatha", name: "Sujatha Hospital", lat: 12.97813, lng: 77.63724, prominence: 4.2 },
    { id: "cambridge", name: "Cambridge Hospital", lat: 12.97162, lng: 77.62738, prominence: 4.6 },
    { id: "shyamala", name: "Shyamala Hospital", lat: 12.97143, lng: 77.62749, prominence: 4 },
    { id: "sri-ram", name: "Sri Ram Speciality Hospital", lat: 12.95438, lng: 77.62098, prominence: 4.4 },
    { id: "health-cottage", name: "Health Cottage Hospital", lat: 12.97091, lng: 77.63211, prominence: 3.8 },
    { id: "venus", name: "Venus MultiSpeciality Hospital", lat: 12.97218, lng: 77.68079, prominence: 4.8 },
    { id: "well-spring", name: "Well Spring Hospital", lat: 12.94257, lng: 77.62243, prominence: 4.2 },
    { id: "sai-thunga", name: "Sai Thunga Hospitals", lat: 12.924, lng: 77.64818, prominence: 4.6 },
  ],
};
