import test from 'node:test';import assert from 'node:assert/strict';import {compileModules} from './compile.mjs';
const {carryIssues,activeIssue}=await compileModules('issues',['issue-workflow']);
const ticket={id:'ticket',number:'261020-006',group_id:'A',item_id:'check',status:'Open',photos:['original']};
test('next checklist carries active fault, original evidence and ticket reference',()=>{const a=carryIssues({},[ticket],'A');assert.equal(a.check.status,'FAULTY');assert.match(a.check.note,/261020-006/);assert.deepEqual(a.check.photos,['original']);assert.equal(activeIssue([ticket],'A','check').id,'ticket')});
test('Open, In progress and Awaiting verification all stay faulty',()=>{for(const status of ['Open','In progress','Awaiting verification'])assert.equal(carryIssues({check:{status:'Normal'}},[{...ticket,status}],'A').check.status,'FAULTY')});
test('closed issue and other locations do not force a new checklist fault',()=>{assert.deepEqual(carryIssues({},[{...ticket,status:'Closed'}],'A'),{});assert.deepEqual(carryIssues({},[ticket],'B'),{})});
test('additional observations and new photos survive carry-forward without changing original ticket',()=>{const draft={check:{note:'Awaiting part',photos:['new'],temp:'25'}};assert.deepEqual(carryIssues(draft,[ticket],'A').check,{...draft.check,carriedIssueId:'ticket',status:'FAULTY'});assert.deepEqual(ticket.photos,['original'])});

test('closure clears carried evidence on an already-open draft and asks for a fresh status',()=>{const draft=carryIssues({},[ticket],'A');const next=carryIssues(draft,[{...ticket,status:'Closed'}],'A');assert.equal(next.check.status,'');assert.deepEqual(next.check.photos,[]);assert.equal(next.check.note,'')});
