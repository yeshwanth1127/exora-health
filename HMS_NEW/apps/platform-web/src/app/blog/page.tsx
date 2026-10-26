import { pageMetadata } from "../../lib/seo";
import { BRAND_NAME } from "../../lib/brand";
import ResourceShell from '../components/resource-shell';
import BlogCards from './blog-cards';
import './blog.css';

export default function BlogPage(){return <ResourceShell><main className="capture-blog"><header><p className="blog-eyebrow">THE {BRAND_NAME.toUpperCase()} BLOG</p><h1>A calmer clinic day.<br/>A little perspective.</h1><p>Practical ideas for the people who keep care moving.</p></header><BlogCards/></main></ResourceShell>}

export const metadata = pageMetadata("/blog");
