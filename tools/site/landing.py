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
.pcard img{width:92%}
.pcard.a{left:2%;top:4%;transform:rotate(-8deg);z-index:2}
.pcard.b{right:2%;top:12%;transform:rotate(7deg)}
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


# ---------------------------------------------------------------- interactive layer
CSS += r"""
button{font:inherit;color:inherit}
.hint{display:inline-flex;align-items:center;gap:8px;font-weight:900;font-size:14px;background:rgba(255,255,255,.18);border-radius:999px;padding:7px 14px;margin-top:18px}
.hint::before{content:"";width:8px;height:8px;border-radius:50%;background:#FFD43B;box-shadow:0 0 0 0 rgba(255,212,59,.7);animation:ping 1.8s infinite}
@keyframes ping{0%{box-shadow:0 0 0 0 rgba(255,212,59,.7)}70%{box-shadow:0 0 0 10px rgba(255,212,59,0)}100%{box-shadow:0 0 0 0 rgba(255,212,59,0)}}
.dark-hint{background:rgba(22,58,74,.08);color:#3d4a63}
.press-btn{transition:transform .18s cubic-bezier(.3,1.6,.5,1)}.press-btn:active{transform:scale(.94)}
/* progress + sticky bar + toast */
.progress{position:fixed;left:0;top:0;height:4px;width:100%;background:#FFD43B;transform-origin:left;transform:scaleX(0);z-index:60}
.sticky{position:fixed;left:50%;bottom:16px;transform:translate(-50%,140%);z-index:50;display:flex;align-items:center;gap:12px;background:#fff;color:#163A4A;border-radius:22px;padding:9px 10px 9px 9px;box-shadow:0 14px 40px rgba(14,30,60,.25);transition:transform .45s cubic-bezier(.2,1.2,.3,1);width:min(420px,calc(100% - 24px))}
.sticky.on{transform:translate(-50%,0)}
.sticky img{width:46px;height:46px;border-radius:12px}
.sticky div{flex:1;line-height:1.15}.sticky b{font-weight:900;font-size:17px;display:block}.sticky small{font-weight:800;color:#7c8494;font-size:13px}
.sticky a{background:#16B3D3;color:#fff;font-weight:900;border-radius:999px;padding:10px 20px;text-decoration:none;font-size:15px}
.toast{width:max-content;position:fixed;left:50%;bottom:92px;transform:translate(-50%,20px);opacity:0;z-index:70;background:#163A4A;color:#fff;font-weight:900;border-radius:999px;padding:12px 22px;box-shadow:0 10px 30px rgba(0,0,0,.25);transition:all .35s cubic-bezier(.2,1.2,.3,1);pointer-events:none;max-width:calc(100% - 32px);text-align:center}
.toast.on{opacity:1;transform:translate(-50%,0)}
.fx{position:fixed;inset:0;pointer-events:none;z-index:80;overflow:hidden}
.fx i{position:absolute;width:9px;height:13px;border-radius:2px}
.fx b{position:absolute;font-size:22px}
/* hero */
.hero .art{cursor:pointer}
.hero .art .duo{transition:transform .5s cubic-bezier(.3,1.6,.5,1)}
.hero .art.jump .duo{transform:translateY(-26px) scale(1.04)}
.scrolldown{position:absolute;left:50%;bottom:66px;transform:translateX(-50%);z-index:2;color:#fff;font-weight:900;font-size:13px;display:flex;flex-direction:column;align-items:center;gap:2px;text-decoration:none;opacity:.9;animation:bob 1.8s ease-in-out infinite}
@keyframes bob{0%,100%{transform:translate(-50%,0)}50%{transform:translate(-50%,8px)}}
/* mini app */
.app{display:flex;flex-direction:column;align-items:center;padding:46px 14px 14px;color:#23304A;user-select:none}
.m-top{width:100%;display:flex;justify-content:space-between;align-items:center}
.m-ring{width:36px;height:36px;border-radius:50%;border:3px solid #DDF6F7;border-top-color:#14B8C4;display:flex;align-items:center;justify-content:center;font-weight:900;color:#14B8C4;font-size:14px}
.m-menu{width:36px;height:36px;border-radius:50%;background:#F5F6F8;display:flex;align-items:center;justify-content:center;font-weight:900}
.m-count{font-size:44px;font-weight:900;color:#14B8C4;line-height:1;margin-top:2px}.m-count b{display:inline-block;transition:transform .3s cubic-bezier(.3,1.8,.5,1)}.m-count b.pop{transform:scale(1.35)}
.m-sub{font-size:12.5px;font-weight:800;color:#9AA1AE;margin:4px 0 2px;text-align:center;min-height:18px}
.m-pet{position:relative;width:72%;margin:4px 0 8px;flex:1;display:flex;align-items:center}
.m-pet img{width:100%}
.m-pet .gray{filter:grayscale(1) brightness(1.25) contrast(.6);opacity:.55}
.m-pet .col{position:absolute;left:0;top:50%;transform:translateY(-50%);clip-path:inset(100% 0 0 0);transition:clip-path .9s cubic-bezier(.3,1.2,.4,1)}
.m-row{display:grid;grid-template-columns:repeat(6,1fr);gap:4px;width:100%}
.m-care{border:0;background:none;padding:0;display:flex;flex-direction:column;align-items:center;cursor:pointer;position:relative;font-size:9.5px;font-weight:900;color:#9AA1AE;text-transform:uppercase;letter-spacing:.02em}
.m-care img{width:100%;aspect-ratio:1;object-fit:contain;filter:grayscale(1) opacity(.55);transition:filter .3s,transform .3s cubic-bezier(.3,1.8,.5,1)}
.m-care i{position:absolute;right:0;top:30%;width:17px;height:17px;border-radius:50%;background:#14B8C4;color:#fff;font-style:normal;font-size:13px;line-height:17px;font-weight:900;border:2px solid #fff}
.m-care.on img{filter:none;transform:scale(1.08)}.m-care.on{color:#23304A}.m-care.on i{background:#27A55B}
.m-care:hover img{transform:translateY(-3px)}
.m-again{margin-top:10px;border:0;background:#23304A;color:#fff;border-radius:999px;padding:9px 18px;font-weight:900;font-size:13px;cursor:pointer}
.live .btns button{flex:1;text-align:center;padding:9px;border-radius:999px;font-weight:900;font-size:14px;background:#2b2f3b;border:0;color:#fff;cursor:pointer}
.live .btns button:last-child{background:#16B3D3}
.live.paused .clock{opacity:.45}
.live .saved{display:none;font-weight:900;font-size:15px;margin:10px 0 12px;line-height:1.3}
.live.done .clock,.live.done .btns .p,.live.done .btns .f{display:none}.live.done .saved{display:block}
.live .btns .n{display:none}.live.done .btns .n{display:block}
/* routine tiles */
.tile{border:0;cursor:pointer;color:#fff;position:relative;font:inherit;font-weight:900}
.tile img{transition:filter .5s}
.tile:not(.on):not(.wide){background:#ffffff26!important}
.tile:not(.on):not(.wide) img{filter:grayscale(1) brightness(1.2) opacity(.6)}
.tile .chk{position:absolute;top:8px;right:8px;width:24px;height:24px;border-radius:50%;background:#fff;color:#27A55B;font-size:14px;line-height:24px;opacity:0;transform:scale(.4);transition:all .3s cubic-bezier(.3,1.8,.5,1)}
.tile.on .chk{opacity:1;transform:none}
.count{margin-top:14px;font-weight:900;font-size:15px;opacity:.95}
/* carousel swipe */
.slides{touch-action:pan-y;cursor:grab}
/* reminders */
.icons button{border:0;background:none;cursor:pointer;font-weight:900;font-size:15px;color:#fff;padding:8px 4px;border-radius:20px;transition:background .25s}
.icons button.on{background:rgba(255,255,255,.25)}
.notif .acts{display:flex;gap:8px;margin-top:12px;border-top:1px solid #f0e3ea;padding-top:10px}
.notif .acts button{flex:1;border:0;border-radius:12px;padding:8px;background:#F5F6F8;font-weight:900;color:#23304A;cursor:pointer}
.notif .acts button:first-child{background:#DDF6F7;color:#0E8F99}
.notif .txt{transition:opacity .25s,transform .25s}.notif .txt.swap{opacity:0;transform:translateY(8px)}
.notif.done{animation:nudge .5s}
@keyframes nudge{30%{transform:scale(1.03)}}
/* collect cards */
.pcard{cursor:pointer;border:0;perspective:900px;transition:transform .5s cubic-bezier(.3,1.4,.5,1);transform-style:preserve-3d}
.pcard .flipper{position:relative;width:100%;height:100%;transition:transform .7s cubic-bezier(.3,1.3,.5,1);transform-style:preserve-3d}
.pcard.flip .flipper{transform:rotateY(180deg)}
.pcard .face{position:absolute;inset:0;backface-visibility:hidden;-webkit-backface-visibility:hidden;border-radius:22px;display:flex;align-items:flex-end;justify-content:center;overflow:hidden}
.pcard .back{transform:rotateY(180deg);align-items:center;flex-direction:column;justify-content:center;background:#FFF4D6;color:#B86A00;font-weight:900;font-size:15px;gap:6px}
.pcard .back img{width:70%}
.pcard.a .front{background:#FFE1EC}.pcard.b .front{background:#DDF3F0}
/* streak + track phone */
.row{border:0;width:100%;cursor:pointer;color:#23304A;font:inherit;font-weight:900;text-align:left;transition:background .25s,transform .2s}
.row:hover{background:#EEF0F3}
.row .ok{opacity:.15;transition:opacity .3s,transform .3s cubic-bezier(.3,1.8,.5,1)}
.row.on .ok{opacity:1;transform:scale(1.25)}
.row.on{background:#E8F7EE}
.ring circle:last-child{transition:stroke-dashoffset .8s cubic-bezier(.3,1.2,.4,1)}
.ring b{transition:transform .35s cubic-bezier(.3,1.8,.5,1)}.ring b.pop{transform:scale(1.3)}
.flame{width:70px;margin:16px auto 0;filter:grayscale(1) opacity(.4);transition:filter .5s,transform .5s cubic-bezier(.3,1.8,.5,1)}
.flame.lit{filter:none;transform:scale(1.25)}
.pet-pick button{border:0;background:#F5F6F8;border-radius:999px;padding:5px 12px 5px 5px;display:flex;align-items:center;gap:8px;font-weight:900;cursor:pointer}
.pet-pick button img{width:34px;height:34px;border-radius:50%}
.pet-pick button.on{background:#FFF2DB;box-shadow:inset 0 0 0 2px #F5A524}
.pet-pick{gap:8px}
.detail{position:absolute;inset:0;background:#fff;padding:56px 18px 18px;transform:translateX(100%);transition:transform .45s cubic-bezier(.3,1.1,.4,1);display:flex;flex-direction:column;align-items:center;text-align:center;gap:10px}
.detail.on{transform:none}
.detail .bk{align-self:flex-start;border:0;background:#F5F6F8;border-radius:999px;padding:6px 14px;font-weight:900;cursor:pointer}
.detail img{width:56%;margin-top:6px}
.detail h5{margin:0;font-size:24px;font-weight:900}
.detail p{margin:0;font-weight:800;color:#5b6474}
.detail .bar{width:100%;height:14px;border-radius:999px;background:#EEF0F3;overflow:hidden}.detail .bar i{display:block;height:100%;background:#F5A524;border-radius:999px;width:0;transition:width .9s .2s cubic-bezier(.3,1.2,.4,1)}
/* milestones */
.mcard{cursor:pointer;transition:transform .6s cubic-bezier(.3,1.4,.5,1),z-index 0s .2s}
.mcard.front{z-index:3}
/* benefits flip */
.benefit{position:relative;border:0;color:#fff;cursor:pointer;perspective:800px;background:none;padding:0;min-height:200px}
.benefit .in2{position:relative;width:100%;height:100%;min-height:200px;transition:transform .6s cubic-bezier(.3,1.3,.5,1);transform-style:preserve-3d}
.benefit.flip .in2{transform:rotateY(180deg)}
.benefit .f,.benefit .b{position:absolute;inset:0;border-radius:28px;backface-visibility:hidden;-webkit-backface-visibility:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:18px 14px;font-weight:900;font-size:19px;background:rgba(255,255,255,.16)}
.benefit .b{transform:rotateY(180deg);font-size:15.5px;font-weight:800;line-height:1.35;background:#fff;color:#163A4A}
.benefit:hover .f img{transform:translateY(-6px) rotate(-4deg)}
.benefit .f img{transition:transform .35s cubic-bezier(.3,1.8,.5,1)}
/* goal */
.goal .pets button{flex:1;display:flex;align-items:center;gap:10px;font-weight:900;font-size:17px;padding:8px 12px;border-radius:999px;background:#F5F6F8;border:0;cursor:pointer;color:#163A4A}
.goal .pets button.on{background:#EDE6FF;box-shadow:inset 0 0 0 2px #B39AE8}
.goal .pets img{width:40px;height:40px;border-radius:50%;object-fit:cover}
.segs i{cursor:pointer}
.segs i.f::after{transform:scaleX(1)}
.fillpet .col{animation:none;clip-path:inset(100% 0 0 0);transition:clip-path .8s cubic-bezier(.3,1.2,.4,1)}
.goal .acts{display:flex;gap:10px;margin-top:16px}
.goal .acts button{flex:1;border:0;border-radius:999px;padding:12px;font-weight:900;cursor:pointer;background:#163A4A;color:#fff;font-size:15px}
.goal .acts button.ghost{flex:none;background:#F5F6F8;color:#5b6474;padding:12px 16px}
.goal .hd em.done{color:#B39AE8}
/* cta screens */
.phone .scr .cyc{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:top;opacity:0;transition:opacity .7s}
.phone .scr .cyc.on{opacity:1}
.cdots{display:flex;gap:6px;justify-content:center;margin-top:14px}.cdots button{width:9px;height:9px;padding:0;border-radius:50%;border:0;background:#d6d0c2;cursor:pointer}.cdots button.on{width:24px;border-radius:5px;background:#16B3D3}
.tiltable{transition:transform .25s ease-out;will-change:transform}
.copybtn{border:0;background:#fff;color:#163A4A;font-weight:900;border-radius:999px;padding:12px 20px;margin-left:10px;cursor:pointer;box-shadow:0 8px 20px rgba(0,0,0,.06)}
@media (min-width:901px){.sticky{left:auto;right:24px;transform:translateY(140%);width:340px}.sticky.on{transform:none}.toast{bottom:28px}}
@media (max-width:900px){.sticky{bottom:10px}.scrolldown{display:none}
 #try .devices{flex-direction:column;min-height:0}
 #try .live{position:relative;right:auto;bottom:auto;top:auto;margin:16px auto 0;width:min(300px,86vw)}
 #try .tile-icon{bottom:auto;top:46%}}
@media (prefers-reduced-motion:reduce){.m-pet .col,.fillpet .col{transition:none}}
"""

