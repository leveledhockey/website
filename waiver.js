(function () {
  var html =
    '<p class="waiver-org">Leveled Hockey Development</p>' +
    '<p class="waiver-title">Participant Waiver, Liability Release &amp; Media Consent Agreement</p>' +

    '<h4>1. Assumption of Risk</h4>' +
    '<p>I acknowledge that participation in hockey training, skating, and athletic development activities involves inherent risks, including but not limited to:</p>' +
    '<ul>' +
      '<li>Falls, collisions with players, boards, glass, or equipment</li>' +
      '<li>Injuries from sticks, pucks, or other objects</li>' +
      '<li>Strains, sprains, fractures, concussions, or other physical injuries</li>' +
      '<li>Risks associated with high-speed skating, shooting, and competitive drills</li>' +
    '</ul>' +
    '<p>I fully understand these risks and voluntarily assume all responsibility for any injury, loss, or damage that may occur as a result of participation.</p>' +

    '<h4>2. Release of Liability</h4>' +
    '<p>In consideration for participation in Leveled Hockey Development programs, I hereby release, waive, and discharge:</p>' +
    '<ul>' +
      '<li>Leveled Hockey Development</li>' +
      '<li>Its owners, coaches, staff, contractors, and affiliates</li>' +
      '<li>Any facility operators where sessions are conducted</li>' +
    '</ul>' +
    '<p>from any and all liability, claims, demands, or causes of action arising out of or related to participation. This includes, but is not limited to:</p>' +
    '<ul>' +
      '<li>Personal injury</li>' +
      '<li>Property damage</li>' +
      '<li>Losses arising from negligence or any other cause permitted by law</li>' +
    '</ul>' +

    '<h4>3. Medical Responsibility &amp; Emergency Authorization</h4>' +
    '<p>I confirm that the participant is physically fit and able to safely participate in hockey activities and has no medical conditions that would increase risk (or such conditions have been disclosed). In the event of injury or medical emergency, I authorize Leveled Hockey Development staff to administer basic first aid and seek emergency medical treatment if deemed necessary. I accept full financial responsibility for any medical care required.</p>' +

    '<h4>4. Conduct &amp; Safety Requirements</h4>' +
    '<ul>' +
      '<li>Participants must follow all instructions from coaches and staff at all times</li>' +
      '<li>Full, CSA-approved hockey equipment is required</li>' +
      '<li>Unsafe, reckless, or disruptive behavior may result in removal without refund</li>' +
    '</ul>' +

    '<h4>5. Media, Filming &amp; Promotional Release</h4>' +
    '<p>I grant permission for the participant to be filmed, photographed, and recorded (video and audio) during any Leveled Hockey Development sessions. I acknowledge and agree that:</p>' +
    '<ul>' +
      '<li>All media content is the exclusive property of Leveled Hockey Development</li>' +
      '<li>Content may be used for marketing, advertising, and promotional purposes</li>' +
      '<li>Content may be distributed across all platforms (including social media, websites, and digital advertising)</li>' +
      '<li>No compensation will be provided now or in the future</li>' +
      '<li>Participant names are not required to be displayed</li>' +
      '<li>I waive any right to inspect or approve final media content</li>' +
    '</ul>' +

    '<h4>6. Indemnification</h4>' +
    '<p>I agree to indemnify and hold harmless Leveled Hockey Development and its affiliates from any claims, damages, or expenses (including legal fees) arising from the participant\'s actions, breach of this agreement, or any third-party claims related to participation.</p>' +

    '<h4>7. Business Status &amp; Insurance</h4>' +
    '<p>Leveled Hockey Development operates as a licensed and insured business with qualified coaching staff, active liability insurance coverage, and structured development programming.</p>' +

    '<h4>8. Governing Law</h4>' +
    '<p>This agreement shall be governed by and interpreted in accordance with the laws of the Province of British Columbia, Canada.</p>' +

    '<h4>9. Cancellation &amp; Refund Policy</h4>' +
    '<p><strong>Drop-In Sessions</strong></p>' +
    '<ul>' +
      '<li><strong>Full Refund:</strong> Cancellations made 48 hours or more before the scheduled session start time will receive a full refund.</li>' +
      '<li><strong>No Refund or Credit:</strong> Cancellations made within 48 hours of the session, as well as missed sessions (no-shows), are not eligible for a refund or account credit.</li>' +
    '</ul>' +
    '<p><strong>Summer Programs</strong></p>' +
    '<ul>' +
      '<li><strong>Full Refund:</strong> Cancellations made 7 or more days before the first scheduled class will receive a full refund.</li>' +
      '<li><strong>50% Refund:</strong> Cancellations made 3–6 days before the first scheduled class will receive a 50% refund.</li>' +
      '<li><strong>No Refund or Make-Up Classes:</strong> Cancellations made less than 3 days before the first class, or failure to attend the program, are not eligible for a refund, credit, or make-up classes.</li>' +
    '</ul>' +
    '<p>By registering for any Leveled Hockey Development program or session, participants acknowledge and agree to this cancellation policy.</p>' +

    '<h4>10. Acknowledgment &amp; Consent</h4>' +
    '<p>By checking below, I confirm that I have read and fully understand this agreement, I voluntarily agree to all terms and conditions, I am the legal parent/guardian of the participant (if under 18), and I provide full consent for participation and media use.</p>';

  document.querySelectorAll('[data-waiver-content]').forEach(function (el) {
    el.innerHTML = html;
  });
})();
