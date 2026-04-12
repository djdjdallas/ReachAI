/**
 * Drip email sequence — sent to new paid subscribers.
 * Templates use {{full_name}} and {{app_url}} placeholders.
 */

function layout(content) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Clinchd</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f4;font-family:'Nunito',system-ui,-apple-system,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f4;">
<tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:16px;overflow:hidden;">
<!-- Header -->
<tr><td style="background-color:#ff7e67;padding:32px 40px;">
  <span style="font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">Clinchd</span>
</td></tr>
<!-- Body -->
<tr><td style="padding:40px;">
${content}
</td></tr>
<!-- Footer -->
<tr><td style="padding:24px 40px;border-top:1px solid #e7e5e4;">
  <p style="margin:0;font-size:12px;color:#a8a29e;line-height:1.5;">
    You're receiving this because you signed up for Clinchd.<br/>
    <a href="{{app_url}}/settings" style="color:#a8a29e;">Unsubscribe</a>
  </p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function button(text, href) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0;">
<tr><td style="background-color:#ff7e67;border-radius:8px;padding:14px 28px;">
  <a href="${href}" style="color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;display:inline-block;">${text}</a>
</td></tr>
</table>`;
}

export const DRIP_SEQUENCE = [
  {
    step: 1,
    delayDays: 0,
    subject: "Welcome to Clinchd \u2014 let\u2019s get your AI live in 30 minutes",
    html: layout(`
  <h1 style="margin:0 0 16px;font-size:22px;color:#1a1a1a;">Hey {{full_name}}, welcome aboard!</h1>
  <p style="margin:0 0 16px;font-size:16px;color:#44403c;line-height:1.6;">
    You just unlocked your own AI-powered DM setter. In the next 30 minutes you can have it
    qualifying leads and booking calls on autopilot.
  </p>
  <p style="margin:0 0 8px;font-size:16px;font-weight:600;color:#1a1a1a;">Here\u2019s your 3-step checklist:</p>
  <ol style="margin:0 0 16px;padding-left:20px;font-size:16px;color:#44403c;line-height:1.8;">
    <li><a href="{{app_url}}/settings" style="color:#ff7e67;text-decoration:underline;">Connect your Instagram</a></li>
    <li><a href="{{app_url}}/script" style="color:#ff7e67;text-decoration:underline;">Build your AI script</a></li>
    <li><a href="{{app_url}}/settings" style="color:#ff7e67;text-decoration:underline;">Activate your AI agent</a></li>
  </ol>
  ${button("Set Up My Account", "{{app_url}}/onboarding")}
  <p style="margin:0;font-size:14px;color:#78716c;">Need help? Just reply to this email \u2014 we read every one.</p>
`),
  },
  {
    step: 2,
    delayDays: 1,
    subject: "Your AI DM setter is waiting \u2014 here\u2019s how to train it",
    html: layout(`
  <h1 style="margin:0 0 16px;font-size:22px;color:#1a1a1a;">Time to make your AI sound like you</h1>
  <p style="margin:0 0 16px;font-size:16px;color:#44403c;line-height:1.6;">
    The script builder is where the magic happens. Tell the AI about your offer, your ideal client,
    and the questions that matter \u2014 it\u2019ll handle the rest.
  </p>
  <p style="margin:0 0 16px;font-size:16px;color:#44403c;line-height:1.6;">
    <strong>Pro tip:</strong> Use your voice profile so the AI matches your natural tone.
    Prospects can\u2019t tell it\u2019s not you.
  </p>
  ${button("Build My Script", "{{app_url}}/script")}
  <p style="margin:0;font-size:14px;color:#78716c;">
    Most users finish their script in under 10 minutes.
  </p>
`),
  },
  {
    step: 3,
    delayDays: 3,
    subject: "The coaches booking 9 calls/day are doing this one thing",
    html: layout(`
  <h1 style="margin:0 0 16px;font-size:22px;color:#1a1a1a;">They connected Calendly \u2014 and leads started booking themselves</h1>
  <p style="margin:0 0 16px;font-size:16px;color:#44403c;line-height:1.6;">
    When Clinchd qualifies a lead, it shares your Calendly link at exactly the right moment.
    No back-and-forth, no missed follow-ups \u2014 the lead books while they\u2019re still excited.
  </p>
  <p style="margin:0 0 16px;font-size:16px;color:#44403c;line-height:1.6;">
    Here\u2019s how the flow works:
  </p>
  <ol style="margin:0 0 16px;padding-left:20px;font-size:16px;color:#44403c;line-height:1.8;">
    <li>A prospect DMs you</li>
    <li>Your AI qualifies them with smart questions</li>
    <li>When they\u2019re interested, it drops your booking link</li>
    <li>You get notified and the call shows up on your calendar</li>
  </ol>
  ${button("Connect Calendly", "{{app_url}}/settings")}
`),
  },
  {
    step: 4,
    delayDays: 7,
    subject: "Quick check-in \u2014 is your AI getting results?",
    html: layout(`
  <h1 style="margin:0 0 16px;font-size:22px;color:#1a1a1a;">Hey {{full_name}}, how\u2019s it going?</h1>
  <p style="margin:0 0 16px;font-size:16px;color:#44403c;line-height:1.6;">
    You\u2019ve been on Clinchd for a week now. Pop into your dashboard to see how many leads
    your AI has qualified and how many calls have been booked.
  </p>
  <p style="margin:0 0 8px;font-size:16px;font-weight:600;color:#1a1a1a;">Quick FAQ:</p>
  <ul style="margin:0 0 16px;padding-left:20px;font-size:16px;color:#44403c;line-height:1.8;">
    <li><strong>AI sounds off?</strong> Tweak your script or update your voice profile.</li>
    <li><strong>Want to pause?</strong> Switch to Handoff mode in Settings \u2014 messages still get logged.</li>
    <li><strong>Need more DMs?</strong> Upgrade to Unlimited for uncapped conversations.</li>
  </ul>
  ${button("View My Dashboard", "{{app_url}}/dashboard")}
  <p style="margin:0;font-size:14px;color:#78716c;">
    Questions? Reply any time \u2014 we\u2019re here to help you close.
  </p>
`),
  },
];
