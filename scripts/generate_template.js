const XLSX = require('xlsx')
const fs = require('fs')
const path = require('path')

const wb = XLSX.utils.book_new()

// Title row
const title = [['Reporte de asistencia — Semana: dd/mm/yyyy']]
const header = [['N°','Nombre completo','Universidad','Lugar de subida','Tipo de viaje','Pagado','Monto (Q)']]
const aoa = [].concat(title, [], header)

const ws = XLSX.utils.aoa_to_sheet(aoa)
XLSX.utils.book_append_sheet(wb, ws, 'Asistencia')

// merge title across A1:G1
ws['!merges'] = [{s:{r:0,c:0}, e:{r:0,c:6}}]
// column widths
ws['!cols'] = [ {wch:4}, {wch:28}, {wch:20}, {wch:18}, {wch:14}, {wch:8}, {wch:12} ]

// basic styles where supported
function setCellStyle(cell, style){
  cell.s = Object.assign(cell.s || {}, style)
}

// style header (row index 2) — use full ARGB values and stronger styling
const headerRow = 2
const headerFillColor = 'FF2F75B5' // professional blue
const headerFontColor = 'FFFFFFFF' // white
const borderColor = 'FF9E9E9E'
for(let c=0;c<7;c++){
  const ref = XLSX.utils.encode_cell({r:headerRow, c})
  if(ws[ref]){
    setCellStyle(ws[ref], {
      font:{bold:true, color:{rgb: headerFontColor}},
      alignment:{horizontal:'center', vertical:'center'},
      fill:{patternType:'solid', fgColor:{rgb: headerFillColor}},
      border:{top:{style:'thin', color:{rgb:borderColor}}, bottom:{style:'thin', color:{rgb:borderColor}}, left:{style:'thin', color:{rgb:borderColor}}, right:{style:'thin', color:{rgb:borderColor}}}
    })
  }
}

// title style
if(ws['A1']){
  setCellStyle(ws['A1'], {font:{bold:true, sz:14, color:{rgb:'FF000000'}}, alignment:{horizontal:'left'}})
}

const outDir = path.join(__dirname, '..', 'public', 'templates')
fs.mkdirSync(outDir, { recursive: true })
const outPath = path.join(outDir, 'attendance_template.xlsx')

XLSX.writeFile(wb, outPath, {bookType:'xlsx', cellStyles:true})
console.log('Template written to', outPath)
