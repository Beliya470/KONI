// @ts-nocheck
/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */

// Pick React from UMD globals loaded in index.html
const { useState, useEffect, useReducer, useContext, createContext } = React;

/* ----------------------------- ICON UTILITY ------------------------------ */
function useLucide() {
  useEffect(() => {
    if (window.lucide?.createIcons) window.lucide.createIcons();
  });
}

/* -------------------------- FAKE BACKEND (STORE) ------------------------- */
const Store = createContext(null);

const initialPatients = [
  {
    id: 'p1', name: 'Mrs. Adongo', sex: 'F', age: 62,
    dx: ['Hypertension','Depression'], risk: 98, status: 'critical',
    issue: 'Hypertensive Urgency: BP ≥180/120 with vision loss',
    lastBP: '192/121', lastGlucose: null, pregnancy: false,
    location: 'Navrongo Central (Zone 4)', lastCheck: '10 min ago',
    mental: 'At Risk', phone: '0240 123 456'
  },
  {
    id: 'p2', name: 'Mr. Mensah', sex: 'M', age: 58,
    dx: ['Type 2 Diabetes'], risk: 85, status: 'warning',
    issue: 'Diabetic foot ulcer + fever → sepsis risk',
    lastBP: '148/94', lastGlucose: '16.4 mmol/L', pregnancy: false,
    location: 'Bawku West', lastCheck: '2 hrs ago',
    mental: 'Stable', phone: '0205 888 222'
  },
  {
    id: 'p3', name: 'Amina Yussif', sex: 'F', age: 45,
    dx: ['Hypertension'], risk: 30, status: 'stable',
    issue: 'Routine adherence check',
    lastBP: '136/88', lastGlucose: null, pregnancy: false,
    location: 'Kassena North', lastCheck: '1 day ago',
    mental: 'Stable', phone: '0541 888 333'
  }
];

const initialState = {
  patients: JSON.parse(localStorage.getItem('koni_patients') || 'null') || initialPatients,
  alerts: JSON.parse(localStorage.getItem('koni_alerts') || '[]'),
  calls: JSON.parse(localStorage.getItem('koni_calls') || '[]'),
  dispatches: JSON.parse(localStorage.getItem('koni_dispatches') || '[]'),
  metrics: JSON.parse(localStorage.getItem('koni_metrics') || 'null') || {
    enrolled: 20250,
    weeklyCheckins: 15420,
    earlyAlerts: 64,
    critIntercepted: 9,
    outbreaksFlagged: 1,
    programCostUSD: 20250,
    estCostsAvoidedUSD: 9 * 211 + 6 * 140
  },
  outbreaks: JSON.parse(localStorage.getItem('koni_outbreaks') || 'null') || [
    { id:'o1', name:'Watery Diarrhea (suspected cholera)', zone:'Kassena-Nankana East', reports:3, window:'Last 1h', status:'watch' }
  ]
};

function persist(state) {
  localStorage.setItem('koni_patients', JSON.stringify(state.patients));
  localStorage.setItem('koni_alerts', JSON.stringify(state.alerts));
  localStorage.setItem('koni_calls', JSON.stringify(state.calls));
  localStorage.setItem('koni_dispatches', JSON.stringify(state.dispatches));
  localStorage.setItem('koni_metrics', JSON.stringify(state.metrics));
  localStorage.setItem('koni_outbreaks', JSON.stringify(state.outbreaks));
}

function reducer(state, action) {
  switch(action.type) {
    case 'RAISE_ALERT': {
      const alerts = [{ id: uid(), ...action.payload, createdAt: new Date().toISOString(), status:'new' }, ...state.alerts];
      let patients = state.patients;
      if (action.payload.patient && !state.patients.find(p => p.id === action.payload.patient.id)) {
        patients = [action.payload.patient, ...state.patients];
      }
      const metrics = { ...state.metrics, earlyAlerts: state.metrics.earlyAlerts + 1,
        critIntercepted: state.metrics.critIntercepted + (action.payload.severity === 'critical' ? 1 : 0),
        estCostsAvoidedUSD: state.metrics.estCostsAvoidedUSD + (action.payload.severity === 'critical' ? 211 : 35)
      };
      const newState = { ...state, alerts, patients, metrics };
      persist(newState);
      return newState;
    }
    case 'ADD_CALL': {
      const calls = [{ id: uid(), ...action.payload }, ...state.calls];
      const newState = { ...state, calls };
      persist(newState);
      return newState;
    }
    case 'DISPATCH': {
      const dispatches = [{ id: uid(), ...action.payload, createdAt: new Date().toISOString(), status:'enroute' }, ...state.dispatches];
      const alerts = state.alerts.map(a => a.id === action.payload.alertId ? { ...a, status:'dispatched' } : a);
      const newState = { ...state, dispatches, alerts };
      persist(newState);
      return newState;
    }
    case 'RESOLVE': {
      const alerts = state.alerts.map(a => a.id === action.payload.alertId ? { ...a, status:'resolved' } : a);
      const dispatches = state.dispatches.map(d => d.id === action.payload.dispatchId ? { ...d, status:'closed' } : d);
      const newState = { ...state, alerts, dispatches };
      persist(newState);
      return newState;
    }
    case 'FLAG_OUTBREAK': {
      const outbreaks = [{ id: uid(), ...action.payload }, ...state.outbreaks];
      const metrics = { ...state.metrics, outbreaksFlagged: state.metrics.outbreaksFlagged + 1 };
      const newState = { ...state, outbreaks, metrics };
      persist(newState);
      return newState;
    }
    case 'RESET_DEMO': {
      localStorage.clear();
      return initialState;
    }
    default: return state;
  }
}

