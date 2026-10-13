# SpeakFlow — Public Speaking Trainer

Website latihan public speaking gratis berbasis HTML, CSS, dan JavaScript.

## Fitur
- Tambah, edit, hapus, cari, dan pilih topik sendiri
- Acak topik
- Timer 1, 1.5, 2, 3, atau 5 menit
- Pengenalan ucapan melalui Speech Recognition browser
- Penghitung kata, words per minute (WPM), waktu bicara, dan kata pengisi
- Penyimpanan daftar topik di localStorage browser

## Cara menjalankan di VS Code
1. Ekstrak folder `public-speaking-trainer`.
2. Buka VS Code → **File → Open Folder** → pilih folder tersebut.
3. Buka `index.html`.
4. Disarankan memasang ekstensi **Live Server** di VS Code.
5. Klik kanan `index.html` → **Open with Live Server**.
6. Buka alamat lokal yang muncul di browser, biasanya `http://127.0.0.1:5500`.

Bisa juga buka `index.html` langsung di browser untuk mencoba antarmuka dan pengelolaan topik. Untuk pengenalan suara, gunakan Google Chrome dan izinkan akses mikrofon. Dukungan pengenalan suara berbeda antar-browser dan biasanya memerlukan koneksi internet karena layanan pengenalan suara browser dapat memproses audio secara online.

## Mengubah bahasa pengenalan suara
Buka `script.js`, cari:
```js
recognition.lang = "id-ID";
```
Untuk latihan bahasa Inggris, ubah menjadi:
```js
recognition.lang = "en-US";
```

## Catatan
- Topik tersimpan di browser yang sama. Menghapus data situs/browser dapat menghapus daftar topik.
- Penghitung kata menghitung kata dari transkrip yang dikenali browser, bukan setiap kata yang benar-benar diucapkan. Hasil bergantung pada kualitas mikrofon, aksen, kebisingan, dan bahasa.
- WPM = jumlah kata yang dikenali ÷ waktu sesi dalam menit.
- Kata pengisi yang dideteksi termasuk um, uh, erm, hmm, like, basically, actually, anu, eee, dan em.
