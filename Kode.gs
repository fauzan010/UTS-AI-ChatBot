function levenshtein(a, b) {
  if (!a || !b) return 99;
  var m = [], i, j;
  for (i = 0; i <= b.length; i++) {
    m[i] = [i];
    for (j = 1; j <= a.length; j++) {
      m[i][j] =
        i === 0
          ? j
          : Math.min(
              m[i - 1][j] + 1,
              m[i][j - 1] + 1,
              m[i - 1][j - 1] + (a[j - 1] === b[i - 1] ? 0 : 1)
            );
    }
  }
  return m[b.length][a.length];
}
function similar(a, b) {
  return levenshtein(a, b) <= 2;
}

// KATEGORI UNTUK REKOMENDASI OTOMATIS

var categories = {
  "ujian": [
    "Jadwal UTS",
    "Periode UTS",
    "Lokasi ujian",
    "Syarat mengikuti ujian"
  ],
  "kuliah": [
    "Jadwal kuliah",
    "Dosen pengampu",
    "Ruang kuliah",
    "Kalender akademik"
  ],
  "administrasi": [
    "KRS",
    "Nilai",
    "Pembayaran kuliah"
  ]
};

var intentWords = ["tentang", "mengenai", "info", "informasi", "jelas", "ingin", "tahu", "penjelasan"];


// CHATBOT UTAMA

function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Sheet1");
    var data = sheet.getDataRange().getValues();

    var query = e.parameter.q ? e.parameter.q.toLowerCase().trim() : "";
    var words = query.split(/\s+/);

    var fallbackBase = ["jadwal", "dosen", "uts", "kelas", "nilai", "krs"];
    var reply = "Maaf, saya belum memahami. Coba kata kunci seperti: " + fallbackBase.join(", ") + ".";


    // REKOMENDASI OTOMATIS (intent detection)

    var triggeredIntent = false;
    for (var t = 0; t < intentWords.length; t++) {
      if (query.includes(intentWords[t])) {
        triggeredIntent = true;
        break;
      }
    }

    if (triggeredIntent) {
      for (var cat in categories) {
        if (query.includes(cat)) {
          reply = 
            "Apakah yang Anda maksud:\n" +
            categories[cat].map(x => "• " + x).join("\n") + "?";

          saveHistory(ss, query, reply);
          return sendReply(reply);
        }
      }
    }


    // CARI JAWABAN — PRIORITAS KEYWORD UTUH

    var matches = [];
    var matchedKeys = []; // menyimpan keyword sesuai urutan muncul di query

    for (var i = 1; i < data.length; i++) {
      var key = data[i][0].toString().toLowerCase().trim();
      var answer = data[i][1].toString().trim();

      if (query.includes(key)) {
        matches.push({ key: key, answer: answer });
      }
    }

    // Jika tidak ada exact match → fuzzy
    if (matches.length === 0) {
      for (var i = 1; i < data.length; i++) {
        var key = data[i][0].toString().toLowerCase().trim();
        var answer = data[i][1].toString().trim();

        for (var w = 0; w < words.length; w++) {
          if (similar(words[w], key)) {
            matches.push({ key: key, answer: answer });
            break;
          }
        }
      }
    }


    // SUSUN JAWABAN GAYA PROFESIONAL

    if (matches.length > 0) {

      // Urutkan berdasarkan posisi KEYWORD pada query
      matches.sort((a, b) => {
        return query.indexOf(a.key) - query.indexOf(b.key);
      });

      let parts = matches.map((m, index) => {

        // Kalimat profesional kampus
        if (index === 0)
          return m.answer + "."; 
        else
          return "Untuk " + m.key + ", " + m.answer.toLowerCase() + ".";

      });

      reply = parts.join(" ");
    }


 
    // HISTORY
 
    saveHistory(ss, query, reply);

    return sendReply(reply);

  } catch (err) {
    return sendReply("Error: " + err.toString());
  }
}


// HELPER

function sendReply(msg) {
  return ContentService
    .createTextOutput(JSON.stringify({ reply: msg }))
    .setMimeType(ContentService.MimeType.JSON);
}

function saveHistory(ss, q, r) {
  var hist = ss.getSheetByName("History");
  if (!hist) {
    hist = ss.insertSheet("History");
    hist.appendRow(["Timestamp", "Pertanyaan", "Jawaban"]);
  }
  hist.appendRow([new Date(), q, r]);
}
