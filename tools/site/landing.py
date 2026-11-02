"""The one-page landing (Waterllama-style colour bands, every band a full screen tall).
Art comes from the app (site/img/l, prepared by tools/site/art.py); copy from landing_text.py."""
from html import escape as E
from landing_text import L

CSS = r"""
:root{--ink:#163A4A;--white:#fff;--cyan:#16B3D3;--indigo:#3B2C93;--green:#2EA37B;--pink:#E57CB2;--teal:#6CC3B1;--blue:#2B62C6;--orange:#F5A524;--brown:#6A402E;--lav:#B39AE8;--cream:#FBF5EA;--shadow:0 24px 60px rgba(14,30,60,.22)}
*{box-sizing:border-box}html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}
body.lp{margin:0;font-family:Nunito,ui-rounded,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#fff;background:#fff;line-height:1.5;font-size:18px;overflow-x:hidden}
img{max-width:100%;height:auto;display:block}
a{color:inherit}
.band{position:relative;min-height:100vh;min-height:100svh;display:flex;align-items:center;overflow:hidden;padding:72px 0}
.wrap{width:100%;max-width:1160px;margin:0 auto;padding:0 28px;display:grid;grid-template-columns:1fr 1fr;gap:56px;align-items:center;position:relative;z-index:1}
.wrap.center{grid-template-columns:1fr;text-align:center;justify-items:center}
h1,h2{font-weight:900;letter-spacing:-.015em;margin:0 0 18px;line-height:1.04}
h1{font-size:clamp(42px,5.6vw,74px)}
h2{font-size:clamp(36px,4.6vw,60px)}
.lead{font-size:clamp(18px,1.6vw,22px);font-weight:700;opacity:.95;max-width:560px;margin:0 0 26px}
.center .lead{margin-left:auto;margin-right:auto}
.logo{display:flex;align-items:center;gap:10px;font-weight:900;font-size:30px;margin-bottom:22px;text-decoration:none}
.logo svg{width:34px;height:34px}
/* hero */
.hero{background:var(--cyan)}
.hero::before{content:"";position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.09) 2px,transparent 2px),linear-gradient(90deg,rgba(255,255,255,.09) 2px,transparent 2px);background-size:56px 56px;transform:perspective(900px) rotateX(38deg) scale(1.6);transform-origin:center 80%;pointer-events:none}
.hero .art{position:relative;justify-self:center;width:min(560px,100%)}
.hero .art img{width:100%;filter:drop-shadow(0 30px 40px rgba(0,60,90,.25))}
.hero .art .heart{position:absolute;filter:none;top:2%;right:16%;width:13%;animation:beat 1.6s ease-in-out infinite}
.rays{position:absolute;inset:-8% -4%;pointer-events:none}
.laurels{display:flex;gap:18px;flex-wrap:wrap;margin:0 0 26px}
.laurel{display:flex;align-items:center;gap:4px;font-weight:900;text-align:center;line-height:1.05}
.laurel svg{width:22px;height:48px;flex:none}
.laurel b{display:block;font-size:22px}.laurel small{display:block;font-size:11px;letter-spacing:.06em;text-transform:uppercase;opacity:.9}
.stores{display:flex;gap:12px;flex-wrap:wrap}
.store{display:inline-flex;align-items:center;gap:10px;background:#0B0B0F;color:#fff;border-radius:14px;padding:9px 18px 9px 14px;text-decoration:none;border:1.5px solid rgba(255,255,255,.35);transition:transform .2s}
.store:hover{transform:translateY(-2px)}
.store svg{width:26px;height:26px}
.store span{display:flex;flex-direction:column;line-height:1.05}.store small{font-size:10px;font-weight:800;letter-spacing:.05em}.store b{font-size:19px;font-weight:900}
.store.soon{opacity:.72;cursor:default}
.strip{position:absolute;left:0;right:0;bottom:0;background:#fff;color:var(--ink);display:flex;justify-content:center;align-items:center;gap:12px;padding:14px;font-weight:800;font-size:15px;z-index:2}
.strip b{font-weight:900}.strip i{width:1px;height:18px;background:#c9d2d8;display:block}
/* devices */
.devices{position:relative;display:flex;align-items:center;justify-content:center;min-height:540px}
.phone{position:relative;width:min(318px,72vw);aspect-ratio:390/844;border-radius:44px;background:#111;padding:9px;box-shadow:var(--shadow);flex:none}
.phone::before{content:"";position:absolute;top:17px;left:50%;transform:translateX(-50%);width:28%;height:22px;border-radius:12px;background:#111;z-index:2}
.phone .scr{width:100%;height:100%;border-radius:36px;overflow:hidden;background:#fff;position:relative}
.phone .scr>img.shot{width:100%;height:100%;object-fit:cover;object-position:top}
.phone.sm{width:min(210px,44vw);border-radius:34px;padding:7px}.phone.sm .scr{border-radius:28px}.phone.sm::before{top:13px;height:16px}
.tile-icon{position:absolute;left:-6%;bottom:12%;width:30%;border-radius:26%;box-shadow:var(--shadow);transform:rotate(-8deg);z-index:3}
.live{position:absolute;right:-8%;bottom:14%;width:250px;background:rgba(20,22,30,.92);backdrop-filter:blur(12px);border-radius:26px;padding:16px;color:#fff;box-shadow:var(--shadow);z-index:3}
.live .top{display:flex;align-items:center;gap:10px}.live .top img{width:34px;height:34px;border-radius:9px}
.live .t{font-weight:900;font-size:15px;line-height:1.1}.live .s{font-size:12px;opacity:.7;font-weight:700}
.live .clock{font-size:44px;font-weight:900;letter-spacing:.02em;margin:10px 0 12px;font-variant-numeric:tabular-nums}
.live .btns{display:flex;gap:8px}.live .btns span{flex:1;text-align:center;padding:9px;border-radius:999px;font-weight:900;font-size:14px;background:#2b2f3b}.live .btns span:last-child{background:#16B3D3}
.chips{display:flex;gap:10px;flex-wrap:wrap}
.chip{border:2px solid rgba(255,255,255,.7);border-radius:999px;padding:7px 15px;font-weight:900;font-size:15px}
.indigo{background:var(--indigo)}
/* routines */
.green{background:var(--green)}
.badge-new{display:inline-block;background:#173d30;color:#fff;font-weight:900;font-size:13px;letter-spacing:.08em;padding:5px 12px;border-radius:8px;margin-bottom:16px}
.tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
.tile{border-radius:22px;padding:14px 10px 10px;text-align:center;font-weight:900;font-size:17px;box-shadow:0 10px 24px rgba(0,0,0,.12);transition:transform .25s}
.tile:hover{transform:translateY(-4px) rotate(-1deg)}
.tile img{width:76%;margin:6px auto 0;aspect-ratio:1;object-fit:contain}
.tile.wide{grid-column:span 3;display:flex;align-items:center;justify-content:space-between;text-align:left;padding:18px 26px;font-size:clamp(22px,2.4vw,30px);line-height:1.1;background:#5b3424}
.tile.wide img{width:132px;margin:0}
/* quotes */
.cyan{background:var(--cyan)}
.stats{display:flex;gap:30px;justify-content:center;flex-wrap:wrap;margin-bottom:34px}
.carousel{position:relative;width:min(820px,100%);display:flex;align-items:center;gap:18px}
.slides{flex:1;display:grid}
.slide{margin:0;grid-area:1/1;opacity:0;transform:translateX(30px);transition:opacity .5s,transform .5s;pointer-events:none}
.slide.on{opacity:1;transform:none;pointer-events:auto}
.stars{font-size:34px;margin-bottom:8px}
.slide .q{margin:0;font-weight:900;font-size:clamp(26px,3vw,40px);line-height:1.15;margin-bottom:14px}
.slide p{font-weight:700;font-size:19px;margin:0 auto 10px;max-width:620px}
.slide figcaption{font-weight:800;opacity:.85;font-size:15px}
.arrow{width:54px;height:54px;border-radius:50%;border:0;background:rgba(255,255,255,.22);color:#fff;font-size:24px;font-weight:900;cursor:pointer;flex:none;transition:background .2s}
.arrow:hover{background:rgba(255,255,255,.38)}
.dots{display:flex;gap:8px;justify-content:center;margin-top:22px}.dots button{width:10px;height:10px;border-radius:50%;border:0;background:rgba(255,255,255,.45);padding:0;cursor:pointer}.dots button.on{background:#fff;width:28px;border-radius:6px}
/* reminders */
.pink{background:var(--pink)}
.notif{background:linear-gradient(180deg,#fff,#fff3f8);color:var(--ink);border-radius:24px;padding:16px 20px;width:min(420px,100%);text-align:left;box-shadow:var(--shadow);margin:0 auto 34px;position:relative}
.notif .hd{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:800;color:#8a8f9b;text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px}
.notif .hd img{width:20px;height:20px;border-radius:5px}.notif .hd em{margin-left:auto;font-style:normal;text-transform:none}
.notif b{font-size:18px;font-weight:900}.notif p{margin:2px 0 0;font-weight:700;color:#3d4a63}
.icons{display:grid;grid-template-columns:repeat(7,1fr);gap:16px;width:min(980px,100%);margin-top:34px}
.icons div{font-weight:900;font-size:15px}.icons img{width:min(92px,100%);margin:0 auto 6px;aspect-ratio:1;object-fit:contain;transition:transform .3s}
.icons div:hover img{transform:translateY(-6px) scale(1.06)}
/* collect */
.teal{background:var(--teal)}
.cards{position:relative;height:440px;justify-self:center;width:min(480px,100%)}
.pcard{position:absolute;width:62%;aspect-ratio:3/3.6;border-radius:30px;background:#fff;padding:10px;box-shadow:var(--shadow)}
.pcard div{width:100%;height:100%;border-radius:22px;display:flex;align-items:flex-end;justify-content:center;overflow:hidden}
.pcard img{width:92%}
.pcard.a{left:2%;top:4%;transform:rotate(-8deg);z-index:2}.pcard.a div{background:#FFE1EC}
.pcard.b{right:2%;top:12%;transform:rotate(7deg)}.pcard.b div{background:#DDF3F0}
.mini-badge{position:absolute;width:24%;z-index:3;filter:drop-shadow(0 10px 14px rgba(0,0,0,.18))}
/* streak */
.blue{background:var(--blue)}
.ui{background:#fff;color:var(--ink);padding:52px 18px 18px;height:100%}
.ui h4{margin:0 0 12px;font-weight:900;font-size:15px;text-align:center;color:#2B62C6}
.ring{width:150px;height:150px;margin:0 auto 18px;position:relative;display:flex;align-items:center;justify-content:center;flex-direction:column}
.ring svg{position:absolute;inset:0}
.ring b{font-size:54px;font-weight:900;color:#16B3D3;line-height:1}.ring small{font-weight:900;color:#16B3D3;font-size:14px}
.row{display:flex;align-items:center;gap:10px;background:#F5F6F8;border-radius:16px;padding:9px 12px;margin-bottom:9px;font-weight:900;font-size:15px}
.row img{width:30px;height:30px;object-fit:contain}.row .ok{margin-left:auto;color:#27A55B;font-size:18px}.row .chev{margin-left:auto;color:#b2b8c2}
/* track */
.orange{background:var(--orange)}
.pet-pick{display:flex;align-items:center;gap:10px;font-weight:900;font-size:18px;margin-bottom:14px}.pet-pick img{width:44px;height:44px;border-radius:50%;background:#FFF2DB}
/* milestones */
.brown{background:var(--brown)}
.mcards{position:relative;height:500px;width:min(560px,100%);justify-self:center}
.mcard{position:absolute;width:58%;border-radius:22px;overflow:hidden;box-shadow:var(--shadow);border:6px solid #fff;background:#fff}
.mcard.a{left:0;top:6%;transform:rotate(-6deg);z-index:2}.mcard.b{right:0;top:16%;transform:rotate(6deg)}
.badge-share{display:inline-block;background:#2a1910;font-weight:900;font-size:13px;letter-spacing:.08em;padding:5px 12px;border-radius:8px;margin-bottom:16px}
/* benefits */
.benefits{display:grid;grid-template-columns:repeat(4,1fr);gap:22px;width:min(980px,100%);margin-top:36px}
.benefit{background:rgba(255,255,255,.16);border-radius:28px;padding:26px 14px;font-weight:900;font-size:19px}
.benefit img{width:96px;height:96px;margin:0 auto 12px;object-fit:contain}
/* goal */
.lav{background:var(--lav)}
.goal{background:#fff;color:var(--ink);border-radius:30px;padding:24px;box-shadow:var(--shadow);width:min(470px,100%);justify-self:center}
.goal .pets{display:flex;gap:14px;margin-bottom:18px}
.goal .pets span{flex:1;display:flex;align-items:center;gap:10px;font-weight:900;font-size:17px;padding:8px 12px;border-radius:999px;background:#F5F6F8}
.goal .pets span.on{background:#EDE6FF;box-shadow:inset 0 0 0 2px #B39AE8}
.goal .pets img{width:40px;height:40px;border-radius:50%;object-fit:cover}
.goal .hd{display:flex;justify-content:space-between;font-weight:900;margin-bottom:10px}.goal .hd em{font-style:normal;color:#27A55B}
.segs{display:grid;grid-template-columns:repeat(5,1fr);gap:7px}.segs i{height:16px;border-radius:999px;background:#E9ECF1;position:relative;overflow:hidden}
.segs i::after{content:"";position:absolute;inset:0;background:#4CC26A;transform:scaleX(0);transform-origin:left;transition:transform .6s cubic-bezier(.2,.8,.2,1)}
.in .segs i.f::after{transform:scaleX(1)}
.in .segs i:nth-child(2)::after{transition-delay:.15s}.in .segs i:nth-child(3)::after{transition-delay:.3s}.in .segs i:nth-child(4)::after{transition-delay:.45s}
.fillpet{position:relative;width:200px;margin:0 auto 18px}
.fillpet img{width:100%}
.fillpet .gray{filter:grayscale(1) brightness(1.18) contrast(.75);opacity:.75}
.fillpet .col{position:absolute;inset:0;clip-path:inset(100% 0 0 0);animation:fill 5s cubic-bezier(.45,.05,.3,1) infinite}
/* cta */
.creamy{background:var(--cream);color:var(--ink)}
.cta-logo{display:flex;align-items:center;gap:20px;margin-bottom:12px}.cta-logo img{width:120px;border-radius:28px;box-shadow:0 16px 40px rgba(22,58,74,.2)}
.cta-logo b{font-size:clamp(40px,5vw,64px);font-weight:900;display:flex;align-items:center;gap:8px;color:var(--ink)}
.creamy .lead{color:#3d4a63}
.note{font-weight:800;color:#6b7383;font-size:15px;margin-top:16px}
.creamy .store{border-color:transparent}
.pair{display:flex;gap:22px;justify-content:center;align-items:flex-start}.pair .phone:last-child{margin-top:60px}
/* press + footer */
.press{background:#F3F4F6;color:var(--ink);flex-direction:column;justify-content:center}
.press h2{font-size:clamp(30px,3.4vw,44px)}
.press .lead{color:#4a5568}
.pbtn{display:inline-block;background:var(--cyan);color:#fff;font-weight:900;border-radius:999px;padding:14px 26px;text-decoration:none;box-shadow:0 10px 24px rgba(22,179,211,.35);transition:transform .2s}.pbtn:hover{transform:translateY(-2px)}
.mail{margin:12px 0 0;font-weight:800;color:#6b7383;font-size:15px}
.kit{display:flex;gap:16px;justify-content:center;margin:30px 0}.kit img{width:84px;height:84px;object-fit:contain;background:#fff;border-radius:22px;padding:8px;box-shadow:0 8px 20px rgba(0,0,0,.06)}
.foot{margin-top:36px;display:flex;flex-direction:column;align-items:center;gap:14px;font-weight:800;font-size:15px;color:#5b6474}
.foot nav{display:flex;gap:18px;flex-wrap:wrap;justify-content:center}.foot a{text-decoration:none}.foot a:hover{color:var(--cyan)}
.langs{display:flex;gap:8px}.langs a{padding:5px 11px;border-radius:999px;background:#fff;font-size:13px}.langs a.on{background:var(--cyan);color:#fff}
.copy{background:#163A4A;color:#fff;border-radius:999px;padding:6px 16px;font-size:13px}
/* sparkles + motion */
.spark{position:absolute;width:56px;opacity:.95;pointer-events:none}
.float{animation:float 5s ease-in-out infinite}
.float.d2{animation-delay:-2.5s}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-14px)}}
@keyframes beat{0%,100%{transform:scale(1)}15%{transform:scale(1.18)}30%{transform:scale(1)}45%{transform:scale(1.12)}}
@keyframes fill{0%{clip-path:inset(100% 0 0 0)}55%,85%{clip-path:inset(0 0 0 0)}100%{clip-path:inset(0 0 0 0);opacity:0}}
.reveal{opacity:0;transform:translateY(34px);transition:opacity .8s cubic-bezier(.2,.8,.2,1),transform .8s cubic-bezier(.2,.8,.2,1)}
.reveal.d1{transition-delay:.12s}.reveal.d2{transition-delay:.24s}
.in .reveal,.reveal.in{opacity:1;transform:none}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}.reveal{opacity:1;transform:none}.fillpet .col{clip-path:inset(30% 0 0 0)}}
@media (max-width:900px){
 .band{padding:64px 0 72px}
 .wrap{grid-template-columns:1fr;gap:38px;text-align:center;justify-items:center}
 .lead{margin-left:auto;margin-right:auto}.laurels,.stores,.chips{justify-content:center}.logo{justify-content:center}
 .devices{min-height:480px}.live{right:-2%;top:auto;bottom:4%;width:210px}.live .clock{font-size:34px}
 .tiles{width:100%}.tile{font-size:15px}
 .icons{grid-template-columns:repeat(4,1fr)}
 .benefits{grid-template-columns:repeat(2,1fr)}
 .cards{height:360px}.mcards{height:400px}
 .order-2{order:2}
 .cta-logo{justify-content:center}
 .hero{padding-bottom:110px}
 .hero .art{width:min(330px,78%)}
 .laurels{gap:10px}
 .strip{font-size:13px}
}
@media (max-width:520px){.pair .phone.sm{width:40vw}.icons{grid-template-columns:repeat(3,1fr)}.carousel .arrow{display:none}.tile img{width:84%}.mcards{height:330px}}
"""

