// Summer 2026 program packages — shared between index.html and register.html
const SUMMER_PROGRAMS = [
  {
    id: 'sat-over-aug',
    abbrev: 'OVERSPEED',
    day: 'Saturday',
    name: 'Overspeed',
    month: 'August',
    sessionsCount: 5,
    dropIn: 55,
    programRate: 225,
    amountCents: 22500,
    ageGroup: 'U7–U18',
    location: null,
    times: [
      { time: '3:00–3:50 PM', age: 'U7–U9' },
      { time: '4:00–4:50 PM', age: 'U11–U13' },
      { time: '5:00–5:50 PM', age: 'U15–U18' },
    ],
    dates: ['Aug 1', 'Aug 8', 'Aug 15', 'Aug 22', 'Aug 29'],
    timeOverrides: {
      'Aug 22': {
        '3:00–3:50 PM': '3:30–4:20 PM',
        '4:00–4:50 PM': '4:30–5:20 PM',
        '5:00–5:50 PM': '5:30–6:20 PM',
      },
    },
    skills: ['Edge control', 'Dynamic skating', 'Speed and power'],
    notes: 'Aug 22 times shift: 3:30–4:20 PM (U7–U9) · 4:30–5:20 PM (U11–U13) · 5:30–6:20 PM (U15–U18).',
    desc: 'Five-session August Overspeed package. Max your edge work and acceleration heading into the fall season with Bronko resistance training.',
  },
  {
    id: 'sun-pep-aug',
    abbrev: 'PEP',
    day: 'Sunday',
    name: 'Power Edge Pro',
    month: 'August',
    sessionsCount: 5,
    dropIn: 55,
    programRate: 225,
    amountCents: 22500,
    ageGroup: 'U7–U18',
    location: null,
    times: [
      { time: '3:00–3:50 PM', age: 'U7–U9' },
      { time: '4:00–4:50 PM', age: 'U11–U13' },
      { time: '5:00–5:50 PM', age: 'U15–U18' },
    ],
    dates: ['Aug 2', 'Aug 9', 'Aug 16', 'Aug 23', 'Aug 30'],
    skills: ['Edge control', 'Stick handling', 'Dynamic skating', 'High tempo drills', 'Conditioning'],
    notes: null,
    desc: 'Five-session August Power Edge Pro package, the most effective skating system available. Enter the fall season ahead of the competition.',
  },
];

// --- Session ID helpers (mirrors stripe-webhook.js logic) ---

const _MONTH_NUM = {
  Jan:1, Feb:2, Mar:3, Apr:4, May:5, Jun:6,
  Jul:7, Aug:8, Sep:9, Oct:10, Nov:11, Dec:12,
  January:1, February:2, March:3, April:4, June:6,
  July:7, August:8, September:9, October:10, November:11, December:12,
};

function _summerDateToId(dateStr) {
  const [monthToken, day] = dateStr.trim().split(' ');
  const mm = String(_MONTH_NUM[monthToken] || 0).padStart(2, '0');
  const dd = String(parseInt(day, 10)).padStart(2, '0');
  return `${mm}-${dd}-26`;
}

function _summerTimeTo24h(timeStr) {
  const startPart = timeStr.split(/[–\-]/)[0].trim();
  const isPM      = /pm/i.test(timeStr);
  const [hStr, mStr = '0'] = startPart.replace(/[apm]/gi, '').trim().split(':');
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (isPM && h !== 12) h += 12;
  if (!isPM && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// Returns all session IDs associated with a program (all dates × all time slots).
function getSummerSessionIds(prog) {
  const ids = [];
  prog.dates.forEach(date => {
    prog.times.forEach(({ time }) => {
      const override = prog.timeOverrides && prog.timeOverrides[date] && prog.timeOverrides[date][time];
      const resolvedTime = override || time;
      const timeCode = _summerTimeTo24h(resolvedTime);
      ids.push(`${prog.abbrev}_${_summerDateToId(date)}_${timeCode}`);
    });
  });
  return ids;
}

// Returns { [time]: [sessionIds] } — one entry per time slot, with all dates' IDs for that slot.
function getSummerSessionIdsByTime(prog) {
  const byTime = {};
  prog.times.forEach(({ time }) => {
    byTime[time] = prog.dates.map(date => {
      const override = prog.timeOverrides && prog.timeOverrides[date] && prog.timeOverrides[date][time];
      const resolvedTime = override || time;
      const timeCode = _summerTimeTo24h(resolvedTime);
      return `${prog.abbrev}_${_summerDateToId(date)}_${timeCode}`;
    });
  });
  return byTime;
}

// Render summer program cards into a container element.
// onCardClick(prog) is called when the user clicks a non-sold-out card.
// ctaLabel controls the button text (default: 'Details').
function renderSummerCards(containerId, onCardClick, ctaLabel = 'Details') {
  const container = document.getElementById(containerId);
  if (!container) return;
  SUMMER_PROGRAMS.forEach(prog => {
    const card = document.createElement('article');
    card.className = 'summer-card';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.dataset.programId = prog.id;
    card.innerHTML = `
      <div class="summer-card-header">
        <span class="summer-card-month-badge">${prog.month}</span>
        <span class="summer-card-day">${prog.day}</span>
        <h3 class="summer-card-name">${prog.name}</h3>
        <span class="summer-card-sessions-tag">${prog.sessionsCount} sessions &middot; ${prog.ageGroup}</span>
      </div>
      <div class="summer-card-body">
        <p class="summer-card-desc">${prog.desc}</p>
        <div class="summer-card-meta">
          <div class="summer-card-price">
            $${prog.programRate}
            <span>for ${prog.sessionsCount} sessions</span>
          </div>
          <div class="summer-card-cta-col">
            <span class="btn btn-accent-outline summer-card-cta">${ctaLabel}</span>
          </div>
        </div>
      </div>
    `;
    const handler = () => { onCardClick(prog); };
    card.addEventListener('click', handler);
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(); }
    });
    container.appendChild(card);
  });
}

