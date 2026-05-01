-- =====================================================
-- Sample Data Seed — Batuan Voting System
-- SSLG Election only
-- =====================================================
USE batuan_voting;

-- ─── Sample Voters ──────────────────────────────────
-- Grade 7 - Amethyst
SET @v1 = UUID(); INSERT INTO users (id,lrn,password_hash,full_name,must_change_password) VALUES (@v1,'123456789001','$2a$10$qJuWvaZPekXNKtP8hr60SeYNgdeZVoze0/nRIQxgmWrglNH7ObvY.','Juan dela Cruz',0);
INSERT INTO profiles (id,user_id,full_name,grade_level,section) VALUES (UUID(),@v1,'Juan dela Cruz','Grade 7','Amethyst');
INSERT INTO user_roles (id,user_id,role) VALUES (UUID(),@v1,'voter');

SET @v2 = UUID(); INSERT INTO users (id,lrn,password_hash,full_name,must_change_password) VALUES (@v2,'123456789002','$2a$10$qJuWvaZPekXNKtP8hr60SeYNgdeZVoze0/nRIQxgmWrglNH7ObvY.','Maria Santos',0);
INSERT INTO profiles (id,user_id,full_name,grade_level,section) VALUES (UUID(),@v2,'Maria Santos','Grade 7','Amethyst');
INSERT INTO user_roles (id,user_id,role) VALUES (UUID(),@v2,'voter');

SET @v3 = UUID(); INSERT INTO users (id,lrn,password_hash,full_name,must_change_password) VALUES (@v3,'123456789003','$2a$10$qJuWvaZPekXNKtP8hr60SeYNgdeZVoze0/nRIQxgmWrglNH7ObvY.','Pedro Reyes',0);
INSERT INTO profiles (id,user_id,full_name,grade_level,section) VALUES (UUID(),@v3,'Pedro Reyes','Grade 7','Diamond');
INSERT INTO user_roles (id,user_id,role) VALUES (UUID(),@v3,'voter');

SET @v4 = UUID(); INSERT INTO users (id,lrn,password_hash,full_name,must_change_password) VALUES (@v4,'123456789004','$2a$10$qJuWvaZPekXNKtP8hr60SeYNgdeZVoze0/nRIQxgmWrglNH7ObvY.','Ana Garcia',0);
INSERT INTO profiles (id,user_id,full_name,grade_level,section) VALUES (UUID(),@v4,'Ana Garcia','Grade 7','Diamond');
INSERT INTO user_roles (id,user_id,role) VALUES (UUID(),@v4,'voter');

SET @v5 = UUID(); INSERT INTO users (id,lrn,password_hash,full_name,must_change_password) VALUES (@v5,'123456789005','$2a$10$qJuWvaZPekXNKtP8hr60SeYNgdeZVoze0/nRIQxgmWrglNH7ObvY.','Carlo Lim',0);
INSERT INTO profiles (id,user_id,full_name,grade_level,section) VALUES (UUID(),@v5,'Carlo Lim','Grade 8','Garnet');
INSERT INTO user_roles (id,user_id,role) VALUES (UUID(),@v5,'voter');

SET @v6 = UUID(); INSERT INTO users (id,lrn,password_hash,full_name,must_change_password) VALUES (@v6,'123456789006','$2a$10$qJuWvaZPekXNKtP8hr60SeYNgdeZVoze0/nRIQxgmWrglNH7ObvY.','Rosa Flores',0);
INSERT INTO profiles (id,user_id,full_name,grade_level,section) VALUES (UUID(),@v6,'Rosa Flores','Grade 8','Garnet');
INSERT INTO user_roles (id,user_id,role) VALUES (UUID(),@v6,'voter');

SET @v7 = UUID(); INSERT INTO users (id,lrn,password_hash,full_name,must_change_password) VALUES (@v7,'123456789007','$2a$10$qJuWvaZPekXNKtP8hr60SeYNgdeZVoze0/nRIQxgmWrglNH7ObvY.','Luis Torres',0);
INSERT INTO profiles (id,user_id,full_name,grade_level,section) VALUES (UUID(),@v7,'Luis Torres','Grade 9','ICT');
INSERT INTO user_roles (id,user_id,role) VALUES (UUID(),@v7,'voter');

SET @v8 = UUID(); INSERT INTO users (id,lrn,password_hash,full_name,must_change_password) VALUES (@v8,'123456789008','$2a$10$qJuWvaZPekXNKtP8hr60SeYNgdeZVoze0/nRIQxgmWrglNH7ObvY.','Claire Mendoza',0);
INSERT INTO profiles (id,user_id,full_name,grade_level,section) VALUES (UUID(),@v8,'Claire Mendoza','Grade 9','ICT');
INSERT INTO user_roles (id,user_id,role) VALUES (UUID(),@v8,'voter');

-- ─── SSLG Candidates ─────────────────────────────────
-- President
INSERT INTO candidates (id,name,position_id,grade_level,section,party_list,motto) VALUES
(UUID(),'Andrei Villanueva',(SELECT id FROM positions WHERE title = 'President'),'Grade 10','Amethyst','Bagong Pag-asa','Together we rise, united we thrive.'),
(UUID(),'Sofia Navarro',(SELECT id FROM positions WHERE title = 'President'),'Grade 11','Diamond','Pagbabago','A voice for every student, every day.');

-- Vice President
INSERT INTO candidates (id,name,position_id,grade_level,section,party_list,motto) VALUES
(UUID(),'Marco Dela Vega',(SELECT id FROM positions WHERE title = 'Vice President'),'Grade 11','Garnet','Bagong Pag-asa','Service above self.'),
(UUID(),'Jasmine Reyes',(SELECT id FROM positions WHERE title = 'Vice President'),'Grade 10','ICT','Kabataan','Lead with heart, serve with purpose.');