JS = r"""
(function(){
 'use strict';
 var T=JSON.parse(document.getElementById('pv-i18n').textContent);
 var reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 var $=function(s,r){return (r||document).querySelector(s)},$$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};
 var fmt=function(s,v){return s.replace(/\{(\w+)\}/g,function(_,k){return v[k]})};
 function buzz(){try{navigator.vibrate&&navigator.vibrate(12)}catch(e){}}
 // ---- reveal on scroll
 var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}})},{threshold:.18});
 $$('.band').forEach(function(b){io.observe(b)});
 // ---- toast + confetti + hearts
 var toastEl=$('.toast'),tt;
 function toast(m){toastEl.textContent=m;toastEl.classList.add('on');clearTimeout(tt);tt=setTimeout(function(){toastEl.classList.remove('on')},2600)}
 var fx=$('.fx'),COLS=['#14B8C4','#FFC83D','#FF6B9A','#58C322','#9B7BF7','#1CB0F6','#FF8A1F'];
 function confetti(el,n){if(reduce||!el.animate)return;var r=el.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;n=n||46;
  for(var i=0;i<n;i++){var p=document.createElement('i');p.style.left=x+'px';p.style.top=y+'px';p.style.background=COLS[i%COLS.length];fx.appendChild(p);
   var a=Math.random()*Math.PI*2,v=120+Math.random()*260,dx=Math.cos(a)*v,dy=Math.sin(a)*v-220;
   p.animate([{transform:'translate(0,0) rotate(0)',opacity:1},{transform:'translate('+dx+'px,'+(dy+520)+'px) rotate('+(Math.random()*900-450)+'deg)',opacity:0}],{duration:1300+Math.random()*700,easing:'cubic-bezier(.2,.6,.4,1)'}).onfinish=(function(q){return function(){q.remove()}})(p)}}
 function hearts(el,ch){if(reduce||!el.animate)return;var r=el.getBoundingClientRect();for(var i=0;i<6;i++){var h=document.createElement('b');h.textContent=ch||'❤️';h.style.left=(r.left+r.width/2-10)+'px';h.style.top=(r.top+r.height/3)+'px';fx.appendChild(h);
  h.animate([{transform:'translate(0,0) scale(.4)',opacity:1},{transform:'translate('+(Math.random()*160-80)+'px,'+(-90-Math.random()*90)+'px) scale(1.1)',opacity:0}],{duration:1000+Math.random()*500,easing:'ease-out'}).onfinish=(function(q){return function(){q.remove()}})(h)}}
 // ---- progress bar, sticky bar
 var prog=$('.progress'),sticky=$('.sticky'),hero=$('.hero'),cta=$('.creamy'),press=$('.press'),ticking=false;
 function onScroll(){ticking=false;var h=document.documentElement,max=h.scrollHeight-h.clientHeight;prog.style.transform='scaleX('+(max>0?h.scrollTop/max:0)+')';
  var hb=hero.getBoundingClientRect().bottom,cr=cta.getBoundingClientRect(),pr=press.getBoundingClientRect(),vh=window.innerHeight;
  var hide=hb>80||(cr.top<vh*.7&&cr.bottom>vh*.3)||pr.top<vh*.6;sticky.classList.toggle('on',!hide)}
 window.addEventListener('scroll',function(){if(!ticking){ticking=true;requestAnimationFrame(onScroll)}},{passive:true});onScroll();
 // ---- tilt
 if(!reduce&&window.matchMedia('(hover:hover)').matches){$$('.tiltable').forEach(function(el){var base=el.getAttribute('data-rot')||'0';
  el.addEventListener('pointermove',function(e){var r=el.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;el.style.transform='perspective(800px) rotate('+base+'deg) rotateY('+(x*14)+'deg) rotateX('+(-y*14)+'deg) translateY(-4px)'});
  el.addEventListener('pointerleave',function(){el.style.transform=''})})}
 // ---- hero: the duo jumps with hearts
 var art=$('.hero .art');art.addEventListener('click',function(){art.classList.add('jump');hearts(art);buzz();setTimeout(function(){art.classList.remove('jump')},450)});
 art.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();art.click()}});
 // ---- mini app: tap cares, Honey colours in
 var mini=$('#mini');if(mini){var cares=$$('.m-care',mini),n=0,cnt=$('[data-n]',mini),sub=$('[data-sub]',mini),col=$('.m-pet .col',mini),again=$('.m-again',mini),ring=$('.m-ring',mini);
  function paint(){var p=Math.round(n/cares.length*100);col.style.clipPath='inset('+(100-p)+'% 0 0 0)';cnt.textContent=n;sub.textContent=n===cares.length?T.all_done:fmt(T.logged,{p:p});again.hidden=n<cares.length;ring.textContent=n}
  cares.forEach(function(b){b.addEventListener('click',function(){if(b.classList.contains('on'))return;b.classList.add('on');b.setAttribute('aria-pressed','true');n++;cnt.classList.add('pop');setTimeout(function(){cnt.classList.remove('pop')},300);paint();hearts(b,'✨');buzz();if(n===cares.length){confetti($('.m-pet',mini),60)}})});
  again.addEventListener('click',function(){n=0;cares.forEach(function(b){b.classList.remove('on');b.setAttribute('aria-pressed','false')});paint()});paint()}
 // ---- live walk card
 var live=$('.live');if(live){var clk=$('[data-clock]',live),st=$('.s',live),start=Date.now()-(18*60+42)*1000,pausedAt=0,timer;
  function tick(){var now=pausedAt||Date.now(),s=Math.floor((now-start)/1000);clk.textContent=String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')}
  tick();timer=setInterval(tick,1000);var pb=$('.p',live),fb=$('.f',live),nb=$('.n',live),sub0=st.textContent;
  pb.addEventListener('click',function(){if(pausedAt){start+=Date.now()-pausedAt;pausedAt=0;live.classList.remove('paused');pb.textContent=T.pause;st.textContent=sub0}else{pausedAt=Date.now();live.classList.add('paused');pb.textContent=T.resume;st.textContent=T.paused}tick();buzz()});
  fb.addEventListener('click',function(){live.classList.add('done');confetti(live,50);toast(T.walk_saved);buzz()});
  nb.addEventListener('click',function(){live.classList.remove('done','paused');start=Date.now();pausedAt=0;pb.textContent=T.pause;st.textContent=sub0;tick()})}
 // ---- routine tiles
 var tiles=$$('.tiles .tile:not(.wide)'),tc=$('.tiles-count');function tcount(){tc.textContent=fmt(T.routine_count,{n:tiles.filter(function(t){return t.classList.contains('on')}).length})}
 tiles.forEach(function(t){t.addEventListener('click',function(){var on=t.classList.toggle('on');t.setAttribute('aria-pressed',on);if(on)hearts(t,'✨');buzz();tcount()})});tcount();
 var wide=$('.tile.wide');wide.addEventListener('click',function(){confetti(wide,50);toast(T.challenge_go);buzz()});
 // ---- carousel (buttons, dots, swipe, keys, autoplay)
 var c=$('.carousel');if(c){var s=$$('.slide',c),d=$$('.dots button'),i=0,t;
  function go(k){i=(k+s.length)%s.length;s.forEach(function(x,j){x.classList.toggle('on',j===i);x.setAttribute('aria-hidden',j!==i)});d.forEach(function(x,j){x.classList.toggle('on',j===i);x.setAttribute('aria-current',j===i)})}
  function auto(){clearInterval(t);if(!reduce)t=setInterval(function(){go(i+1)},6000)}
  $('.prev',c).onclick=function(){go(i-1);auto()};$('.next',c).onclick=function(){go(i+1);auto()};d.forEach(function(x,j){x.onclick=function(){go(j);auto()}});
  var sx=null,sl=$('.slides',c);sl.addEventListener('pointerdown',function(e){sx=e.clientX});sl.addEventListener('pointerup',function(e){if(sx===null)return;var dx=e.clientX-sx;sx=null;if(Math.abs(dx)>40){go(i+(dx<0?1:-1));auto()}});
  c.addEventListener('keydown',function(e){if(e.key==='ArrowLeft'){go(i-1);auto()}if(e.key==='ArrowRight'){go(i+1);auto()}});
  c.addEventListener('mouseenter',function(){clearInterval(t)});c.addEventListener('mouseleave',auto);go(0);auto()}
 // ---- reminders: preview each care's notification, act on it
 var nf=$('.notif'),nt=$('.notif .txt'),nh=$('.notif .txt b'),np=$('.notif .txt p'),rb=$$('.icons button');
 rb.forEach(function(b,k){b.addEventListener('click',function(){rb.forEach(function(x){x.classList.toggle('on',x===b);x.setAttribute('aria-pressed',x===b)});nt.classList.add('swap');setTimeout(function(){nh.textContent=T.notifs[k][0];np.textContent=T.notifs[k][1];nt.classList.remove('swap')},200);buzz()})});
 $('.notif .dn').addEventListener('click',function(e){nf.classList.remove('done');void nf.offsetWidth;nf.classList.add('done');confetti(e.currentTarget,36);toast(T.done_toast);buzz()});
 $('.notif .sz').addEventListener('click',function(){toast(T.snooze_toast);buzz()});
 // ---- collect stickers
 var pool=JSON.parse(document.getElementById('pv-stickers').textContent),got=2,cc=$('.collect-count');
 function ccount(){cc.textContent=fmt(T.collected,{n:Math.min(got,12)})}ccount();
 $$('.pcard').forEach(function(card){card.addEventListener('click',function(){if(card.classList.contains('flip')){card.classList.remove('flip');return}
  var img=$('.back img',card);img.src=pool[got%pool.length];card.classList.add('flip');got++;ccount();hearts(card,'⭐');buzz();if(got===12)confetti(card,60)})});
 // ---- streak phone
 var sr=$$('.streak-ui .row'),sn=$('.streak-ui .ring b'),sc=$('.streak-ui .ring circle:last-child'),fl=$('.streak-ui .flame'),days=14,saved=false;
 sr.forEach(function(r){r.addEventListener('click',function(){var on=r.classList.toggle('on');r.setAttribute('aria-pressed',on);buzz();var all=sr.every(function(x){return x.classList.contains('on')});
  if(all&&!saved){saved=true;days++;sn.textContent=days;sn.classList.add('pop');setTimeout(function(){sn.classList.remove('pop')},350);sc.style.strokeDashoffset='0';fl.classList.add('lit');confetti(fl,60);toast(fmt(T.streak_up,{n:days}))}
  else if(!all&&saved){saved=false;days--;sn.textContent=days;sc.style.strokeDashoffset='70';fl.classList.remove('lit')}})});
 // ---- track phone: pet switch + detail panels
 var tp=$('.track-ui'),petBtns=$$('.pet-pick button',tp),det=$('.detail',tp),pet=0,TR=JSON.parse(document.getElementById('pv-track').textContent);
 function rowsFor(){$$('.trow',tp).forEach(function(r,k){var lbl=$('span',r);if(k===2){lbl.textContent=pet?T.litter:TR.labels[2];$('img',r).src=pet?TR.litterImg:TR.imgs[2]}})}
 petBtns.forEach(function(b,k){b.addEventListener('click',function(){pet=k;petBtns.forEach(function(x){x.classList.toggle('on',x===b);x.setAttribute('aria-pressed',x===b)});$('.track-pet',tp).src=k?TR.catImg:TR.dogImg;rowsFor();det.classList.remove('on');buzz()})});
 $$('.trow',tp).forEach(function(r,k){r.addEventListener('click',function(){$('h5',det).textContent=$('span',r).textContent;$('p',det).textContent=T.track[pet][k];$('img',det).src=$('img',r).src;var bar=$('.bar i',det);bar.style.width='0';det.classList.add('on');det.setAttribute('aria-hidden','false');setTimeout(function(){bar.style.width=TR.pct[pet][k]+'%'},60);buzz()})});
 $('.bk',det).addEventListener('click',function(){det.classList.remove('on');det.setAttribute('aria-hidden','true')});
 // ---- milestone cards
 var mc=$$('.mcard');mc.forEach(function(m){m.addEventListener('click',function(){mc.forEach(function(x){x.classList.toggle('front',x===m)});hearts(m,'💛');buzz()})});
 // ---- benefits flip
 $$('.benefit').forEach(function(b){b.addEventListener('click',function(){var f=b.classList.toggle('flip');b.setAttribute('aria-pressed',f);buzz()})});
 // ---- daily goal (two pets)
 var g=$('.goal'),gs=$$('.segs i',g),gp=$$('.pets button',g),gcol=$('.fillpet .col',g),ggr=$('.fillpet .gray',g),gof=$('.hd em',g),state=[4,2],cur=0,GI=JSON.parse(document.getElementById('pv-goal').textContent);
 function gpaint(){var v=state[cur];gs.forEach(function(s,k){s.classList.toggle('f',k<v)});gcol.style.clipPath='inset('+(100-v*20)+'% 0 0 0)';gof.textContent=GI.of[v]+(v===5?' ✓':'');gof.classList.toggle('done',v===5)}
 gp.forEach(function(b,k){b.addEventListener('click',function(){cur=k;gp.forEach(function(x){x.classList.toggle('on',x===b);x.setAttribute('aria-pressed',x===b)});gcol.src=ggr.src=GI.img[k];gpaint();buzz()})});
 function setG(v){var was=state[cur];state[cur]=Math.max(0,Math.min(5,v));gpaint();buzz();if(state[cur]===5&&was<5){confetti(gcol,70);toast(T.goal_done)}}
 gs.forEach(function(s,k){s.addEventListener('click',function(){setG(k+1)})});
 $('.goal .log').addEventListener('click',function(){setG(state[cur]+1)});$('.goal .ghost').addEventListener('click',function(){setG(0)});gpaint();
 // ---- cta screens cycle
 var cy=$$('.cyc'),cd=$$('.cdots button'),ci=0,ct;function cgo(k){ci=(k+cy.length)%cy.length;cy.forEach(function(x,j){x.classList.toggle('on',j===ci)});cd.forEach(function(x,j){x.classList.toggle('on',j===ci);x.setAttribute('aria-current',j===ci)})}
 function cauto(){clearInterval(ct);if(!reduce)ct=setInterval(function(){cgo(ci+1)},3200)}cd.forEach(function(x,j){x.onclick=function(){cgo(j);cauto()}});cgo(0);cauto();
 // ---- copy email
 var cb=$('.copybtn');if(cb)cb.addEventListener('click',function(){var m='lesepavistespro@gmail.com';(navigator.clipboard?navigator.clipboard.writeText(m):Promise.reject()).then(function(){toast(T.copied)},function(){toast(m)})});
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
    import json as _json
    from landing_ix import X
    t = L[lang]
    x = X[lang]
    I = lambda n: f'{up}img/l/{n}.webp'
    data = lambda id_, obj: f'<script type="application/json" id="{id_}">{_json.dumps(obj, ensure_ascii=False)}</script>'

    def stores():
        return (f'<div class="stores"><a class="store press-btn" href="{play_url}" rel="noopener">{GPLAY}<span><small>{E(t["play_small"])}</small><b>{t["play"]}</b></span></a>'
                f'<span class="store soon" aria-disabled="true">{APPLE}<span><small>{E(t["ios_small"])}</small><b>{t["ios"]}</b></span></span></div>')

    laurels = ''.join(f'<div class="laurel">{LEAF}<span><b>{E(a)}</b><small>{E(b)}</small></span>{LEAF_R}</div>' for a, b in t['laurels'])
    ry = lambda style, c='#FFD43B', cls='float': RAYS.format(style=style, c=c, cls=cls)
    hint = lambda s, cls='': f'<div class="hint {cls}">{E(s)}</div>'

    hero = f"""<section class="band hero" id="top"><div class="wrap">