JS = r"""
(function(){
 var reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}})},{threshold:.18});
 document.querySelectorAll('.band').forEach(function(b){io.observe(b)});
 var c=document.querySelector('.carousel');
 if(c){var s=c.querySelectorAll('.slide'),d=document.querySelectorAll('.dots button'),i=0,t;
  function go(n){i=(n+s.length)%s.length;s.forEach(function(x,k){x.classList.toggle('on',k===i);x.setAttribute('aria-hidden',k!==i)});d.forEach(function(x,k){x.classList.toggle('on',k===i);x.setAttribute('aria-current',k===i)})}
  function auto(){clearInterval(t);if(!reduce)t=setInterval(function(){go(i+1)},6000)}
  c.querySelector('.prev').onclick=function(){go(i-1);auto()};c.querySelector('.next').onclick=function(){go(i+1);auto()};
  d.forEach(function(x,k){x.onclick=function(){go(k);auto()}});go(0);auto()}
 var clk=document.querySelector('[data-clock]');
 if(clk){var start=Date.now()-(18*60+42)*1000;function tick(){var s=Math.floor((Date.now()-start)/1000);clk.textContent=String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')}tick();if(!reduce)setInterval(tick,1000)}
})();
"""

PAW = '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="currentColor"><ellipse cx="6" cy="9" rx="2.3" ry="3"/><ellipse cx="10" cy="5" rx="2.3" ry="3"/><ellipse cx="14.5" cy="5" rx="2.3" ry="3"/><ellipse cx="18.4" cy="9" rx="2.3" ry="3"/><path d="M12 11c-3.6 0-6.6 4.3-6.6 6.8 0 2 1.6 3 3.4 3 1.4 0 2.2-.8 3.2-.8s1.8.8 3.2.8c1.8 0 3.4-1 3.4-3C18.6 15.3 15.6 11 12 11z"/></g></svg>'
LEAF = '<svg viewBox="0 0 22 48" aria-hidden="true"><g fill="currentColor" opacity=".9"><path d="M17 46C6 40 2 28 6 12" fill="none" stroke="currentColor" stroke-width="2"/><ellipse cx="5" cy="14" rx="2.6" ry="5" transform="rotate(-20 5 14)"/><ellipse cx="4" cy="24" rx="2.6" ry="5" transform="rotate(-35 4 24)"/><ellipse cx="7" cy="33" rx="2.6" ry="5" transform="rotate(-50 7 33)"/><ellipse cx="12" cy="40" rx="2.6" ry="5" transform="rotate(-65 12 40)"/></g></svg>'
LEAF_R = LEAF.replace('<svg ', '<svg style="transform:scaleX(-1)" ')
GPLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#34A853" d="M3.6 2.3 13.4 12l-9.8 9.7c-.4-.2-.6-.6-.6-1.1V3.4c0-.5.2-.9.6-1.1z"/><path fill="#FBBC04" d="m16.9 15.5-3.5-3.5 3.5-3.5 4 2.3c1.1.6 1.1 1.8 0 2.4z"/><path fill="#EA4335" d="M16.9 15.5 13.4 12l-9.8 9.7c.4.2.9.2 1.4-.1z"/><path fill="#4285F4" d="M16.9 8.5 5 1.4c-.5-.3-1-.3-1.4-.1l9.8 9.7z"/></svg>'
APPLE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#fff" d="M16.4 12.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9-1.7 0-3.3 1-4.2 2.6-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8 1.6 0 2 .8 3.4.8 1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9 0 0-2.7-1-2.7-4.1zM13.9 4.9c.7-.9 1.2-2 1.1-3.2-1 .1-2.3.7-3 1.6-.7.8-1.3 2-1.1 3.1 1.1.1 2.3-.6 3-1.5z"/></svg>'
SPARK = '<svg class="spark {cls}" style="{style}" viewBox="0 0 60 60" aria-hidden="true"><g stroke="{c}" stroke-width="5" stroke-linecap="round"><path d="M30 6v12M30 42v12M6 30h12M42 30h12"/></g></svg>'
RAYS = '<svg class="spark {cls}" style="{style}" viewBox="0 0 60 60" aria-hidden="true"><g stroke="{c}" stroke-width="6" stroke-linecap="round"><path d="M10 40 22 34M8 22l14 4M20 8l8 12"/></g></svg>'


