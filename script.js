// Enhanced Quiz script: keyboard nav, progress, timer, accessibility
let selectedCategory = "";

const categoryButtons = document.querySelectorAll(".category-box .option");
const startBtn = document.querySelector(".start-btn");
const categoryScreen = document.querySelector(".category-wrapper");
const quizScreen = document.querySelector(".quiz-screen");

const _question = document.getElementById("question");
const _options = document.querySelector(".quiz-options");
const _checkBtn = document.getElementById("check-answer");
const _playAgainBtn = document.getElementById("play-again");
const _result = document.getElementById("result");
const _correctScore = document.getElementById("correct-score");
const _totalQuestion = document.getElementById("total-question");
const _progressBar = document.getElementById("progress-bar");
const _progress = document.getElementById("progress");
const _timerEl = document.getElementById("timer");

let correctAnswer = "";
let correctScore = 0;
let askedCount = 0;
let totalQuestion = 10;

// timer
const timePerQuestion = 15; // seconds
let remainingTime = timePerQuestion;
let timerInterval = null;
// sound / mute
let audioCtx = null;
let isMuted = false;

function ensureAudio() {
  if (audioCtx) return audioCtx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AC();
    return audioCtx;
  } catch (e) {
    audioCtx = null; return null;
  }
}

function playTone(freq, duration = 0.16, type = 'sine', vol = 0.12) {
  if (isMuted) return;
  const ctx = ensureAudio();
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.value = vol;
  o.connect(g); g.connect(ctx.destination);
  const now = ctx.currentTime;
  o.start(now);
  g.gain.setValueAtTime(vol, now);
  g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  o.stop(now + duration + 0.02);
}

function playSuccessSound() {
  if (isMuted) return;
  const ctx = ensureAudio(); if (!ctx) return;
  playTone(880,0.12,'sine',0.12);
  setTimeout(()=>playTone(1100,0.12,'sine',0.1),90);
}

function playFailSound() {
  if (isMuted) return;
  playTone(300,0.18,'sawtooth',0.16);
  setTimeout(()=>playTone(220,0.16,'sawtooth',0.12),140);
}

function playWarnSound() {
  if (isMuted) return;
  playTone(520,0.1,'triangle',0.12);
}

// category selection: visual + accessible
categoryButtons.forEach((button) => {
  button.addEventListener("click", () => {
    categoryButtons.forEach((b) => {
      b.classList.remove("selected");
      b.setAttribute("aria-checked", "false");
    });
    button.classList.add("selected");
    button.setAttribute("aria-checked", "true");
    selectedCategory = button.innerText;
  });
  button.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      button.click();
    }
  });
});

startBtn.addEventListener("click", () => {
  if (selectedCategory === "") {
    alert("Please select a category first!");
    return;
  }

  categoryScreen.style.display = "none";
  quizScreen.style.display = "block";
  askedCount = 0; correctScore = 0; setCount(); updateProgress();
  loadQuestion(selectedCategory);
});

async function loadQuestion(category = "") {
  _checkBtn.disabled = false;
  _playAgainBtn.style.display = 'none';
  _checkBtn.style.display = 'inline-block';
  // build API URL
  let APIUrl = "https://opentdb.com/api.php?amount=1&type=multiple";

  const categoryMap = {
    Programming: 18,
    Geography: 22,
    Mathematics: 19,
    Entertainment: 11,
  };

  try {
    const key = (category || selectedCategory || '').toString().trim();
    if (key && categoryMap[key]) {
      APIUrl += `&category=${categoryMap[key]}`;
    }

    const result = await fetch(APIUrl);
    if (!result.ok) throw new Error(`API error ${result.status}`);
    const data = await result.json();
    if (!data.results || !data.results.length) throw new Error('No question returned');
    showQuestion(data.results[0]);
  } catch (err) {
    console.error('loadQuestion failed', err);
    // show inline message + retry button without boxed <p>
    _result.innerHTML = `<span class="result-inline">Unable to load question. <button id="retry-q" class="inline-retry" aria-label="Retry loading question">Retry</button></span>`;
    const retry = document.getElementById('retry-q');
    if (retry) retry.addEventListener('click', () => loadQuestion(category));
    _checkBtn.disabled = true;
  }
}

