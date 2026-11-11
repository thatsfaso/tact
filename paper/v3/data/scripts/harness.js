// Tact evaluation harness: runs the real app flow on the live site, one story
// every INTERVAL ms, and records fit, picture, requests and timings.
(function () {
  if (window.__H && window.__H.running) return 'already running';
  const INTERVAL = 180000;
  const IDEAS = [
    ['a whale who sings to the stars', 'una balena che canta alle stelle', 'whale'],
    ['a dragon afraid of the dark', 'un drago che ha paura del buio', 'dragon'],
    ['two friends and a paper boat', 'due amici e una barchetta di carta', 'boat'],
    ['a fox who finds a hidden castle', 'una volpe che trova un castello nascosto', 'fox'],
    ['a pirate cat sailing to the moon', 'un gatto pirata che naviga verso la luna', 'cat'],
    ['a hedgehog who wants a hug', 'un riccio che vuole un abbraccio', 'hedgehog'],
    ['a little robot lost in the snow', 'un piccolo robot perso nella neve', 'robot'],
    ['a turtle who races a rabbit', 'una tartaruga che sfida un coniglio', 'turtle'],
    ['an owl who cannot sleep at night', 'un gufo che non riesce a dormire di notte', 'owl'],
    ['a penguin who dreams of flying', 'un pinguino che sogna di volare', 'penguin'],
    ['a kite that escapes on a windy day', 'un aquilone che scappa in una giornata di vento', 'kite'],
    ['a lighthouse that guides a lost ship', 'un faro che guida una nave perduta', 'lighthouse'],
    ['a bee who makes friends with a flower', "un'ape che diventa amica di un fiore", 'bee'],
    ['a snail who wants to go fast', 'una lumaca che vuole andare veloce', 'snail'],
    ['a teddy bear left in the park', 'un orsacchiotto dimenticato al parco', 'teddy_bear'],
    ['a mermaid who hears a bell under the sea', 'una sirena che sente una campana sotto il mare', 'mermaid'],
    ['a dinosaur who loves to dance', 'un dinosauro a cui piace ballare', 'dinosaur'],
    ['a balloon that floats over the town', 'un palloncino che vola sopra la città', 'balloon'],
    ['a squirrel who hides a key', 'uno scoiattolo che nasconde una chiave', 'squirrel'],
    ['a unicorn who finds a rainbow', 'un unicorno che trova un arcobaleno', 'unicorn'],
  ];
  const CONDS = [['it', 1], ['en', 1], ['en', 2]];
  const queue = [];
  IDEAS.forEach((row, i) => CONDS.forEach(([lang, grade]) =>
    queue.push({ i, lang, grade, idea: lang === 'it' ? row[1] : row[0], expected: row[2] })));

  const H = window.__H = { running: true, results: [], errors: [], current: null, queue, next: 0 };
  try { H.results = JSON.parse(localStorage.getItem('tact-eval') || '[]'); H.next = H.results.length; } catch (e) {}
  const save = () => { try { localStorage.setItem('tact-eval', JSON.stringify(H.results)); } catch (e) {} };

  // Worker requests: provider, timing, size of each answer.
  const origFetch = window.__origFetch || window.fetch;
  window.__origFetch = origFetch;
  window.fetch = function (url, opts) {
    const isStory = typeof url === 'string' && url.indexOf('workers.dev') >= 0 && opts && opts.method === 'POST';
    if (!isStory || !H.current) return origFetch.apply(this, arguments);
    let asked = 0; try { asked = JSON.parse(opts.body).targetWords; } catch (e) {}
    const rec = { asked, t0: performance.now() };
    H.current.requests.push(rec);
    return origFetch.apply(this, arguments).then(r => {
      rec.status = r.status; rec.ms = Math.round(performance.now() - rec.t0);
      r.clone().json().then(d => {
        rec.provider = d.provider;
        rec.words = d.story ? d.story.split(/\s+/).filter(Boolean).length : 0;
        rec.chain = d.chain;
      }).catch(() => {});
      return r;
    }, e => { rec.status = 'error'; rec.err = String(e); rec.ms = Math.round(performance.now() - rec.t0); throw e; });
  };

  // The story the app settles on, measured with the app's own functions.
  const origBuild = window.__origBuild || window.buildPages;
  window.__origBuild = origBuild;
  window.buildPages = function (storyText, lang, idea) {
    const out = origBuild.apply(this, arguments);
    if (H.current) {
      const c = H.current;
      c.story = storyText;
      c.words = String(storyText || '').split(/\s+/).filter(Boolean).length;
      c.fit = measureFit(storyText);
      c.good = fitIsGood(c.fit);
      const texts = paginateStory(storyText);
      c.pageRows = texts.map((t, k) => {
        const w = widthsForRendering(k + 1, texts.length, t);
        return layoutBrailleLinesVar(textToBrailleCells(t), w, indentForPage(k + 1)).length + '/' + w.length;
      });
      c.shapes = out.map(p => p.illustration ? p.illustration.elements[0].shape : null);
      c.grade2 = !!(window.TACT.grade2Active && window.TACT.grade2Active());
    }
    return out;
  };

  const wait = ms => new Promise(r => setTimeout(r, ms));
  const btn = pred => [...document.querySelectorAll('button')].find(pred);
  const setInput = v => {
    const el = document.querySelector('form input[type=text]');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true }));
  };

  async function runOne(job) {
    // Back to the input screen if a result is showing.
    const again = btn(b => /Tell another|Un'altra storia/.test(b.textContent));
    if (again) { again.click(); await wait(1500); }
    btn(b => b.getAttribute('aria-label') === (job.lang === 'it' ? 'Italiano' : 'English')).click();
    await wait(800);
    if (job.lang === 'en') {
      const g = btn(b => b.textContent.indexOf(job.grade === 2 ? 'Grade 2' : 'Grade 1') >= 0);
      if (g) g.click();
      await wait(800);
    }
    H.current = { n: H.next, idea: job.idea, lang: job.lang, grade: job.grade, expected: job.expected,
                  requests: [], start: new Date().toISOString() };
    const t0 = performance.now();
    setInput(job.idea);
    await wait(300);
    document.querySelector('form button[type=submit]').click();
    // Done when the result region appears (or after 4 minutes).
    for (let k = 0; k < 480; k++) {
      await wait(500);
      if (document.querySelector('main[aria-label]') && H.current.fit) break;
    }
    H.current.totalMs = Math.round(performance.now() - t0);
    await wait(2500); // let the last response bodies be read
    H.current.requests.forEach(r => { delete r.t0; });
    H.results.push(H.current); save();
    H.current = null;
  }

  (async function loop() {
    while (H.running && H.next < queue.length) {
      const started = performance.now();
      try { await runOne(queue[H.next]); }
      catch (e) { H.errors.push({ n: H.next, err: String(e && e.stack || e) }); H.current = null; }
      H.next++;
      const left = INTERVAL - (performance.now() - started);
      if (H.next < queue.length) await wait(Math.max(5000, left));
    }
    H.running = false;
    H.finishedAt = new Date().toISOString();
  })();
  return 'started ' + queue.length + ' jobs from ' + H.next;
})();
