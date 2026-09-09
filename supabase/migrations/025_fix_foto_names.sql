-- 025: ensure all Foto Suhu Container names are exact 6 per container (fix remaining C12 old names)
UPDATE piket_tasks SET name = 'Foto Suhu Container 20ft 07.00' WHERE name = 'Foto Suhu Container (07:00 / 15:00 / 22:00) C12';
UPDATE piket_tasks SET name = 'Foto Suhu Container 40ft 07.00' WHERE name = 'Foto Suhu Container (07:00 / 15:00 / 22:00) C12 Backup';
