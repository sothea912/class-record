import ExcelJS from 'exceljs';
import { monthName } from './helpers';

/**
 * Downloads a highly styled Excel report (.xlsx) representing the monthly student attendance.
 * Designed to exactly match the requested visual style:
 * - Top info block (rows 1-5): Bold title at ~16pt, Class, Time, Month, and Legend rows
 * - Header row: Dark navy blue background (#305496), bold white text, for columns No., Name, Sex, and 1..N days
 * - Day columns: Stacked header (Day number and Day of week), with weekend columns shaded in lighter blue (#D9E1F2)
 * - Data rows: Weekend column shading carried down through rows; "P" cells filled with light green (#C6EFCE), "A" cells filled with light pink (#FFC7CE).
 */
export async function downloadAttendanceExcel(
  currentClass: { name: string; timeFrom?: string; timeTo?: string },
  selectedMonth: string,
  studentRows: any[],
  days: any[]
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Attendance');

  // Enforce visible grid lines
  worksheet.views = [{ showGridLines: true }];

  // 1. Top info block (rows 1-5)
  
  // Row 1: Bold title (approx 16pt)
  const row1 = worksheet.getRow(1);
  row1.height = 28;
  const cellTitle = row1.getCell(1);
  cellTitle.value = currentClass.name;
  cellTitle.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF305496' } };

  // Row 2: Class & Time
  const row2 = worksheet.getRow(2);
  row2.height = 18;
  row2.getCell(1).value = 'Class:';
  row2.getCell(1).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF5B7592' } };
  row2.getCell(2).value = currentClass.name;
  row2.getCell(2).font = { name: 'Calibri', size: 10, bold: true };

  const classTime = currentClass.timeFrom && currentClass.timeTo
    ? `${currentClass.timeFrom} - ${currentClass.timeTo}`
    : 'N/A';
  row2.getCell(4).value = 'Time:';
  row2.getCell(4).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF5B7592' } };
  row2.getCell(5).value = classTime;
  row2.getCell(5).font = { name: 'Calibri', size: 10, bold: true };

  // Row 3: Month
  const row3 = worksheet.getRow(3);
  row3.height = 18;
  row3.getCell(1).value = 'Month:';
  row3.getCell(1).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF5B7592' } };
  row3.getCell(2).value = monthName(selectedMonth);
  row3.getCell(2).font = { name: 'Calibri', size: 10, bold: true };

  // Row 4: Legend explaining present / absent, with matching colors and instructional note
  const row4 = worksheet.getRow(4);
  row4.height = 20;
  
  row4.getCell(1).value = 'Legend:';
  row4.getCell(1).font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF5B7592' } };

  const pLegend = row4.getCell(2);
  pLegend.value = 'P = Present';
  pLegend.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF006100' } };
  pLegend.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFC6EFCE' } // Light Green
  };
  pLegend.alignment = { horizontal: 'center', vertical: 'middle' };
  pLegend.border = {
    top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
    left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
    right: { style: 'thin', color: { argb: 'FFCCCCCC' } },
    bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } }
  };

  const aLegend = row4.getCell(3);
  aLegend.value = 'A = Absent';
  aLegend.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF9C0006' } };
  aLegend.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFC7CE' } // Light Pink
  };
  aLegend.alignment = { horizontal: 'center', vertical: 'middle' };
  aLegend.border = {
    top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
    left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
    right: { style: 'thin', color: { argb: 'FFCCCCCC' } },
    bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } }
  };

  const instrNote = row4.getCell(4);
  instrNote.value = 'Note: Weekends shaded in Light Blue. Excused (E)/Unexcused (U)/Late (L) map to P/A visual formats.';
  instrNote.font = { name: 'Calibri', size: 8.5, italic: true, color: { argb: 'FF888888' } };

  // Row 5: spacer/empty line
  const row5 = worksheet.getRow(5);
  row5.height = 10;

  // Row 6: Header row (No. | Name | Sex | Days of month)
  const headerRowIdx = 6;
  const headerRow = worksheet.getRow(headerRowIdx);
  headerRow.height = 32;

  // Set default dimensions
  worksheet.getColumn(1).width = 6;  // No.
  worksheet.getColumn(2).width = 28; // Name
  worksheet.getColumn(3).width = 8;  // Sex

  const baseHeaders = ['No.', 'Name', 'Sex'];
  baseHeaders.forEach((text, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = text;
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF305496' } // Navy Background
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF305496' } },
      left: { style: 'thin', color: { argb: 'FFAAAAAA' } },
      right: { style: 'thin', color: { argb: 'FFAAAAAA' } },
      bottom: { style: 'medium', color: { argb: 'FF305496' } }
    };
  });

  // Calculate days in the selectedMonth
  const [year, month] = selectedMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const daysOfWeek = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  // Render day header columns
  for (let d = 1; d <= daysInMonth; d++) {
    const colIdx = 3 + d;
    worksheet.getColumn(colIdx).width = 5;

    const date = new Date(year, month - 1, d);
    const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const dayAbbrev = daysOfWeek[dayOfWeek];

    const cell = headerRow.getCell(colIdx);
    cell.value = `${d}\n${dayAbbrev}`;
    cell.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' };

    if (isWeekend) {
      cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF1F497D' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD9E1F2' } // Lighter Blue
      };
    } else {
      cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF305496' } // Navy Background
      };
    }

    cell.border = {
      top: { style: 'medium', color: { argb: 'FF305496' } },
      left: { style: 'thin', color: { argb: 'FFAAAAAA' } },
      right: { style: 'thin', color: { argb: 'FFAAAAAA' } },
      bottom: { style: 'medium', color: { argb: 'FF305496' } }
    };
  }

  // 2. Data Rows
  studentRows.forEach((row, sIdx) => {
    const dataRowIdx = headerRowIdx + 1 + sIdx;
    const dataRow = worksheet.getRow(dataRowIdx);
    dataRow.height = 20;

    const student = row.student;

    // Col 1: No.
    const cellNo = dataRow.getCell(1);
    cellNo.value = sIdx + 1;
    cellNo.alignment = { vertical: 'middle', horizontal: 'center' };
    cellNo.font = { name: 'Calibri', size: 9.5 };
    cellNo.border = {
      left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      right: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } }
    };

    // Col 2: Name
    const cellName = dataRow.getCell(2);
    cellName.value = student.name;
    cellName.alignment = { vertical: 'middle', horizontal: 'left' };
    cellName.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF10243A' } };
    cellName.border = {
      left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      right: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } }
    };

    // Col 3: Sex
    const cellSex = dataRow.getCell(3);
    cellSex.value = student.sex || 'M';
    cellSex.alignment = { vertical: 'middle', horizontal: 'center' };
    cellSex.font = { name: 'Calibri', size: 9.5 };
    cellSex.border = {
      left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      right: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } }
    };

    // Col 4..N: Days of month
    for (let d = 1; d <= daysInMonth; d++) {
      const colIdx = 3 + d;
      const cell = dataRow.getCell(colIdx);
      cell.alignment = { vertical: 'middle', horizontal: 'center' };

      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayOfWeek = new Date(year, month - 1, d).getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      // Find the recorded session
      const session = days.find(x => x.date === dateStr);
      const rec = session ? (session.records || {})[student.id] : undefined;

      // Default cell border
      cell.border = {
        left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        right: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } }
      };

      if (rec && rec.status) {
        const st = rec.status;
        if (st === 'P' || st === 'L') {
          cell.value = 'P';
          cell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF006100' } };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFC6EFCE' } // Light Green Present
          };
        } else if (st === 'E' || st === 'U') {
          cell.value = 'A';
          cell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF9C0006' } };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFC7CE' } // Light Pink Absent
          };
        }
      } else {
        // No attendance record taken for this student on this day
        if (isWeekend) {
          // Weekend shading continues through rows
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFD9E1F2' } // Lighter Blue
          };
        }
      }
    }
  });

  // Export process
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Attendance_${currentClass.name.replace(/\s+/g, '_')}_${selectedMonth}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