<div class="reveal"><a class="logo" href="#top">{PAW}Pavurio</a><h1>{E(t['h1'])}</h1><p class="lead">{E(t['sub'])}</p>
<div class="laurels">{laurels}</div>{stores()}</div>
<div class="art reveal d1" role="button" tabindex="0" aria-label="{E(t['img_alt'])}">{ry('left:-2%;top:30%;width:70px','#fff')}{ry('right:0;top:-2%;width:64px;transform:scaleX(-1)','#fff','float d2')}
<img class="duo" src="{I('duo_hug')}" alt="{E(t['img_alt'])}" width="640" height="640" fetchpriority="high"><img class="heart" src="{I('ui_heart')}" alt=""></div>
</div><a class="scrolldown" href="#try" aria-label="{E(x['scroll'])}">{E(x['scroll'])}<span aria-hidden="true">⌄</span></a>
<div class="strip">{PAW.replace('<svg', '<svg style="width:20px;height:20px;color:#16B3D3"')}<b>Pavurio</b><i></i><span>{E(t['tag'])}</span></div></section>"""

    care_imgs = ['meal', 'water', 'walk', 'play', 'grooming', 'medication']
    mcare = ''.join(f'<button class="m-care" aria-pressed="false" aria-label="{E(lbl)}"><img src="{I(n)}" alt="">{E(lbl)}<i aria-hidden="true">+</i></button>' for n, lbl in zip(care_imgs, x['care']))
    chips = ''.join(f'<span class="chip">{E(c)}</span>' for c in t['s2_chips'])
    s2 = f"""<section class="band indigo" id="try"><div class="wrap">