def body(lang, up, play_url, legal, lang_links):
    t = L[lang]
    I = lambda n: f'{up}img/l/{n}.webp'

    def stores(dark=False):
        return (f'<div class="stores"><a class="store" href="{play_url}" rel="noopener">{GPLAY}<span><small>{E(t["play_small"])}</small><b>{t["play"]}</b></span></a>'
                f'<span class="store soon" aria-disabled="true">{APPLE}<span><small>{E(t["ios_small"])}</small><b>{t["ios"]}</b></span></span></div>')

    laurels = ''.join(f'<div class="laurel">{LEAF}<span><b>{E(a)}</b><small>{E(b)}</small></span>{LEAF_R}</div>' for a, b in t['laurels'])
    sp = lambda style, c='#FFD43B', cls='float': SPARK.format(style=style, c=c, cls=cls)
    ry = lambda style, c='#FFD43B', cls='float': RAYS.format(style=style, c=c, cls=cls)

    hero = f"""<section class="band hero" id="top"><div class="wrap">
<div class="reveal"><a class="logo" href="#top">{PAW}Pavurio</a><h1>{E(t['h1'])}</h1><p class="lead">{E(t['sub'])}</p>
<div class="laurels">{laurels}</div>{stores()}</div>
<div class="art reveal d1">{ry('left:-2%;top:30%;width:70px','#fff')}{ry('right:0;top:-2%;width:64px;transform:scaleX(-1)','#fff','float d2')}
<img src="{I('duo_hug')}" alt="{E(t['img_alt'])}" width="640" height="640" fetchpriority="high"><img class="heart" src="{I('ui_heart')}" alt=""></div>
</div><div class="strip">{PAW.replace('<svg', '<svg style="width:20px;height:20px;color:#16B3D3"')}<b>Pavurio</b><i></i><span>{E(t['tag'])}</span></div></section>"""

    chips = ''.join(f'<span class="chip">{E(c)}</span>' for c in t['s2_chips'])
    s2 = f"""<section class="band indigo"><div class="wrap">
<div class="devices reveal"><img class="tile-icon float" src="{I('app_icon')}" alt="Pavurio app icon">
<div class="phone"><div class="scr"><img class="shot" src="{I('app_home')}" alt="Pavurio home screen: the pet colours in as care is logged" loading="lazy"></div></div>
<div class="live float d2" role="img" aria-label="{E(t['live_title'])}"><div class="top"><img src="{I('app_icon')}" alt=""><div><div class="t">{E(t['live_title'])}</div><div class="s">{E(t['live_sub'])}</div></div></div>
<div class="clock" data-clock>18:42</div><div class="btns"><span>{E(t['pause'])}</span><span>{E(t['finish'])}</span></div></div></div>
<div class="reveal d1"><h2>{E(t['s2_h'])}</h2><p class="lead">{E(t['s2_p'])}</p><div class="chips">{chips}</div></div>
</div></section>"""

    tl = t['tiles']
    tile = lambda label, img, bg: f'<div class="tile" style="background:{bg}">{E(label)}<img src="{I(img)}" alt="" loading="lazy"></div>'
    s3 = f"""<section class="band green"><div class="wrap">
<div class="reveal"><span class="badge-new">{E(t['new'])}</span><h2>{E(t['s3_h'])}</h2><p class="lead">{E(t['s3_p'])}</p></div>
<div class="tiles reveal d1">{tile(tl[0], 'meal', '#FF9F43')}{tile(tl[1], 'walk_leash', '#38B6E8')}{tile(tl[2], 'grooming', '#F07AB0')}
<div class="tile wide"><span>{E(tl[3])}</span><img src="{I('dog_trophy')}" alt="" loading="lazy"></div>
{tile(tl[4], 'medication', '#9C7BEA')}{tile(tl[5], 'litter', '#7FC64A')}{tile(tl[6], 'records', '#F4B400')}</div>
</div></section>"""

    stats = ''.join(f'<div class="laurel">{LEAF}<span><b>{E(a)}</b><small>{E(b)}</small></span>{LEAF_R}</div>' for a, b in t['stats'])
    slides = ''.join(f'<figure class="slide" aria-roledescription="slide"><div class="stars" aria-hidden="true">🐾</div><blockquote class="q">{E(q)}</blockquote><p>{E(p)}</p><figcaption>— {E(c)}</figcaption></figure>' for q, p, c in t['quotes'])
    dots = ''.join(f'<button aria-label="{k + 1}"></button>' for k in range(len(t['quotes'])))
    s4 = f"""<section class="band cyan"><div class="wrap center"><div class="stats reveal">{stats}</div>
<div class="carousel reveal d1" aria-roledescription="carousel"><button class="arrow prev" aria-label="{E(t['prev'])}">←</button><div class="slides" aria-live="polite">{slides}</div><button class="arrow next" aria-label="{E(t['next'])}">→</button></div>
<div class="dots">{dots}</div></div></section>"""

    icons = ''.join(f'<div><img src="{I(n)}" alt="" loading="lazy">{E(lbl)}</div>' for n, lbl in zip(['meal', 'water', 'walk', 'medication', 'grooming', 'litter', 'sleep'], t['rem']))
    s5 = f"""<section class="band pink"><div class="wrap center">{ry('left:22%;top:12%;width:70px')}
<div class="notif reveal float" role="img" aria-label="{E(t['notif_h'])} {E(t['notif_p'])}"><div class="hd"><img src="{I('app_icon')}" alt="">Pavurio<em>{E(t['notif_time'])}</em></div><b>{E(t['notif_h'])}</b><p>{E(t['notif_p'])}</p></div>
<h2 class="reveal">{E(t['s5_h'])}</h2><p class="lead reveal d1">{E(t['s5_p'])}</p><div class="icons reveal d2">{icons}</div></div></section>"""

    s6 = f"""<section class="band teal"><div class="wrap">
<div class="cards reveal">{ry('left:-6%;top:40%;width:64px')}<div class="pcard a float"><div><img src="{I('dog_love')}" alt="Honey" loading="lazy"></div></div><div class="pcard b float d2"><div><img src="{I('cat_happy')}" alt="Tabby" loading="lazy"></div></div>
<img class="mini-badge float" style="left:40%;bottom:-2%" src="{I('moment')}" alt="" loading="lazy"><img class="mini-badge float d2" style="right:-4%;top:-4%;width:20%" src="{I('streak7')}" alt="" loading="lazy"></div>
<div class="reveal d1">{ry('right:8%;top:-40px;width:60px')}<h2>{E(t['s6_h'])}</h2><p class="lead">{E(t['s6_p'])}</p></div>
</div></section>"""

    ring = '<svg viewBox="0 0 150 150"><circle cx="75" cy="75" r="64" fill="none" stroke="#E6F7FA" stroke-width="12"/><circle cx="75" cy="75" r="64" fill="none" stroke="#16B3D3" stroke-width="12" stroke-linecap="round" stroke-dasharray="402" stroke-dashoffset="70" transform="rotate(-90 75 75)"/></svg>'
    row = lambda img, label, end='<span class="ok">✓</span>': f'<div class="row"><img src="{I(img)}" alt="">{E(label)}{end}</div>'
    s7 = f"""<section class="band blue"><div class="wrap">
<div class="reveal"><h2>{E(t['s7_h'])}</h2><p class="lead">{E(t['s7_p'])}</p></div>
<div class="devices reveal d1">{ry('right:6%;top:6%;width:66px;transform:scaleX(-1)')}<div class="phone"><div class="scr ui"><h4>{E(t['streak'])}</h4>
<div class="ring">{ring}<b>14</b><small>{E(t['days'])}</small></div>
{row('meal', t['feed'])}{row('walk', t['walk'])}{row('water', t['water'])}<img src="{I('flame')}" alt="" style="width:70px;margin:16px auto 0"></div></div></div>
</div></section>"""

    chev = '<span class="chev">›</span>'
    rows = ''.join(row(n, lbl, chev) for n, lbl in zip(['meal', 'water', 'walk', 'medication', 'records', 'calendar'], t['track']))
    s8 = f"""<section class="band orange"><div class="wrap">
<div class="devices reveal order-2">{ry('left:4%;top:8%;width:66px')}<div class="phone"><div class="scr ui" style="padding-top:56px"><div class="pet-pick"><img src="{I('dog_wave')}" alt="">Honey ▾</div>{rows}
<img src="{I('duo_hug')}" alt="" style="width:62%;margin:14px auto 0"></div></div></div>
<div class="reveal d1"><h2>{E(t['s8_h'])}</h2><p class="lead">{E(t['s8_p'])}</p></div>
</div></section>"""

    s9 = f"""<section class="band brown"><div class="wrap">
<div class="reveal"><span class="badge-share">{E(t['share'])}</span><h2>{E(t['s9_h'])}</h2><p class="lead">{E(t['s9_p'])}</p></div>
<div class="mcards reveal d1">{ry('left:-4%;top:0;width:64px')}<img class="mcard a float" src="{I(f'card_gotcha_{lang}')}" alt="Memory Card" loading="lazy"><img class="mcard b float d2" src="{I(f'card_daily_{lang}')}" alt="Memory Card" loading="lazy"></div>
</div></section>"""

    ben = ''.join('<div class="benefit"><img src="' + I(n) + '" alt="" loading="lazy">' + E(lbl) + '</div>' for n, lbl in zip(['ui_heart', 'dog_sunny', 'cat_sleep', 'duo_hug'], t['benefits']))
    s10 = f"""<section class="band cyan" style="background:#18B4CF"><div class="wrap center"><h2 class="reveal">{E(t['s10_h'])}</h2><p class="lead reveal d1">{E(t['s10_p'])}</p><div class="benefits reveal d2">{ben}</div></div></section>"""

    s11 = f"""<section class="band lav"><div class="wrap">
<div class="reveal">{ry('left:-10px;top:-50px;width:60px')}<h2>{E(t['s11_h'])}</h2><p class="lead">{E(t['s11_p'])}</p></div>
<div class="goal reveal d1"><div class="fillpet"><img class="gray" src="{I('dog_wave')}" alt=""><img class="col" src="{I('dog_wave')}" alt="Honey colouring in as care is logged"></div>
<div class="pets"><span class="on"><img src="{I('dog_wave')}" alt="">Honey</span><span><img src="{I('cat_wave')}" alt="">Tabby</span></div>
<div class="hd"><span>{E(t['goal'])}</span><em>{E(t['goal_of'])} ✓</em></div><div class="segs"><i class="f"></i><i class="f"></i><i class="f"></i><i class="f"></i><i></i></div></div>
</div></section>"""

    s12 = f"""<section class="band creamy"><div class="wrap">
<div class="reveal"><div class="cta-logo"><img src="{I('app_icon')}" alt="Pavurio"><b>{PAW.replace('<svg', '<svg style="width:46px;height:46px;color:#16B3D3"')}Pavurio</b></div><p class="lead">{E(t['cta_p'])}</p>{stores()}<p class="note">{E(t['cta_note'])}</p></div>
<div class="pair reveal d1">{ry('left:40%;top:-30px;width:60px')}<div class="phone sm float"><div class="scr"><img class="shot" src="{I('app_log_meal')}" alt="Logging a meal in Pavurio" loading="lazy"></div></div><div class="phone sm float d2"><div class="scr"><img class="shot" src="{I('app_memories')}" alt="Pavurio Memories" loading="lazy"></div></div></div>
</div></section>"""

    nav = ''.join(f'<a href="{h}">{E(n)}</a>' for h, n in legal)
    s13 = f"""<section class="band press"><div class="wrap center"><h2 class="reveal">{E(t['press_h'])}</h2><p class="lead reveal d1">{E(t['press_p'])}</p>
<div class="kit reveal d1"><img src="{I('app_icon')}" alt=""><img src="{I('duo_hug')}" alt=""><img src="{I('dog_party')}" alt=""><img src="{I('cat_cheer')}" alt=""></div>
<a class="pbtn reveal d2" href="mailto:lesepavistespro@gmail.com?subject=Pavurio%20press%20kit">{E(t['press_btn'])}</a><p class="mail reveal d2">lesepavistespro@gmail.com</p>
<footer class="foot"><nav>{nav}<a href="mailto:lesepavistespro@gmail.com">Contact</a></nav><div class="langs">{lang_links}</div><div class="copy">© 2026 Pavurio · All rights reserved</div></footer>
</div></section>"""

    return '<main>' + hero + s2 + s3 + s4 + s5 + s6 + s7 + s8 + s9 + s10 + s11 + s12 + s13 + '</main>'