// event listeners
function eventListeners() {
  _checkBtn.addEventListener("click", checkAnswer);
  _playAgainBtn.addEventListener("click", restartQuiz);

  // keyboard shortcuts
  document.addEventListener("keydown", function (e) {
    if (/^[1-4]$/.test(e.key)) {
      const idx = Number(e.key) - 1;
      const items = _options.querySelectorAll("li");
      if (items[idx]) items[idx].click();
    }
    if (e.key === "Enter") {
      if (!document.activeElement.closest || !document.activeElement.closest('.quiz-options')) {
        if (!_checkBtn.disabled) _checkBtn.click();
      }
    }
  });
}

document.addEventListener("DOMContentLoaded", function () {
  eventListeners();
  _totalQuestion.textContent = totalQuestion;
  _correctScore.textContent = correctScore;
  updateProgress();
  // init mute toggle
  const muteBtn = document.getElementById('mute-toggle');
  try {
    const stored = localStorage.getItem('quiz-muted');
    isMuted = stored === '1';
  } catch (e) { isMuted = false; }
  if (muteBtn) {
    muteBtn.setAttribute('aria-pressed', isMuted ? 'true' : 'false');
    muteBtn.textContent = isMuted ? '🔈' : '🔊';
    muteBtn.addEventListener('click', ()=>{
      isMuted = !isMuted;
      muteBtn.setAttribute('aria-pressed', isMuted ? 'true' : 'false');
      muteBtn.textContent = isMuted ? '🔈' : '🔊';
      try { localStorage.setItem('quiz-muted', isMuted ? '1' : '0'); } catch(e){}
    });
  }
  // how-to dialog handlers
  const howBtn = document.getElementById('howto');
  const howDlg = document.getElementById('howto-dialog');
  const closeHow = document.getElementById('close-howto');
  if (howBtn && howDlg) {
    howBtn.addEventListener('click', ()=>{ howDlg.style.display='block'; howDlg.setAttribute('aria-hidden','false'); });
  }
  if (closeHow && howDlg) {
    closeHow.addEventListener('click', ()=>{ howDlg.style.display='none'; howDlg.setAttribute('aria-hidden','true'); howBtn.focus(); });
  }
});

// display question and options
function showQuestion(data) {
  document.body.classList.add("quiz-active");
  correctAnswer = data.correct_answer;
  let incorrectAnswer = data.incorrect_answers;
  let optionsList = incorrectAnswer.slice();
  optionsList.splice(
    Math.floor(Math.random() * (incorrectAnswer.length + 1)),
    0,
    correctAnswer
  );

  _question.innerHTML = `${data.question} <br> <span class = "category"> ${data.category} </span>`;
  _options.innerHTML = `
        ${optionsList
          .map(
            (option, index) => `
            <li tabindex="0" role="button" aria-pressed="false"> ${index + 1}. <span>${option}</span> </li>
        `
          )
          .join("")}
    `;

  // clear previous result and enable options
  _result.innerHTML = "";
  _options.style.pointerEvents = 'auto';
  selectOption();
  resetTimer();
  startTimer();
}

// options selection
function selectOption() {
  _options.querySelectorAll("li").forEach(function (option, idx, list) {
    option.addEventListener("click", function () {
      if (_options.querySelector(".selected")) {
        const activeOption = _options.querySelector(".selected");
        activeOption.classList.remove("selected");
        activeOption.setAttribute('aria-pressed','false');
      }
      option.classList.add("selected");
      option.setAttribute('aria-pressed','true');
    });

    // keyboard navigation within options
    option.addEventListener('keydown', function(e){
      const items = Array.from(_options.querySelectorAll('li'));
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        const next = items[(idx+1) % items.length]; next.focus();
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const prev = items[(idx-1+items.length) % items.length]; prev.focus();
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault(); option.click();
      }
    });
  });
}