function uid() {
  return Math.random().toString(36).slice(2,10) + Date.now().toString(36).slice(-4);
}

/* ----------------------------- TRIAGE LOGIC ------------------------------ */
function analyzeUtterance(utter) {
  if (!utter) return { tags:[], danger:false, notes:[], severity: 'low' };
  const t = utter.toLowerCase();
  const tags = [];
  const notes = [];
  const has = (...words)=> words.some(w => t.includes(w));
  if (has('chest pain','tightness','pressure','left arm','squeez')) { tags.push('chest_pain'); notes.push('Chest pain/pressure'); }
  if (has('headache','blurry','vision','see double','confus','weakness one side','slurred')) { tags.push('neuro'); notes.push('Neuro: headache/vision/weakness'); }
  if (has('dizzy','lightheaded','faint')) { tags.push('dizziness'); notes.push('Dizziness'); }
  if (has('swollen','edema','feet','ankle')) { tags.push('edema'); notes.push('Swollen feet/ankles'); }
  if (has('fever','hot','chills','shiver')) { tags.push('fever'); notes.push('Fever'); }
  if (has('diarrhea','watery','stool')) { tags.push('diarrhea'); notes.push('Watery diarrhea'); }
  if (has('breath','short of breath','hard to breathe','breathing')) { tags.push('dyspnea'); notes.push('Breathing difficulty'); }
  if (has('pregnan','baby','antenatal')) { tags.push('pregnancy'); notes.push('Pregnancy'); }
  if (has('missed','forgot','no pill','ran out','no money','cannot afford')) { tags.push('non_adherence'); notes.push('Missed/ran out of meds'); }
  if (has('foot','wound','ulcer','smell','pus')) { tags.push('foot_wound'); notes.push('Foot ulcer'); }

  let severity = 'low';
  if (tags.includes('chest_pain') || (tags.includes('neuro') && tags.includes('dizziness'))) severity = 'critical';
  if (tags.includes('foot_wound') && tags.includes('fever')) severity = 'critical';
  if (tags.includes('edema') && tags.includes('dyspnea')) severity = 'critical';
  if (tags.includes('diarrhea') && tags.includes('fever')) severity = 'warning';
  if (tags.includes('non_adherence') && severity !== 'critical') severity = 'warning';
  if (tags.includes('pregnancy') && (tags.includes('headache') || tags.includes('neuro'))) severity = 'critical';

  return { tags, severity, notes, danger: severity === 'critical' };
}

/* ------------------------------- VOICE KIT ------------------------------- */
const hasSpeech = !!(window.SpeechRecognition || window.webkitSpeechRecognition);

function tts(text, lang='en-US') {
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = 1.02;
    window.speechSynthesis?.cancel();
    window.speechSynthesis?.speak(u);
  } catch(e) {}
}

function recognizeOnce({ lang='en-US', timeout=7000 }={}) {
  return new Promise((resolve) => {
    if (!hasSpeech) return resolve({ ok:false, text:'', reason:'nosupport' });
    const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
    const r = new Rec();
    r.continuous = false; r.interimResults = false; r.lang = lang;
    let done = false;
    const finish = (payload)=>{ if (!done){ done = true; resolve(payload); } };
    r.onresult = (e)=> finish({ ok:true, text: e.results[0][0].transcript || '' });
    r.onerror = ()=> finish({ ok:false, text:'', reason:'error' });
    r.onend = ()=> finish({ ok:false, text:'', reason:'end' });
    r.start();
    setTimeout(()=> { try{ r.stop(); }catch(_){}; finish({ ok:false, text:'', reason:'timeout' }); }, timeout);
  });
}

