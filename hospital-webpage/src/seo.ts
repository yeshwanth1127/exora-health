import { BLOG_POSTS } from './components/blog/blogData';
import { branches } from './data/branches';
import { departments } from './data/departments';
import { doctors } from './data/doctors';

type SeoPage = {
  title: string;
  description: string;
  path: string;
  draft?: boolean;
};

const siteUrl = (() => {
  try {
    const url = new URL(import.meta.env.VITE_SITE_URL || '');
    if (
      url.protocol !== 'https:' || url.pathname !== '/' || url.search || url.hash ||
      url.username || url.password ||
      /(^localhost$|\.localhost$|\.example$|\.test$|(^|\.)example\.(com|net|org)$|^127\.)/i.test(url.hostname)
    ) return null;
    return url.origin;
  } catch {
    return null;
  }
})();
const launchApproved = import.meta.env.VITE_SEO_APPROVED === 'verified-content-and-clinic' && Boolean(siteUrl);

function pageMetadata(view: string, ids: { post: string; department: string; doctor: string; branch: string; legal: string }): SeoPage {
  const department = departments.find(item => item.id === ids.department);
  const doctor = doctors.find(item => item.id === ids.doctor);
  const branch = branches.find(item => item.id === ids.branch);
  const post = BLOG_POSTS.find(item => item.id === ids.post);
  switch (view) {
    case 'not-found': return { title: 'Page not found', description: 'The requested page could not be found.', path: '/', draft: true };
    case 'departments': return { title: 'Care departments', description: 'Browse care departments and find the right starting point for a visit.', path: '/departments/' };
    case 'department': return department
      ? { title: department.name, description: department.tagline, path: `/departments/${department.id}/` }
      : { title: 'Care department', description: 'Explore care departments.', path: '/?page=departments', draft: true };
    case 'doctors': return { title: 'Find a doctor', description: 'Browse doctors by specialty and location.', path: '/doctors/' };
    case 'doctor-detail': return doctor
      ? { title: doctor.name, description: `${doctor.title}. View profile and visit options.`, path: `/doctors/${doctor.id}/` }
      : { title: 'Doctor profile', description: 'Browse our doctors.', path: '/?page=doctors', draft: true };
    case 'locations': return { title: 'Locations', description: 'Explore in-person and virtual visit options.', path: '/locations/' };
    case 'location': return branch
      ? { title: branch.name, description: `Visit information for ${branch.area}.`, path: `/locations/${branch.id}/` }
      : { title: 'Location', description: 'Explore locations.', path: '/?page=locations', draft: true };
    case 'blog': return { title: 'Practical care guides', description: 'Short guides to preparing for appointments and organizing health records.', path: '/?page=blog', draft: true };
    case 'blog-post': return post
      ? { title: post.title, description: post.excerpt, path: `/?page=blog-post&id=${post.id}`, draft: true }
      : { title: 'Article', description: 'Read care guides.', path: '/?page=blog', draft: true };
    case 'faq': return { title: 'Frequently asked questions', description: 'Answers to common questions about visits and patient care.', path: '/faq/' };
    case 'insurance-pricing': return { title: 'Insurance and pricing', description: 'Questions to ask about coverage and expected visit costs.', path: '/insurance-pricing/' };
    case 'community': return { title: 'Community & media', description: 'Explore hospital photographs, community moments and films from Sri Lakshmi.', path: '/community/' };
    case 'facilities': return { title: 'Facilities & technology', description: 'Explore cardiac, renal, surgical and diagnostic facilities published by Sri Lakshmi Hospital.', path: '/facilities/' };
    case 'founder': return { title: 'From the founder', description: 'Dr. Sambashiva’s vision for accessible healthcare in KR Puram.', path: '/founder/' };
    case 'about': return { title: 'About us', description: 'Founded in 2002 by Dr. Sambashiva, Sri Lakshmi Super Speciality Hospital serves KR Puram with a 50-bed facility.', path: '/about/' };
    case 'how-it-works': return { title: 'How care works', description: 'Learn how to find care and plan a visit.', path: '/how-it-works/' };
    case 'contact-page': return { title: 'Contact', description: 'Find the right way to get in touch.', path: '/contact/' };
    case 'legal': return { title: 'Policies', description: 'Read site and patient policies.', path: '/?page=legal' };
    case 'legal-doc': return { title: 'Policy information', description: 'Read site and patient policy information.', path: `/?page=legal&doc=${encodeURIComponent(ids.legal)}`, draft: true };
    case 'search-results':
    case 'schedule-appointment':
    case 'insurance':
      return { title: 'Plan a visit', description: 'Explore visit options.', path: '/?page=doctors', draft: true };
    default: return { title: 'Sri Lakshmi Hospital', description: 'Explore care, clinicians, and visit information.', path: '/' };
  }
}

function setMeta(attribute: 'name' | 'property', key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.append(element);
  }
  element.content = content;
}

export function updateSeo(view: string, ids: { post: string; department: string; doctor: string; branch: string; legal: string }) {
  const page = pageMetadata(view, ids);
  const indexable = launchApproved && !page.draft;
  document.title = page.title === 'Sri Lakshmi Hospital' ? page.title : `${page.title} | Sri Lakshmi Hospital`;
  setMeta('name', 'description', page.description);
  setMeta('name', 'robots', indexable ? 'index,follow' : 'noindex,nofollow');
  setMeta('property', 'og:title', document.title);
  setMeta('property', 'og:description', page.description);
  setMeta('property', 'og:type', 'website');
  const canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (indexable && siteUrl) {
    const url = new URL(page.path, siteUrl).href;
    const link = canonical || document.createElement('link');
    link.rel = 'canonical';
    link.href = url;
    if (!canonical) document.head.append(link);
    setMeta('property', 'og:url', url);
  } else {
    canonical?.remove();
    document.head.querySelector('meta[property="og:url"]')?.remove();
  }
}