function updateProgress() {
  const pct = Math.round((askedCount / totalQuestion) * 100);
  if (_progressBar) {
    _progressBar.style.width = pct + "%";
    _progress.setAttribute('aria-valuenow', pct);
  }
}

function resetTimer(){
  remainingTime = timePerQuestion;
  if (_timerEl) _timerEl.textContent = `${remainingTime}s`;
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}

// --- Modal helpers for centered overlay ---
function ensureResultModal() {
  let modal = document.getElementById('result-modal');
  if (modal) return modal;
  modal = document.createElement('div');
  modal.id = 'result-modal';
  modal.setAttribute('aria-hidden','true');
  modal.innerHTML = `
    <div class="modal-backdrop" tabindex="-1"></div>
    <div class="modal-content" role="dialog" aria-modal="true">
      <p class="modal-title"></p>
      <div class="modal-detail"></div>
      <div class="modal-actions"><button id="modal-dismiss">OK</button></div>
    </div>`;
  document.body.appendChild(modal);
  const btn = modal.querySelector('#modal-dismiss');
  btn.addEventListener('click', () => hideResultModal());
  modal.querySelector('.modal-backdrop').addEventListener('click', () => hideResultModal());
  return modal;
}

function showResultModal(type, title, detailHTML = '', autoHide = 1200, cb) {
  const modal = ensureResultModal();
  const titleEl = modal.querySelector('.modal-title');
  const detailEl = modal.querySelector('.modal-detail');
  modal.className = ''; // reset
  modal.classList.add('show', `modal-${type}`);
  titleEl.innerHTML = title;
  detailEl.innerHTML = detailHTML || '';
  modal.setAttribute('aria-hidden','false');
  const actionsEl = modal.querySelector('.modal-actions');
  const dismiss = modal.querySelector('#modal-dismiss');
  // hide OK for success/fail so modal auto-hides; keep button for warnings
  if (type === 'success' || type === 'fail') {
    actionsEl.style.display = 'none';
    dismiss.tabIndex = -1;
    const content = modal.querySelector('.modal-content');
    content.setAttribute('tabindex','-1');
    content.focus();
  } else {
    actionsEl.style.display = 'flex';
    dismiss.tabIndex = 0;
    dismiss.focus();
  }
  if (autoHide && autoHide > 0) {
    setTimeout(() => {
      hideResultModal();
      if (typeof cb === 'function') cb();
    }, autoHide);
  } else {
    if (typeof cb === 'function') {
      const handler = function() { cb(); modal.querySelector('#modal-dismiss').removeEventListener('click', handler); };
      modal.querySelector('#modal-dismiss').addEventListener('click', handler);
    }
  }
}

function hideResultModal() {
  const modal = document.getElementById('result-modal');
  if (!modal) return;
  modal.classList.remove('show');
  modal.setAttribute('aria-hidden','true');
}

function startTimer(){
  resetTimer();
  timerInterval = setInterval(()=>{
    remainingTime--;
    if (_timerEl) _timerEl.textContent = `${remainingTime}s`;
    // low-time visual
    if (_timerEl) {
      if (remainingTime <= 4) _timerEl.classList.add('low'); else _timerEl.classList.remove('low');
    }
    if (remainingTime <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;
      // auto-fail this question: reveal and show modal then advance
      // play fail sound
      playFailSound();
      revealAnswers(null);
      showResultModal('fail', "Time's up!", `<div class=\"correct-note\"><strong>Correct:</strong> ${HTMLDecode(correctAnswer)}</div>`, 1400, () => checkCount());
    }
  },1000);
}

