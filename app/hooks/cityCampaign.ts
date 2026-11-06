/**
 * The Mayor's Programme — real-time goals over the authoritative city
 * simulation. No shadow currency, localStorage counter or fabricated progress.
 *
 * Recomputed from live World/TickUpdate metrics, so pausing, zoning,
 * growth, bankruptcy, a loaded city or New City all report the same truth.
 */
export interface CityCampaignVitals {
  tick: number;
  population: number;
  money: number;
  employed: number;
  unemployed: number;
  monthlyIncome: number;
  monthlyUpkeep: number;
  happiness: number;
  congestion: number;
  serviceFundingPerMille: number;
}

export type GoalMetric =
  | 'population' | 'money' | 'employed' | 'net' | 'happiness'
  | 'unemployment' | 'congestion' | 'serviceFundingPerMille';

export interface CityGoalRule {
  metric: GoalMetric;
  label: string;
  target: number;
  direction: 'atLeast' | 'atMost';
  unit: 'people' | 'coins' | 'ratio' | 'percent' | 'funding';
}

export interface CityCampaignChapter {
  id: string;
  title: string;
  subtitle: string;
  guidance: string;
  goals: readonly CityGoalRule[];
}

const atLeast=(metric:GoalMetric,label:string,target:number,unit:CityGoalRule['unit']):CityGoalRule=>({
  metric,label,target,direction:'atLeast',unit
});
const atMost=(metric:GoalMetric,label:string,target:number,unit:CityGoalRule['unit']):CityGoalRule=>({
  metric,label,target,direction:'atMost',unit
});

/** Sequential chapters are a tutorial-to-sandbox career, not free credits. */
export const CITY_CAMPAIGN: readonly CityCampaignChapter[] = [
  {id:'foundation',title:'Foundations',subtitle:'Build your first neighbourhood',
    guidance:'Connect residential zones to roads, electricity and water. Keep a reserve for maintenance.',
    goals:[atLeast('population','Residents',10,'people'),atLeast('money','Treasury reserve',2000,'coins')]},
  {id:'commerce',title:'A Working Town',subtitle:'Turn housing into a functioning labour market',
    guidance:'Zone commercial and industrial lots on connected roads so residents can actually reach jobs.',
    goals:[atLeast('population','Residents',30,'people'),atLeast('employed','Employed citizens',12,'people'),
      atMost('unemployment','Unemployment',.35,'percent')]},
  {id:'balanced',title:'Balanced Books',subtitle:'Make the budget sustainable',
    guidance:'Increase the tax base and avoid overbuilding expensive services before population can fund them.',
    goals:[atLeast('population','Residents',50,'people'),atLeast('net','Projected monthly surplus',0,'coins'),
      atLeast('serviceFundingPerMille','Upkeep paid',1000,'funding')]},
  {id:'community',title:'A Place to Live',subtitle:'Make prosperity visible to citizens',
    guidance:'Provide road-connected services and parks, maintain jobs and keep public finances healthy.',
    goals:[atLeast('population','Residents',80,'people'),atLeast('happiness','City happiness',.58,'percent'),
      atMost('unemployment','Unemployment',.25,'percent')]},
  {id:'transport',title:'Moving Metropolis',subtitle:'Grow without gridlock',
    guidance:'Connect several neighbourhoods with alternate routes, and distribute employment across your city.',
    goals:[atLeast('population','Residents',130,'people'),atLeast('employed','Employed citizens',70,'people'),
      atMost('congestion','Road congestion',.4,'percent')]},
  {id:'legacy',title:'Regional Capital',subtitle:'Achieve a wealthy, healthy and resilient city',
    guidance:'Balance profitable growth with full maintenance funding, employment and quality of life.',
    goals:[atLeast('population','Residents',200,'people'),atLeast('money','Treasury reserve',15000,'coins'),
      atLeast('net','Projected monthly surplus',300,'coins'),
      atLeast('happiness','City happiness',.68,'percent'),
      atLeast('serviceFundingPerMille','Upkeep paid',1000,'funding')]},
] as const;

export interface GoalEvaluation extends CityGoalRule {
  value: number;
  met: boolean;
  progress: number;
}
export interface ChapterEvaluation extends Omit<CityCampaignChapter,'goals'> {
  goals: GoalEvaluation[];
  met: boolean;
  progress: number;
  status: 'locked' | 'active' | 'complete';
}
export interface CampaignEvaluation {
  chapters: ChapterEvaluation[];
  currentChapter: number;
  finished: boolean;
  complete: number;
  total: number;
  progress: number;
}

const safe=(value:number):number=>Number.isFinite(value)?Math.max(0,value):0;
const clamp01=(value:number):number=>Math.max(0,Math.min(1,value));
export function cityGoalValue(v:CityCampaignVitals,metric:GoalMetric):number{
  switch(metric){
    case 'population':return safe(v.population);
    case 'money':return safe(v.money);
    case 'employed':return safe(v.employed);
    case 'net':return Number.isFinite(v.monthlyIncome-v.monthlyUpkeep)?v.monthlyIncome-v.monthlyUpkeep:-1e10;
    case 'happiness':return clamp01(safe(v.happiness));
    case 'unemployment':{
      const workforce=safe(v.employed)+safe(v.unemployed);
      return workforce>0?clamp01(safe(v.unemployed)/workforce):0;
    }
    case 'congestion':return clamp01(safe(v.congestion));
    case 'serviceFundingPerMille':return Math.min(1000,safe(v.serviceFundingPerMille));
  }
}
export function cityGoalProgress(rule:CityGoalRule,value:number):number{
  if(!Number.isFinite(value))return 0;
  if(rule.direction==='atLeast'){
    if(value>=rule.target)return 1;
    // A break-even zero surplus has a binary threshold, not 0/0.
    if(rule.target<=0)return 0;
    return clamp01(value/rule.target);
  }
  if(value<=rule.target)return 1;
  if(value<=0||rule.target<=0)return 0;
  return clamp01(rule.target/value);
}
export function cityGoalText(value:number,unit:CityGoalRule['unit']):string{
  if(unit==='percent')return Math.round(value*100)+'%';
  if(unit==='funding')return Math.round(value/10)+'%';
  if(unit==='ratio')return value.toFixed(2);
  return Math.round(value).toLocaleString('en-US');
}
export function evaluateCityCampaign(v:CityCampaignVitals):CampaignEvaluation{
  const evaluated=CITY_CAMPAIGN.map(chapter=>{
    const goals=chapter.goals.map(rule=>{
      const value=cityGoalValue(v,rule.metric);
      const progress=cityGoalProgress(rule,value);
      return {...rule,value,progress,met:progress>=1};
    });
    return {...chapter,goals,met:goals.every(g=>g.met),
      progress:goals.reduce((sum,g)=>sum+g.progress,0)/goals.length,
      status:'locked' as const};
  });
  const firstUnmet=evaluated.findIndex(stage=>!stage.met);
  const currentChapter=firstUnmet<0?evaluated.length:firstUnmet;
  return {
    chapters:evaluated.map((stage,i)=>({...stage,status:
      (i<currentChapter?'complete':i===currentChapter?'active':'locked') as ChapterEvaluation['status']})),
    currentChapter,finished:firstUnmet<0,
    complete:currentChapter,total:evaluated.length,
    progress:evaluated.reduce((sum,stage,i)=>sum+
      (i<currentChapter?1:i===currentChapter?stage.progress:0),0)/evaluated.length,
  };
}