-- Secretary
INSERT INTO candidates (id,name,position_id,grade_level,section,party_list,motto) VALUES
(UUID(),'Nina Castillo',(SELECT id FROM positions WHERE title = 'Secretary'),'Grade 9','Amethyst','Pagbabago','Organized, dedicated, transparent.'),
(UUID(),'Carlo Buenaventura',(SELECT id FROM positions WHERE title = 'Secretary'),'Grade 10','Diamond','Bagong Pag-asa','Every word counts, every record matters.');

-- Treasurer
INSERT INTO candidates (id,name,position_id,grade_level,section,party_list,motto) VALUES
(UUID(),'Angela Cruz',(SELECT id FROM positions WHERE title = 'Treasurer'),'Grade 11','ICT','Kabataan','Wise stewards of our shared resources.'),
(UUID(),'Renz Magalona',(SELECT id FROM positions WHERE title = 'Treasurer'),'Grade 10','Garnet','Pagbabago','Integrity in every centavo.');

-- Auditor
INSERT INTO candidates (id,name,position_id,grade_level,section,party_list,motto) VALUES
(UUID(),'Bianca Tolentino',(SELECT id FROM positions WHERE title = 'Auditor'),'Grade 12','Amethyst','Bagong Pag-asa','Truth and accountability always.'),
(UUID(),'Edison Lim',(SELECT id FROM positions WHERE title = 'Auditor'),'Grade 11','Diamond','Kabataan','Numbers don''t lie — and neither do I.');

-- P.I.O.
INSERT INTO candidates (id,name,position_id,grade_level,section,party_list,motto) VALUES
(UUID(),'Kyla Soriano',(SELECT id FROM positions WHERE title = 'Public Information Officer'),'Grade 10','Garnet','Pagbabago','Connecting students through communication.'),
(UUID(),'James Evangelista',(SELECT id FROM positions WHERE title = 'Public Information Officer'),'Grade 11','ICT','Kabataan','Your news, your voice, your school.');

-- Peace Officer
INSERT INTO candidates (id,name,position_id,grade_level,section,party_list,motto) VALUES
(UUID(),'Vincent Padilla',(SELECT id FROM positions WHERE title = 'Peace Officer'),'Grade 12','Diamond','Bagong Pag-asa','Peace starts with one step.'),
(UUID(),'Ella Domingo',(SELECT id FROM positions WHERE title = 'Peace Officer'),'Grade 11','Amethyst','Pagbabago','A safer school for everyone.');

-- Grade 7 Representative
INSERT INTO candidates (id,name,position_id,grade_level,section,party_list,motto) VALUES
(UUID(),'Leo Bernardo',(SELECT id FROM positions WHERE title = 'Grade 7 Representative'),'Grade 7','Amethyst','Kabataan','The future begins in Grade 7.'),
(UUID(),'Trisha Bautista',(SELECT id FROM positions WHERE title = 'Grade 7 Representative'),'Grade 7','Diamond','Pagbabago','Small steps, big dreams.');

-- Grade 8 Representative
INSERT INTO candidates (id,name,position_id,grade_level,section,party_list,motto) VALUES
(UUID(),'Mark Salazar',(SELECT id FROM positions WHERE title = 'Grade 8 Representative'),'Grade 8','Garnet','Bagong Pag-asa','Rising stronger in Grade 8.'),
(UUID(),'Kaye Villafuerte',(SELECT id FROM positions WHERE title = 'Grade 8 Representative'),'Grade 8','ICT','Kabataan','For a brighter Grade 8.');

-- Grade 9 Representative
INSERT INTO candidates (id,name,position_id,grade_level,section,party_list,motto) VALUES
(UUID(),'Jared Aquino',(SELECT id FROM positions WHERE title = 'Grade 9 Representative'),'Grade 9','Amethyst','Pagbabago','Grade 9: Stronger, Smarter, Together.'),
(UUID(),'Angie Quirino',(SELECT id FROM positions WHERE title = 'Grade 9 Representative'),'Grade 9','Diamond','Bagong Pag-asa','Empowering every Grade 9 student.');

-- Grade 10 Representative
INSERT INTO candidates (id,name,position_id,grade_level,section,party_list,motto) VALUES
(UUID(),'Rico Manahan',(SELECT id FROM positions WHERE title = 'Grade 10 Representative'),'Grade 10','Garnet','Kabataan','Grade 10: Leading the way.'),
(UUID(),'Ysabelle Castro',(SELECT id FROM positions WHERE title = 'Grade 10 Representative'),'Grade 10','ICT','Pagbabago','A rep who truly represents.');

-- Grade 11 Representative
INSERT INTO candidates (id,name,position_id,grade_level,section,party_list,motto) VALUES
(UUID(),'Paolo Miranda',(SELECT id FROM positions WHERE title = 'Grade 11 Representative'),'Grade 11','Amethyst','Bagong Pag-asa','Senior high, senior values.'),
(UUID(),'Fatima Peralta',(SELECT id FROM positions WHERE title = 'Grade 11 Representative'),'Grade 11','Diamond','Kabataan','Grade 11 voices heard and respected.');

-- Grade 12 Representative
INSERT INTO candidates (id,name,position_id,grade_level,section,party_list,motto) VALUES
(UUID(),'Dominic Santiago',(SELECT id FROM positions WHERE title = 'Grade 12 Representative'),'Grade 12','Garnet','Pagbabago','Leaving a legacy for those behind us.'),
(UUID(),'Rhea Fernandez',(SELECT id FROM positions WHERE title = 'Grade 12 Representative'),'Grade 12','ICT','Bagong Pag-asa','The final year, the greatest impact.');
