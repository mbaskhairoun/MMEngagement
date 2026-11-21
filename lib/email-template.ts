import { wedding } from "@/content/wedding";

export const PALETTE = {
  page: "#FBF8F1",
  card: "#FFFDF8",
  blue: "#B9D7E6",
  blueDeep: "#8FB8CF",
  tint: "#F2F8FB",
  text: "#2F4F5F",
  muted: "#6B8794",
} as const;

export const SERIF = "'Cormorant Garamond', Georgia, 'Times New Roman', serif";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export const eyebrow = (text: string, extra = "") =>
  `<p style="margin:0 0 6px 0;font-family:${SERIF};font-size:12px;letter-spacing:3px;text-transform:uppercase;color:${PALETTE.blueDeep};${extra}">${text}</p>`;

export const paragraph = (html: string, extra = "") =>
  `<p style="margin:0 0 16px 0;font-family:${SERIF};font-size:17px;line-height:1.7;color:${PALETTE.text};${extra}">${html}</p>`;

export const rule = (width = 120) =>
  `<table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;"><tr><td style="width:${width}px;height:1px;background-color:${PALETTE.blue};font-size:0;line-height:0;">&nbsp;</td></tr></table>`;

export const button = (href: string, label: string, filled: boolean) =>
  `<a href="${escapeHtml(href)}" target="_blank" style="display:inline-block;margin:4px;padding:12px 26px;font-family:${SERIF};font-size:13px;letter-spacing:2px;text-transform:uppercase;text-decoration:none;border:1px solid ${PALETTE.blueDeep};${
    filled ? `background-color:${PALETTE.blueDeep};color:#FFFFFF;` : `background-color:${PALETTE.card};color:${PALETTE.text};`
  }">${escapeHtml(label)}</a>`;

export type LayoutOptions = {
  headerLabel: string;
  greeting: string;
  preheader: string;
  contentHtml: string;
  footerMessage: string;
  footnote?: string;
};

/** Table-based 600px shell with inline styles; all text inputs must already be HTML-safe. */
export function renderLayout(o: LayoutOptions): string {
  const year = wedding.date.iso.slice(0, 4);
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>${o.headerLabel} — ${escapeHtml(wedding.couple.display)}</title>
<style>@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&display=swap');</style>
</head>
<body style="margin:0;padding:0;background-color:${PALETTE.page};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${o.preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${PALETTE.page};">
<tr><td align="center" style="padding:36px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:${PALETTE.card};border:1px solid ${PALETTE.blue};">
<tr><td style="height:3px;background-color:${PALETTE.blue};font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td style="padding:44px 40px 12px 40px;" align="center">
${eyebrow(o.headerLabel, "letter-spacing:4px;margin-bottom:18px;")}
<h1 style="margin:0 0 18px 0;font-family:${SERIF};font-size:38px;font-weight:400;font-style:italic;color:${PALETTE.text};line-height:1.2;">${o.greeting}</h1>
${rule(140)}
</td></tr>
<tr><td style="padding:24px 40px 8px 40px;font-family:${SERIF};font-size:17px;line-height:1.7;color:${PALETTE.text};">
${o.contentHtml}
</td></tr>
<tr><td align="center" style="padding:16px 40px 40px 40px;">
${rule(80)}
<p style="margin:20px 0 6px 0;font-family:${SERIF};font-size:16px;font-style:italic;color:${PALETTE.muted};">${o.footerMessage}</p>
<p style="margin:0 0 18px 0;font-family:${SERIF};font-size:30px;font-style:italic;color:${PALETTE.text};">${escapeHtml(wedding.couple.display)}</p>
<p style="margin:0;font-family:${SERIF};font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${PALETTE.blueDeep};">${escapeHtml(wedding.date.weekday)} · ${escapeHtml(wedding.date.display)}</p>
${o.footnote ? `<p style="margin:16px 0 0 0;font-family:${SERIF};font-size:12px;line-height:1.6;color:${PALETTE.muted};">${o.footnote}</p>` : ""}
<p style="margin:12px 0 0 0;font-family:${SERIF};font-size:11px;color:${PALETTE.muted};">&copy; ${year} · With love</p>
</td></tr>
<tr><td style="height:3px;background-color:${PALETTE.blue};font-size:0;line-height:0;">&nbsp;</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}
