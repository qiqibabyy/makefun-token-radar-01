(function(){
'use strict';
const D=globalThis.RADAR_DATA,E=globalThis.RadarEngine;
const $=id=>document.getElementById(id);
if(!D || !E){$('load-error').hidden=false;return;}
const money=(n,exact=false)=>n===null?'Not reported':exact?'$'+Math.round(n).toLocaleString('en-US'):'$'+(n>=1e9?(n / 1e9).toFixed(2)+'B':n>=1e6?(n / 1e6).toFixed(2)+'M':n>=1e3?(n / 1e3).toFixed(1)+'K':n.toFixed(0));
const pct=n=>n===null?'—':(n>=0?'+':'')+n.toFixed(2)+'%';
const ageText=n=>n===null?'Unknown':n<365?n+'d':(n / 365).toFixed(1)+'y';
const short=n=>Math.round(n).toLocaleString('en-US');
const compare=(a,b)=>a<b?-1:a>b?1:0;
const initial={view:'pre',scope:'all',q:'',category:'',chain:'',min:0,growing:false,sort:'implied_value_usd',direction:-1,page:1,size:25};
let state={...initial},saved;
try{saved=new Set(JSON.parse(localStorage.getItem('signal-atlas-saved')|| '[]'));}catch(_){saved=new Set();}
const bySlug=new Map([...D.rows,...D.live].map(r=>[r.slug,r]));
saved=new Set([...saved].filter(slug=>bySlug.has(slug)));
function node(tag,attrs,...children){
const n=document.createElement(tag);
for(const[key,value]of Object.entries(attrs ||{})){
if(value===null|| value===undefined)continue;
if(key==='text')n.textContent=value;
else if(key.startsWith('on'))n.addEventListener(key.slice(2),value);
else n.setAttribute(key,String(value));
}
children.flat().filter(x=>x !==null&& x !==undefined).forEach(c=>n.append(typeof c==='string'?document.createTextNode(c):c));
return n;
}
function replace(id,...children){$(id).replaceChildren(...children.flat());}
function initials(name){const words=name.split(/\s+/);return(words[0][0]+(words.length>1?words[words.length - 1][0]:words[0][1]|| '')).toUpperCase();}
function avatar(r){const tone=[...r.slug].reduce((a,c)=>a+c.charCodeAt(0),0)% 5;return node('span',{class:'avatar tone-'+tone,'aria-hidden':'true',text:initials(r.name)});}
function writeHash(extra={}){
const p=new URLSearchParams();
for(const[key,value]of Object.entries(state))if(value !==initial[key])p.set(key,String(value));
for(const[key,value]of Object.entries(extra))if(value)p.set(key,value);
if($('detail').open && $('detail').dataset.slug && !('protocol'in extra))p.set('protocol',$('detail').dataset.slug);
if($('model').open && !('model'in extra))p.set('model','1');
try{history.replaceState(null,'',location.pathname+location.search+(p.size?'#'+p:''));}catch(_){/* file viewers may disable history */}
}
function readHash(){
const p=new URLSearchParams(location.hash.slice(1));
state={...initial};
for(const key of['q','category','chain'])state[key]=p.get(key)|| '';
state.view=p.get('view')==='live'?'live':'pre';
state.scope=['all','watchlist','early','saved'].includes(p.get('scope'))?p.get('scope'):'all';
state.growing=p.get('growing')==='true';
state.min=Math.max(0,Number(p.get('min'))|| 0);
state.page=Math.max(1,Math.floor(Number(p.get('page'))|| 1));
state.size=[25,50,100].includes(Number(p.get('size')))?Number(p.get('size')):25;
state.direction=p.get('direction')==='1'?1:-1;
if(['rank','name','category','tvl_usd','change_7d','age_days','implied_value_usd','mcap_usd','capital'].includes(p.get('sort')))state.sort=p.get('sort');
if(state.view==='live'&& state.sort==='implied_value_usd')state.sort='mcap_usd';
syncControls();renderTable();
if(p.get('protocol')&& bySlug.has(p.get('protocol')))openDetail(p.get('protocol'));
else if($('detail').open)$('detail').close();
if(p.get('model')==='1')openModel();
}
function change(update){Object.assign(state,update,{page:1});syncControls();renderTable();writeHash();}
function reset(){change({q:'',category:'',chain:'',min:0,growing:false,scope:'all'});}
function save(slug){
saved.has(slug)?saved.delete(slug):saved.add(slug);
try{localStorage.setItem('signal-atlas-saved',JSON.stringify([...saved].sort(compare)));}catch(_){/* saving remains available in this tab */}
renderTable();
const button=$('detail-save');
if(button && $('detail').dataset.slug===slug){button.textContent=saved.has(slug)?'★ Saved':'☆ Save protocol';button.setAttribute('aria-pressed',saved.has(slug));}
}
function filteredRows(){
const q=state.q.trim().toLowerCase();
return(state.view==='pre'?D.rows:D.live).filter(r=>
(!q ||[r.name,r.slug,r.category || '',...r.chains].join(' ').toLowerCase().includes(q))
&&(!state.category || r.category===state.category)&&(!state.chain || r.chains.includes(state.chain))
&& r.tvl_usd>=state.min &&(!state.growing || r.change_7d !==null&& r.change_7d>0)
&&(state.scope !=='saved'|| saved.has(r.slug))
&&(state.view !=='pre'|| state.scope !=='watchlist'|| r.watchlist)
&&(state.view !=='pre'|| state.scope !=='early'|| !r.watchlist));
}
function sortedRows(){
const key=state.sort,list=filteredRows();
return list.sort((a,b)=>{
const x=key==='capital'?a.farm?.capital:a[key],y=key==='capital'?b.farm?.capital:b[key];
if(x===null|| x===undefined)return y===null|| y===undefined?compare(a.slug,b.slug):1;
if(y===null|| y===undefined)return -1;
return(typeof x==='string'?compare(x.toLowerCase(),y.toLowerCase()):x - y)* state.direction || compare(a.slug,b.slug);
});
}
function fillOptions(id,values,label){
replace(id,node('option',{value:'',text:label}),[...new Set(values)].filter(Boolean).sort(compare).map(v=>node('option',{value:v,text:v})));
}
function syncControls(){
$('search').value=state.q;
const source=state.view==='pre'?D.rows:D.live;
fillOptions('category',source.map(r=>r.category),'All categories');
fillOptions('chain',source.flatMap(r=>r.chains),'All chains');
$('category').value=state.category;$('chain').value=state.chain;
if(!$('category').value)state.category='';
if(!$('chain').value)state.chain='';
$('min-tvl').value=String(state.min);$('page-size').value=String(state.size);
$('momentum').setAttribute('aria-pressed',state.growing);
$('pre-tab').setAttribute('aria-pressed',state.view==='pre');$('live-tab').setAttribute('aria-pressed',state.view==='live');
document.querySelectorAll('[data-scope]').forEach(b=>{b.classList.toggle('active',b.dataset.scope===state.scope);b.setAttribute('aria-pressed',b.dataset.scope===state.scope);b.hidden=state.view==='live'&& b.dataset.scope !=='all';});
$('live-note').hidden=state.view !=='live';
$('nav-radar').classList.toggle('active',state.scope !=='saved');$('nav-saved').classList.toggle('active',state.scope==='saved');
}
function headerCell(key,label,numeric=false){
const active=state.sort===key;
return node('th',{scope:'col',class:numeric?'numeric':'','aria-sort':active?(state.direction===1?'ascending':'descending'):'none'},node('button',{type:'button',onclick:()=>change({sort:key,direction:active?-state.direction:key==='name'|| key==='rank'?1:-1}),text:label},node('span',{class:'sort-indicator','aria-hidden':'true',text:active?(state.direction===1?'↑':'↓'):''})));
}
function renderTable(){
const live=state.view==='live',rows=sortedRows(),pages=Math.max(1,Math.ceil(rows.length / state.size));
state.page=Math.min(state.page,pages);
const start=(state.page - 1)* state.size,shown=rows.slice(start,start+state.size);
const topValue=D.rows[0].implied_value_usd;
replace('table-head',node('tr',{},live?node('th',{scope:'col',text:'Token'}):headerCell('rank','#'),headerCell('name','Protocol'),node('th',{scope:'col',text:'Chains'}),headerCell('tvl_usd','TVL',true),headerCell('change_7d','7D change',true),live?null:headerCell('age_days','History',true),headerCell(live?'mcap_usd':'implied_value_usd',live?'Market cap':'Implied value',true),live?null:headerCell('capital','Farm budget',true),node('th',{scope:'col',text:'Actions',class:'sr-only'})));
replace('table-body',shown.map(r=>node('tr',{'data-slug':r.slug,class:$('detail').dataset.slug===r.slug && $('detail').open?'selected':''},
node('td',{class:'rank',text:live?r.symbol || 'ID':String(r.rank).padStart(2,'0')}),
node('td',{},node('div',{class:'protocol-cell'},avatar(r),node('div',{},node('button',{class:'protocol-name',type:'button',onclick:()=>openDetail(r.slug),text:r.name}),node('div',{class:'protocol-meta'},r.category || 'Other',r.watchlist?node('span',{class:'watch-badge',text:'WATCHLIST'}):null)))),
node('td',{class:'chain-cell',title:r.chains.join(', ')},r.chains[0]|| 'Unreported',r.chains.length>1?node('span',{text:'+'+(r.chains.length - 1)}):null),
node('td',{class:'numeric',title:money(r.tvl_usd,true),text:money(r.tvl_usd)}),
node('td',{class:'numeric '+(r.change_7d===null?'unknown':r.change_7d>=0?'positive':'negative'),text:pct(r.change_7d)}),
live?null:node('td',{class:'numeric '+(r.age_days===null?'unknown':''),title:'Days since first listing: '+(r.age_days??'unknown'),text:ageText(r.age_days)}),
node('td',{class:'numeric value-cell',title:money(live?r.mcap_usd:r.implied_value_usd,true)},node('span',{class:'value-number',text:money(live?r.mcap_usd:r.implied_value_usd)}),live?null:node('div',{class:'value-bar','aria-hidden':'true'},node('i',{style:'width:'+Math.max(3,r.implied_value_usd / topValue * 100)+'%'}))),
live?null:node('td',{class:'numeric budget',text:'$'+r.farm.capital}),
node('td',{class:'row-actions'},node('button',{class:'save-button'+(saved.has(r.slug)?' saved':''),'aria-label':(saved.has(r.slug)?'Unsave ':'Save ')+r.name,'aria-pressed':saved.has(r.slug),onclick:()=>save(r.slug),text:saved.has(r.slug)?'★':'☆'}),node('button',{class:'open-button','aria-label':'Open details for '+r.name,onclick:()=>openDetail(r.slug),text:'↗'}))
)));
$('result-count').textContent=rows.length+' of '+(live?D.live.length:D.rows.length)+' records'+(state.scope==='saved'?' · saved':!live?' · '+rows.filter(r=>r.watchlist).length+'/'+D.watchlist.length+' watchlist':'');
$('empty').hidden=rows.length !==0;document.querySelector('.table-wrap').hidden=!rows.length;
$('page-range').textContent=rows.length?'Showing '+(start+1)+'–'+Math.min(start+state.size,rows.length)+' of '+rows.length:'0 results';
$('page-label').textContent=state.page+' / '+pages;$('prev-page').disabled=state.page<=1;$('next-page').disabled=state.page>=pages;
$('saved-count').textContent=saved.size;
$('clear-filters').hidden=!state.q && !state.category && !state.chain && !state.min && !state.growing && state.scope==='all';
}
function factor(label,value,note){return node('div',{class:'factor'},node('span',{class:'factor-key',text:label},note?node('small',{text:note}):null),node('b',{text:value}));}
function openDetail(slug){
const r=bySlug.get(slug);if(!r)return;
const ranked=r.rank !==undefined,dialog=$('detail');dialog.dataset.slug=slug;
const header=node('div',{class:'dialog-header'},node('div',{class:'detail-identity'},avatar(r),node('div',{},node('div',{class:'eyebrow',text:ranked?'PROTOCOL BRIEF / RANK '+r.rank+' OF '+D.rows.length:'TOKEN RECORDED / OUTSIDE THE RANKING'}),node('h2',{id:'detail-title',text:r.name}),node('div',{class:'detail-sub',text:(r.category || 'Other')+' · '+(ranked && r.watchlist?'Sealed watchlist':ranked?'Below-floor early radar':'Token evidence in snapshot')}))),node('button',{class:'close-button','aria-label':'Close protocol details',onclick:()=>dialog.close(),text:'×'}));
dialog.replaceChildren(header);
if(ranked){
const f=r.model,recomputed=E.valueOf(r,D.as_of).implied_value_usd;
const valuation=node('section',{class:'valuation','aria-label':'Valuation breakdown'},node('div',{class:'section-label',text:'IMPLIED TOKEN VALUE'}),node('div',{class:'big-value',title:money(r.implied_value_usd,true),text:money(r.implied_value_usd)}),node('p',{class:'fine-print',text:money(r.implied_value_usd,true)+' · Model estimate at the sealed snapshot.'}),node('div',{class:'value-rule'}),node('div',{class:'section-label',text:'HOW THIS VALUE IS BUILT'}),
factor('Locked capital',money(r.tvl_usd),'Snapshot TVL · not revenue'),factor('Base value / TVL','× '+D.model.base.toFixed(2)),
factor('7-day momentum','× '+f.growth_multiplier.toFixed(3),pct(r.change_7d)+' raw; capped at −60% / +80%'),
factor('Observed history','× '+f.age_multiplier.toFixed(3),r.age_days===null?'Unknown listing · 365-day prior':short(r.age_days)+' days since first listing'),
factor('Category capture','× '+f.category_multiplier.toFixed(2),r.category || 'Other'),
factor('Chain reach','× '+f.chain_multiplier.toFixed(2),new Set(r.chains).size+' recorded chains · capped at 1.20×'),
node('div',{class:'factor total'},node('span',{text:'Same as board.json'}),node('b',{text:recomputed===r.implied_value_usd?'VERIFIED ✓':'DATA MISMATCH'})),
node('p',{class:'assumption-note',text:'No token recorded is an evidence label. Listing age does not prove token absence. Category TVL can overlap other protocols; this is a scale model, not a launch forecast.'}),
node('div',{class:'value-rule'}),node('div',{class:'section-label',text:'RECORDED DEPLOYMENTS'}),node('div',{class:'chain-list'},r.chains.map(c=>node('span',{class:'chain-tag',text:c}))),
node('button',{class:'outline-button',id:'detail-save','aria-pressed':saved.has(slug),style:'margin-top:18px',onclick:()=>save(slug),text:saved.has(slug)?'★ Saved':'☆ Save protocol'}));
const titles=['Verify the route','Fund the working wallet','Put capital to work','Maintain useful activity','Monitor the evidence','Plan the exit'];
const plan=node('section',{class:'playbook'},node('div',{class:'playbook-heading'},node('div',{},node('div',{class:'section-label',text:'FROM SIGNAL TO ACTION'}),node('h3',{text:'Your farm playbook'})),node('span',{class:'route-label',text:r.farm.route+' route'})),node('p',{class:'fine-print',text:'A category-based plan on '+r.farm.chain+'. Verify access, supported assets and fees in the app before funding.'}),
node('div',{class:'plan-summary'},node('div',{},node('span',{text:'Position budget'}),node('b',{text:'$'+r.farm.capital}),node('small',{text:'TVL-tier estimate'})),node('div',{},node('span',{text:'Gas reserve'}),node('b',{text:'$'+r.farm.gas * 6}),node('small',{text:'6 tx · fees vary'})),node('div',{},node('span',{text:'Monitor for'}),node('b',{text:r.farm.hold_days+' days'}),node('small',{text:'planning window'}))),
node('ol',{class:'steps'},r.farm_steps.map((s,i)=>{
const costAt=s.indexOf(' Cost: '),timeAt=s.lastIndexOf(' Time: ');
return node('li',{},node('h4',{text:titles[i]|| 'Next action'}),node('p',{text:costAt>=0?s.slice(0,costAt):s}),node('div',{class:'step-meta'},node('div',{},node('b',{text:'COST'}),costAt>=0?s.slice(costAt+7,timeAt):'See plan'),node('div',{},node('b',{text:'TIME'}),timeAt>=0?s.slice(timeAt+7):'See plan')));
})));
dialog.append(node('div',{class:'detail-layout'},valuation,plan));
}else{
dialog.append(node('section',{class:'live-detail'},node('div',{class:'section-label',text:'REPORTED MARKET CAP'}),node('div',{class:'big-value',text:money(r.mcap_usd)}),node('p',{class:'fine-print',text:'Snapshot market cap, when reported. A symbol or CoinGecko ID is token evidence even when market cap is unknown; this record has no pre-token opportunity rank.'}),factor('TVL',money(r.tvl_usd,true)),factor('7-day TVL change',pct(r.change_7d)),factor('Symbol',r.symbol || 'Not reported'),factor('CoinGecko ID',r.gecko_id || 'Not reported'),node('div',{class:'chain-list'},r.chains.map(c=>node('span',{class:'chain-tag',text:c})))));
}
if(!dialog.open)dialog.showModal();
dialog.scrollTop=0;writeHash({protocol:slug});renderTable();
}
function openModel(){
const dialog=$('model'),m=D.model,top=D.rows[0];
const assumptions=[
['01 / Locked capital','TVL × 0.25 sets the scale. TVL measures assets, not protocol revenue, equity or a token claim on those assets. The multiple is an explicit house assumption.'],
['02 / Momentum','1 + 0.5 × clamp(7-day change, −60, +80) / 100. A missing change uses 0%. Capping both tails limits the influence of a single volatile week.'],
['03 / Observed history','0.60 + 0.40 × min(listing age, 1,095 days) / 1,095. Dates use the snapshot day, not today. Missing listing age uses a 365-day prior. Listing age is the only history proxy available.'],
['04 / Category capture','Shared-allocation curators and custody-dependent RWA receive lower TVL multiples. Lending and exchanges receive higher ones. These are assumptions about potential capture, not measured fees. Unknown categories use 0.80×.'],
['05 / Chain reach','1 + 0.04 × min(max(unique chains − 1, 0), 5). Each additional recorded chain adds four percent, up to 1.20×. This describes reach and does not sum chain TVL.'],
['06 / What the universe includes','Every sealed watchlist record plus eligible records below the $50M floor. Early entries exclude CEX, bridges, staking and token-wrapper categories, versioned pools and wrapped/staked names. Token evidence is shown in its own view. The snapshot has no parent-protocol field.']
];
dialog.replaceChildren(node('div',{class:'dialog-header'},node('div',{},node('div',{class:'eyebrow',text:'TRANSPARENT BY DESIGN / ATLAS 01'}),node('h2',{id:'model-title',text:'A model you can read.'}),node('div',{class:'detail-sub',text:'Every rank follows the same snapshot-derived formula.'})),node('button',{class:'close-button','aria-label':'Close value model',onclick:()=>dialog.close(),text:'×'})),
node('div',{class:'model-body'},node('div',{class:'model-equation'},node('strong',{text:'Implied value'}),' = round(TVL × 0.25',node('br'),' × momentum × history × category × reach)'),node('div',{class:'assumptions'},assumptions.map(([label,text])=>node('p',{},node('b',{text:label}),text))),
node('h3',{text:'Category multipliers'}),node('div',{class:'category-multiples'},Object.keys(m.categories).sort(compare).map(c=>node('span',{text:c},node('b',{text:m.categories[c].toFixed(2)+'×'})))),
node('div',{class:'model-sample'},node('b',{text:top.name+' / #'+top.rank}),node('br'),money(top.tvl_usd,true)+' × 0.25 × '+top.growth_multiplier.toFixed(4)+' × '+top.age_multiplier.toFixed(4)+' × '+top.category_multiplier.toFixed(2)+' × '+top.chain_multiplier.toFixed(2),node('br'),'Result with full-precision factors: '+money(top.implied_value_usd,true)),
node('p',{class:'fine-print',text:'Values are positive whole dollars, with ties resolved by slug. No names are used in scoring. The sealed snapshot does not establish launch probability, token supply, fees, eligibility or reward amounts. Farm budgets and hold windows are planning assumptions, not guaranteed qualification rules. No implied value is assigned to records with token evidence.'})));
if(!dialog.open)dialog.showModal();dialog.scrollTop=0;writeHash({model:'1'});
}
function metric(label,value,sub,icon,extra=''){return node('div',{class:'metric'},node('div',{class:'metric-label',text:label}),node('div',{class:'metric-value'},value,extra?node('span',{class:'metric-total',text:extra}):null),node('div',{class:'metric-sub',text:sub}),node('span',{class:'metric-icon','aria-hidden':'true',text:icon}));}
const date=new Date(D.as_of+'T00:00:00Z').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'});
$('snapshot-date').textContent='As of '+date;$('side-date').textContent=D.as_of+' / UTC';
$('nav-count').textContent=D.rows.length;$('pre-count').textContent=D.rows.length;$('live-count').textContent=D.live.length;
$('source-line').textContent=D.source+' · '+D.universe_size+' protocols · '+D.omitted_size+' records outside these views';
replace('metrics',metric('Watchlist coverage',String(D.watchlist.length),'Every required protocol covered','✓',' / '+D.watchlist.length),metric('Ranked opportunities',String(D.rows.length),(D.rows.length - D.watchlist.length)+' early records below '+money(D.floor_usd),'⊕'),metric('Ranked protocol TVL',money(D.rows.reduce((sum,r)=>sum+r.tvl_usd,0)),'Reported capital · may overlap','▥'),metric('Positive momentum',String(D.rows.filter(r=>r.change_7d !==null&& r.change_7d>0).length),'Protocols growing over 7 days','↗'));
$('search').addEventListener('input',e=>{state.q=e.target.value;state.page=1;renderTable();writeHash();});
$('category').addEventListener('change',e=>change({category:e.target.value}));
$('chain').addEventListener('change',e=>change({chain:e.target.value}));
$('min-tvl').addEventListener('change',e=>change({min:Number(e.target.value)}));
$('momentum').addEventListener('click',()=>change({growing:!state.growing}));
$('pre-tab').addEventListener('click',()=>change({view:'pre',scope:'all',category:'',chain:'',sort:'implied_value_usd',direction:-1}));
$('live-tab').addEventListener('click',()=>change({view:'live',scope:'all',category:'',chain:'',sort:'mcap_usd',direction:-1}));
document.querySelectorAll('[data-scope]').forEach(b=>b.addEventListener('click',()=>change({scope:b.dataset.scope})));
['clear-filters','empty-reset'].forEach(id=>$(id).addEventListener('click',reset));
$('nav-radar').addEventListener('click',()=>{change({...initial});$('board').scrollIntoView({block:'start'});});
$('nav-saved').addEventListener('click',()=>change({...initial,scope:'saved'}));
['nav-model','model-button','footer-model'].forEach(id=>$(id).addEventListener('click',openModel));
$('page-size').addEventListener('change',e=>change({size:Number(e.target.value)}));
$('prev-page').addEventListener('click',()=>{state.page--;renderTable();writeHash();});
$('next-page').addEventListener('click',()=>{state.page++;renderTable();writeHash();});
for(const id of['detail','model'])$(id).addEventListener('close',()=>{if(id==='detail')delete $('detail').dataset.slug;writeHash(id==='detail'?{protocol:''}:{model:''});renderTable();});
window.addEventListener('hashchange',readHash);
readHash();
})();
