// Regenerates docs/BT-Warehouse-WMS-Guide.pdf from docs/WMS-GUIDE.md (A4, styled, page numbers).
// Usage: node scripts/guide-pdf.mjs
// ponytail: tiny Markdown subset (headings, lists, tables, code, quotes, bold, code spans, links), which is all
// the guide uses; switch to a real Markdown library if the guide starts using more.
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const inline = (s) =>
  esc(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
const slug = (s) =>
  s
    .replace(/[*`]/g, "")
    .toLowerCase()
    .replace(/[^\w\- ]/g, "")
    .replace(/ /g, "-");
const LIST = /^(\s*)([-*]|\d+\.) (.*)$/;
const isBlockStart = (l) => /^(#{1,6} |```|\||>|---$)/.test(l) || LIST.test(l);

function render(lines) {
  const out = [];
  for (let i = 0; i < lines.length;) {
    const l = lines[i];
    if (!l.trim()) {
      i++;
    } else if (l.startsWith("```")) {
      const code = [];
      for (i++; i < lines.length && !lines[i].startsWith("```"); i++) code.push(lines[i]);
      i++;
      out.push(`<pre>${esc(code.join("\n"))}</pre>`);
    } else if (/^#{1,6} /.test(l)) {
      const [, hashes, text] = /^(#{1,6}) (.*)$/.exec(l);
      out.push(`<h${hashes.length} id="${slug(text)}">${inline(text)}</h${hashes.length}>`);
      i++;
    } else if (/^---$/.test(l)) {
      out.push("<hr>");
      i++;
    } else if (l.startsWith("|")) {
      const rows = [];
      for (; i < lines.length && lines[i].startsWith("|"); i++) rows.push(lines[i]);
      const cells = (r) =>
        r
          .replace(/^\||\|$/g, "")
          .split("|")
          .map((c) => c.trim());
      const [head, , ...body] = rows;
      out.push(
        `<table><thead><tr>${cells(head)
          .map((c) => `<th>${inline(c)}</th>`)
          .join("")}</tr></thead><tbody>${body
          .map(
            (r) =>
              `<tr>${cells(r)
                .map((c) => `<td>${inline(c)}</td>`)
                .join("")}</tr>`,
          )
          .join("")}</tbody></table>`,
      );
    } else if (l.startsWith(">")) {
      const q = [];
      for (; i < lines.length && lines[i].startsWith(">"); i++) q.push(lines[i].replace(/^> ?/, ""));
      out.push(`<blockquote>${render(q)}</blockquote>`);
    } else if (LIST.test(l)) {
      const block = [];
      for (; i < lines.length; i++) {
        const x = lines[i];
        if (!x.trim()) {
          if (!/^\s+\S|^\s*([-*]|\d+\.) /.test(lines[i + 1] ?? "")) break;
        } else if (!LIST.test(x) && !/^\s/.test(x)) break;
        block.push(x);
      }
      out.push(list(block));
    } else {
      const p = [];
      for (; i < lines.length && lines[i].trim() && !isBlockStart(lines[i]); i++) p.push(lines[i].trim());
      out.push(`<p>${inline(p.join(" "))}</p>`);
    }
  }
  return out.join("\n");
}

/** A list block: items at the smallest indent; deeper lines belong to the item above. */
function list(block) {
  const base = Math.min(...block.filter((l) => LIST.test(l)).map((l) => LIST.exec(l)[1].length));
  const ordered = /\d/.test(LIST.exec(block.find((l) => LIST.test(l)))[2]);
  const items = [];
  for (const l of block) {
    const m = LIST.exec(l);
    if (m && m[1].length === base) items.push([m[3]]);
    else items.at(-1)?.push(l.slice(Math.min(l.search(/\S|$/), base + 3)));
  }
  const li = items.map(([first, ...rest]) => {
    // Wrapped lines right after the marker continue the item's text; a sub-list or blank line starts the rest.
    const cut = rest.findIndex((r) => !r.trim() || LIST.test(r));
    const text = [first, ...(cut < 0 ? rest : rest.slice(0, cut)).map((r) => r.trim())];
    const nested = cut < 0 ? [] : rest.slice(cut);
    return `<li>${inline(text.join(" "))}${nested.length ? render(nested) : ""}</li>`;
  });
  return ordered ? `<ol>${li.join("")}</ol>` : `<ul>${li.join("")}</ul>`;
}

const md = readFileSync("docs/WMS-GUIDE.md", "utf8").replace(/\r/g, "");
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  body { font: 10.5pt/1.5 "Segoe UI", Roboto, Arial, sans-serif; color: #1f2937; }
  h1 { font-size: 22pt; color: #1d4ed8; border-bottom: 3px solid #1d4ed8; padding-bottom: 6px; margin: 0 0 12px; }
  h2 { font-size: 15pt; color: #1d4ed8; margin: 22px 0 8px; break-after: avoid; page-break-before: always; }
  h2#contents { page-break-before: auto; }
  h3 { font-size: 12pt; margin: 16px 0 6px; break-after: avoid; }
  p, li { orphans: 3; widows: 3; }
  ul, ol { padding-left: 20px; margin: 6px 0; }
  li > p { margin: 0; }
  code { font: 9pt Consolas, monospace; background: #eef2ff; padding: 0 3px; border-radius: 3px; }
  pre { font: 9pt/1.35 Consolas, monospace; background: #f3f4f6; padding: 10px; border-radius: 6px; break-inside: avoid; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 9.5pt; break-inside: auto; }
  tr { break-inside: avoid; }
  th { background: #1d4ed8; color: #fff; text-align: left; }
  th, td { border: 1px solid #d1d5db; padding: 4px 6px; vertical-align: top; }
  tbody tr:nth-child(even) { background: #f9fafb; }
  blockquote { margin: 10px 0; padding: 6px 12px; border-left: 4px solid #f59e0b; background: #fffbeb; break-inside: avoid; }
  blockquote p { margin: 4px 0; }
  hr { border: 0; border-top: 1px solid #e5e7eb; margin: 16px 0; }
  a { color: #1d4ed8; text-decoration: none; }
</style></head><body>${render(md.split("\n"))}</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(html, { waitUntil: "load" });
await page.pdf({
  path: "docs/BT-Warehouse-WMS-Guide.pdf",
  format: "A4",
  printBackground: true,
  margin: { top: "18mm", bottom: "18mm", left: "16mm", right: "16mm" },
  displayHeaderFooter: true,
  headerTemplate: `<div style="font-size:7.5pt;width:100%;padding:0 16mm;color:#6b7280;text-align:right">BT Warehouse WMS · complete guide</div>`,
  footerTemplate: `<div style="font-size:7.5pt;width:100%;text-align:center;color:#6b7280">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>`,
});
await browser.close();
console.log("docs/BT-Warehouse-WMS-Guide.pdf written");
