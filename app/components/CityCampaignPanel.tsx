'use client';

/** The Mayor's Programme: a real goal overlay, never an independent save.
 * Numbers come directly from the same snapshot used by the HUD.
 */
import {useEffect,useRef,useState} from 'react';
import type {CityCampaignVitals,ChapterEvaluation} from '../hooks/cityCampaign';
import {evaluateCityCampaign,cityGoalText} from '../hooks/cityCampaign';

function ChapterCard({chapter,number}:{chapter:ChapterEvaluation;number:number}){
 const current=chapter.status==='active';
 return (
  <article className={`campaign-chapter campaign-${chapter.status}`}
   data-campaign-chapter={chapter.id} data-campaign-status={chapter.status}>
   <header>
    <span className="campaign-number">{String(number).padStart(2,'0')}</span>
    <div><small>{chapter.subtitle}</small><h3>{chapter.title}</h3></div>
    <span className="campaign-stage-status">{chapter.status==='complete'?'COMPLETE':current?'CURRENT':'LOCKED'}</span>
   </header>
   {(current||chapter.status==='complete')&&(
     <div className="campaign-chapter-detail">
      <p>{chapter.guidance}</p>
      <div className="campaign-goals">
       {chapter.goals.map(goal=>(
        <div className="campaign-goal" data-goal-metric={goal.metric} data-goal-met={goal.met?'true':'false'} key={goal.metric}>
         <div className="campaign-goal-label">
          <span><b className="campaign-check">{goal.met?'✓':'·'}</b>{goal.label}</span>
          <strong>{cityGoalText(goal.value,goal.unit)} / {goal.direction==='atMost'?'≤ ':'≥ '}{cityGoalText(goal.target,goal.unit)}</strong>
         </div>
         <div className="campaign-track" role="progressbar" aria-valuemin={0} aria-valuemax={100}
           aria-valuenow={Math.round(goal.progress*100)} aria-label={goal.label}>
          <span style={{width:`${Math.round(goal.progress*100)}%`}}/>
         </div>
        </div>
       ))}
      </div>
     </div>
   )}
  </article>
 );
}

export function CityCampaignPanel({vitals}:{vitals:CityCampaignVitals}){
 const [open,setOpen]=useState(false);
 const trigger=useRef<HTMLButtonElement>(null);
 const close=()=>{setOpen(false);requestAnimationFrame(()=>trigger.current?.focus());};
 const campaign=evaluateCityCampaign(vitals);
 useEffect(()=>{
  if(!open)return;
  const keydown=(ev:KeyboardEvent)=>{if(ev.key==='Escape')close();};
  window.addEventListener('keydown',keydown);
  return()=>window.removeEventListener('keydown',keydown);
 },[open]);
 return (
  <>
   <button ref={trigger} type="button" className="campaign-trigger"
    data-campaign-trigger aria-haspopup="dialog" aria-expanded={open}
    onClick={()=>setOpen(true)}>
     <span>City Hall</span>
     <strong>{campaign.finished?'MASTER PLAN COMPLETE':`CHAPTER ${Math.min(campaign.currentChapter+1,campaign.total)} / ${campaign.total}`}</strong>
    </button>
   {open&&(
    <div className="campaign-overlay" onMouseDown={event=>{if(event.target===event.currentTarget)close();}}>
     <section role="dialog" aria-modal="true" aria-labelledby="campaign-heading" className="campaign-dialog">
      <header className="campaign-heading">
       <div><span>CAREER MODE · MAYOR’S PROGRAMME</span><h2 id="campaign-heading">Build a city worth staying in.</h2></div>
       <button type="button" className="campaign-close" onClick={close} aria-label="Close City Hall">×</button>
      </header>
      <p className="campaign-intro">Six chapters from the first neighbourhood to a thriving regional capital.
       All targets use live population, employment, treasury, public funding, happiness and
       congestion from the actual simulation. No fake tasks, no hidden currency or paid rerolls.
       Progress can fall if the city’s conditions worsen.</p>
      <div className="campaign-summary" aria-live="polite">
       <div><small>CHAPTERS CURRENTLY MET</small><strong>{campaign.complete} / {campaign.total}</strong></div>
       <div><small>CAREER PROGRESS</small><strong>{Math.round(campaign.progress*100)}%</strong></div>
       <div><small>STATUS</small><strong data-campaign-current>{campaign.finished?'CITY COMPLETE':campaign.chapters[campaign.currentChapter].title}</strong></div>
      </div>
      {campaign.finished&&<div className="campaign-victory" role="status">City Hall recognition awarded: Regional Capital. Keep your city healthy to retain this achievement.</div>}
      <div className="campaign-list">
       {campaign.chapters.map((chapter,i)=><ChapterCard key={chapter.id} chapter={chapter} number={i+1}/>)}
      </div>
      <footer>This programme is calculated from your city save. Changing or loading a city immediately recalculates every requirement.</footer>
     </section>
    </div>
   )}
  </>
 );
}
