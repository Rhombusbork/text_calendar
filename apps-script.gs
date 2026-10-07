// Google 스프레드시트 > 확장 프로그램 > Apps Script 에 붙여넣고 웹 앱으로 배포한다.
// 시트 "checks": A열에 체크된 항목 키를 한 줄씩 저장한다.
// 시트 "moves": A열 원래 수업일, B열 바뀐 수업일.
function sheet_(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function rows_(sh, cols) {
  return sh.getLastRow() > 0 ? sh.getRange(1, 1, sh.getLastRow(), cols).getDisplayValues() : [];
}

function doGet() {
  const checks = {}, moves = {};
  rows_(sheet_("checks"), 1).forEach(([k]) => { if (k) checks[k] = 1; });
  rows_(sheet_("moves"), 2).forEach(([from, to]) => { if (from && to) moves[from] = to; });
  return ContentService.createTextOutput(JSON.stringify({ checks, moves })).setMimeType(ContentService.MimeType.JSON);
}

function remove_(sh, key) {
  sh.createTextFinder(key).matchEntireCell(true).findAll()
    .filter((r) => r.getColumn() === 1)
    .reverse().forEach((r) => sh.deleteRow(r.getRow()));
}

function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (body.move) {
      const sh = sheet_("moves");
      remove_(sh, body.move);
      // 날짜가 자동 변환되지 않도록 텍스트로 저장
      if (body.to) sh.appendRow(["'" + body.move, "'" + body.to, new Date()]);
    } else {
      const sh = sheet_("checks");
      const found = sh.createTextFinder(body.key).matchEntireCell(true).findAll();
      if (body.on && found.length === 0) sh.appendRow([body.key, new Date()]);
      if (!body.on) remove_(sh, body.key);
    }
  } finally {
    lock.releaseLock();
  }
  return ContentService.createTextOutput("ok");
}
