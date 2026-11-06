import {describe,it,expect} from 'vitest';
import {CITY_CAMPAIGN,cityGoalProgress,cityGoalText,cityGoalValue,evaluateCityCampaign} from './cityCampaign';
import type {CityCampaignVitals,CityGoalRule} from './cityCampaign';

const start:CityCampaignVitals={
 tick:0,population:0,money:10000,employed:0,unemployed:0,
 monthlyIncome:0,monthlyUpkeep:0,happiness:0.48,congestion:0,
 serviceFundingPerMille:1000,
};
const enriched:CityCampaignVitals={
 tick:440,population:230,money:19000,employed:140,unemployed:8,
 monthlyIncome:1800,monthlyUpkeep:1050,happiness:.81,congestion:.13,
 serviceFundingPerMille:1000,
};
describe("Mayor's Programme, derived from saved city simulation",()=>{
 it('defines six sequential chapters and no phantom currency rewards',()=>{
  expect(CITY_CAMPAIGN).toHaveLength(6);
  expect(new Set(CITY_CAMPAIGN.map(x=>x.id)).size).toBe(6);
  for(const chapter of CITY_CAMPAIGN){
   expect(chapter.goals.length).toBeGreaterThanOrEqual(2);
   expect(chapter.guidance).toBeTruthy();
   for(const goal of chapter.goals)expect(goal.target).toBeGreaterThanOrEqual(0);
  }
 });
 it('new city starts on the first residential goal without any free completion',()=>{
  const c=evaluateCityCampaign(start);
  expect(c.currentChapter).toBe(0);
  expect(c.complete).toBe(0);
  expect(c.finished).toBe(false);
  expect(c.chapters.map(x=>x.status)).toEqual(['active','locked','locked','locked','locked','locked']);
  expect(c.chapters[0].goals[0].value).toBe(0);
  expect(c.chapters[0].goals[1].met).toBe(true);
  expect(c.progress).toBeGreaterThan(0);
  expect(c.progress).toBeLessThan(.2);
 });
 it('population and reserve really unlock only chapter one, not future missions',()=>{
  const c=evaluateCityCampaign({...start,population:15,money:2500});
  expect(c.currentChapter).toBe(1);
  expect(c.complete).toBe(1);
  expect(c.chapters[0].status).toBe('complete');
  expect(c.chapters[1].status).toBe('active');
  expect(c.chapters[2].status).toBe('locked');
 });
 it('a commuter city with no jobs cannot pass employment chapter',()=>{
  const c=evaluateCityCampaign({...start,population:60,money:8800,employed:0,unemployed:38});
  expect(c.currentChapter).toBe(1);
  expect(c.chapters[1].goals.find(x=>x.metric==='employed')?.met).toBe(false);
  expect(c.chapters[1].goals.find(x=>x.metric==='unemployment')?.met).toBe(false);
 });
 it('monthly deficits fail chapter three despite high treasury and full funding',()=>{
  const c=evaluateCityCampaign({
   ...enriched,money:20000,monthlyIncome:100,monthlyUpkeep:260,
  });
  expect(c.currentChapter).toBe(2);
  const net=c.chapters[2].goals.find(x=>x.metric==='net');
  expect(net?.value).toBe(-160);
  expect(net?.met).toBe(false);
  expect(net?.progress).toBe(0);
 });
 it('true all-around sustainable city earns the final recognition',()=>{
  const c=evaluateCityCampaign(enriched);
  expect(c.complete).toBe(6);
  expect(c.currentChapter).toBe(6);
  expect(c.finished).toBe(true);
  expect(c.progress).toBe(1);
  expect(c.chapters.every(x=>x.status==='complete'&&x.met&&x.progress===1)).toBe(true);
 });
 it('real deterioration removes the recognition; no stale milestone flags or replay rewards',()=>{
  const good=evaluateCityCampaign(enriched);
  expect(good.finished).toBe(true);
  const bad=evaluateCityCampaign({...enriched,congestion:.85,happiness:.2,serviceFundingPerMille:400});
  expect(bad.finished).toBe(false);
  expect(bad.currentChapter).toBe(2);
  expect(bad.chapters[2].status).toBe('active');
  expect(bad.complete).toBe(2);
  expect(evaluateCityCampaign(enriched)).toEqual(good);
 });
 it('value functions match established labor, fiscal and transit semantics',()=>{
  expect(cityGoalValue(enriched,'unemployment')).toBeCloseTo(8/148,10);
  expect(cityGoalValue(enriched,'net')).toBe(750);
  expect(cityGoalValue(enriched,'congestion')).toBe(.13);
  expect(cityGoalValue({...enriched,unemployed:NaN},'unemployment')).toBe(0);
  expect(cityGoalValue({...enriched,congestion:Infinity},'congestion')).toBe(0);
  expect(cityGoalValue({...enriched,monthlyIncome:Infinity},'net')).toBeLessThan(0);
 });
 it('at-least and at-most progress never divides by zero or overflows',()=>{
  const g:CityGoalRule={metric:'population',label:'Test',target:100,direction:'atLeast',unit:'people'};
  expect(cityGoalProgress(g,50)).toBe(.5);
  expect(cityGoalProgress(g,500)).toBe(1);
  expect(cityGoalProgress({...g,target:0},-100)).toBe(0);
  expect(cityGoalProgress({...g,target:0},0)).toBe(1);
  expect(cityGoalProgress({...g,direction:'atMost',target:.3},.6)).toBe(.5);
  expect(cityGoalProgress({...g,direction:'atMost',target:.3},0)).toBe(1);
  expect(cityGoalProgress(g,NaN)).toBe(0);
  expect(cityGoalProgress(g,Infinity)).toBe(0);
 });
 it('units render correctly without confusing per-mille funding with unemployment',()=>{
  expect(cityGoalText(.245,'percent')).toBe('25%');
  expect(cityGoalText(1000,'funding')).toBe('100%');
  expect(cityGoalText(870,'funding')).toBe('87%');
  expect(cityGoalText(1000,'coins')).toBe('1,000');
 });
 it('the campaign does not mutate the source city snapshot',()=>{
  const s=Object.freeze({...enriched});
  const before=JSON.stringify(s);
  for(let i=0;i<20;i++)evaluateCityCampaign(s);
  expect(JSON.stringify(s)).toBe(before);
 });
});
