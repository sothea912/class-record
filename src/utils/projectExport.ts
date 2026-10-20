import ExcelJS from 'exceljs';
import { ProjectItem, ProjectResult, StudentItem } from '../types';

/**
 * Downloads a styled Excel (.xlsx) spreadsheet matching the teacher's
 * "Presentation Project - Speaking Scoring Sheet"
 */
export async function exportProjectExcel(
  project: ProjectItem,
  className: string,
  schoolName: string,
  teacherName: string,
  students: StudentItem[],
  results: ProjectResult[]
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Scoring Sheet');

  worksheet.views = [{ showGridLines: true }];

  // 1. Title Block
  const row1 = worksheet.getRow(1);
  row1.height = 28;
  const cTitle = row1.getCell(1);
  cTitle.value = `${project.name} - Scoring Sheet`;
  cTitle.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF305496' } };

  const row2 = worksheet.getRow(2);
  row2.height = 18;
  row2.getCell(1).value = 'Class:';
  row2.getCell(1).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF5B7592' } };
  row2.getCell(2).value = className;
  row2.getCell(2).font = { name: 'Calibri', size: 10, bold: true };

  row2.getCell(4).value = 'Date:';
  row2.getCell(4).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF5B7592' } };
  row2.getCell(5).value = project.date || 'N/A';
  row2.getCell(5).font = { name: 'Calibri', size: 10, bold: true };

  const row3 = worksheet.getRow(3);
  row3.height = 18;
  row3.getCell(1).value = 'School:';
  row3.getCell(1).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF5B7592' } };
  row3.getCell(2).value = schoolName || 'Central Academy';
  row3.getCell(2).font = { name: 'Calibri', size: 10 };

  row3.getCell(4).value = 'Teacher:';
  row3.getCell(4).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF5B7592' } };
  row3.getCell(5).value = teacherName || 'Instructor';
  row3.getCell(5).font = { name: 'Calibri', size: 10 };

  const row4 = worksheet.getRow(4);
  row4.height = 18;
  row4.getCell(1).value = 'Total Max Mark:';
  row4.getCell(1).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF5B7592' } };
  row4.getCell(2).value = `${project.totalMax} pts`;
  row4.getCell(2).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF107C41' } };

  // Empty separator
  worksheet.getRow(5).height = 10;

  // 2. Table Headers (Row 6)
  const headerRow = worksheet.getRow(6);
  headerRow.height = 28;

  const headers: string[] = ['No.', 'Student Name', 'Topic'];
  project.criteria.forEach(c => {
    headers.push(`${c.name} (${c.maxMark})`);
  });
  headers.push(`TOTAL (${project.totalMax})`);
  headers.push('Comments / Remarks');

  headers.forEach((h, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = h;
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF305496' },
    };
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = {
      vertical: 'middle',
      horizontal: idx === 1 || idx === 2 || idx === headers.length - 1 ? 'left' : 'center',
      wrapText: true,
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFB0C4DE' } },
      left: { style: 'thin', color: { argb: 'FFB0C4DE' } },
      bottom: { style: 'medium', color: { argb: 'FF1F3864' } },
      right: { style: 'thin', color: { argb: 'FFB0C4DE' } },
    };
  });

  // 3. Data Rows
  // Sort results by student name or row order
  results.forEach((res, rowIdx) => {
    const student = students.find(s => s.id === res.studentId);
    const studentName = student ? student.name : 'Unknown Student';
    const currentRow = worksheet.getRow(7 + rowIdx);
    currentRow.height = 24;

    const rowValues: (string | number)[] = [
      rowIdx + 1,
      studentName,
      res.topic || '',
    ];

    project.criteria.forEach(c => {
      const score = res.scores?.[c.id];
      rowValues.push(score !== undefined ? score : '');
    });

    rowValues.push(res.total !== undefined ? res.total : 0);
    rowValues.push(res.comment || '');

    const isEven = rowIdx % 2 === 1;

    rowValues.forEach((val, colIdx) => {
      const cell = currentRow.getCell(colIdx + 1);
      cell.value = val;
      cell.font = {
        name: 'Calibri',
        size: 10,
        bold: colIdx === rowValues.length - 2, // Total column is bold
      };
      cell.alignment = {
        vertical: 'middle',
        horizontal: colIdx === 1 || colIdx === 2 || colIdx === rowValues.length - 1 ? 'left' : 'center',
        wrapText: colIdx === 2 || colIdx === rowValues.length - 1,
      };

      if (isEven) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF2F4F8' },
        };
      }

      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        right: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      };
    });
  });

  // Column Widths
  worksheet.getColumn(1).width = 6; // No.
  worksheet.getColumn(2).width = 24; // Student Name
  worksheet.getColumn(3).width = 26; // Topic
  project.criteria.forEach((_, idx) => {
    worksheet.getColumn(4 + idx).width = 18;
  });
  worksheet.getColumn(4 + project.criteria.length).width = 14; // Total
  worksheet.getColumn(5 + project.criteria.length).width = 36; // Comments

  // Write and trigger download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeName = (project.name || 'Project').replace(/[^a-zA-Z0-9_-]/g, '_');
  a.download = `${safeName}_Scoring_Sheet_${project.date || 'today'}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Downloads CSV format of the scoring sheet
 */
export function exportProjectCsv(
  project: ProjectItem,
  students: StudentItem[],
  results: ProjectResult[]
): void {
  const headers = ['No.', 'Student Name', 'Topic'];
  project.criteria.forEach(c => {
    headers.push(`"${c.name.replace(/"/g, '""')} (Max ${c.maxMark})"`);
  });
  headers.push(`"TOTAL (Max ${project.totalMax})"`);
  headers.push('"Comments"');

  const rows: string[] = [headers.join(',')];

  results.forEach((res, idx) => {
    const student = students.find(s => s.id === res.studentId);
    const row = [
      idx + 1,
      `"${(student?.name || 'Unknown').replace(/"/g, '""')}"`,
      `"${(res.topic || '').replace(/"/g, '""')}"`,
    ];
    project.criteria.forEach(c => {
      row.push(res.scores?.[c.id] !== undefined ? String(res.scores[c.id]) : '');
    });
    row.push(res.total !== undefined ? String(res.total) : '0');
    row.push(`"${(res.comment || '').replace(/"/g, '""')}"`);
    rows.push(row.join(','));
  });

  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeName = (project.name || 'Project').replace(/[^a-zA-Z0-9_-]/g, '_');
  a.download = `${safeName}_Scoring_Sheet.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Opens a printable scoring sheet in a clean print-ready popout window
 */
export function printProjectScoringSheet(
  project: ProjectItem,
  className: string,
  schoolName: string,
  teacherName: string,
  students: StudentItem[],
  results: ProjectResult[]
): void {
  const printWindow = window.open('', '_blank', 'width=1100,height=800');
  if (!printWindow) return;

  const criteriaHeaders = project.criteria
    .map(c => `<th>${c.name}<br/><span style="font-size:10px;font-weight:normal;">(Max ${c.maxMark})</span></th>`)
    .join('');

  const rowsHtml = results
    .map((res, idx) => {
      const student = students.find(s => s.id === res.studentId);
      const criteriaCells = project.criteria
        .map(c => `<td style="text-align:center;">${res.scores?.[c.id] !== undefined ? res.scores[c.id] : '—'}</td>`)
        .join('');
      return `
        <tr>
          <td style="text-align:center;">${idx + 1}</td>
          <td><strong>${student?.name || 'Unknown'}</strong></td>
          <td>${res.topic || '—'}</td>
          ${criteriaCells}
          <td style="text-align:center;font-weight:bold;color:#1e3a8a;">${res.total} / ${project.totalMax}</td>
          <td style="font-size:11px;color:#334155;">${res.comment || ''}</td>
        </tr>
      `;
    })
    .join('');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${project.name} - Scoring Sheet</title>
        <style>
          @page { size: landscape; margin: 15mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1e293b; padding: 20px; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #3b82f6; padding-bottom: 12px; margin-bottom: 16px; }
          h1 { margin: 0 0 6px 0; font-size: 22px; color: #1e3a8a; }
          .meta { font-size: 13px; color: #64748b; line-height: 1.5; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
          th, td { border: 1px solid #cbd5e1; padding: 7px 10px; }
          th { background-color: #f1f5f9; color: #1e293b; text-align: left; font-weight: 600; }
          tr:nth-child(even) { background-color: #f8fafc; }
          .footer { margin-top: 24px; font-size: 11px; color: #94a3b8; text-align: right; }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom:16px;">
          <button onclick="window.print()" style="padding:8px 16px;background:#2563eb;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">
            Print / Save as PDF
          </button>
        </div>
        <div class="header">
          <div>
            <h1>${project.name} — Speaking Scoring Sheet</h1>
            <div class="meta">
              <strong>Class:</strong> ${className} &nbsp;|&nbsp; 
              <strong>Date:</strong> ${project.date || 'N/A'} &nbsp;|&nbsp;
              <strong>Total Max:</strong> ${project.totalMax} pts
            </div>
          </div>
          <div class="meta" style="text-align:right;">
            <div><strong>${schoolName || 'Central Academy'}</strong></div>
            <div>Teacher: ${teacherName || 'Instructor'}</div>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width:40px;text-align:center;">No.</th>
              <th style="width:180px;">Student Name</th>
              <th style="width:190px;">Topic</th>
              ${criteriaHeaders}
              <th style="width:90px;text-align:center;">TOTAL</th>
              <th>Comments / Remarks</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
        <div class="footer">
          Generated from Class Record · ${new Date().toLocaleDateString()}
        </div>
      </body>
    </html>
  `);
  printWindow.document.close();
}
