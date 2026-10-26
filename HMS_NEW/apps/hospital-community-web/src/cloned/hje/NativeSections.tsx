import type {WebsiteProfile} from '../../lib/website';
import TextLink from './TextLink';
const TextLink_data=[{href:'/doctors',label:'Find a doctor'},{href:'/departments',label:'Specialties'},{href:'/packages',label:'Health plans'},{href:'/visit',label:'Plan your visit'}];
const TextLink_styles=[{className:'cn220'},{className:'cn221'},{className:'cn222'},{className:'cn223'}];
type Props={profile:WebsiteProfile};
export function NativeHero({profile}:Props){return <div className="hje-native" data-component-source="ditto-hje/home/hero"><section className="cn208">
          <img className="cn209" src={profile.content.heroImage||'/images/cardiology-consultation.jpg'} alt={profile.content.preview?'Illustrative care photograph, not this hospital':profile.name}/>
          {" "}
          <div className="cn211">
            <div className="cn212">
              <div className="cn213">
                <div className="cn214">
                  <h1 className="cn215" data-component="heading">{profile.content.headline||`Care, close to home in ${profile.city||'your community'}.`}</h1>
                  {" "}
                  <p className="cn216">{profile.content.introduction||`Find your doctor, understand your options and plan your visit to ${profile.name}.`}</p>
                  {" "}
                  <p className="cn217">Choose your next step below. Review the care team, explore specialties or find practical information before your visit.</p>
                  {" "}
                  <p className="cn218">
                    I am looking for…
                  </p>
                  {" "}
                </div>
                {" "}
                <div className="cn219">
                  {TextLink_data.map((d, i) => <TextLink key={i} d={d} styles={TextLink_styles[i]} />)}
                  {" "}
                </div>
                {" "}
              </div>
              {" "}
            </div>
            {" "}
          </div>
          {" "}
        </section></div>;}
export function NativeHospitalStory({profile}:Props){return <div className="hje-native" data-component-source="ditto-hje/home/hospital-story"><div className="cn224">
          <div className="cn225">
            <div className="cn226">
              <div className="cn227">
                <div className="cn228" />
                {" "}
              </div>
              {" "}
              <div className="cn229">
                <div className="cn230">
                  <div className="cn231">
                    <div className="cn232">
                      <h2 className="cn233" data-component="heading">{`Get to know ${profile.name}.`}</h2>
                      {" "}
                      <p className="cn234">{profile.content.story||'Your health decisions deserve time, clear information and a team you can speak to.'}</p>
                      {" "}
                      <p className="cn235"><a href="/about">About your hospital ↗</a></p>
                      {" "}
                    </div>
                  </div>
                  {" "}
                </div>
                {" "}
              </div>
              {" "}
            </div>
            {" "}
          </div>
          {" "}
        </div></div>;}
export function NativeVisit({profile}:Props){return <div className="hje-native" data-component-source="ditto-hje/home/visiting"><div className="cn236">
          <div className="cn237">
            <div className="cn238">
              <div className="cn239">
                <div className="cn240" />
                {" "}
              </div>
              {" "}
              <div className="cn241">
                <div className="cn242">
                  <div className="cn243">
                    <div className="cn244">
                      <h2 className="cn245" data-component="heading">Plan your visit.</h2>
                      {" "}
                      <p className="cn246">{profile.address||`${profile.city}. Confirm the exact address with the hospital before travelling.`}</p>
                      {" "}
                      <p className="cn247">{profile.content.openingHours||'Please confirm consultation and visiting hours with reception before travelling.'}</p>
                      {" "}
                    </div>
                  </div>
                  {" "}
                  <div className="cn248">
                    {" "}
                    <a className="cn249" data-component="button" href="/visit" target="_self">
                      How to get here
                    </a>
                    {" "}
                  </div>
                  {" "}
                </div>
                {" "}
              </div>
              {" "}
            </div>
            {" "}
          </div>
          {" "}
        </div></div>;}