<div class="devices reveal"><img class="tile-icon float" src="{I('app_icon')}" alt="Pavurio app icon">
<div class="phone"><div class="scr app" id="mini" aria-live="polite">
<div class="m-top"><span class="m-ring">0</span><span class="m-menu" aria-hidden="true">≋</span></div>
<div class="m-count"><b data-n>0</b>/6</div><div class="m-sub" data-sub></div>
<div class="m-pet"><img class="gray" src="{I('dog_wave')}" alt=""><img class="col" src="{I('dog_wave')}" alt="Honey"></div>
<div class="m-row">{mcare}</div><button class="m-again" hidden>{E(x['again'])}</button></div></div>
<div class="live" role="group" aria-label="{E(t['live_title'])}"><div class="top"><img src="{I('app_icon')}" alt=""><div><div class="t">{E(t['live_title'])}</div><div class="s">{E(t['live_sub'])}</div></div></div>
<div class="clock" data-clock aria-live="off">18:42</div><div class="saved">{E(x['walk_saved'])}</div>
<div class="btns"><button class="p">{E(t['pause'])}</button><button class="f">{E(t['finish'])}</button><button class="n">{E(x['walk_new'])}</button></div></div></div>
<div class="reveal d1"><h2>{E(t['s2_h'])}</h2><p class="lead">{E(t['s2_p'])}</p><div class="chips">{chips}</div>{hint(x['try_it'])}</div>
</div></section>"""

    tl = t['tiles']
    tile = lambda label, img, bg, on: f'<button class="tile press-btn{" on" if on else ""}" aria-pressed="{"true" if on else "false"}" style="background:{bg}"><span class="chk" aria-hidden="true">✓</span>{E(label)}<img src="{I(img)}" alt="" loading="lazy"></button>'
    s3 = f"""<section class="band green"><div class="wrap">