// Build the inner HTML for the summer info/details modal.
// ctaHtml: HTML string for the CTA area (differs between index.html and register.html).
// spotsPerTime: optional { [time]: spotsRemaining } for per-age-group availability display.
// spotsStatus: 'loading' | 'done' | 'error' — controls the availability UI state.
function buildSummerModalContent(prog, ctaHtml, spotsPerTime, spotsStatus) {
  const timesHtml = prog.times.map(t => {
    let spotsHtml = '';
    if (spotsStatus === 'loading') {
      spotsHtml = `<span class="summer-modal-time-spots summer-modal-time-spots--loading" aria-label="Checking availability"></span>`;
    } else if (spotsStatus === 'done' && spotsPerTime && t.time in spotsPerTime) {
      const spots = spotsPerTime[t.time];
      if (spots <= 0) {
        spotsHtml = `<span class="summer-modal-time-spots summer-modal-time-spots--full">Sold Out</span>`;
      } else {
        spotsHtml = `<span class="summer-modal-time-spots">${spots} spot${spots !== 1 ? 's' : ''} left</span>`;
      }
    }
    return `
    <div class="summer-modal-time-row">
      <span class="summer-modal-time-val">${t.time}</span>
      <span class="summer-modal-time-right">
        ${t.age ? `<span class="summer-modal-time-age">${t.age}</span>` : ''}
        ${spotsHtml}
      </span>
    </div>`;
  }).join('');

  const spotsErrorHtml = spotsStatus === 'error'
    ? `<p class="summer-modal-spots-error">Unable to fetch spots remaining. Please contact Jacob to register.</p>`
    : '';

  const datesHtml = prog.dates.map(d =>
    `<span class="summer-modal-date-pill">${d}</span>`).join('');

  const skillsHtml = prog.skills.map(s =>
    `<span class="summer-modal-skill-tag">${s}</span>`).join('');

  const savings = prog.dropIn * prog.sessionsCount - prog.programRate;

  const locationHtml = prog.location ? `
    <div class="summer-modal-sec">
      <p class="summer-modal-sec-label">Location</p>
      <p style="font-size:0.875rem;color:var(--text-muted);margin:0">${prog.location}</p>
    </div>` : '';

  const notesHtml = prog.notes
    ? `<p class="summer-modal-note" style="margin-top:0.5rem">${prog.notes}</p>`
    : '';

  return `
    <div>
      <p class="summer-modal-eyebrow">${prog.day} &middot; ${prog.month} 2026</p>
      <h2 class="summer-modal-title" id="summer-modal-title">${prog.name}</h2>
    </div>
    <div class="summer-modal-sec">
      <p class="summer-modal-sec-label">Session Dates</p>
      <div class="summer-modal-date-pills">${datesHtml}</div>
    </div>
    <div class="summer-modal-sec">
      <p class="summer-modal-sec-label">Class Times${prog.times.length > 1 ? ' by Age Group' : ''}</p>
      ${timesHtml}
      ${notesHtml}
      ${spotsErrorHtml}
    </div>
    ${locationHtml}
    <div class="summer-modal-sec">
      <p class="summer-modal-sec-label">Skills Covered</p>
      <div class="summer-modal-skill-tags">${skillsHtml}</div>
    </div>
    <div class="summer-modal-sec">
      <p class="summer-modal-sec-label">Pricing</p>
      <div class="summer-modal-pricing">
        <div class="summer-modal-price-box">
          <p class="summer-modal-price-box-label">Drop-In Rate</p>
          <p class="summer-modal-price-box-amount">$${prog.dropIn}</p>
          <p class="summer-modal-price-box-detail">per session</p>
        </div>
        <div class="summer-modal-price-box summer-modal-price-box--accent">
          <p class="summer-modal-price-box-label">Program Rate</p>
          <p class="summer-modal-price-box-amount">$${prog.programRate}</p>
          <p class="summer-modal-price-box-detail">all ${prog.sessionsCount} sessions &middot; save $${savings}</p>
        </div>
      </div>
    </div>
    ${ctaHtml}
  `;
}
