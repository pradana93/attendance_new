-- 022: rename piket_tasks to match sheet exactly (custom names, zero mistake)
-- Sheet: Harian: Depan/Tengah/Belakang, Tutup Rolling Door (2 People), Foto Suhu Container (07:00 / 15:00 / 22:00), Forms

-- Harian generic 12 (existing) -> Harian: Depan etc.
UPDATE piket_tasks SET name = 'Harian: Depan' WHERE area = 'Depan' AND name = 'Harian';
UPDATE piket_tasks SET name = 'Harian: Tengah' WHERE area = 'Tengah' AND name = 'Harian';
UPDATE piket_tasks SET name = 'Harian: Belakang' WHERE area = 'Belakang' AND name = 'Harian';

-- Harian C12 12 -> same Harian: Depan etc. (keep C12 distinction via area, name same as sheet)
UPDATE piket_tasks SET name = 'Harian: Depan' WHERE name LIKE 'Harian Depan C12%';
UPDATE piket_tasks SET name = 'Harian: Tengah' WHERE name LIKE 'Harian Tengah C12%';
UPDATE piket_tasks SET name = 'Harian: Belakang' WHERE name LIKE 'Harian Belakang C12%';

-- Tutup Rolling Door 4 -> Tutup Rolling Door (2 People)
UPDATE piket_tasks SET name = 'Tutup Rolling Door (2 People)' WHERE name LIKE 'Tutup Rolling Door%';

-- Foto Suhu Container 4 -> Foto Suhu Container (07:00 / 15:00 / 22:00) with C11/C12 suffix for distinction
UPDATE piket_tasks SET name = 'Foto Suhu Container (07:00 / 15:00 / 22:00) C11' WHERE name = 'Foto Suhu Container 20ft C11';
UPDATE piket_tasks SET name = 'Foto Suhu Container (07:00 / 15:00 / 22:00) C11 Backup' WHERE name = 'Foto Suhu Container 40ft C11';
UPDATE piket_tasks SET name = 'Foto Suhu Container (07:00 / 15:00 / 22:00) C12' WHERE name = 'Foto Suhu Container 20ft C12';
UPDATE piket_tasks SET name = 'Foto Suhu Container (07:00 / 15:00 / 22:00) C12 Backup' WHERE name = 'Foto Suhu Container 40ft C12';

-- Forms 5 -> sheet exact
UPDATE piket_tasks SET name = 'Suhu Container C11' WHERE name = 'Form Suhu Container C11';
UPDATE piket_tasks SET name = 'Suhu Container C12' WHERE name = 'Form Suhu Container C12';
UPDATE piket_tasks SET name = 'Suhu Ruang C11' WHERE name = 'Form Suhu Ruang C11';
UPDATE piket_tasks SET name = 'Suhu Ruang C12' WHERE name = 'Form Suhu Ruang C12';
UPDATE piket_tasks SET name = 'Kebersihan' WHERE name LIKE 'Form Kebersihan%';