<div class="reveal"><span class="badge-new">{E(t['new'])}</span><h2>{E(t['s3_h'])}</h2><p class="lead">{E(t['s3_p'])}</p>{hint(x['routine_hint'])}</div>
<div class="reveal d1"><div class="tiles">{tile(tl[0], 'meal', '#FF9F43', 1)}{tile(tl[1], 'walk_leash', '#38B6E8', 1)}{tile(tl[2], 'grooming', '#F07AB0', 0)}
<button class="tile wide press-btn"><span>{E(tl[3])}</span><img src="{I('dog_trophy')}" alt="" loading="lazy"></button>
{tile(tl[4], 'medication', '#9C7BEA', 0)}{tile(tl[5], 'litter', '#7FC64A', 0)}{tile(tl[6], 'records', '#F4B400', 1)}</div><div class="count tiles-count" aria-live="polite"></div></div>
</div></section>"""

    stats = ''.join(f'<div class="laurel">{LEAF}<span><b>{E(a)}</b><small>{E(b)}</small></span>{LEAF_R}</div>' for a, b in t['stats'])
    slides = ''.join(f'<figure class="slide" aria-roledescription="slide"><div class="stars" aria-hidden="true">🐾</div><blockquote class="q">{E(q)}</blockquote><p>{E(p)}</p><figcaption>— {E(c)}</figcaption></figure>' for q, p, c in t['quotes'])
    dots = ''.join(f'<button aria-label="{k + 1}"></button>' for k in range(len(t['quotes'])))
    s4 = f"""<section class="band cyan"><div class="wrap center"><div class="stats reveal">{stats}</div>
