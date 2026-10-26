"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { CalendarClock, ClipboardList, MessageCircle, PhoneIncoming, Sunrise, Sunset } from "lucide-react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { BRAND_NAME } from "../../lib/brand";
import "./day-night-story.css";

const moments = [
  { time: "2:30 pm", label: "The front desk is busy", detail: "Your team is helping the patient in front of them.", Icon: PhoneIncoming, tone: "peach" },
  { time: "2:31 pm", label: "Another call comes in", detail: "Give routine enquiries a way through during the afternoon rush.", Icon: MessageCircle, tone: "green" },
  { time: "5:00 pm", label: "The clinic closes", detail: "The lights go down. Patients still have questions.", Icon: Sunset, tone: "lilac" },
  { time: "6:15 pm", label: "“What time do you open?”", detail: "Help callers with the everyday details, even after hours.", Icon: PhoneIncoming, tone: "peach" },
  { time: "8:40 pm", label: "“Can I book for tomorrow?”", detail: "Capture the appointment request for your team to review.", Icon: CalendarClock, tone: "blue" },
  { time: "8:00 am", label: "A clearer start to the day", detail: "Pick up the overnight enquiries and their next steps together.", Icon: Sunrise, tone: "green" },
  { time: "8:15 am", label: "Your team takes it from here", detail: "Review requests, confirm availability and follow up with context.", Icon: ClipboardList, tone: "lilac" },
];

// A seeded scatter is irregular without causing server/client hydration differences.
function makeStars() {
  let seed = 87169;
  const random = () => {
    seed = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    seed ^= seed + Math.imul(seed ^ (seed >>> 7), 61 | seed);
    return ((seed ^ (seed >>> 14)) >>> 0) / 4294967296;
  };
  return Array.from({ length: 46 }, () => {
    let x = 3 + random() * 94;
    let y = 7 + random() * 82;
    // Leave the main heading and active chapter clear.
    if (x > 28 && x < 72 && y < 54) x = random() > .5 ? 74 + random() * 23 : 3 + random() * 23;
    return {
      left: `${x.toFixed(2)}%`, top: `${y.toFixed(2)}%`,
      "--star-size": `${(1.2 + random() * 2.6).toFixed(1)}px`,
      "--star-opacity": (.3 + random() * .65).toFixed(2),
      sparkle: random() > .9,
      drift: (random() - .5) * 40,
    };
  });
}
const starField = makeStars();

function Sun({ dawn = false }: { dawn?: boolean }) {
  return <div className={dawn ? "day-night-dawn" : "day-night-sun"}>
    <div className="day-night-rays">{Array.from({ length: 12 }, (_, i) => <i key={i} style={{ "--ray": i } as CSSProperties} />)}</div>
  </div>;
}

