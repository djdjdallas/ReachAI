/**
 * Drip email sequence — sent to new paid subscribers.
 * Templates use {{full_name}} and {{app_url}} placeholders.
 *
 * Design system: Cabinet Grotesk headings, Satoshi body, stone palette,
 * coral #ff7e67 primary, rounded-full buttons, pill badges.
 */

function layout({ badge, content }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<style>@import url('https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@700,800&f[]=satoshi@300,400,500,700&display=swap');</style>
</head>
<body style="margin:0;padding:0;background-color:#fafaf9;font-family:'Satoshi',system-ui,-apple-system,'Segoe UI',sans-serif;-webkit-font-smoothing:antialiased;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fafaf9;">
<tr><td align="center" style="padding:48px 16px 40px;">

<!-- Card -->
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:24px;overflow:hidden;border:1px solid #e7e5e4;">

<!-- Header -->
<tr><td style="padding:36px 40px 0;">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
    <td style="vertical-align:middle;padding-right:10px;">
      <img src="{{app_url}}/logo.png" alt="Clinchd" width="36" height="36" style="display:block;border-radius:8px;" />
    </td>
    <td style="vertical-align:middle;">
      <span style="font-family:'Cabinet Grotesk','Satoshi',system-ui,sans-serif;font-size:20px;font-weight:800;color:#1c1917;letter-spacing:-0.02em;">Clinchd</span>
    </td>
  </tr></table>
</td></tr>

<!-- Body -->
<tr><td style="padding:32px 40px 40px;">
  ${badge ? `<!-- Badge -->
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:24px;"><tr>
    <td style="background-color:#fff5f2;border:1px solid rgba(255,126,103,0.1);border-radius:999px;padding:6px 14px;">
      <span style="font-size:13px;font-weight:700;color:#ff7e67;letter-spacing:-0.01em;">${badge}</span>
    </td>
  </tr></table>` : ""}
${content}
</td></tr>

<!-- Footer -->
<tr><td style="padding:24px 40px;background-color:#f5f5f4;border-top:1px solid #e7e5e4;">
  <p style="margin:0;font-size:12px;color:#a8a29e;line-height:1.5;">
    You're receiving this because you signed up for Clinchd.<br/>
    <a href="{{app_url}}/settings" style="color:#a8a29e;text-decoration:underline;">Unsubscribe</a> &middot;
    <a href="https://www.clinchd.io" style="color:#a8a29e;text-decoration:underline;">clinchd.io</a>
  </p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

function h1(text) {
  return `<h1 style="margin:0 0 16px;font-family:'Cabinet Grotesk','Satoshi',system-ui,sans-serif;font-size:28px;font-weight:800;color:#1c1917;letter-spacing:-0.02em;line-height:1.15;">${text}</h1>`;
}

function p(text) {
  return `<p style="margin:0 0 20px;font-size:16px;color:#78716c;line-height:1.7;font-weight:500;">${text}</p>`;
}

function button(text, href) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:32px 0 0;">
<tr><td style="background-color:#ff7e67;border-radius:999px;padding:16px 32px;box-shadow:0 8px 24px rgba(255,126,103,0.3);">
  <a href="${href}" style="color:#ffffff;font-family:'Satoshi',system-ui,sans-serif;font-size:16px;font-weight:700;text-decoration:none;display:inline-block;">${text} &rarr;</a>
</td></tr>
</table>`;
}

function divider() {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr><td style="border-top:1px solid #e7e5e4;"></td></tr></table>`;
}

function checklist(items) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:8px 0 0;">
${items
  .map(
    (item, i) => `<tr>
  <td style="padding:12px 16px;${i < items.length - 1 ? "border-bottom:1px solid #f5f5f4;" : ""}vertical-align:top;" width="36">
    <span style="display:inline-block;width:28px;height:28px;line-height:28px;text-align:center;background-color:#fff5f2;color:#ff7e67;font-weight:700;font-size:13px;border-radius:999px;">${i + 1}</span>
  </td>
  <td style="padding:12px 8px;${i < items.length - 1 ? "border-bottom:1px solid #f5f5f4;" : ""}vertical-align:middle;">
    <span style="font-size:15px;color:#1c1917;font-weight:600;">${item.title}</span>
    ${item.link ? `<br/><a href="${item.link}" style="font-size:13px;color:#ff7e67;font-weight:500;text-decoration:none;">${item.linkText || "Go"} &rarr;</a>` : ""}
  </td>
</tr>`
  )
  .join("")}