/* --------------------------- USSD FLOW CONTENT --------------------------- */
const USSD_STEPS = {
  WELCOME: { text: "Koni Health v2.0\n1. English\n2. Kasem\n3. Nankam", options: [1,2,3], next: 'MAIN' },
  MAIN:    { text: "Welcome, Abena.\n1. Report Symptom\n2. Mental Check-in\n3. Med Refill\n4. Pregnancy Check", options: [1,2,3,4], next: (v)=> v===1?'SYMPT':'MENTAL' },
  SYMPT:   { text: "Select Symptom:\n1. Chest Pain\n2. Blurry Vision/Headache\n3. Swollen Feet\n4. Foot Wound + Smell\n5. Watery Diarrhea\n6. Just Tired", options: [1,2,3,4,5,6], next: (v)=> (v<=2?'SEV':'ROUTINE') },
  SEV:     { text: "WARNING: Is this sudden or severe?\n1. Yes, severe\n2. Mild/Chronic", options: [1,2], next: (v)=> v===1 ? 'CRIT_END':'ROUTINE' },
  MENTAL:  { text: "Past 2 weeks: little interest/pleasure?\n1. Yes\n2. No", options: [1,2], next: 'MENTAL_END' },
  CRIT_END:{ text: "!!! ALERT !!!\nDanger sign detected.\nStay calm.\nA nurse is being alerted now.\nDo not hang up.", options: [], end:true, risk:'critical' },
  ROUTINE: { text: "Logged. Please rest and drink water.\nNurse notified for routine review.", options: [], end:true, risk:'low' },
  MENTAL_END: { text: "Thank you.\nA counselor will check in this week.", options: [], end:true, risk:'medium' }
};

/* ------------------------------ COMPONENTS ------------------------------- */
function TopBar({ scene, setScene, reset, runScenario }) {
  useLucide();
  return (
    <div className="bg-koni-dark text-white sticky top-0 z-50 border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-koni-green font-bold tracking-widest">KONI HEALTH</span>
          <span className="text-slate-500">|</span>
          <span className="text-slate-300 text-sm">Prototype</span>
        </div>
        <div className="flex items-center gap-2">
          {['patient','chw','payer'].map(s=>(
            <button key={s} onClick={()=>setScene(s)}
              className={`px-3 py-1.5 text-xs font-bold rounded border ${scene===s?'bg-white text-slate-900':'bg-slate-900 border-slate-700 hover:bg-slate-800'}`}>
              {s==='patient'?'PATIENT':s==='chw'?'CHW':'PAYER'}
            </button>
          ))}
          <div className="hidden md:flex items-center gap-1 ml-3">
            <span className="text-xs text-slate-400 mr-1">Quick Scenarios:</span>
            <ScenarioButton label="Stroke Flag" onClick={()=>runScenario('stroke')} />
            <ScenarioButton label="Foot Sepsis" onClick={()=>runScenario('foot')} />
            <ScenarioButton label="Preeclampsia" onClick={()=>runScenario('pree')} />
            <ScenarioButton label="Cholera Cluster" onClick={()=>runScenario('cholera')} />
          </div>
          <button onClick={reset} className="ml-3 text-xs bg-red-900/50 border border-red-800 text-red-100 px-3 py-1.5 rounded hover:bg-red-900">
            New Alert
          </button>
        </div>
      </div>
    </div>
  );
}
function ScenarioButton({ label, onClick }) {
  return (
    <button onClick={onClick} className="text-xs bg-slate-800 border border-slate-700 px-2 py-1 rounded hover:bg-slate-700">
      {label}
    </button>
  );
}

/* ---------- Patient: Nokia Phone (USSD) + Voice/IVR simulator ----------- */
function PatientView() {
  const [tab, setTab] = useState('ussd'); // 'voice'
  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6">
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-6 soft-shadow">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-slate-800">Patient Phone (Nokia / USSD)</h2>
            <div className="flex gap-2">
              <button onClick={()=>setTab('ussd')} className={`text-xs px-3 py-1.5 rounded border ${tab==='ussd'?'bg-slate-900 text-white':'bg-white border-slate-300 hover:bg-slate-50'}`}>USSD</button>
              <button onClick={()=>setTab('voice')} className={`text-xs px-3 py-1.5 rounded border ${tab==='voice'?'bg-slate-900 text-white':'bg-white border-slate-300 hover:bg-slate-50'}`}>Voice/IVR</button>
            </div>
          </div>
          {tab==='ussd' ? <USSDPhone/> : <VoiceIVR/>}
        </div>
        <PatientExplainer />
      </div>
    </div>
  );
}

