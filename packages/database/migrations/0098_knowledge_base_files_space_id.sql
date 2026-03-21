ALTER TABLE knowledge_base_files ADD COLUMN space_id TEXT;
CREATE INDEX kbf_space_id_idx ON knowledge_base_files(space_id);
