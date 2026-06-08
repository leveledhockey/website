// Summer 2026 program packages — shared between index.html and register.html
const SUMMER_PROGRAMS = [
  {
    id: 'tue-puck-jul',
    day: 'Tuesday',
    name: 'Puck Skills',
    month: 'July',
    sessionsCount: 3,
    dropIn: 55,
    programRate: 130,
    amountCents: 13000,
    ageGroup: '2017–2014',
    location: 'Canlan Sports North Shore',
    times: [{ time: '2:45–3:35 PM', age: null }],
    dates: ['July 7', 'July 14', 'July 21'],
    skills: ['Dynamic skating & puck control', 'Stickhandling', 'Passing', 'Shooting', 'Small area games'],
    notes: null,
    desc: 'Offensive puck skills under pressure — stickhandling in tight areas, passing, shooting, and small area games to build real game confidence.',
  },
  {
    id: 'thu-def-jul',
    day: 'Thursday',
    name: 'Defensive Skills',
    month: 'July',
    sessionsCount: 3,
    dropIn: 55,
    programRate: 130,
    amountCents: 13000,
    ageGroup: '2017–2014',
    location: 'Canlan Sports North Shore',
    times: [{ time: '2:45–3:35 PM', age: null }],
    dates: ['July 9', 'July 16', 'July 23'],
    skills: ['Defensive dynamic skating', 'Situational drills', 'Shooting', 'Small area games'],
    notes: null,
    desc: 'Sharpen your defensive game — zone skating, puck control under pressure, situational drills, and small area games for a complete two-way player.',
  },
  {
    id: 'sat-over-jul',
    day: 'Saturday',
    name: 'Overspeed',
    month: 'July',
    sessionsCount: 3,
    dropIn: 55,
    programRate: 150,
    amountCents: 15000,
    ageGroup: 'U7–U18',
    location: null,
    times: [
      { time: '3:00–3:50 PM', age: 'U7–U9' },
      { time: '4:00–4:50 PM', age: 'U11–U13' },
      { time: '5:00–5:50 PM', age: 'U15–U18' },
    ],
    dates: ['July 11', 'July 18', 'July 25'],
    skills: ['Edge control', 'Dynamic skating', 'Speed and power'],
    notes: null,
    desc: 'Power skating combined with Bronko resistance training. Build stride strength, acceleration, and top-end speed across all age groups.',
  },
  {
    id: 'sat-over-aug',
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
    skills: ['Edge control', 'Dynamic skating', 'Speed and power'],
    notes: 'Aug 22 times shift: 3:30–4:20 PM (U7–U9) · 4:30–5:20 PM (U11–U13) · 5:30–6:20 PM (U15–U18).',
    desc: 'Five-session August Overspeed package. Max your edge work and acceleration heading into the fall season with Bronko resistance training.',
  },
  {
    id: 'sun-pep-jul',
    day: 'Sunday',
    name: 'Power Edge Pro',
    month: 'July',
    sessionsCount: 3,
    dropIn: 55,
    programRate: 150,
    amountCents: 15000,
    ageGroup: 'U7–U18',
    location: null,
    times: [
      { time: '3:00–3:50 PM', age: 'U7–U9' },
      { time: '4:00–4:50 PM', age: 'U11–U13' },
      { time: '5:00–5:50 PM', age: 'U15–U18' },
    ],
    dates: ['July 12', 'July 19', 'July 26'],
    skills: ['Edge control', 'Stick handling', 'Dynamic skating', 'High tempo drills', 'Conditioning'],
    notes: null,
    desc: 'Led by a Certified PEP Instructor. High-rep edge and puck work that builds elite skating mechanics and conditioning — more reps per session than any traditional practice.',
  },
  {
    id: 'sun-pep-aug',
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
    desc: 'Five-session August Power Edge Pro package — the most effective skating system available. Enter the fall season ahead of the competition.',
  },
];

// Render summer program cards into a container element.
// onCardClick(prog) is called when the user clicks a card.
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
          <span class="btn btn-accent-outline summer-card-cta">${ctaLabel}</span>
        </div>
      </div>
    `;
    const handler = () => onCardClick(prog);
    card.addEventListener('click', handler);
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(); }
    });
    container.appendChild(card);
  });
}

// Build the inner HTML for the summer info/details modal.
// ctaHtml: HTML string for the CTA area (differs between index.html and register.html).
function buildSummerModalContent(prog, ctaHtml) {
  const timesHtml = prog.times.map(t => `
    <div class="summer-modal-time-row">
      <span class="summer-modal-time-val">${t.time}</span>
      ${t.age ? `<span class="summer-modal-time-age">${t.age}</span>` : ''}
    </div>`).join('');

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
