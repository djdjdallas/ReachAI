// Leaf module, no imports. The one support / founder address. Every
// user-facing "contact us" link, every founder/ops alert, and the reply-to
// on every email the app sends use this. (clinchd.com has no MX record and
// privacy@clinchd.io doesn't exist; only this inbox does.)

export const SUPPORT_EMAIL = "dom@clinchd.io";

export const SUPPORT_MAILTO = `mailto:${SUPPORT_EMAIL}`;