<div class="carousel reveal d1" aria-roledescription="carousel" tabindex="0"><button class="arrow prev press-btn" aria-label="{E(t['prev'])}">←</button><div class="slides" aria-live="polite">{slides}</div><button class="arrow next press-btn" aria-label="{E(t['next'])}">→</button></div>
<div class="dots">{dots}</div></div></section>"""

    rem_imgs = ['meal', 'water', 'walk', 'medication', 'grooming', 'litter', 'sleep']
    icons = ''.join(f'<button class="{"on" if k == 2 else ""}" aria-pressed="{"true" if k == 2 else "false"}"><img src="{I(n)}" alt="" loading="lazy">{E(lbl)}</button>' for k, (n, lbl) in enumerate(zip(rem_imgs, t['rem'])))
    n0 = x['notifs'][2]
    s5 = f"""<section class="band pink"><div class="wrap center">{ry('left:22%;top:12%;width:70px')}
<div class="notif reveal float" aria-live="polite"><div class="hd"><img src="{I('app_icon')}" alt="">Pavurio<em>{E(t['notif_time'])}</em></div><div class="txt"><b>{E(n0[0])}</b><p>{E(n0[1])}</p></div>
<div class="acts"><button class="dn press-btn">✓ {E(x['done'])}</button><button class="sz press-btn">⏰ {E(x['snooze'])}</button></div></div>
<h2 class="reveal">{E(t['s5_h'])}</h2><p class="lead reveal d1">{E(t['s5_p'])}</p><div class="icons reveal d2">{icons}</div>{hint(x['rem_hint'])}</div></section>"""

    pool = [I(n) for n in ['dog_party', 'cat_cheer', 'dog_trot', 'cat_sleep', 'dog_sunny', 'cat_passport', 'dog_trophy', 'cat_wave', 'dog_love', 'cat_happy', 'duo_hug', 'dog_wave']]
    s6 = f"""<section class="band teal"><div class="wrap">
