-- 023: expand Foto Suhu Container to 12 tasks (6 per C11/C12) with exact sheet names
-- Existing 4: Foto Suhu Container 20ft/40ft C11/C12 (with suffixes) -> rename to 07.00 base, add 08 new

-- Rename existing 4 to 07.00 slots
UPDATE piket_tasks SET name = 'Foto Suhu Container 20ft 07.00' WHERE name = 'Foto Suhu Container (07:00 / 15:00 / 22:00) C11';
UPDATE piket_tasks SET name = 'Foto Suhu Container 40ft 07.00' WHERE name = 'Foto Suhu Container (07:00 / 15:00 / 22:00) C11 Backup';
UPDATE piket_tasks SET name = 'Foto Suhu Container 20ft 07.00' WHERE name = 'Foto Suhu Container 20ft C11';
UPDATE piket_tasks SET name = 'Foto Suhu Container 40ft 07.00' WHERE name = 'Foto Suhu Container 40ft C11';

-- For C12 existing also rename to 07.00 (they were similarly)
-- Need to handle both C11 and C12: we have 4 tasks total, 2 per container. Rename them to 07.00 for each container
-- To distinguish C11 vs C12, we keep workspace_id but add area Gudang with suffix via description? Instead, duplicate names with same name but different id is allowed (name not unique)
-- So we will have 2 tasks named 'Foto Suhu Container 20ft 07.00' (one for each container's 07 slot) - need to differentiate by keeping separate ids
-- The 4 existing will become: C11 20ft 07, C11 40ft 07, C12 20ft 07, C12 40ft 07 (4 of 12)

-- For the remaining, insert 8 new: 15.00 and 22.00 for each
INSERT INTO piket_tasks (id, workspace_id, name, area, points, requires_proof, active, icon, description) VALUES (gen_random_uuid(), '051aef2c-f96c-436a-8a2a-de298383fec5'::uuid, 'Foto Suhu Container 20ft 15.00', 'Gudang', 10, true, true, 'thermo', 'C11 15.00') ON CONFLICT DO NOTHING;
INSERT INTO piket_tasks (id, workspace_id, name, area, points, requires_proof, active, icon, description) VALUES (gen_random_uuid(), '051aef2c-f96c-436a-8a2a-de298383fec5'::uuid, 'Foto Suhu Container 20ft 22.00', 'Gudang', 10, true, true, 'thermo', 'C11 22.00 lives') ON CONFLICT DO NOTHING;
INSERT INTO piket_tasks (id, workspace_id, name, area, points, requires_proof, active, icon, description) VALUES (gen_random_uuid(), '051aef2c-f96c-436a-8a2a-de298383fec5'::uuid, 'Foto Suhu Container 40ft 15.00', 'Gudang', 10, true, true, 'thermo', 'C11 15.00') ON CONFLICT DO NOTHING;
INSERT INTO piket_tasks (id, workspace_id, name, area, points, requires_proof, active, icon, description) VALUES (gen_random_uuid(), '051aef2c-f96c-436a-8a2a-de298383fec5'::uuid, 'Foto Suhu Container 40ft 22.00', 'Gudang', 10, true, true, 'thermo', 'C11 22.00 lives') ON CONFLICT DO NOTHING;
INSERT INTO piket_tasks (id, workspace_id, name, area, points, requires_proof, active, icon, description) VALUES (gen_random_uuid(), '051aef2c-f96c-436a-8a2a-de298383fec5'::uuid, 'Foto Suhu Container 20ft 15.00', 'Gudang', 10, true, true, 'thermo', 'C12 15.00') ON CONFLICT DO NOTHING;
INSERT INTO piket_tasks (id, workspace_id, name, area, points, requires_proof, active, icon, description) VALUES (gen_random_uuid(), '051aef2c-f96c-436a-8a2a-de298383fec5'::uuid, 'Foto Suhu Container 20ft 22.00', 'Gudang', 10, true, true, 'thermo', 'C12 22.00 lives') ON CONFLICT DO NOTHING;
INSERT INTO piket_tasks (id, workspace_id, name, area, points, requires_proof, active, icon, description) VALUES (gen_random_uuid(), '051aef2c-f96c-436a-8a2a-de298383fec5'::uuid, 'Foto Suhu Container 40ft 15.00', 'Gudang', 10, true, true, 'thermo', 'C12 15.00') ON CONFLICT DO NOTHING;
INSERT INTO piket_tasks (id, workspace_id, name, area, points, requires_proof, active, icon, description) VALUES (gen_random_uuid(), '051aef2c-f96c-436a-8a2a-de298383fec5'::uuid, 'Foto Suhu Container 40ft 22.00', 'Gudang', 10, true, true, 'thermo', 'C12 22.00 lives') ON CONFLICT DO NOTHING;
