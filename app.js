
(() => {
  const Q = window.GB_QUESTIONS || [];
  const APP = document.getElementById('app');

  const K = {
    settings:'gbweb_settings_v11',
    stats:'gbweb_stats_v11',
    wrong:'gbweb_wrong_v11',
    fav:'gbweb_fav_v11',
    daily:'gbweb_daily_v11',
    mock:'gbweb_mock_v11',
    theme:'gbweb_theme_v11',
    progress:'gbweb_progress_v11',
    modeProgress:'gbweb_mode_progress_v12'
  };

  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const get=(k,f)=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):f}catch{return f}};
  const set=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const todayKey=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
  const settings=()=>get(K.settings,{dailyGoal:30,examDate:''});
  const stats=()=>get(K.stats,{});
  const ids=k=>get(k,[]).map(Number);
  const byId=id=>Q.find(q=>Number(q.id)===Number(id));
  const shuffle=a=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
  const displayQ=q=>q.type==='judge'?{...q,options:[{key:'A',text:'正确'},{key:'B',text:'错误'}]}:q;
  const correctKeys=q=>q.type==='judge'?[q.answer?'A':'B']:[...q.answer];
  const typeName=q=>q.type==='single'?'单选题':q.type==='multiple'?'多选题':'判断题';

  let deferredInstallPrompt=null;
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstallPrompt=e});

  function toast(msg){
    let t=$('.toast');
    if(!t){t=document.createElement('div');t.className='toast';document.body.appendChild(t)}
    t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),1300);
  }

  function record(id,ok){
    const s=stats(),k=String(id),r=s[k]||{attempts:0,correct:0,wrong:0,lastCorrect:false};
    r.attempts++;ok?r.correct++:r.wrong++;r.lastCorrect=ok;r.updatedAt=Date.now();s[k]=r;set(K.stats,s);
    const d=get(K.daily,{}),dk=todayKey(),x=d[dk]||{attempts:0,correct:0};
    x.attempts++;if(ok)x.correct++;d[dk]=x;set(K.daily,d);
    if(!ok){const a=ids(K.wrong);if(!a.includes(Number(id))){a.push(Number(id));set(K.wrong,a)}}
  }

  function toggleId(k,id){
    let a=ids(k),n=Number(id),i=a.indexOf(n),on=i<0;
    if(on)a.push(n);else a.splice(i,1);
    set(k,a);return on;
  }

  function nav(active){
    const n=document.getElementById('nav-template').content.cloneNode(true);
    n.querySelectorAll('button').forEach(b=>{
      if(b.dataset.route===active)b.classList.add('active');
      b.onclick=()=>route(b.dataset.route);
    });
    return n;
  }

  function shell(content,active){
    APP.innerHTML=`<main class="app-shell">
      <div class="topbar">
        <div class="brand"><img src="assets/icon.svg"><div><strong>公基刷题</strong><div class="small muted">700题 · V1.3优化版</div></div></div>
        <div class="top-actions">
          <button class="btn light mini" id="installBtn" style="${deferredInstallPrompt?'':'display:none'}">安装</button>
          <button class="btn light mini" id="themeBtn">${document.body.classList.contains('dark')?'浅色':'深色'}</button>
        </div>
      </div>${content}</main>`;
    APP.appendChild(nav(active));

    $('#themeBtn').onclick=()=>{
      document.body.classList.toggle('dark');
      set(K.theme,document.body.classList.contains('dark'));
      route(active);
    };
    if($('#installBtn'))$('#installBtn').onclick=async()=>{
      if(!deferredInstallPrompt)return;
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt=null;
      route(active);
    };
  }

  function route(name,args={}){
    history.replaceState(null,'',`#${name}`);
    if(name==='home')renderHome();
    else if(name==='practice')renderPractice();
    else if(name==='stats')renderStats();
    else if(name==='settings')renderSettings();
    else if(name==='question')renderQuestion(args);
    else if(name==='wrong')renderList('wrong');
    else if(name==='favorite')renderList('favorite');
    else if(name==='mock')renderMock();
    else if(name==='exam')renderExam(args);
    else if(name==='review')renderReview();
    else if(name==='answered')renderList('answered');
  }
  window.route=route;
  window.goMock=()=>route('mock');

  const metric=(n,l,sub='')=>`<div class="metric"><div class="n">${n}</div><div class="metric-label">${l}</div>${sub?`<div class="metric-sub">${sub}</div>`:''}</div>`;
  const bankLine=(a,b)=>`<div class="bank-line"><span>${a}</span><span>${b}</span></div>`;
  const entry=(ic,t,s,c,onclick)=>`<button class="card entry" onclick="${onclick}"><div class="iconbox ${c}">${ic}</div><div class="entry-title">${t}</div><div class="small muted">${s}</div></button>`;
  const menu=(a,b,c)=>`<button class="menu" onclick="${c}" style="width:100%;background:transparent;text-align:left;color:inherit"><span><strong>${a}</strong><small class="muted">${b}</small></span><span class="arrow">›</span></button>`;

  function progressInfo(){
    return get(K.progress,null);
  }

  function modeProgressMap(){
    return get(K.modeProgress,{});
  }

  function getModeProgress(mode){
    return modeProgressMap()[mode] || null;
  }

  function saveModeProgress(title,mode,list,index){
    if(!mode || mode==='search' || !list?.length)return;
    const map=modeProgressMap();
    map[mode]={
      title,
      mode,
      questionId:list[index]?.id,
      index,
      total:list.length,
      savedAt:Date.now()
    };
    set(K.modeProgress,map);
  }

  function savedIndexFor(mode,list){
    const p=getModeProgress(mode);
    if(!p || !list?.length)return 0;
    let idx=list.findIndex(q=>Number(q.id)===Number(p.questionId));
    if(idx<0)idx=Math.min(Number(p.index)||0,Math.max(0,list.length-1));
    return Math.max(0,idx);
  }

  function bindSwipe(target,onLeft,onRight){
    if(!target)return;
    let sx=0,sy=0,active=false;
    target.addEventListener('touchstart',e=>{
      if(!e.touches || e.touches.length!==1)return;
      sx=e.touches[0].clientX; sy=e.touches[0].clientY; active=true;
    },{passive:true});
    target.addEventListener('touchend',e=>{
      if(!active || !e.changedTouches || !e.changedTouches.length)return;
      active=false;
      const dx=e.changedTouches[0].clientX-sx;
      const dy=e.changedTouches[0].clientY-sy;
      if(Math.abs(dx)<60 || Math.abs(dx)<Math.abs(dy)*1.25)return;
      if(dx<0)onLeft(); else onRight();
    },{passive:true});
  }

  function saveProgress(title,mode,list,index){
    if(!list?.length)return;
    const q=list[index];
    set(K.progress,{
      title,mode,
      questionId:q.id,
      index,
      total:list.length,
      savedAt:Date.now()
    });
    saveModeProgress(title,mode,list,index);
  }

  function resumeProgress(){
    const p=progressInfo();
    if(!p)return;
    let list=Q;
    if(p.mode==='core')list=Q.filter(q=>q.priority==='A核心');
    else if(p.mode==='high')list=Q.filter(q=>q.priority==='B高频');
    else if(p.mode==='expand')list=Q.filter(q=>q.priority==='B扩展');
    else if(p.mode==='supplement')list=Q.filter(q=>q.priority==='C补充');
    else if(p.mode==='unanswered'){
      const st=stats();list=Q.filter(q=>!st[String(q.id)]);
    } else if(p.mode?.startsWith('group:')){
      const g=p.mode.slice(6);list=Q.filter(q=>q.group===g);
    } else if(p.mode==='wrong')list=ids(K.wrong).map(byId).filter(Boolean);
    else if(p.mode==='favorite')list=ids(K.fav).map(byId).filter(Boolean);
    else if(p.mode==='all')list=Q;

    let idx=list.findIndex(q=>Number(q.id)===Number(p.questionId));
    if(idx<0)idx=Math.min(p.index||0,Math.max(0,list.length-1));
    qstate={list,index:idx,mode:p.mode,title:p.title,session:{}};
    route('question',{resume:true});
  }
  window.resumeProgress=resumeProgress;

  function renderHome(){
    const s=settings(),d=get(K.daily,{}),today=d[todayKey()]||{attempts:0,correct:0},st=stats(),ks=Object.keys(st);
    const attempts=ks.reduce((n,k)=>n+(st[k].attempts||0),0),correct=ks.reduce((n,k)=>n+(st[k].correct||0),0);
    const pct=Math.min(100,Math.round(today.attempts/(s.dailyGoal||30)*100));
    let days=null;
    if(s.examDate){
      const e=new Date(s.examDate+'T00:00:00'),n=new Date(),z=new Date(n.getFullYear(),n.getMonth(),n.getDate());
      days=Math.max(0,Math.ceil((e-z)/86400000));
    }
    const core=Q.filter(q=>q.priority==='A核心'),coreDone=core.filter(q=>st[String(q.id)]).length,corePct=Math.round(coreDone/core.length*100);
    const unanswered=Q.length-ks.length;
    const prog=progressInfo();

    shell(`
      <section class="card hero">
        <div class="hero-grid">
          <div><div class="hero-kicker">2026 · 12月备考计划</div><div class="title">公共基础知识</div><div class="sub">700题离线题库 · 分层训练 · 错题闭环</div></div>
          <div class="today"><div class="n">${today.attempts}</div><div class="small muted">今日已刷</div></div>
        </div>
        <div class="goal-row"><span>今日目标 ${today.attempts} / ${s.dailyGoal}</span><span class="muted">${pct}%</span></div>
        <div class="progress"><i style="width:${pct}%"></i></div>
        <div class="exam-row">
          <label class="chip">考试日期 <input id="examDateHome" type="date" value="${esc(s.examDate)}" style="border:0;background:transparent;color:inherit;font-weight:700"></label>
          ${s.examDate?`<span class="small muted">距离考试还有 <b style="color:var(--primary);font-size:20px">${days}</b> 天</span>`:''}
        </div>
      </section>

      ${prog?`<section class="card resume-card" onclick="resumeProgress()">
        <div><div class="resume-kicker">继续上次</div><div class="resume-title">${esc(prog.title)}</div><div class="small muted">上次做到第 ${prog.index+1} / ${prog.total} 题</div></div>
        <div class="resume-arrow">继续 ›</div>
      </section>`:''}

      <div class="section-title">开始训练</div>
      <div class="grid2">
        ${entry('A','A核心必刷','223题 · 主干知识','blue',"startMode('core')")}
        ${entry('B','B高频强化','157题 · 高频辨析','orange',"startMode('high')")}
        ${entry('扩','B扩展训练','119题 · 延伸巩固','purple',"startMode('expand')")}
        ${entry('补','C补充训练','201题 · 查漏补缺','green',"startMode('supplement')")}
        ${entry('未','未做题专项',`${unanswered}题待完成`,'purple',"startMode('unanswered')")}
        ${entry('模','模拟考试','自定题量与时长','green',"goMock()")}
      </div>

      <div class="section-title">核心掌握</div>
      <section class="card mastery">
        <div class="bank-line"><span>A核心掌握进度</span><b>${coreDone} / 223</b></div>
        <div class="progress"><i style="width:${corePct}%"></i></div>
        <div class="small muted" style="margin-top:8px">已覆盖 ${corePct}%</div>
      </section>

      <div class="section-title">我的学习</div>
      <div class="grid2">
        <button class="metric metric-clickable" onclick="route('answered')">
          <div class="n">${ks.length}</div><div class="metric-label">已做题目</div>
        </button>
        ${metric(attempts?Math.round(correct/attempts*100)+'%':'0%','累计正确率')}
        <button class="metric metric-clickable" onclick="route('wrong')">
          <div class="n">${ids(K.wrong).length}</div><div class="metric-label">错题本</div>
        </button>
        <button class="metric metric-clickable" onclick="route('favorite')">
          <div class="n">${ids(K.fav).length}</div><div class="metric-label">收藏题目</div>
        </button>
      </div>

      <div class="section-title">题库结构</div>
      <section class="card">${bankLine('A核心','223')}${bankLine('B高频','157')}${bankLine('B扩展','119')}${bankLine('C补充','201')}${bankLine('<b>总题量</b>','<b>700</b>')}</section>
    `,'home');

    $('#examDateHome').onchange=e=>{const n=settings();n.examDate=e.target.value;set(K.settings,n);renderHome()};
  }

  function openQuestionMode(list,mode,title,useSaved=true){
    if(!list?.length){route('question',{list:[],mode,title});return}
    const index=useSaved?savedIndexFor(mode,list):0;
    qstate={list,index,mode,title,session:{}};
    route('question',{resume:true});
    if(useSaved && index>0)toast(`已续接到第 ${index+1} 题`);
  }

  window.startMode=mode=>{
    let list=Q,title='完整700题',internalMode=mode,useSaved=true;
    if(mode==='core'){list=Q.filter(q=>q.priority==='A核心');title='A核心223'}
    else if(mode==='high'){list=Q.filter(q=>q.priority==='B高频');title='B高频157'}
    else if(mode==='expand'){list=Q.filter(q=>q.priority==='B扩展');title='B扩展119'}
    else if(mode==='supplement'){list=Q.filter(q=>q.priority==='C补充');title='C补充201'}
    else if(mode==='random10'){list=shuffle(Q).slice(0,10);title='随机10题';useSaved=false}
    else if(mode==='random20'){list=shuffle(Q).slice(0,20);title='随机20题';useSaved=false}
    else if(mode==='random50'){list=shuffle(Q).slice(0,50);title='随机50题';useSaved=false}
    else if(mode==='unanswered'){const st=stats();list=Q.filter(q=>!st[String(q.id)]);title='未做题专项'}
    else if(mode==='wrong'){list=ids(K.wrong).map(byId).filter(Boolean);title='错题本'}
    else if(mode==='favorite'){list=ids(K.fav).map(byId).filter(Boolean);title='收藏夹'}
    else if(mode==='answered'){const st=stats();list=Q.filter(q=>st[String(q.id)]);title='已做题目'}
    openQuestionMode(list,internalMode,title,useSaved);
  };

  window.startGroup=g=>{
    const mode='group:'+g, list=Q.filter(q=>q.group===g);
    openQuestionMode(list,mode,g+'专项',true);
  };

  function renderPractice(){
    const groups={};Q.forEach(q=>groups[q.group]=(groups[q.group]||0)+1);
    const st=stats(),unanswered=Q.filter(q=>!st[String(q.id)]).length;

    shell(`
      <section class="card hero"><div class="title">刷题中心</div><div class="sub">按层级、模块、随机或未做题训练。</div></section>

      <section class="card search-card">
        <div class="search-row"><input id="searchInput" placeholder="搜索题干 / 知识点 / 模块"><button class="btn" id="searchBtn">搜索</button></div>
        <div id="searchResult"></div>
      </section>

      <div class="section-title">按层级刷题</div>
      <section class="card">
        ${menu('完整700题','全量知识覆盖',"startMode('all')")}
        ${menu('A核心223','优先掌握，建议反复刷',"startMode('core')")}
        ${menu('B高频157','高频易混辨析训练',"startMode('high')")}
        ${menu('B扩展119','扩展知识与延伸巩固',"startMode('expand')")}
        ${menu('C补充201','补充覆盖与查漏补缺',"startMode('supplement')")}
        ${menu('未做题专项',`${unanswered}题尚未作答`,"startMode('unanswered')")}
      </section>

      <div class="section-title">随机训练</div>
      <div class="grid3">
        <button class="card random-card" onclick="startMode('random10')"><b>10题</b><span>快速热身</span></button>
        <button class="card random-card" onclick="startMode('random20')"><b>20题</b><span>日常训练</span></button>
        <button class="card random-card" onclick="startMode('random50')"><b>50题</b><span>强化训练</span></button>
      </div>

      <div class="section-title">按模块专项</div>
      <div class="module-grid">${Object.entries(groups).map(([g,n])=>`<button class="module" onclick="startGroup('${g}')"><strong>${g}</strong><div class="small muted">${n}题</div></button>`).join('')}</div>

      <div class="section-title">个人题库</div>
      <div class="grid2">
        <button class="card entry" onclick="route('wrong')"><div class="entry-title">错题本</div><div class="small muted">${ids(K.wrong).length}题</div></button>
        <button class="card entry" onclick="route('favorite')"><div class="entry-title">收藏夹</div><div class="small muted">${ids(K.fav).length}题</div></button>
      </div>
    `,'practice');

    const doSearch=()=>{
      const kw=$('#searchInput').value.trim().toLowerCase(),box=$('#searchResult');
      if(!kw){box.innerHTML='';return}
      const arr=Q.filter(q=>`${q.question} ${q.explanation} ${q.group} ${q.module} ${q.mistakeTag||''}`.toLowerCase().includes(kw)).slice(0,30);
      box.innerHTML=arr.length?`<div class="search-count">找到 ${arr.length}${arr.length===30?'+' : ''} 条</div>${arr.map(q=>`<button class="search-item" data-id="${q.id}"><div><span class="badge">${q.group}</span><span class="badge orange">${typeName(q)}</span></div><div class="search-q">${esc(q.question)}</div></button>`).join('')}`:'<div class="small muted" style="padding-top:12px">没有找到相关题目</div>';
      $$('.search-item',box).forEach(b=>b.onclick=()=>route('question',{list:[byId(b.dataset.id)],mode:'search',title:'搜索结果'}));
    };
    $('#searchBtn').onclick=doSearch;
    $('#searchInput').onkeydown=e=>{if(e.key==='Enter')doSearch()};
  }

  let qstate=null;
  function renderQuestion(args={}){
    if(args.list)qstate={list:args.list,index:savedIndexFor(args.mode,args.list),mode:args.mode,title:args.title,session:{}};
    if(!qstate||!qstate.list.length){shell('<div class="card">暂无题目</div>','practice');return}

    const raw=qstate.list[qstate.index],q=displayQ(raw),ss=qstate.session[q.id]||{selected:[],submitted:false,isCorrect:false};
    const selected=new Set(ss.selected),correct=correctKeys(q),answerText=correct.join('、');
    const answered=Object.values(qstate.session).filter(x=>x.submitted).length,correctCount=Object.values(qstate.session).filter(x=>x.submitted&&x.isCorrect).length,pct=Math.round(answered/qstate.list.length*100);

    saveProgress(qstate.title,qstate.mode,qstate.list,qstate.index);

    shell(`
      <section class="card">
        <div class="q-head">
          <div><div class="small muted">${qstate.title}</div><div class="q-index"><b>${qstate.index+1}</b> / ${qstate.list.length}</div></div>
          <div class="small muted" style="text-align:right">已答 ${answered} 题<br>正确 ${correctCount} 题</div>
        </div>
        <div class="progress" style="margin-top:12px"><i style="width:${pct}%"></i></div>
      </section>

      <section class="card swipe-zone">
        <div class="badges"><span class="badge">${q.group}</span><span class="badge gray">${q.module}</span><span class="badge orange">${typeName(q)}</span><span class="badge green">${q.priority}</span></div>
        <div class="question">${esc(q.question)}</div>
        ${q.options.map(o=>{let c='option';if(selected.has(o.key))c+=' selected';if(ss.submitted&&correct.includes(o.key))c+=' correct';else if(ss.submitted&&selected.has(o.key)&&!correct.includes(o.key))c+=' wrong';return `<button class="${c}" data-key="${o.key}"><span class="key">${o.key}</span><span class="text">${esc(o.text)}</span></button>`}).join('')}
        ${!ss.submitted?'<button class="btn" id="submitQ" style="width:100%;margin-top:8px">提交答案</button>':`<div class="answer-box ${ss.isCorrect?'ok':'bad'}"><b>${ss.isCorrect?'回答正确':'回答错误'}</b><div class="small">正确答案：${answerText}</div></div><div class="explain"><b>解析</b>${esc(q.explanation)}</div>`}
      </section>

      <div class="toolbar">
        <button class="btn light" id="prevQ">上一题</button>
        <button class="btn light" id="cardQ">答题卡</button>
        <button class="btn light" id="nextQ">${qstate.index+1>=qstate.list.length?'完成':'下一题'}</button>
      </div>
      <div class="toolbar2">
        <button class="btn light" id="favQ">${ids(K.fav).includes(Number(q.id))?'★ 已收藏':'☆ 收藏本题'}</button>
        ${qstate.mode==='wrong'&&ss.submitted&&ss.isCorrect?'<button class="btn light" id="masterQ">移出错题</button>':''}
      </div>
    `,'practice');

    $$('.option').forEach(b=>b.onclick=()=>{
      if(ss.submitted)return;
      const k=b.dataset.key;
      if(q.type==='multiple'){selected.has(k)?selected.delete(k):selected.add(k)}
      else{selected.clear();selected.add(k)}
      ss.selected=[...selected];qstate.session[q.id]=ss;renderQuestion({});
    });

    if($('#submitQ'))$('#submitQ').onclick=()=>{
      if(!selected.size){toast('请先选择答案');return}
      const a=[...selected].sort(),c=[...correct].sort(),ok=a.length===c.length&&a.every((x,i)=>x===c[i]);
      ss.selected=a;ss.submitted=true;ss.isCorrect=ok;qstate.session[q.id]=ss;record(q.id,ok);renderQuestion({});
    };

    const goPrev=()=>{if(qstate.index>0){qstate.index--;renderQuestion({})}};
    const goNext=()=>{if(qstate.index+1<qstate.list.length){qstate.index++;renderQuestion({})}else toast(`本组已答 ${answered}/${qstate.list.length} 题`)};
    $('#prevQ').onclick=goPrev;
    $('#nextQ').onclick=goNext;
    $('#cardQ').onclick=()=>openCard(false);
    bindSwipe($('.swipe-zone'),goNext,goPrev);
    $('#favQ').onclick=()=>{toggleId(K.fav,q.id);renderQuestion({})};
    if($('#masterQ'))$('#masterQ').onclick=()=>{set(K.wrong,ids(K.wrong).filter(x=>x!==Number(q.id)));toast('已移出错题本')};
  }

  function openCard(exam=false){
    const s=exam?examState:qstate,session=exam?s.answers:s.session,mask=document.createElement('div'),sheet=document.createElement('div');
    mask.className='sheet-mask';sheet.className='sheet';
    const items=s.list.map((q,i)=>{
      let st='';
      if(i===s.index)st='current';
      else if(exam){if((session[q.id]||[]).length)st='answered'}
      else{const x=session[q.id];if(x&&x.submitted)st=x.isCorrect?'correct':'wrong'}
      return `<button class="num ${st}" data-i="${i}">${i+1}</button>`;
    }).join('');
    sheet.innerHTML=`<div class="sheet-head"><div><h3>答题卡</h3><div class="small muted">${s.title||'模拟考试'}</div></div><button class="btn light" id="closeSheet">关闭</button></div><div class="sheet-grid">${items}</div><div class="legend">蓝框=当前 · 绿色=已答/正确 · 红色=错误 · 灰色=未答</div>`;
    document.body.append(mask,sheet);
    const close=()=>{mask.remove();sheet.remove()};
    mask.onclick=close;$('#closeSheet',sheet).onclick=close;
    $$('.num',sheet).forEach(b=>b.onclick=()=>{s.index=Number(b.dataset.i);close();exam?renderExam({resume:true}):renderQuestion({})});
  }

  function renderList(type){
    let arr=[],title='',mode=type;
    if(type==='wrong'){arr=ids(K.wrong).map(byId).filter(Boolean);title='错题本'}
    else if(type==='favorite'){arr=ids(K.fav).map(byId).filter(Boolean);title='收藏夹'}
    else if(type==='answered'){
      const st=stats();
      arr=Q.filter(q=>st[String(q.id)]);
      title='已做题目';
    }
    const wrongGroups={};
    if(type==='wrong')arr.forEach(q=>wrongGroups[q.group]=(wrongGroups[q.group]||0)+1);

    shell(`
      <section class="card hero">
        <div class="title">${title}</div>
        <div class="sub">${arr.length}题</div>
        ${arr.length?`<button class="btn" style="margin-top:14px" id="startList">开始复习</button>`:''}
      </section>
      ${type==='wrong'&&arr.length?`<section class="card"><div class="small muted">错题模块分布</div><div class="wrong-tags">${Object.entries(wrongGroups).sort((a,b)=>b[1]-a[1]).map(([g,n])=>`<span>${g} ${n}</span>`).join('')}</div></section>`:''}
      ${arr.length?arr.map(q=>`<section class="card">
        <div>
          <span class="badge">${q.group}</span><span class="badge orange">${typeName(q)}</span>
          ${type==='wrong'?`<button class="remove" data-id="${q.id}">移除</button>`:type==='favorite'?`<button class="remove" data-id="${q.id}">取消收藏</button>`:''}
        </div>
        <button class="list-q list-open" data-id="${q.id}">${esc(q.question)}</button>
      </section>`).join(''):'<div class="card muted">当前没有题目。</div>'}
    `,'practice');

    if($('#startList'))$('#startList').onclick=()=>openQuestionMode(arr,mode,title,true);
    $$('.list-open').forEach(b=>b.onclick=()=>openQuestionMode([byId(b.dataset.id)].filter(Boolean),'search','单题复习',false));
    $$('.remove').forEach(b=>b.onclick=()=>{
      if(type==='wrong')set(K.wrong,ids(K.wrong).filter(x=>x!==Number(b.dataset.id)));
      else if(type==='favorite')toggleId(K.fav,b.dataset.id);
      renderList(type);
    });
  }

  function renderMock(){
    const hist=get(K.mock,[]);
    shell(`
      <section class="card hero"><div class="title">模拟考试</div><div class="sub">默认从 A核心 + B高频 共380题中随机组卷。</div></section>
      <section class="card">
        <div class="form-grid">
          <div class="field"><label>题量</label><input id="mockCount" type="number" min="5" max="100" value="50"></div>
          <div class="field"><label>时长（分钟）</label><input id="mockMinutes" type="number" min="5" value="30"></div>
        </div>
        <div class="quick-pills">
          <button data-c="20" data-m="15">20题 / 15分</button>
          <button data-c="30" data-m="20">30题 / 20分</button>
          <button data-c="50" data-m="30" class="active">50题 / 30分</button>
        </div>
      </section>
      <section class="card">${bankLine('组卷范围','A核心 + B高频')}${bankLine('题型','单选 / 多选 / 判断')}${bankLine('交卷后','可查看错题解析')}</section>
      <button class="btn" style="width:100%" id="startExam">开始模拟</button>
      <div class="section-title">最近记录</div>
      ${hist.length?`<section class="card">${hist.slice(0,5).map(x=>`<div class="bank-line"><span><b style="color:var(--primary)">${x.score}分</b><br><small class="muted">${x.date} · ${x.count}题 · ${x.minutes}分钟</small></span><span class="small muted">正确 ${x.correct}/${x.count}</span></div>`).join('')}</section>`:'<div class="card muted">暂无模拟记录</div>'}
    `,'practice');

    $$('.quick-pills button').forEach(b=>b.onclick=()=>{$('#mockCount').value=b.dataset.c;$('#mockMinutes').value=b.dataset.m;$$('.quick-pills button').forEach(x=>x.classList.remove('active'));b.classList.add('active')});
    $('#startExam').onclick=()=>{
      const c=Math.max(5,Math.min(100,Number($('#mockCount').value)||50)),m=Math.max(5,Number($('#mockMinutes').value)||30),src=Q.filter(q=>q.priority==='A核心'||q.priority==='B高频');
      route('exam',{start:true,list:shuffle(src).slice(0,c),minutes:m});
    };
  }

  let examState=null,examTimer=null;
  const fmt=s=>`${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

  function renderExam(args={}){
    if(args.start){
      examState={list:args.list,index:0,answers:{},seconds:args.minutes*60,minutes:args.minutes,finished:false,title:'模拟考试',wrongReview:[]};
      clearInterval(examTimer);
      examTimer=setInterval(()=>{
        if(!examState||examState.finished)return;
        examState.seconds--;
        if(examState.seconds<=0){examState.seconds=0;submitExam(true)}else updateTimer();
      },1000);
    }

    if(examState.finished){
      const r=examState.result;
      shell(`
        <section class="card result-card">
          <div class="small muted">本次得分</div><div class="score">${r.score}</div><div class="sub">正确 ${r.correct}/${r.total} · 正确率 ${r.accuracy}%</div>
        </section>
        <div class="grid2">${metric(r.correct,'正确')}${metric(r.wrong,'错误')}</div>
        <div class="toolbar2" style="margin-top:16px">
          ${r.wrong?'<button class="btn light" id="reviewWrong">查看错题解析</button>':''}
          <button class="btn" id="backMock">返回模拟考试</button>
        </div>
      `,'practice');
      if($('#reviewWrong'))$('#reviewWrong').onclick=()=>route('review');
      $('#backMock').onclick=()=>route('mock');
      return;
    }

    const q=displayQ(examState.list[examState.index]),selected=new Set(examState.answers[q.id]||[]),answered=Object.values(examState.answers).filter(a=>a.length).length,pct=Math.round(answered/examState.list.length*100);

    shell(`
      <section class="card">
        <div class="q-head">
          <div><div class="small muted">模拟考试</div><div class="q-index"><b>${examState.index+1}</b> / ${examState.list.length}</div></div>
          <div><div class="timer" id="timer">${fmt(examState.seconds)}</div><div class="small muted">已答 ${answered}/${examState.list.length}</div></div>
        </div>
        <div class="progress" style="margin-top:12px"><i style="width:${pct}%"></i></div>
      </section>
      <section class="card swipe-zone">
        <div class="badges"><span class="badge">${q.group}</span><span class="badge orange">${typeName(q)}</span></div>
        <div class="question">${esc(q.question)}</div>
        ${q.options.map(o=>`<button class="option ${selected.has(o.key)?'selected':''}" data-key="${o.key}"><span class="key">${o.key}</span><span class="text">${esc(o.text)}</span></button>`).join('')}
      </section>
      <div class="toolbar"><button class="btn light" id="prevE">上一题</button><button class="btn light" id="cardE">答题卡</button><button class="btn light" id="nextE">${examState.index+1>=examState.list.length?'去交卷':'下一题'}</button></div>
      <div class="toolbar2"><button class="btn danger" id="submitE">提前交卷</button></div>
    `,'practice');

    $$('.option').forEach(b=>b.onclick=()=>{
      const k=b.dataset.key;
      if(q.type==='multiple'){selected.has(k)?selected.delete(k):selected.add(k)}
      else{selected.clear();selected.add(k)}
      examState.answers[q.id]=[...selected];
      renderExam({resume:true});
    });
    const examPrev=()=>{if(examState.index>0){examState.index--;renderExam({resume:true})}};
    const examNext=()=>{if(examState.index+1<examState.list.length){examState.index++;renderExam({resume:true})}else submitExam(false)};
    $('#prevE').onclick=examPrev;
    $('#nextE').onclick=examNext;
    $('#cardE').onclick=()=>openCard(true);
    bindSwipe($('.swipe-zone'),examNext,examPrev);
    $('#submitE').onclick=()=>submitExam(false);
    updateTimer();
  }

  function updateTimer(){
    const e=$('#timer');
    if(e){e.textContent=fmt(examState.seconds);e.classList.toggle('danger',examState.seconds<300)}
  }

  function submitExam(auto){
    const go=()=>{
      clearInterval(examTimer);
      let c=0,wrongReview=[];
      examState.list.forEach(q=>{
        const a=[...(examState.answers[q.id]||[])].sort(),b=correctKeys(q).sort(),ok=a.length===b.length&&a.every((x,i)=>x===b[i]);
        if(ok)c++; else wrongReview.push({q,chosen:a,correct:b});
        record(q.id,ok);
      });
      const total=examState.list.length,score=Math.round(c/total*100),d=new Date(),date=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const h=get(K.mock,[]);h.unshift({time:Date.now(),date,count:total,minutes:examState.minutes,correct:c,score});set(K.mock,h.slice(0,30));
      examState.finished=true;examState.wrongReview=wrongReview;examState.result={score,correct:c,wrong:total-c,total,accuracy:score};
      renderExam({resume:true});
    };
    if(auto)return go();
    const un=examState.list.filter(q=>!(examState.answers[q.id]||[]).length).length;
    if(confirm(un?`还有 ${un} 题未作答，确定交卷吗？`:'确定交卷吗？'))go();
  }

  function renderReview(){
    if(!examState?.wrongReview?.length){route('mock');return}
    shell(`
      <section class="card hero"><div class="title">模拟错题复盘</div><div class="sub">本次共 ${examState.wrongReview.length} 道错题</div></section>
      ${examState.wrongReview.map((x,i)=>{
        const q=displayQ(x.q);
        return `<section class="card">
          <div class="badges"><span class="badge">${q.group}</span><span class="badge orange">${typeName(q)}</span><span class="badge gray">第${i+1}题</span></div>
          <div class="question">${esc(q.question)}</div>
          <div class="review-answer"><b>你的答案：</b>${x.chosen.length?x.chosen.join('、'):'未作答'}　<b>正确答案：</b>${x.correct.join('、')}</div>
          <div class="explain"><b>解析</b>${esc(q.explanation)}</div>
        </section>`;
      }).join('')}
      <button class="btn" style="width:100%" onclick="route('mock')">完成复盘</button>
    `,'practice');
  }

  function renderStats(){
    const st=stats(),keys=Object.keys(st),attempts=keys.reduce((n,k)=>n+(st[k].attempts||0),0),correct=keys.reduce((n,k)=>n+(st[k].correct||0),0),groups={};
    Q.forEach(q=>{if(!groups[q.group])groups[q.group]={total:0,ids:[]};groups[q.group].total++;groups[q.group].ids.push(String(q.id))});
    const wrongSet=new Set(ids(K.wrong).map(String));
    const modules=Object.entries(groups).map(([name,g])=>{
      const answered=g.ids.filter(id=>st[id]).length;let a=0,c=0;
      g.ids.forEach(id=>{if(st[id]){a+=st[id].attempts||0;c+=st[id].correct||0}});
      return{name,total:g.total,answered,acc:a?Math.round(c/a*100):0,pct:Math.round(answered/g.total*100),wrong:g.ids.filter(id=>wrongSet.has(id)).length};
    }).sort((a,b)=>b.acc-a.acc);

    shell(`
      <section class="card hero">
        <div class="title">学习统计</div><div class="sub">统计基于当前浏览器本地数据。</div>
        <div class="grid2" style="margin-top:18px">${metric(keys.length,'已做题目')}${metric(attempts,'累计作答')}${metric(attempts?Math.round(correct/attempts*100)+'%':'0%','累计正确率')}${metric(ids(K.wrong).length,'错题本')}</div>
      </section>

      <div class="section-title">模块掌握</div>
      <section class="card">
        ${modules.map((x,i)=>`<div class="module-row">
          <div class="bank-line" style="border:0;padding:0 0 8px">
            <span><b>${i+1}. ${x.name}</b><br><small class="muted">错题 ${x.wrong} · 已做 ${x.answered}/${x.total}</small></span>
            <span class="small muted">正确率 ${x.acc}%</span>
          </div>
          <div class="bar"><i style="width:${x.pct}%"></i></div>
        </div>`).join('')}
      </section>
    `,'stats');
  }

  function renderSettings(){
    const s=settings();
    shell(`
      <section class="card">
        <div class="setting-row"><div><b>每日目标</b><div class="small muted">建议20—50题</div></div><input id="dailyGoal" type="number" min="1" value="${s.dailyGoal}" style="width:110px;padding:11px;border:1px solid var(--line);border-radius:12px;background:var(--card);color:var(--text)"></div>
        <div class="setting-row"><div><b>考试日期</b><div class="small muted">留空则不显示倒计时</div></div><input id="examDate" type="date" value="${esc(s.examDate)}" style="padding:11px;border:1px solid var(--line);border-radius:12px;background:var(--card);color:var(--text)"></div>
        <button class="btn" id="saveSettings" style="width:100%;margin-top:15px">保存设置</button>
      </section>

      <div class="section-title">数据管理</div>
      <section class="card">
        ${menu('导出学习数据','下载JSON备份文件',"exportBackup()")}
        ${menu('导入学习数据','从备份文件恢复',"importBackup()")}
        ${menu('清空全部记录','错题、收藏、统计都会清除',"resetAll()")}
      </section>

      <div class="section-title">关于题库</div>
      <section class="card">${bankLine('网页版本','V1.1功能增强版')}${bankLine('题库版本','V2精修版')}${bankLine('总题量','700题')}${bankLine('运行方式','离线优先')}</section>
    `,'settings');

    $('#saveSettings').onclick=()=>{set(K.settings,{dailyGoal:Math.max(1,Number($('#dailyGoal').value)||30),examDate:$('#examDate').value});toast('已保存')};
  }

  window.exportBackup=()=>{
    const obj={version:1,settings:settings(),stats:stats(),wrong:ids(K.wrong),favorite:ids(K.fav),daily:get(K.daily,{}),mock:get(K.mock,[]),progress:get(K.progress,null),modeProgress:get(K.modeProgress,{})};
    const b=new Blob([JSON.stringify(obj,null,2)],{type:'application/json'}),u=URL.createObjectURL(b),a=document.createElement('a');
    a.href=u;a.download='公基刷题学习数据备份.json';a.click();URL.revokeObjectURL(u);
  };

  window.importBackup=()=>{
    const i=document.createElement('input');i.type='file';i.accept='.json,application/json';
    i.onchange=()=>{
      const f=i.files[0];if(!f)return;
      const r=new FileReader();
      r.onload=()=>{
        try{
          const o=JSON.parse(r.result);
          if(o.settings)set(K.settings,o.settings);if(o.stats)set(K.stats,o.stats);if(o.wrong)set(K.wrong,o.wrong);if(o.favorite)set(K.fav,o.favorite);if(o.daily)set(K.daily,o.daily);if(o.mock)set(K.mock,o.mock);if(o.progress)set(K.progress,o.progress);if(o.modeProgress)set(K.modeProgress,o.modeProgress);
          toast('导入成功');renderSettings();
        }catch{alert('备份文件格式无效')}
      };
      r.readAsText(f);
    };
    i.click();
  };

  window.resetAll=()=>{
    if(confirm('确定清空全部学习记录吗？')){
      [K.stats,K.wrong,K.fav,K.daily,K.mock,K.progress,K.modeProgress].forEach(k=>localStorage.removeItem(k));
      toast('已清空');renderSettings();
    }
  };

  if(get(K.theme,false))document.body.classList.add('dark');
  if('serviceWorker' in navigator && location.protocol!=='file:')navigator.serviceWorker.register('./sw.js').catch(()=>{});

  route((location.hash||'#home').slice(1));
})();