// answer checking
function checkAnswer() {
  // stop timer
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  _checkBtn.disabled = true;
  const selectedEl = _options.querySelector(".selected");
  if (selectedEl) {
    let selectedAnswer = selectedEl.querySelector("span").textContent;
    const isCorrect = selectedAnswer == HTMLDecode(correctAnswer);
    if (isCorrect) {
      correctScore++;
        // reveal and show success modal, then advance
        // play success + reveal
        playSuccessSound();
        revealAnswers(selectedAnswer);
        // celebration
        launchConfetti();
        showResultModal('success', 'Correct Answer!', '', 1100, () => { checkCount(); });
    } else {
        // reveal and show fail modal with correct answer, then advance
        playFailSound();
        revealAnswers(selectedAnswer);
        showResultModal('fail', 'Incorrect Answer!', `<div class=\"correct-note\"><strong>Correct Answer:</strong> ${HTMLDecode(correctAnswer)}</div>`, 1600, () => { checkCount(); });
    }
    // visually reveal handled above; progression runs after modal hide
  } else {
    // show warning modal and re-enable check button after
    playWarnSound();
    showResultModal('warn', 'Please select an option!', '', 900, () => { _checkBtn.disabled = false; });
  }
}

// Lightweight confetti: create colorful pieces and animate them from center
function launchConfetti(count = 36) {
  const colors = ['#ff5a8a','#ffb86b','#ffd166','#7ce3b8','#6f43f0','#8a6bff'];
  const container = document.createElement('div');
  container.className = 'confetti-container';
  document.body.appendChild(container);
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'confetti-piece';
    const color = colors[Math.floor(Math.random() * colors.length)];
    el.style.background = color;
    el.style.left = (50 + (Math.random() - 0.5) * 20) + '%';
    el.style.transform = `rotate(${Math.random()*360}deg)`;
    el.style.opacity = String(0.9 - Math.random()*0.4);
    container.appendChild(el);
  }
  // remove after animation
  setTimeout(()=>{ container.remove(); }, 2200);
}

// reveal correct and mark incorrect selection
function revealAnswers(selectedAnswer) {
  const items = _options.querySelectorAll('li');
  items.forEach(li => {
    const text = li.querySelector('span') ? li.querySelector('span').textContent.trim() : '';
    li.classList.remove('selected');
    li.setAttribute('aria-pressed','false');
    // disable further interaction
    li.style.pointerEvents = 'none';
    if (text == HTMLDecode(correctAnswer)) {
      li.classList.add('correct');
    }
    if (selectedAnswer && text == selectedAnswer && text != HTMLDecode(correctAnswer)) {
      li.classList.add('incorrect');
    }
  });
  // ensure timer stops/loading state
  if (_timerEl) _timerEl.classList.remove('low');
  _options.style.pointerEvents = 'none';
}

// to convert html entities into normal text of correct answer if there is any
function HTMLDecode(textString) {
  let doc = new DOMParser().parseFromString(textString, "text/html");
  return doc.documentElement.textContent;
}

function checkCount() {
  askedCount++;
  setCount();
  updateProgress();
  if (askedCount == totalQuestion) {
    setTimeout(function () {
      console.log("");
    }, 500);

    _result.innerHTML += `<p>Your score is ${correctScore}.</p>`;
    _playAgainBtn.style.display = "block";
    _checkBtn.style.display = "none";
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  } else {
    setTimeout(function () {
      loadQuestion(selectedCategory);
    }, 700);
  }
}

function setCount() {
  _totalQuestion.textContent = totalQuestion;
  _correctScore.textContent = correctScore;
}

function restartQuiz() {
  // reset counters and UI, then start a fresh question
  correctScore = 0;
  askedCount = 0;
  _playAgainBtn.style.display = "none";
  _checkBtn.style.display = "block";
  _checkBtn.disabled = false;
  _result.innerHTML = "";
  _options.innerHTML = "";
  setCount();
  updateProgress();
  resetTimer();

  // ensure quiz view is visible; if no category selected, go back to category screen
  if (!selectedCategory) {
    quizScreen.style.display = 'none';
    categoryScreen.style.display = 'flex';
  } else {
    categoryScreen.style.display = 'none';
    quizScreen.style.display = 'block';
    loadQuestion(selectedCategory);
  }
}