export default function DayNightStory() {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    const section = root.current;
    if (!section) return;
    gsap.registerPlugin(ScrollTrigger);
    const media = gsap.matchMedia();
    media.add("(min-width: 900px) and (min-height: 620px) and (prefers-reduced-motion: no-preference)", () => {
      const stage = section.querySelector<HTMLElement>(".day-night-stage")!;
      const track = section.querySelector<HTMLOListElement>(".day-night-track")!;
      section.dataset.animated = "true";
      const labels = gsap.utils.toArray<HTMLElement>(".day-night-phase", section);
      const sun = section.querySelector(".day-night-sun");
      const moon = section.querySelector(".day-night-moon");
      const dawn = section.querySelector(".day-night-dawn");
      const stars = section.querySelector(".day-night-stars");
      const clouds = gsap.utils.toArray<HTMLElement>(".day-night-cloud", section);
      gsap.set(labels.slice(1), { autoAlpha: 0, y: 12 });
      gsap.set([moon, dawn, stars], { autoAlpha: 0 });
      gsap.set(moon, { y: 85, rotation: -25 });
      gsap.set(dawn, { y: 95 });

      const starPoints = gsap.utils.toArray<HTMLElement>(".day-night-stars i", section);
      const twinkle = gsap.to(starPoints, {
        opacity: (index) => .2 + (index % 5) * .1,
        duration: (index) => 2.8 + (index % 7) * .57,
        ease: "sine.inOut",
        stagger: { each: .17, repeat: -1, yoyo: true }, paused: true,
      });

      // Keep text readable through the intermediate dusk colours, in both directions.
      const updateContrast = () => {
        const progress = timeline?.progress() || 0;
        twinkle.paused(progress < .35 || progress > .8);
        stage.dataset.chapter = String(progress < .285 ? 0 : progress < .485 ? 1 : progress < .845 ? 2 : 3);
        const skyColor = section.style.getPropertyValue("--story-sky") || "#fffaf0";
        const rgb = gsap.utils.splitColor(skyColor).slice(0, 3).map(value => {
          const channel = value / 255;
          return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
        });
        const luminance = rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
        stage.style.setProperty("--story-ink", luminance > 0.179 ? "#000000" : "#ffffff");
        stage.style.setProperty("--story-muted", luminance > 0.6 ? "#65615c" : luminance < 0.06 ? "#bbc8da" : luminance > 0.179 ? "#000000" : "#ffffff");
        stage.style.setProperty("--story-line", luminance > 0.179 ? "#283c3228" : "#ffffff30");
      };
      let timeline: gsap.core.Timeline;
      timeline = gsap.timeline({
        defaults: { ease: "none" },
        onUpdate: updateContrast,
        scrollTrigger: {
          id: "capture-day-night",
          trigger: stage,
          pin: stage,
          start: "top 80px",
          end: () => `+=${Math.max(window.innerHeight * 2.8, 1800)}`,
          scrub: 0.65,
          invalidateOnRefresh: true,
        },
      });
      // Sequential sky keyframes: sunset and sunrise pass through warm and violet hues instead of RGB grey.
      const sky = (at: number, duration: number, colors: [string, string, string], clouds?: number) =>
        timeline.to(section, { "--story-sky": colors[0], "--story-horizon": colors[1], "--story-glow": colors[2], ...(clouds === undefined ? {} : { "--cloud-opacity": clouds }), duration }, at);
      timeline.to(track, { x: () => -Math.max(0, track.scrollWidth - stage.clientWidth + 112), duration: 1 }, 0)
        .to(sun, { x: () => stage.clientWidth * 0.23, y: 165, autoAlpha: 0, duration: 0.32 }, 0.04);
      sky(0.06, 0.2, ["#fdf0dc", "#f7cfae", "#fbd49c"]);
      sky(0.26, 0.12, ["#f6c9b0", "#e9967f", "#f4a46c"], 0.6);
      sky(0.38, 0.1, ["#4e4672", "#8a5f7e", "#a2688a"], 0.3);
      sky(0.48, 0.1, ["#17283f", "#444564", "#5b638e"], 0.15);
      sky(0.72, 0.08, ["#6a5d8c", "#c58a94", "#e3a487"], 0.3);
      sky(0.8, 0.12, ["#f7d3c0", "#f3c6a6", "#f6c88a"], 0.7);
      sky(0.92, 0.08, ["#f8f9f3", "#e6ecdc", "#f6dfa7"], 0.85);
      timeline.to(moon, { y: 0, rotation: 0, autoAlpha: 1, duration: 0.2 }, 0.33)
        .to(stars, { autoAlpha: 1, duration: 0.16 }, 0.4)
        .to(moon, { x: () => stage.clientWidth * 0.05, y: -12, duration: 0.2 }, 0.53)
        .to([moon, stars], { autoAlpha: 0, y: -40, duration: 0.14 }, 0.72)
        .to(dawn, { autoAlpha: 1, y: 0, duration: 0.16 }, 0.81);

      clouds.forEach((cloud, index) => {
        timeline.to(cloud, { x: index % 2 ? -90 : 110, y: index % 2 ? -16 : 12, duration: 1 }, 0);
      });
      timeline.to(section.querySelectorAll(".day-night-rays"), { rotation: 38, duration: 1 }, 0);
      timeline.to(starPoints, {
        x: (index) => starField[index].drift,
        y: (index) => -10 - Math.abs(starField[index].drift),
        duration: .5,
      }, .3);

      [0.24, 0.44, 0.8].forEach((at, index) => {
        timeline.to(labels[index], { autoAlpha: 0, y: -10, duration: 0.045 }, at)
          .to(labels[index + 1], { autoAlpha: 1, y: 0, duration: 0.06 }, at + 0.045);
      });

      // Refresh after fonts settle without moving the reader to a different scroll position.
      let active = true;
      document.fonts.ready.then(() => { if (active) ScrollTrigger.refresh(); });
      return () => {
        active = false;
        delete section.dataset.animated;
        delete stage.dataset.chapter;
        ["--story-ink", "--story-muted", "--story-line"].forEach(name => stage.style.removeProperty(name));
      };
    });
    return () => media.revert();
  }, []);

  return <section ref={root} id="day-and-night" className="day-night-story" aria-labelledby="day-night-title">
    <div className="day-night-stage">
      <header className="day-night-heading">
        <h2 id="day-night-title">Your day ends.<br />New enquiries don’t.</h2>
        <p>A little more room for your team. A way through for every hello.</p>
      </header>

      <div className="day-night-sky" aria-hidden="true">
        <Sun />
        <div className="day-night-moon"><i /><i /><i /></div>
        <Sun dawn />
        <div className="day-night-stars">{starField.map(({ sparkle, drift, ...style }, index) => <i key={index} className={sparkle ? "star-sparkle" : ""} style={style as CSSProperties} />)}</div>
        <div className="day-night-clouds">{Array.from({ length: 5 }, (_, index) => <div key={index} className={`day-night-cloud cloud-${index + 1}`}><i /><i /><i /></div>)}</div>
      </div>

      <div className="day-night-phases" aria-hidden="true">
        <p className="day-night-phase"><span>2:30 pm · The afternoon rush</span>Be there when your team is <strong>busy.</strong></p>
        <p className="day-night-phase"><span>5:00 pm · Closing time</span>The day slows down.<br /><strong>Enquiries don’t.</strong></p>
        <p className="day-night-phase"><span>8:40 pm · After hours</span>Your front desk rests.<br /><strong>{BRAND_NAME} keeps listening.</strong></p>
        <p className="day-night-phase"><span>8:00 am · A new day</span>A new day.<br /><strong>A clear next step.</strong></p>
      </div>

      <div className="day-night-chapter-progress" aria-hidden="true"><i /><i /><i /><i /></div>

      <div className="day-night-window">
        <ol className="day-night-track" aria-label="A clinic day, from the afternoon rush to the next morning">
          {moments.map(({ time, label, detail, Icon, tone }) => <li className={`day-night-moment day-night-${tone}`} key={time}>
            <div className="day-night-event">
              <span className="day-night-event-icon" aria-hidden="true"><Icon size={20} strokeWidth={1.6} /></span>
              <span className="day-night-time">{time}</span>
              <h3>{label}</h3>
              <p>{detail}</p>
            </div>
            <span className="day-night-stem" aria-hidden="true"><i /></span>
          </li>)}
        </ol>
      </div>


    </div>
  </section>;
}
