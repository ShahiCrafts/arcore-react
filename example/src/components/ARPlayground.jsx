import React, { useEffect, useRef, useState } from 'react';
import { createARView } from 'capacitor-arcore';
import './ARPlayground.css';

const MODELS = [
  { id:'sofa', label:'Sofa', url:'/models/sofa.glb', emoji:'🛋️' },
  { id:'chair', label:'Chair', url:'/models/chair.glb', emoji:'🪑' },
  { id:'table', label:'Table', url:'/models/table.glb', emoji:'▰' },
];
const SWATCHES = [['Beige','#c8b49b'],['Grey','#858585'],['Olive','#68705b'],['Navy','#222b3c'],['Terracotta','#a55f3b']];

export default function ARPlayground() {
  const overlayRef=useRef(null), viewRef=useRef(null), modelIndexRef=useRef(0);
  const [supported,setSupported]=useState(null), [active,setActive]=useState(false), [surface,setSurface]=useState(false);
  const [modelIndex,setModelIndex]=useState(0), [placed,setPlaced]=useState(false), [busy,setBusy]=useState(false);
  const [scale,setScale]=useState(1), [rotation,setRotation]=useState(0), [color,setColor]=useState(SWATCHES[0][1]);
  const [sheetOpen,setSheetOpen]=useState(false), [toast,setToast]=useState(''), [shot,setShot]=useState(null), [needsResume,setNeedsResume]=useState(false);
  const secure=window.isSecureContext;

  useEffect(()=>{ modelIndexRef.current=modelIndex; },[modelIndex]);
  useEffect(()=>{ const v=createARView({overlay:overlayRef.current}); viewRef.current=v; v.checkSupport().then(r=>setSupported(r.supported)); return()=>{ if(viewRef.current===v) v.destroy().catch(()=>{}); }; },[]);

  const start=async()=>{
    setBusy(true); const v=viewRef.current;
    try {
      await v.create({overlay:overlayRef.current,showReticle:true,showPlaneDots:true,dotSpacing:.14,lightEstimation:true});
      v.onFrame(e=>{ if(e.type==='surfaceDetected') setSurface(true); if(e.type==='surfaceLost') setSurface(false); if(e.type==='sessionEnded'){setSurface(false);setNeedsResume(true);} });
      await v.preloadModels(MODELS.map(m=>m.url));
      v.enableCustomization({
        modelUrl:()=>MODELS[modelIndexRef.current].url,
        onTap:()=>setTimeout(()=>setPlaced(!!v.activeModelId),0),
        onScale:s=>setScale(s), onRotate:r=>setRotation(r)
      });
      setActive(true); setToast('Move slowly — dots show detected surfaces');
    } catch(e){ setToast(e.message); }
    setBusy(false);
  };

  const place=async()=>{ if(!surface||busy)return; setBusy(true); const r=await viewRef.current.placeModel(MODELS[modelIndex].url); if(r.success){setPlaced(true);setToast('Pinch to scale • twist to rotate');} setBusy(false); };
  const chooseModel=async i=>{
    setModelIndex(i); modelIndexRef.current=i; setSheetOpen(false);
    if(viewRef.current.activeModelId){ setBusy(true); await viewRef.current.switchModel(MODELS[i].url); setPlaced(true); setBusy(false); setToast(`${MODELS[i].label} switched in place`); }
    else setToast('Tap the dotted surface to place');
  };
  const chooseColor=async c=>{setColor(c);await viewRef.current.setColor(c);};
  const reset=async()=>{await viewRef.current.removeModel();setPlaced(false);setScale(1);setRotation(0);setToast('Tap the dotted surface to place');};
  const screenshot=async()=>{setBusy(true);const r=await viewRef.current.takeScreenshot({format:'png',includeReticle:false});setBusy(false);if(!r.success){setToast(r.error);return;}setShot(r.dataUrl);setToast('Screenshot captured');};
  const saveShot=()=>{if(!shot)return;const a=document.createElement('a');a.href=shot;a.download=`ar-${Date.now()}.png`;a.click();};
  const resume=async()=>{setNeedsResume(false);await start();};
  const close=async()=>{await viewRef.current.destroy();setActive(false);setPlaced(false);setSurface(false);};

  return <div ref={overlayRef} className="ar-shell">
    {!active?<main className="launch"><div className="brandmark">AR</div><div className="eyebrow">Furniture preview</div><h1>See it in<br/>your space.</h1><p>Scan a surface, tap to place, pinch to resize and twist to rotate.</p><button className="launch-btn" disabled={!secure||supported===false||busy} onClick={start}>{busy?'Opening camera…':'View in your room'}</button><small>{!secure?'Trusted HTTPS is required.':supported===false?'This browser does not support immersive WebXR AR.':'Android Chrome • ARCore compatible device'}</small></main>:<>
      <header className="ar-top" data-ui="true"><button className="circle" onClick={close}>×</button><div className="mode-pill"><b>◇</b><span>AR View</span></div><button className="circle" onClick={()=>setToast('Dots = detected surface • tap = place • pinch = scale • twist = rotate')}>?</button></header>
      <div className={`scan-state ${surface?'ready':''}`}><i></i>{surface?'Surface ready':'Scanning your space…'}</div>
      {toast&&<div className="gesture-hint">{toast}</div>}
      {placed&&<div className="side-tools" data-ui="true"><button onClick={screenshot}>▧</button><button onClick={()=>setToast(`${scale.toFixed(2)}× scale`)}>1:1</button><button onClick={reset}>↶</button></div>}
      <div className="product-strip" data-ui="true">{MODELS.map((m,i)=><button key={m.id} className={i===modelIndex?'active':''} disabled={busy} onClick={()=>chooseModel(i)}><span>{m.emoji}</span><b>{m.label}</b></button>)}</div>
      <div className="bottom-actions" data-ui="true"><button className="gallery" onClick={screenshot}>▧</button>{!placed?<button className={`shutter ${surface?'ready':''}`} disabled={!surface||busy} onClick={place}><i></i></button>:<button className="shutter selected" onClick={()=>setSheetOpen(v=>!v)}><i>◇</i></button>}<button className="customize" onClick={()=>placed&&setSheetOpen(v=>!v)}>◇<em></em></button></div>
      {shot&&<div className="shot-preview" data-ui="true"><img src={shot}/><div><button onClick={()=>setShot(null)}>Back to AR</button><button onClick={saveShot}>Save photo</button></div></div>}
      {needsResume&&<div className="resume-card" data-ui="true"><b>AR paused</b><span>Android paused the immersive session while another app was open.</span><button onClick={resume}>Resume AR</button></div>}
      {sheetOpen&&placed&&<section className="custom-sheet" data-ui="true"><button className="grab" onClick={()=>setSheetOpen(false)}></button><div className="tabs"><b>Customize</b><span>Details</span><span>Reviews</span></div><div className="sheet-title"><b>Fabric</b><span>View all</span></div><div className="swatches">{SWATCHES.map(([name,c])=><button key={c} onClick={()=>chooseColor(c)}><i className={color===c?'active':''} style={{background:c}}></i><span>{name}</span></button>)}</div><div className="sheet-title"><b>Gestures</b><span>Live</span></div><div className="gesture-cards"><div><strong>↔</strong><span>Pinch</span><small>{scale.toFixed(2)}×</small></div><div><strong>↻</strong><span>Twist</span><small>{Math.round(rotation*180/Math.PI)}°</small></div><div><strong>◎</strong><span>Tap</span><small>Place</small></div></div><button className="done" onClick={()=>setSheetOpen(false)}>Done customizing</button></section>}
    </>}
  </div>;
}