</table>`;
}

function tipBox(text) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
<tr><td style="background-color:#fff5f2;border-radius:12px;padding:16px 20px;border:1px solid rgba(255,126,103,0.1);">
  <p style="margin:0;font-size:14px;color:#1c1917;line-height:1.6;font-weight:500;">${text}</p>
</td></tr>
</table>`;
}

export const DRIP_SEQUENCE = [
  {
    step: 1,
    delayDays: 0,
    subject: "Welcome to Clinchd \u2014 let\u2019s get your AI live in 30 minutes",
    html: layout({
      badge: "Welcome to Clinchd",
      content: `
  ${h1("Hey {{full_name}}, welcome aboard!")}
  ${p("You just unlocked your AI-assisted DM setter. In the next 30 minutes you can have it qualifying leads and booking discovery calls on your behalf.")}
  ${p("<strong style=\"color:#1c1917;\">Here\u2019s your 3-step setup:</strong>")}
  ${checklist([
    { title: "Connect your Instagram", link: "{{app_url}}/settings", linkText: "Connect" },
    { title: "Build your AI script", link: "{{app_url}}/script", linkText: "Build script" },
    { title: "Activate your AI agent", link: "{{app_url}}/settings", linkText: "Go live" },
  ])}
  ${button("Set Up My Account", "{{app_url}}/onboarding")}
  ${divider()}
  ${p("<span style=\"font-size:14px;color:#a8a29e;\">Need help? Just reply to this email \u2014 we read every one.</span>")}
`,
    }),
  },
  {
    step: 2,
    delayDays: 1,
    subject: "Your AI DM setter is waiting \u2014 here\u2019s how to train it",
    html: layout({
      badge: "Step 2 \u00B7 Script Builder",
      content: `
  ${h1("Time to make your AI sound like you")}
  ${p("The script builder is where the magic happens. Tell the AI about your offer, your ideal client, and the questions that matter \u2014 it\u2019ll handle the rest.")}
  ${tipBox("<strong>\uD83D\uDCA1 Pro tip:</strong> Use your voice profile so the AI matches your natural tone. Prospects can\u2019t tell it\u2019s not you.")}
  ${button("Build My Script", "{{app_url}}/script")}
  ${divider()}
  ${p("<span style=\"font-size:14px;color:#a8a29e;\">Most users finish their script in under 10 minutes.</span>")}
`,
    }),
  },
  {
    step: 3,
    delayDays: 3,
    subject: "The coaches booking 9 calls/day are doing this one thing",
    html: layout({
      badge: "Step 3 \u00B7 Calendly",
      content: `
  ${h1("They connected Calendly \u2014 and leads started booking themselves")}
  ${p("When Clinchd qualifies a lead, it shares your Calendly link at exactly the right moment. No back-and-forth, no missed follow-ups \u2014 the lead books while they\u2019re still excited.")}
  ${p("<strong style=\"color:#1c1917;\">Here\u2019s how the flow works:</strong>")}
  ${checklist([
    { title: "A prospect DMs you on Instagram" },
    { title: "Your AI qualifies them with smart questions" },
    { title: "When they\u2019re interested, it drops your booking link" },
    { title: "You get notified and the call shows up on your calendar" },
  ])}
  ${button("Connect Calendly", "{{app_url}}/settings")}
`,
    }),
  },
  {
    step: 4,
    delayDays: 7,
    subject: "Quick check-in \u2014 is your AI getting results?",
    html: layout({
      badge: "Your first week",
      content: `
  ${h1("Hey {{full_name}}, how\u2019s it going?")}
  ${p("You\u2019ve been on Clinchd for a week now. Pop into your dashboard to see how many leads your AI has qualified and how many calls have been booked.")}
  ${p("<strong style=\"color:#1c1917;\">Quick FAQ:</strong>")}
  ${tipBox("<strong>AI sounds off?</strong> Tweak your script or update your voice profile.")}
  ${tipBox("<strong>Want to pause?</strong> Switch to Handoff mode in Settings \u2014 messages still get logged.")}
  ${tipBox("<strong>Need more DMs?</strong> Upgrade to Unlimited for uncapped conversations.")}
  ${button("View My Dashboard", "{{app_url}}/dashboard")}
  ${divider()}
  ${p("<span style=\"font-size:14px;color:#a8a29e;\">Questions? Reply any time \u2014 we\u2019re here to help you close.</span>")}
`,
    }),
  },
];
