-- 026: reset Piket assignments for manual setup (user will re-create via Admin → Piket)
DELETE FROM piket_assignments WHERE workspace_id = '051aef2c-f96c-436a-8a2a-de298383fec5'::uuid;
