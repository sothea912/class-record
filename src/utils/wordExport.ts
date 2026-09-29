import { esc } from './helpers';

export function buildWordDoc(title: string, subtitle: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${esc(title)}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom><w:DoNotOptimizeForBrowser/></w:WordDocument></xml><![endif]-->
<style>
  @page{size:21cm 29.7cm;margin:2cm 1.8cm}
  body{font-family:Calibri,'Segoe UI',Arial,sans-serif;font-size:11pt;color:#10243A;line-height:1.4}
  h1{font-size:18pt;color:#0B3C71;margin:0 0 4pt;font-weight:bold}
  h2{font-size:13pt;color:#1565C0;margin:14pt 0 6pt;font-weight:bold}
  .sub{color:#5B7592;font-size:10pt;margin:0}
  .banner{border-bottom:2pt solid #1565C0;padding-bottom:8pt;margin-bottom:14pt}
  table{border-collapse:collapse;width:100%;margin-top:6pt;margin-bottom:12pt}
  th,td{border:1pt solid #CFE1F5;padding:6pt 8pt;font-size:10pt;text-align:left}
  th{background:#E8F1FB;color:#0B3C71;font-weight:bold}
  td.num,th.num{text-align:right}
  .muted{color:#5B7592;font-size:9pt}
  .stats{border-collapse:collapse;margin:8pt 0}
  .stats td{border:0;padding:4pt 18pt 4pt 0;font-size:10.5pt}
  .badge-pass{color:#1B8A5A;font-weight:bold}
  .badge-fail{color:#C0392B;font-weight:bold}
</style></head>
<body>
  <div class="banner">
    <h1>${esc(title)}</h1>
    <p class="sub">${subtitle}</p>
  </div>
  ${bodyHtml}
</body>
</html>`;
}

export function downloadWordDoc(filename: string, title: string, subtitle: string, bodyHtml: string): void {
  const html = buildWordDoc(title, subtitle, bodyHtml);
  const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.doc') ? filename : filename + '.doc';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
