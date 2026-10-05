function ascii(value) {
  return String(value ?? '').normalize('NFKD').replace(/[^\x20-\x7E]/g, '');
}

function pdfText(value) {
  return ascii(value).replace(/([\\()])/g, '\\$1');
}

function wrap(value, width = 82) {
  const words = ascii(value).trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    if (!line) line = word;
    else if (`${line} ${word}`.length <= width) line += ` ${word}`;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines.length ? lines : ['Not provided'];
}

function pageStream({ hospitalName, department, branch, doctors, page, pages }) {
  const commands = [
    'BT', '/F1 19 Tf', '48 790 Td', `(${pdfText(hospitalName)}) Tj`,
    '0 -28 Td', '/F1 13 Tf', `(Doctor directory - ${pdfText(department.name)}) Tj`,
    '0 -20 Td', '/F1 10 Tf', `(${pdfText(branch.name)} | Page ${page} of ${pages}) Tj`, 'ET',
  ];
  let y = 710;
  for (const doctor of doctors) {
    commands.push('BT', '/F1 13 Tf', `48 ${y} Td`, `(${pdfText(doctor.name)}) Tj`, 'ET');
    y -= 18;
    commands.push('BT', '/F1 10 Tf', `48 ${y} Td`, `(${pdfText(doctor.title)}) Tj`, 'ET');
    y -= 16;
    const facts = `${doctor.experience_years} years experience | Consultation fee: INR ${doctor.consultation_fee}`;
    commands.push('BT', '/F1 9 Tf', `48 ${y} Td`, `(${pdfText(facts)}) Tj`, 'ET');
    y -= 15;
    for (const line of wrap(doctor.bio, 88).slice(0, 5)) {
      commands.push('BT', '/F1 9 Tf', `48 ${y} Td`, `(${pdfText(line)}) Tj`, 'ET');
      y -= 13;
    }
    y -= 18;
  }
  commands.push('BT', '/F1 8 Tf', '48 35 Td', '(Doctor availability and fees may change. Confirm your selection in WhatsApp.) Tj', 'ET');
  return `${commands.join('\n')}\n`;
}

export function createDoctorDirectoryPdf({ hospitalName = 'Sri Lakshmi Super Speciality Hospital', department, branch, doctors }) {
  const groups = [];
  for (let index = 0; index < doctors.length; index += 4) groups.push(doctors.slice(index, index + 4));
  if (!groups.length) groups.push([]);
  const objects = new Map();
  const pageRefs = groups.map((_, index) => `${4 + index * 2} 0 R`).join(' ');
  objects.set(1, '<< /Type /Catalog /Pages 2 0 R >>');
  objects.set(2, `<< /Type /Pages /Kids [${pageRefs}] /Count ${groups.length} >>`);
  objects.set(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  groups.forEach((group, index) => {
    const pageObject = 4 + index * 2;
    const contentObject = pageObject + 1;
    const stream = pageStream({ hospitalName, department, branch, doctors: group, page: index + 1, pages: groups.length });
    objects.set(pageObject, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObject} 0 R >>`);
    objects.set(contentObject, `<< /Length ${Buffer.byteLength(stream, 'ascii')} >>\nstream\n${stream}endstream`);
  });
  let output = '%PDF-1.4\n';
  const offsets = [0];
  for (let id = 1; id <= objects.size; id += 1) {
    offsets[id] = Buffer.byteLength(output, 'ascii');
    output += `${id} 0 obj\n${objects.get(id)}\nendobj\n`;
  }
  const xref = Buffer.byteLength(output, 'ascii');
  output += `xref\n0 ${objects.size + 1}\n0000000000 65535 f \n`;
  for (let id = 1; id <= objects.size; id += 1) output += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  output += `trailer\n<< /Size ${objects.size + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(output, 'ascii');
}
