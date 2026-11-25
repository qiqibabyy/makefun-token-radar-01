/* Shared by Node's buildRadar and the offline page. No protocol-name score overrides.
   TVL is a scale proxy, not revenue. Listing age is observed history, not proof of token absence.
   Category discounts reflect capture assumptions; chain breadth is reach, not added TVL.
   Farm budgets are planning estimates, not snapshot fees, supported assets or confirmed rewards. */
(function(){
'use strict';
const MODEL={
version:'Atlas / 01',base:0.25,growth_floor:-60,growth_cap:80,growth_weight:0.5,
age_floor:0.6,age_range:0.4,age_cap:1095,unknown_age:365,
chain_step:0.04,chain_cap:5,
categories:{
'Risk Curators':0.70,'Onchain Capital Allocator':0.80,'Lending':1.10,
'Uncollateralized Lending':0.70,'Dexs':1.20,'Derivatives':1.15,
'Interest Rate Derivatives':1.05,'RWA':0.65,'CDP':0.80,'CDP Manager':0.85,
'Yield':0.90,'Yield Aggregator':0.85,'Basis Trading':0.75,'CeDeFi':0.65,
'Restaking':0.75,'Collateral Markets':0.90,'Staking Pool':0.65,
'Stablecoin Wrapper':0.50,'Dual-Token Stablecoin':0.75,'Chain':0.70,
'Prediction Market':1.10,'Insurance':0.85,'Payments':0.60,
'Governance Incentives':0.60,'Liquidity Manager':0.85,'Leveraged Farming':0.70,
'Farm':0.70,'OTC Marketplace':0.85,'Crypto Card Issuer':0.55,'Indexes':0.80
}
};
const compare=(a,b)=>a<b?-1:a>b?1:0;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const distinctChains=p=>[...new Set(p.chains)].sort(compare);
function ageDays(asOf,listed){
if(!listed)return null;
const days=(Date.parse(asOf+'T00:00:00Z')- Date.parse(listed+'T00:00:00Z'))/ 86400000;
return Number.isFinite(days)?Math.max(0,Math.floor(days)):null;
}
function isPreToken(p){return p.symbol===null&& p.gecko_id===null&& p.mcap_usd===null;}
function isEligible(p){
return isPreToken(p)&& !['CEX','Bridge','Canonical Bridge','Cross Chain Bridge','Liquid Staking','Liquid Restaking','Restaked BTC','Anchor BTC','Decentralized BTC','Stablecoin Wrapper','Staking Pool'].includes(p.category)
&& !/\s(v\d+(\.\d+)?|\d+\.\d+)$|\b(wrapped|staked|staking)\b/i.test(p.name);
}
function valueOf(p,asOf){
const age=ageDays(asOf,p.listed_at);
const growth=clamp(p.change_7d===null?0:p.change_7d,MODEL.growth_floor,MODEL.growth_cap);
const g=1+growth / 100* MODEL.growth_weight;
const a=MODEL.age_floor+MODEL.age_range * clamp(age===null?MODEL.unknown_age:age,0,MODEL.age_cap)/ MODEL.age_cap;
const c=MODEL.categories[p.category]??0.80;
const h=1+MODEL.chain_step * clamp(distinctChains(p).length - 1,0,MODEL.chain_cap);
return{age_days:age,growth_pct:growth,growth_multiplier:g,age_multiplier:a,
category_multiplier:c,chain_multiplier:h,
implied_value_usd:Math.max(1,Math.round(p.tvl_usd * MODEL.base * g * a * c * h))};
}

// Per-transaction gas reserve in dollars; estimates deliberately broad, never live quotes.
const GAS={Ethereum:8,Bitcoin:5,Base:1,Arbitrum:1,Optimism:1,Polygon:1,
Solana:0.1,Sui:0.2,Algorand:0.1,Stellar:0.1,Tron:3,Binance:0.5,
Flare:0.5,Monad:0.5,Ink:0.5,Plasma:0.5,Bittensor:0.5,Noble:0.2};
function chainOf(p){
return distinctChains(p).sort((a,b)=>(GAS[a]??2)-(GAS[b]??2)|| compare(a,b))[0]|| 'the published deployment';
}
function routeOf(category){
if(category==='Uncollateralized Lending')return 'credit';
if(/Curator|Allocator|Yield Aggregator|Liquidity Manager|Options Vault|Indexes/.test(category))return 'vault';
if(/Lending/.test(category))return 'lend';
if(/CDP|Dual-Token/.test(category))return 'cdp';
if(/RWA|CeDeFi/.test(category))return 'rwa';
if(/Dex/.test(category))return 'swap';
if(/Derivatives|Basis Trading|Prediction/.test(category))return 'trade';
if(/Restak|Staking|Collateral Markets/.test(category))return 'stake';
if(/Governance/.test(category))return 'governance';
if(/Insurance/.test(category))return 'cover';
if(/Payments|Card/.test(category))return 'pay';
if(category==='Chain')return 'chain';
return 'yield';
}
function farmPlan(p,age){
const chain=chainOf(p),route=routeOf(p.category || 'Other');
const capital=p.tvl_usd>=1e9?250:p.tvl_usd>=1e8?150:p.tvl_usd>=5e7?100:50;
const gas=GAS[chain]??2;
const hold=age===null?30:age<180?60:age<365?45:30;
const name=p.name;
const spend=Math.min(20,capital / 5);
const step=(action,cost,time)=>`${action} Cost: ${cost}. Time: ${time}.`;
const steps=[step(`Open ${name}'s own app and verify its ${chain} deployment, token record and any published reward terms. Identify the exact supported asset and contract for the ${p.category || 'protocol'} route; stop if access is restricted or the deployment cannot be verified.`,'$0 to inspect','10 minutes before funding'),
step(`Use your existing wallet compatible with ${chain}. Move only the asset ${name} accepts, keeping $${capital} as the position budget and $${gas * 6} equivalent in the network's fee asset. Use a canonical transfer route if funds are on another network and test with a small transfer.`,`$${capital} reusable capital plus up to $${gas * 6} estimated gas reserve; bridge or exchange fees extra`,'10–20 minutes plus transfer finality')];
if(route==='vault'){
steps.push(step(`In ${name}, select a permissionless ${chain} vault or a host vault explicitly naming ${name} as curator. Read asset, allocation, withdrawal queue and performance fee; deposit $${capital} of its accepted asset and record the share balance. A curator's TVL may overlap its host protocol.`,`$${capital} stays invested; about $${gas * 2} for approval and deposit, plus displayed vault fees`,'15 minutes; do not use a vault whose minimum exceeds this budget'));
steps.push(step(`After seven days, check the ${name} vault's share price, allocation changes and withdrawal liquidity on ${chain}. Reinvest only an actual earned distribution or top up once if you intended to add capital; record the transaction rather than cycling deposits.`,`about $${gas} only if a useful transaction is needed; performance fees follow the vault terms`,`10 minutes weekly for ${hold} days`));
}else if(route==='lend'){
steps.push(step(`Choose a supplied asset market in ${name} on ${chain}, verify utilization and collateral rules, then approve only $${capital} and supply it. Keep borrowing disabled for the initial position; save the deposit receipt and the displayed supply rate.`,`$${capital} supplied plus about $${gas * 2} approval and supply gas`,'15 minutes'));
steps.push(step(`Check ${name}'s ${chain} utilization and available liquidity weekly. If borrowing is an intended use, borrow at most $${Math.round(capital * 0.1)} only against enabled collateral, keep a wide liquidation buffer and repay it within a week; skip this leg when the asset is not borrowable.`,`optional debt incurs the app's quoted APR plus about $${gas * 2} for borrow and repay`,'10 minutes weekly; optional debt at most 7 days'));
}else if(route==='cdp'){
steps.push(step(`At ${name} on ${chain}, inspect accepted collateral, debt minimum and liquidation threshold. Lock up to $${capital} of supported collateral and mint at most $${Math.round(capital * 0.2)} equivalent only if that exceeds the protocol minimum and leaves collateralization above twice its minimum; otherwise use a published unlevered deposit route or skip.`,`$${capital} collateral; about $${gas * 2} gas, plus the quoted stability or mint fee`,'20 minutes to compare and open'));
steps.push(step(`Review ${name}'s collateral ratio and stable-asset peg on ${chain} every week. Add no leverage to chase activity. Before withdrawing collateral, repay all minted debt and accrued fees; maintain the same vault rather than minting and burning repeatedly.`,`debt repayment uses the minted balance; interest and about $${gas * 2} gas extra`,`10 minutes weekly over ${hold} days`));
}else if(route==='rwa'|| route==='credit'){
steps.push(step(`Read ${name}'s investor eligibility, custody, underlying credit exposure, minimum subscription and redemption terms on ${chain}. Complete the issuer's own onboarding if eligible, then subscribe or deposit $${capital} into an accepted product. If its minimum or investor restrictions exclude you, skip the capital leg.`,`$0 for inspection; up to $${capital} subscribed plus about $${gas} gas and disclosed issuer fees`,'20–45 minutes; onboarding may take several business days'));
steps.push(step(`For an accessible ${name} position, reconcile token or receipt balances with the issuer's ${chain} reporting each week. Record actual yield and the next redemption window; do not assume a secondary market or instant exit for a real-world or private-credit asset.`,'capital remains subject to issuer and credit risk; reporting itself costs $0',`10 minutes weekly for ${hold} days or the product's longer minimum term`));
}else if(route==='swap'){
steps.push(step(`On ${name}'s ${chain} swap interface, select a liquid pair it actually supports, preview a $${spend} equivalent swap, and use a 0.5% slippage limit or tighter. Execute only if the quoted impact is acceptable; on a native-asset market use its native asset rather than assuming USDC support.`,`$${spend} exchanged from the $${capital} budget; pool fee, at most $${(spend * 0.005).toFixed(2)} slippage and about $${gas} gas`,'10 minutes for one swap'));
steps.push(step(`If you intend to supply liquidity to ${name}, use up to $${capital - spend} of the remaining budget in a supported balanced pool on ${chain}; inspect range and impermanent-loss exposure first. Check fees and pool balance weekly, or keep only the swap when no suitable pool exists.`,`remaining capital at market risk; about $${gas * 2} to add liquidity, plus pool fees`,`15 minutes setup and 10 minutes weekly for ${hold} days`));
}else if(route==='trade'){
steps.push(step(`Inspect ${name}'s ${chain} market terms, funding, settlement and withdrawal rules. For a margin interface, deposit $${capital} and make one intended $${spend} notional trade at no more than 1x; for a prediction market, cap a single position at $${spend}. A deposit-only strategy vault should use its subscription route instead.`,`at most $${spend} market loss budget, displayed trading or management fees and about $${gas * 2} gas`,'20 minutes; close a test margin trade in the same session'));
steps.push(step(`Reconcile ${name}'s realized P&L, funding or settlement outcome on ${chain}. Never create artificial volume to claim activity. Keep only capital you planned to expose, inspect withdrawal availability weekly and close positions before their risk exceeds the $${spend} limit.`,'quoted funding and market fees vary; a losing position can consume its full budget',`10 minutes weekly for ${hold} days; market settlement may be later`));
}else if(route==='stake'){
steps.push(step(`At ${name} on ${chain}, identify its actual staking or collateral asset, operator, slashing rules and unbonding delay. Delegate or deposit $${capital} equivalent through a verified operator or vault and record its receipt; use the native staking asset when required, including BTC for a Bitcoin route.`,`$${capital} locked; about $${gas * 2} deposit fees plus any published operator commission`,'20 minutes; exit follows the published unbonding period'));
steps.push(step(`Check ${name}'s ${chain} operator health, reward accounting and slashing updates each week. Compound only earned rewards if the app supports it and fees are smaller than the claim. Record a withdrawal request before your intended exit rather than treating locked capital as instantly liquid.`,`capital stays exposed to slashing; optional claim about $${gas}, commission as displayed`,`10 minutes weekly for ${hold} days plus any unbonding queue`));
}else if(route==='cover'){
steps.push(step(`Read ${name}'s ${chain} policy wording, covered events, exclusions and claims process. Request a quote covering up to $${capital} of an actual exposure for ${hold} days; buy only when that policy covers your use and the premium is at most $${spend}. Do not confuse the coverage amount with the premium.`,`at most $${spend} non-refundable premium plus about $${gas} gas; $${capital} is insured exposure`,'20 minutes to quote and purchase'));
steps.push(step(`Save the ${name} policy identifier and proof of the covered ${chain} position. Check coverage conditions weekly and retain evidence for a genuine claim; renew only if the underlying exposure persists. Buying unnecessary policies is not a useful reward strategy.`,'$0 to monitor; a renewal pays another quoted premium',`10 minutes weekly; policy lasts ${hold} days if offered`));
}else if(route==='pay'){
steps.push(step(`In ${name}'s ${chain} payment interface, confirm supported currency, recipient format and fee. Make a genuine $${spend} equivalent payment from the $${capital} budget. For Bitcoin payment channels, use a supported Lightning wallet and inspect channel-open and routing costs before moving BTC.`,`$${spend} spent on the intended payment plus quoted routing or card fees and up to $${gas * 2} network fees`,'10–20 minutes; channel opening needs Bitcoin confirmations'));
steps.push(step(`Use ${name} again only for a real ${chain} payment you already need. Save payment receipts, verify settlement and leave the unused $${capital - spend} accessible; check channel or account exit terms rather than routing funds back and forth for volume.`,'each actual payment consumes its amount and the displayed fee',`5 minutes per needed payment over ${hold} days`));
}else if(route==='governance'){
steps.push(step(`Inspect ${name}'s ${chain} incentive page for eligible assets, vote power requirements, lock duration and reward rules. Commit up to $${capital} to a supported lock only if its term fits your horizon, then delegate or cast one informed vote; skip if you lack the required asset or voting access.`,`$${capital} may be locked; about $${gas * 2} for lock and vote, plus any protocol fee`,'20 minutes; lock duration can exceed the monitoring window'));
steps.push(step(`Review a live ${name} proposal or incentive epoch on ${chain}, read the options and vote once per intended epoch. Check actual reward accrual rather than assuming every vote earns tokens, and set a reminder for the lock expiry.`,`about $${gas} per onchain vote; claims may incur another transaction`,`15 minutes per epoch for at least ${hold} days`));
}else if(route==='chain'){
steps.push(step(`Fund a compatible ${chain} wallet with up to $${capital} of a supported asset using the network's published deposit route. Make a $${spend} transfer to a recipient you intend to pay or use a verified app listed by ${name}; verify the explorer receipt and do not assume the chain itself accepts vault deposits.`,`$${capital} transferred, then $${spend} used; about $${gas * 2} gas plus any deposit-route fee`,'15–30 minutes plus network finality'));
steps.push(step(`Explore one additional useful ${name} ecosystem action on ${chain}, such as a supported swap or payment, only after confirming its contract and fees. Log actual use weekly; the sealed record contains no points program or token-launch commitment.`,`about $${gas} per useful transaction; app fees and market risk vary`,`10 minutes weekly over ${hold} days`));
}else{
steps.push(step(`At ${name} on ${chain}, inspect the accepted deposit asset, strategy exposure, lock and withdrawal fee. Deposit up to $${capital} into a permissionless yield route after previewing the transaction; skip if its minimum is higher or no documented deposit route exists.`,`$${capital} invested plus about $${gas * 2} for approval and deposit; strategy fees as displayed`,'15 minutes to inspect and fund'));
steps.push(step(`Review ${name}'s ${chain} position value and realized yield weekly. Claim or reinvest only accrued rewards when their value exceeds the quoted fee. For a leveraged strategy, keep leverage disabled unless you explicitly intend its liquidation exposure.`,`about $${gas} per useful claim; performance fees and loss risk depend on the strategy`,`10 minutes weekly for ${hold} days`));
}
steps.push(step(`Monitor this ${name} route on ${chain} for ${hold} days; use that as a planning window, not a qualifying rule. If an official points page exists, compare its terms with your actual activity. The snapshot records no token and does not establish a launch or reward entitlement.`,`no extra fee to inspect; the position budget remains exposed under its own terms`,`5 minutes weekly; ${hold} days planned monitoring`));
steps.push(step(`Test ${name}'s ${chain} exit with a small withdrawal, repay any debt first, then redeem shares or request the documented unlock. Save the receipt, capital recovered and fees in your farm log, and revoke unused token approvals when the wallet supports it. Payment and policy spending cannot be withdrawn.`,`reserve about $${gas * 2} for exit and approval cleanup; redemption fees and queues follow the app`,'15 minutes to request exit; finality, locks and issuer queues may add days'));
return{steps,chain,capital,gas,hold_days:hold,route};
}
globalThis.RadarEngine={MODEL,ageDays,isPreToken,isEligible,valueOf,farmPlan,chainOf,routeOf};
})();