<div class="cards reveal">{ry('left:-6%;top:40%;width:64px')}
<button class="pcard a" aria-label="{E(x['collect_hint'])}"><div class="flipper"><div class="face front"><img src="{I('dog_love')}" alt="Honey" loading="lazy"></div><div class="face back"><img src="{I('dog_party')}" alt="" loading="lazy">{E(x['new_sticker'])}</div></div></button>
<button class="pcard b" aria-label="{E(x['collect_hint'])}"><div class="flipper"><div class="face front"><img src="{I('cat_happy')}" alt="Tabby" loading="lazy"></div><div class="face back"><img src="{I('cat_cheer')}" alt="" loading="lazy">{E(x['new_sticker'])}</div></div></button>
<img class="mini-badge float" style="left:40%;bottom:-2%" src="{I('moment')}" alt="" loading="lazy"><img class="mini-badge float d2" style="right:-4%;top:-4%;width:20%" src="{I('streak7')}" alt="" loading="lazy"></div>
<div class="reveal d1">{ry('right:8%;top:-40px;width:60px')}<h2>{E(t['s6_h'])}</h2><p class="lead">{E(t['s6_p'])}</p>{hint(x['collect_hint'])}<div class="count collect-count" aria-live="polite"></div></div>
</div></section>{data('pv-stickers', pool)}"""

    ring = '<svg viewBox="0 0 150 150"><circle cx="75" cy="75" r="64" fill="none" stroke="#E6F7FA" stroke-width="12"/><circle cx="75" cy="75" r="64" fill="none" stroke="#16B3D3" stroke-width="12" stroke-linecap="round" stroke-dasharray="402" stroke-dashoffset="70" transform="rotate(-90 75 75)"/></svg>'
    srow = lambda img, label: f'<button class="row" aria-pressed="false"><img src="{I(img)}" alt="">{E(label)}<span class="ok" aria-hidden="true">✓</span></button>'
    s7 = f"""<section class="band blue"><div class="wrap">
<div class="reveal"><h2>{E(t['s7_h'])}</h2><p class="lead">{E(t['s7_p'])}</p>{hint(x['streak_hint'])}</div>
<div class="devices reveal d1">{ry('right:6%;top:6%;width:66px;transform:scaleX(-1)')}<div class="phone"><div class="scr ui streak-ui"><h4>{E(t['streak'])}</h4>
<div class="ring">{ring}<b aria-live="polite">14</b><small>{E(t['days'])}</small></div>
{srow('meal', t['feed'])}{srow('walk', t['walk'])}{srow('water', t['water'])}<img class="flame" src="{I('flame')}" alt=""></div></div></div>
</div></section>"""

    track_imgs = ['meal', 'water', 'walk', 'medication', 'records', 'calendar']
    trows = ''.join(f'<button class="row trow"><img src="{I(n)}" alt=""><span>{E(lbl)}</span><span class="chev" aria-hidden="true">›</span></button>' for n, lbl in zip(track_imgs, t['track']))
    trk = {'labels': t['track'], 'imgs': [I(n) for n in track_imgs], 'litterImg': I('litter'), 'dogImg': I('duo_hug'), 'catImg': I('cat_happy'),
           'pct': [[100, 75, 100, 50, 100, 80], [67, 80, 100, 0, 100, 60]]}
    s8 = f"""<section class="band orange"><div class="wrap">
<div class="devices reveal order-2">{ry('left:4%;top:8%;width:66px')}<div class="phone"><div class="scr ui track-ui" style="padding-top:56px;position:relative">
<div class="pet-pick"><button class="on" aria-pressed="true"><img src="{I('dog_wave')}" alt="">Honey</button><button aria-pressed="false"><img src="{I('cat_wave')}" alt="">Tabby</button></div>{trows}
<img class="track-pet" src="{I('duo_hug')}" alt="" style="width:56%;margin:12px auto 0">
<div class="detail" aria-hidden="true"><button class="bk">‹ {E(x['back'])}</button><img src="{I('meal')}" alt=""><h5></h5><p></p><div class="bar"><i></i></div></div></div></div></div>
<div class="reveal d1"><h2>{E(t['s8_h'])}</h2><p class="lead">{E(t['s8_p'])}</p>{hint(x['track_hint'])}</div>
</div></section>{data('pv-track', trk)}"""

    s9 = f"""<section class="band brown"><div class="wrap">
