import {posts} from './posts';
import './blog.css';
/** Shared by Home and the blog index so artwork and article copy stay aligned. */
export default function BlogCards(){return <div className="blog-grid">{posts.map(p=><a className="blog-card" key={p.slug} href={`/blog/${p.slug}`}><div className="blog-art"><img loading="lazy" decoding="async" src={p.image} alt={p.alt} width="600" height="480"/></div><div className="blog-card-copy"><span>{p.category} · Workflow guide</span><h2>{p.title}</h2><p>{p.excerpt}</p><span className="blog-read">Read the guide <span aria-hidden="true">→</span></span></div></a>)}</div>}
