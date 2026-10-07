// Google 스프레드시트 > 확장 프로그램 > Apps Script 에 붙여넣고 웹 앱으로 배포한다.
// 시트 "checks"의 A열에 체크된 항목 키를 한 줄씩 저장한다.
function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName("checks") || ss.insertSheet("checks");
}

function doGet() {
  const sh = sheet_();
  const out = {};
  if (sh.getLastRow() > 0) {
    sh.getRange(1, 1, sh.getLastRow(), 1).getValues().forEach(([k]) => { if (k) out[k] = 1; });
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const { key, on } = JSON.parse(e.postData.contents);
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sh = sheet_();
    const found = sh.createTextFinder(key).matchEntireCell(true).findAll();
    if (on && found.length === 0) sh.appendRow([key, new Date()]);
    if (!on) found.reverse().forEach((r) => sh.deleteRow(r.getRow()));
  } finally {
    lock.releaseLock();
  }
  return ContentService.createTextOutput("ok");
}