function PatientExplainer() {
  useLucide();
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 soft-shadow">
      <h3 className="font-bold text-slate-800 mb-3">What this simulates</h3>
      <ul className="space-y-2 text-sm text-slate-700">
        <li className="flex items-start gap-2"><i data-lucide="phone" className="w-4 h-4 mt-0.5"></i> A <b>feature phone</b> dialing a USSD code (e.g., <span className="font-mono">*555#</span>) or receiving an automated weekly call.</li>
        <li className="flex items-start gap-2"><i data-lucide="mic" className="w-4 h-4 mt-0.5"></i> The patient speaks; the system listens and probes.</li>
        <li className="flex items-start gap-2"><i data-lucide="activity" className="w-4 h-4 mt-0.5"></i> AI triages risk and alerts CHW instantly.</li>
        <li className="flex items-start gap-2"><i data-lucide="shield-alert" className="w-4 h-4 mt-0.5"></i> Cluster signals surface in the Payer view.</li>
      </ul>
      <div className="mt-4 p-3 rounded-lg bg-slate-50 border text-xs">
        💡 Voice demo: try “I have <b>chest pain</b> and I feel <b>dizzy</b>”.
      </div>
    </div>
  );
}

function USSDPhone() {
  useLucide();
  const [step, setStep] = useState('WELCOME');
  const [input, setInput] = useState('');
  const [flash, setFlash] = useState('');
  const store = useContext(Store);

  function handlePress(k) {
    if (k==='SEND') {
      const s = USSD_STEPS[step];
      if (s.options.length>0 && !s.options.includes(parseInt(input))) {
        setFlash('Invalid option'); setTimeout(()=>setFlash(''), 1000); setInput(''); return;
      }
      let next = s.next;
      if (typeof next === 'function') next = next(parseInt(input));
      const nxt = USSD_STEPS[next];
      setStep(next);
      setInput('');

      if (nxt?.end && nxt.risk === 'critical') {
        const patient = {
          id: 'incoming_'+uid(),
          name: 'Abena K. (Incoming)',
          sex: 'F', age: 60, dx: ['Undiagnosed'],
          risk: 99, status:'critical',
          issue: 'STROKE WARNING: sudden vision loss + headache',
          lastBP: 'unknown', lastGlucose: null, pregnancy: false,
          location: 'Navrongo – Zone 4', lastCheck: 'Just now',
          mental: 'Unknown', phone: '—'
        };
        store.dispatch({ type:'RAISE_ALERT', payload: {
          type:'ussd', severity:'critical',
          message:'USSD critical flag (sudden severe symptom)',
          patient
        }});
      }
    } else if (k==='CLR') {
      setInput('');
    } else {
      setInput(x => (''+x+k).slice(-8));
    }
  }

  return (
    <div className="flex justify-center">
      <div className="w-64 h-[520px] p-4 nokia-shell relative">
        <div className="h-48 p-2 nokia-screen lcd-scan flex flex-col justify-between mb-3">
          <div>
            <div className="flex justify-between text-black/80 text-[10px]">
              <span className="flex items-center gap-1"><i data-lucide="signal" className="w-3 h-3"></i> KONI</span>
              <span className="flex items-center gap-1"><i data-lucide="battery" className="w-3 h-3"></i> 96%</span>
            </div>
            <div className="mt-1 text-[13px] font-bold text-black whitespace-pre-wrap font-mono leading-snug">
              {USSD_STEPS[step].text}
            </div>
          </div>
          <div className="text-black font-bold border-t border-black/10 pt-1">
            Input: {input}<span className="animate-pulse">_</span>
          </div>
        </div>

        <div className="text-center text-gray-400 font-bold mb-2 text-[10px] tracking-[.2em]">KONIA</div>

        <div className="grid grid-cols-3 gap-2">
          {[1,2,3,4,5,6,7,8,9,'*',0,'#'].map(k=>(
            <button key={k} onClick={()=>handlePress(k)}
              className="bg-slate-700 text-white rounded p-2 text-sm font-bold active:bg-slate-500 shadow-[0_2px_0_#000] active:shadow-none active:translate-y-[2px]">
              {k}
            </button>
          ))}
        </div>

        <div className="flex justify-between mt-4">
          <button onClick={()=>handlePress('SEND')} className="bg-green-600 text-white px-4 py-1 rounded font-bold text-xs shadow-[0_2px_0_#000] active:translate-y-[2px]">SEND</button>
          <button onClick={()=>handlePress('CLR')} className="bg-red-600 text-white px-4 py-1 rounded font-bold text-xs shadow-[0_2px_0_#000] active:translate-y-[2px]">CLR</button>
        </div>

        {flash && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-red-600 text-white text-xs px-2 py-1 rounded">{flash}</div>}
      </div>
    </div>
  );
}

function VoiceIVR() {
  useLucide();
  const store = useContext(Store);
  const [lang, setLang] = useState('en-US');
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState([]);
  const [lastReply, setLastReply] = useState('');
  const [ended, setEnded] = useState(false);

  const prompts = [
    { id:'greet', text: 'Hello. This is Koni Health. How are you feeling today?' },
    { id:'probe1', text: 'Thank you. Did you take your medicine today?' },
    { id:'probe2', text: 'Are you feeling any chest pain, severe headache, or new swelling of the feet?' },
    { id:'close', text: 'Okay. Please stay calm. We are notifying your community nurse now.' }
  ];

  async function ask(id) {
    const p = prompts.find(x=>x.id===id);
    if (!p) return;
    tts(p.text, lang.startsWith('en')?'en-US':'en-US');
    setTranscript(prev=>[...prev, { role:'system', text:p.text }]);

    setListening(true);
    const res = await recognizeOnce({ lang: lang.startsWith('en')?'en-US':'en-US', timeout: 6500 });
    setListening(false);

    let said = '';
    if (res.ok && res.text) said = res.text;
    else said = lastReply || sampleAutoReply(id);

    setTranscript(prev=>[...prev, { role:'patient', text: said }]);

    const { severity, tags, notes } = analyzeUtterance(said);
    if (severity==='critical' || id==='probe2') {
      tts(prompts.find(x=>x.id==='close').text);
      setTranscript(prev=>[...prev, { role:'system', text: prompts.find(x=>x.id==='close').text }]);
      setEnded(true);

      const patient = {
        id: 'incoming_'+uid(),
        name: 'Unknown Caller (Voice)',
        sex: 'F', age: 60, dx: ['Undiagnosed'],
        risk: severity==='critical'?99:70, status: severity,
        issue: severity==='critical' ? 'Critical flag via voice call' : 'Warning flag via voice call',
        lastBP: 'unknown', lastGlucose: null, pregnancy: tags.includes('pregnancy'),
        location: 'Navrongo – Zone 4', lastCheck: 'Just now', mental: 'Unknown', phone: '—'
      };

      store.dispatch({ type:'ADD_CALL', payload: { when: new Date().toISOString(), transcript:[...transcript, {role:'patient',text:said}], summary: { severity, tags, notes } }});
      store.dispatch({ type:'RAISE_ALERT', payload: { type:'voice', severity, message: `Voice triage: ${notes.join('; ') || 'symptom'}`, tags, patient }});

      if (tags.includes('diarrhea')) {
        store.dispatch({ type:'FLAG_OUTBREAK', payload: { name:'Watery Diarrhea (suspected cholera)', zone:'Kassena-Nankana East', reports:1, window:'Last 15m', status:'watch' }});
      }
    }
  }

  function sampleAutoReply(id) {
    if (id==='greet') return 'I feel dizzy and my vision is blurry.';
    if (id==='probe1') return 'I missed my pills today and yesterday. No money.';
    if (id==='probe2') return 'Yes, I have chest pain and swollen feet.';
    return 'Okay';
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-semibold">Language:</span>
        <select value={lang} onChange={e=>setLang(e.target.value)} className="border rounded px-2 py-1 text-sm">
          <option value="en-US">English (demo)</option>
          <option value="kasem">Kasem (simulated)</option>
          <option value="nankam">Nankam (simulated)</option>
        </select>
        <span className="text-xs text-slate-500 ml-2">TTS uses English voice for demo.</span>
      </div>

      <div className="border rounded-xl p-3 bg-slate-50">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">IVR Call</div>
          <div className="text-xs text-slate-500">{hasSpeech ? 'Mic available' : 'Mic not supported – use Simulate'}</div>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <button onClick={()=>ask('greet')} disabled={ended}
                  className="px-3 py-1.5 bg-slate-900 text-white rounded text-sm disabled:opacity-50">Start Call</button>
          <button onClick={()=>ask('probe1')} disabled={ended} className="px-3 py-1.5 bg-white border rounded text-sm">Ask Meds</button>
          <button onClick={()=>ask('probe2')} disabled={ended} className="px-3 py-1.5 bg-white border rounded text-sm">Ask Danger</button>
          <div className="flex items-center gap-2 ml-auto">
            <input value={lastReply} onChange={e=>setLastReply(e.target.value)} placeholder="Type a simulated reply…" className="text-sm border rounded px-2 py-1 w-48" />
            <button onClick={()=>setLastReply(sampleAutoReply('probe2'))} className="px-2 py-1 text-xs bg-slate-200 rounded">Simulate reply</button>
          </div>
        </div>

        {listening && (
          <div className="mt-3 p-3 rounded bg-white border flex items-center gap-3">
            <div className="mic-bars"><span></span><span></span><span></span><span></span><span></span></div>
            <div className="text-sm">Listening… (speak now)</div>
          </div>
        )}

        <div className="mt-3 bg-white rounded border p-3 h-40 overflow-auto text-sm">
          {transcript.length===0 && <div className="text-slate-400">Call transcript will appear here…</div>}
          {transcript.map((l,i)=>(
            <div key={i} className="mb-2">
              <span className={`px-1.5 py-0.5 text-xs rounded ${l.role==='system'?'bg-slate-900 text-white': 'bg-slate-200'}`}>{l.role==='system'?'KONI':'Caller'}</span>
              <span className="ml-2">{l.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- CHW VIEW -------------------------------- */
function CHWView() {
  useLucide();
  const store = useContext(Store);
  const { patients, alerts } = store.state;
  const criticalCount = patients.filter(p=>p.status==='critical').length;

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6">
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white border rounded-2xl p-6 soft-shadow">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-slate-800">Real‑Time Triage Board</h2>
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1"><i data-lucide="house" className="w-4 h-4"></i> Households: <b>56,000</b></span>
                <span className="flex items-center gap-1"><i data-lucide="users" className="w-4 h-4"></i> CHWs: <b>293</b></span>
                <span className="flex items-center gap-1"><i data-lucide="bell-ring" className="w-4 h-4"></i> Critical: <b>{criticalCount}</b></span>
              </div>
            </div>

            <div className="mt-4">
              {patients.map(p=>(
                <PatientCard key={p.id} p={p} />
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white border rounded-2xl p-6 soft-shadow">
            <h3 className="font-semibold mb-2">New Alerts</h3>
            <div className="space-y-2 max-h-64 overflow-auto">
              {alerts.length===0 && <div className="text-sm text-slate-500">No alerts yet.</div>}
              {alerts.map(a=>(
                <div key={a.id} className="border rounded p-2 text-sm">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">{String(a.severity).toUpperCase()} • {a.type}</div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${a.status==='new'?'bg-red-100 text-red-600':
                      a.status==='dispatched'?'bg-orange-100 text-orange-700':'bg-green-100 text-green-700'}`}>{a.status}</span>
                  </div>
                  <div className="text-slate-600">{a.message}</div>
                </div>
              ))}
            </div>
          </div>

          <TrainingPane />
        </div>
      </div>
    </div>
  );
}

function PatientCard({ p }) {
  useLucide();
  const store = useContext(Store);
  const sevColor = p.status==='critical' ? 'red' : p.status==='warning' ? 'orange' : 'emerald';

  function dispatchNow() {
    store.dispatch({ type:'DISPATCH', payload: { alertId: findAlertIdForPatient(store.state.alerts, p), patientId: p.id, zone: p.location, reason: p.issue }});
  }

  return (
    <div className={`mb-3 bg-white border rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center gap-4 hover:shadow-sm border-l-4 border-l-${sevColor}-500`}>
      <div className={`w-16 h-16 rounded-full flex flex-col items-center justify-center text-white font-bold bg-${sevColor}-500`}>
        <span className="text-xl">{p.risk}%</span>
        <span className="text-[10px] uppercase">Risk</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h4 className="font-bold text-lg">{p.name}</h4>
          {p.status==='critical' && <span className="text-[10px] font-bold px-2 py-0.5 bg-red-100 text-red-700 rounded-full">Emergency</span>}
          {p.mental==='At Risk' && <span className="text-[10px] font-bold px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full flex items-center gap-1"><i data-lucide="brain" className="w-3 h-3"></i> Mental risk</span>}
        </div>
        <div className="text-sm text-slate-600 flex items-center gap-2">
          <span className="flex items-center gap-1"><i data-lucide="map-pin" className="w-4 h-4"></i> {p.location}</span>
          <span className="text-slate-300">|</span>
          <span>{p.dx.join(', ')}</span>
        </div>
      </div>
      <div className="bg-slate-50 p-2 rounded border w-full md:w-auto md:min-w-[260px]">
        <div className="text-[10px] uppercase text-slate-400 font-bold">Clinical Trigger</div>
        <div className={`text-sm font-bold ${p.status==='critical'?'text-red-700':'text-slate-700'}`}>{p.issue}</div>
      </div>
      <div className="flex flex-col gap-2 w-full md:w-auto">
        <button onClick={dispatchNow} className={`px-4 py-2 text-sm font-bold rounded text-white bg-${sevColor}-600 hover:bg-${sevColor}-700`}>{p.status==='critical'?'🚨 DISPATCH NOW':'Visit Patient'}</button>
        <div className="flex gap-2">
          <button className="px-2 py-1 text-xs border rounded flex items-center gap-1"><i data-lucide="phone" className="w-3 h-3"></i> Call</button>
          <button className="px-2 py-1 text-xs border rounded flex items-center gap-1"><i data-lucide="message-square" className="w-3 h-3"></i> Message</button>
          <button className="px-2 py-1 text-xs border rounded flex items-center gap-1"><i data-lucide="calendar" className="w-3 h-3"></i> Schedule</button>
        </div>
      </div>
    </div>
  );
}
function findAlertIdForPatient(alerts, p){
  const match = alerts.find(a => a.patient?.id === p.id || a.message?.toLowerCase().includes((p.issue||'').toLowerCase()));
  return match?.id || alerts[0]?.id;
}

function TrainingPane() {
  useLucide();
  const modules = [
    { title:'Identifying Hypertensive Crises', type:'Video', duration:'5 min', icon:'play-circle' },
    { title:'Mental Health Screening in NCDs', type:'Reading', duration:'10 min', icon:'brain' },
    { title:'Diabetic Foot Care Protocols', type:'PDF', duration:'3 pages', icon:'file-text' },
  ];
  return (
    <div className="bg-white border rounded-2xl p-6 soft-shadow">
      <h3 className="font-semibold mb-3">CHW Training Academy</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {modules.map((m,idx)=>(
          <div key={idx} className="border rounded-xl p-4 hover:shadow-sm">
            <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mb-2">
              <i data-lucide={m.icon} className="w-6 h-6 text-slate-700"></i>
            </div>
            <div className="font-semibold">{m.title}</div>
            <div className="text-xs mt-1 text-slate-500 uppercase">{m.type} • {m.duration}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------ PAYER VIEW ------------------------------- */
function PayerView() {
  useLucide();
  const { state } = useContext(Store);
  const m = state.metrics;
  const roi = m.programCostUSD>0 ? ((m.estCostsAvoidedUSD - m.programCostUSD)/m.programCostUSD)*100 : 0;

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6">
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border rounded-2xl p-6 soft-shadow">
          <h2 className="font-bold text-slate-800 mb-3">Payer / NHIS Dashboard (Value)</h2>
          <div className="grid sm:grid-cols-3 gap-3 mb-4">
            <MiniStat label="Enrolled Patients" value={fmt(m.enrolled)} icon="users"/>
            <MiniStat label="Early Alerts (30d)" value={fmt(m.earlyAlerts)} icon="bell-ring"/>
            <MiniStat label="Critical Intercepts" value={fmt(m.critIntercepted)} icon="shield-check"/>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Tile>
              <div className="text-sm text-slate-500">Estimated Costs Avoided</div>
              <div className="text-2xl font-bold">${fmt(m.estCostsAvoidedUSD)}</div>
              <div className="mt-2 text-xs text-slate-500">Assumes average stroke admission ≈ $211 (demo)</div>
            </Tile>
            <Tile>
              <div className="text-sm text-slate-500">Program Cost</div>
              <div className="text-2xl font-bold">${fmt(m.programCostUSD)}</div>
              <div className="mt-2 text-xs text-slate-500">~$1 per patient per year (demo)</div>
            </Tile>
            <Tile>
              <div className="text-sm text-slate-500">ROI (demo)</div>
              <div className={`text-2xl font-bold ${roi>=0?'text-emerald-700':'text-red-700'}`}>{roi.toFixed(0)}%</div>
              <div className="mt-2 text-xs text-slate-500">Prevention avoids catastrophic spend.</div>
            </Tile>
            <Tile>
              <div className="text-sm text-slate-500">Weekly Check‑ins</div>
              <div className="text-2xl font-bold">{fmt(m.weeklyCheckins)}</div>
              <div className="mt-2 text-xs text-slate-500">Works without smartphones or internet.</div>
            </Tile>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white border rounded-2xl p-6 soft-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold">Outbreak Radar</div>
              <span className="text-xs text-slate-500">Signals</span>
            </div>
            <div className="space-y-2">
              {state.outbreaks.map(o=>(
                <div key={o.id} className="border rounded p-3">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">{o.name}</div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${o.status==='watch'?'bg-amber-100 text-amber-700':'bg-slate-100 text-slate-700'}`}>{o.status}</span>
                  </div>
                  <div className="text-xs text-slate-600 mt-1 flex items-center gap-2">
                    <span className="flex items-center gap-1"><i data-lucide="map-pin" className="w-3 h-3"></i> {o.zone}</span>
                    <span className="text-slate-300">•</span>
                    <span>{o.reports} reports</span>
                    <span className="text-slate-300">•</span>
                    <span>{o.window}</span>
                  </div>
                </div>
              ))}
              {state.outbreaks.length===0 && <div className="text-sm text-slate-500">No signals yet.</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
function MiniStat({ label, value, icon }) {
  useLucide();
  return (
    <div className="border rounded-xl p-4 bg-slate-50">
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-500">{label}</div>
        <i data-lucide={icon} className="w-5 h-5 text-slate-600"></i>
      </div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}
function Tile({ children }) { return <div className="border rounded-xl p-4">{children}</div>; }
function fmt(n){ return Number(n).toLocaleString(); }

/* ---------------------------- APP CONTAINER ------------------------------ */
function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [scene, setScene] = useState('patient');

  function reset(){ dispatch({ type:'RESET_DEMO' }); }

  function runScenario(which) {
    if (which==='stroke') {
      const patient = {
        id:'pX1', name:'Grace Atanga', sex:'F', age:66, dx:['Hypertension'],
        risk:99, status:'critical',
        issue:'Stroke red flags: sudden vision loss + severe headache',
        lastBP:'196/124', lastGlucose:null, pregnancy:false,
        location:'Navrongo Central', lastCheck:'Just now', mental:'Unknown', phone:'—'
      };
      dispatch({ type:'RAISE_ALERT', payload: { type:'voice', severity:'critical', message:'Voice: stroke red flags', patient }});
      toast('Critical voice alert (stroke red flags) → CHW dashboard updated'); setScene('chw');
    }
    if (which==='foot') {
      const patient = {
        id:'pX2', name:'Mr. Alhassan', sex:'M', age:59, dx:['Type 2 Diabetes'],
        risk:92, status:'critical', issue:'Foot ulcer with fever (sepsis risk)',
        lastBP:'150/92', lastGlucose:'17.2 mmol/L', pregnancy:false, location:'Bawku West', lastCheck:'Just now', mental:'Stable', phone:'—'
      };
      dispatch({ type:'RAISE_ALERT', payload: { type:'ussd', severity:'critical', message:'USSD: Foot wound + fever', patient }});
      toast('Critical USSD alert (foot sepsis) → CHW dashboard updated'); setScene('chw');
    }
    if (which==='pree') {
      const patient = {
        id:'pX3', name:'Zuera Yakubu (Pregnant)', sex:'F', age:29, dx:['Pregnancy','Hypertension?'],
        risk:95, status:'critical', issue:'Severe headache + vision changes in pregnancy (preeclampsia)',
        lastBP:'172/110', lastGlucose:null, pregnancy:true, location:'Kassena North', lastCheck:'Just now', mental:'Unknown', phone:'—'
      };
      dispatch({ type:'RAISE_ALERT', payload: { type:'voice', severity:'critical', message:'Voice: preeclampsia suspicion', patient }});
      toast('Critical voice alert (preeclampsia suspicion) → CHW dashboard updated'); setScene('chw');
    }
    if (which==='cholera') {
      dispatch({ type:'FLAG_OUTBREAK', payload: { name:'Watery Diarrhea (suspected cholera)', zone:'Kassena-Nankana East', reports:3, window:'Last 1h', status:'watch' }});
      toast('Outbreak signal (watery diarrhea cluster) → Payer dashboard updated'); setScene('payer');
    }
  }

  return (
    <Store.Provider value={{ state, dispatch }}>
      <TopBar scene={scene} setScene={setScene} reset={reset} runScenario={runScenario} />
      {scene==='patient' && <PatientView/>}
      {scene==='chw' && <CHWView/>}
      {scene==='payer' && <PayerView/>}
      <Toasts/>
    </Store.Provider>
  );
}

/* ------------------------------- TOASTS ---------------------------------- */
const toastBus = [];
function toast(msg){
  toastBus.push({ id: uid(), msg, t: Date.now() });
  window.dispatchEvent(new CustomEvent('koni_toast'));
}
function Toasts(){
  const [items,setItems] = useState([]);
  useEffect(()=>{
    function refresh(){ setItems([...toastBus]); }
    window.addEventListener('koni_toast', refresh);
    const it = setInterval(()=> {
      for (let i=toastBus.length-1; i>=0; i--){
        if (Date.now()-toastBus[i].t>4500) toastBus.splice(i,1);
      }
      refresh();
    }, 350);
    return ()=>{ window.removeEventListener('koni_toast', refresh); clearInterval(it); };
  },[]);
  return (
    <div className="fixed top-4 right-4 space-y-2 z-[60]">
      {items.map(x=>(
        <div key={x.id} className="bg-white border-l-4 border-emerald-600 p-3 rounded-xl soft-shadow w-72">
          <div className="text-sm font-semibold text-slate-800">System</div>
          <div className="text-sm text-slate-600">{x.msg}</div>
        </div>
      ))}
    </div>
  );
}

/* --------------------------------- MOUNT --------------------------------- */
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App/>);