<div class="reveal"><span class="badge-share">{E(t['share'])}</span><h2>{E(t['s9_h'])}</h2><p class="lead">{E(t['s9_p'])}</p>{hint(x['card_hint'])}</div>
<div class="mcards reveal d1">{ry('left:-4%;top:0;width:64px')}<img class="mcard a front float" src="{I(f'card_gotcha_{lang}')}" alt="Memory Card" loading="lazy" tabindex="0" role="button"><img class="mcard b float d2" src="{I(f'card_daily_{lang}')}" alt="Memory Card" loading="lazy" tabindex="0" role="button"></div>
</div></section>"""

    ben = ''.join(f'<button class="benefit" aria-pressed="false"><div class="in2"><div class="f"><img src="{I(n)}" alt="" loading="lazy">{E(lbl)}</div><div class="b">{E(back)}</div></div></button>'
                  for n, lbl, back in zip(['ui_heart', 'dog_sunny', 'cat_sleep', 'duo_hug'], t['benefits'], x['benefit_backs']))
    s10 = f"""<section class="band cyan" style="background:#18B4CF"><div class="wrap center"><h2 class="reveal">{E(t['s10_h'])}</h2><p class="lead reveal d1">{E(t['s10_p'])}</p><div class="benefits reveal d2">{ben}</div>{hint(x['flip'])}</div></section>"""

    of = [t['goal_of'].replace('4', str(k), 1) for k in range(6)]
    s11 = f"""<section class="band lav"><div class="wrap">
<div class="reveal">{ry('left:-10px;top:-50px;width:60px')}<h2>{E(t['s11_h'])}</h2><p class="lead">{E(t['s11_p'])}</p></div>
<div class="goal reveal d1"><div class="fillpet"><img class="gray" src="{I('dog_wave')}" alt=""><img class="col" src="{I('dog_wave')}" alt=""></div>
<div class="pets"><button class="on" aria-pressed="true"><img src="{I('dog_wave')}" alt="">Honey</button><button aria-pressed="false"><img src="{I('cat_wave')}" alt="">Tabby</button></div>
<div class="hd"><span>{E(t['goal'])}</span><em aria-live="polite">{E(t['goal_of'])}</em></div><div class="segs">{''.join('<i role="button" tabindex="0"></i>' for _ in range(5))}</div>
<div class="acts"><button class="log press-btn">{E(x['log_care'])}</button><button class="ghost press-btn">↺ {E(x['reset'])}</button></div></div>
</div></section>{data('pv-goal', {'of': of, 'img': [I('dog_wave'), I('cat_wave')]})}"""

    cyc = ['home', 'log_meal', 'memories', 'card', 'care', 'achievements']
    imgs = ''.join(f'<img class="cyc{" on" if k == 0 else ""}" src="{I("app_" + n)}" alt="" loading="lazy">' for k, n in enumerate(cyc))
    cdots = ''.join(f'<button aria-label="{k + 1}"></button>' for k in range(len(cyc)))
    s12 = f"""<section class="band creamy"><div class="wrap">
<div class="reveal"><div class="cta-logo"><img src="{I('app_icon')}" alt="Pavurio"><b>{PAW.replace('<svg', '<svg style="width:46px;height:46px;color:#16B3D3"')}Pavurio</b></div><p class="lead">{E(t['cta_p'])}</p>{stores()}<p class="note">{E(t['cta_note'])}</p></div>
<div class="reveal d1" style="justify-self:center"><div style="position:relative">{ry('left:40%;top:-30px;width:60px')}<div class="phone tiltable" data-rot="-3"><div class="scr">{imgs}</div></div></div><div class="cdots">{cdots}</div></div>
</div></section>"""

    nav = ''.join(f'<a href="{h}">{E(n)}</a>' for h, n in legal)
    s13 = f"""<section class="band press"><div class="wrap center"><h2 class="reveal">{E(t['press_h'])}</h2><p class="lead reveal d1">{E(t['press_p'])}</p>
<div class="kit reveal d1"><img src="{I('app_icon')}" alt=""><img src="{I('duo_hug')}" alt=""><img src="{I('dog_party')}" alt=""><img src="{I('cat_cheer')}" alt=""></div>
<div class="reveal d2"><a class="pbtn press-btn" href="mailto:lesepavistespro@gmail.com?subject=Pavurio%20press%20kit">{E(t['press_btn'])}</a><button class="copybtn press-btn">{E(x['copy'])}</button></div><p class="mail reveal d2">lesepavistespro@gmail.com</p>
<footer class="foot"><nav>{nav}<a href="mailto:lesepavistespro@gmail.com">Contact</a></nav><div class="langs">{lang_links}</div><div class="copy">© 2026 Pavurio · All rights reserved</div></footer>
</div></section>"""

    chrome = f"""<div class="progress" aria-hidden="true"></div><div class="fx" aria-hidden="true"></div><div class="toast" role="status" aria-live="polite"></div>
<div class="sticky" aria-label="Pavurio"><img src="{I('app_icon')}" alt=""><div><b>Pavurio</b><small>{E(x['free_bar'])}</small></div><a class="press-btn" href="{play_url}" rel="noopener">{E(x['get'])}</a></div>"""
    i18n = {k: x[k] for k in ('logged', 'all_done', 'paused', 'resume', 'walk_saved', 'routine_count', 'challenge_go', 'notifs', 'done_toast', 'snooze_toast', 'collected', 'streak_up', 'track', 'litter', 'goal_done', 'copied')}
    i18n.update(pause=t['pause'])
    return '<main>' + hero + s2 + s3 + s4 + s5 + s6 + s7 + s8 + s9 + s10 + s11 + s12 + s13 + '</main>' + chrome + data('pv-i18n', i18n)
