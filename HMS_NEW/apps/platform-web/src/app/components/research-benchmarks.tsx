import './research-benchmarks.css';

const benchmarks=[
 {value:'25%',title:'Fewer missed appointments'},
 {value:'23%',title:'Higher appointment attendance'},
 {value:'55–65%',title:'Lower reminder cost per attendance'},
];

export default function ResearchBenchmarks(){
 return <section className="research-benchmarks" aria-labelledby="research-benchmarks-title">
  <header><p className="research-eyebrow">THE POTENTIAL OF CONNECTED REMINDERS</p><h2 id="research-benchmarks-title">Small touchpoints. Measurable potential.</h2><p>What published appointment-reminder research has found.</p></header>
  <div className="research-benchmark-grid">{benchmarks.map(item=><article key={item.value}><p className="research-benchmark-value">{item.value}</p><h3>{item.title}</h3></article>)}</div>
 </section>;
}
