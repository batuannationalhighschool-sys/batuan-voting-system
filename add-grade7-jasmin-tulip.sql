-- =====================================================================
-- ADD GRADE 7 SECTIONS (JASMIN, TULIP) AND STUDENTS (20 EACH)
-- Batuan National High School — Batuan Voting System
-- =====================================================================

DO $$
DECLARE
  v_user_id UUID;
  v_profile_id UUID;
  v_role_id UUID;
  v_student RECORD;
  v_students JSONB := '[
    {"lrn": "118026190001", "full_name": "Alonzo Miguel Reyes", "grade_level": "Grade 7", "section": "JASMIN"},
    {"lrn": "118026190002", "full_name": "Beatriz Anne Santos", "grade_level": "Grade 7", "section": "JASMIN"},
    {"lrn": "118026190003", "full_name": "Carlo James Dela Cruz", "grade_level": "Grade 7", "section": "JASMIN"},
    {"lrn": "118026190004", "full_name": "Diana Marie Flores", "grade_level": "Grade 7", "section": "JASMIN"},
    {"lrn": "118026190005", "full_name": "Emilio Jose Ramos", "grade_level": "Grade 7", "section": "JASMIN"},
    {"lrn": "118026190006", "full_name": "Faith Angela Torres", "grade_level": "Grade 7", "section": "JASMIN"},
    {"lrn": "118026190007", "full_name": "Gabriel Luis Navarro", "grade_level": "Grade 7", "section": "JASMIN"},
    {"lrn": "118026190008", "full_name": "Hannah Rose Mendoza", "grade_level": "Grade 7", "section": "JASMIN"},
    {"lrn": "118026190009", "full_name": "Ivan Rey Castillo", "grade_level": "Grade 7", "section": "JASMIN"},
    {"lrn": "118026190010", "full_name": "Jana Claire Villanueva", "grade_level": "Grade 7", "section": "JASMIN"},
    {"lrn": "118026190011", "full_name": "Karl Martin Aquino", "grade_level": "Grade 7", "section": "JASMIN"},
    {"lrn": "118026190012", "full_name": "Lara Nicole Bautista", "grade_level": "Grade 7", "section": "JASMIN"},
    {"lrn": "118026190013", "full_name": "Marc Angelo Lim", "grade_level": "Grade 7", "section": "JASMIN"},
    {"lrn": "118026190014", "full_name": "Nina Patricia Rivera", "grade_level": "Grade 7", "section": "JASMIN"},
    {"lrn": "118026190015", "full_name": "Oscar Rafael Garcia", "grade_level": "Grade 7", "section": "JASMIN"},
    {"lrn": "118026190016", "full_name": "Paula Kristine Soriano", "grade_level": "Grade 7", "section": "JASMIN"},
    {"lrn": "118026190017", "full_name": "Quentin Jose Padilla", "grade_level": "Grade 7", "section": "JASMIN"},
    {"lrn": "118026190018", "full_name": "Rachel Anne Magalona", "grade_level": "Grade 7", "section": "JASMIN"},
    {"lrn": "118026190019", "full_name": "Samuel Diego Peralta", "grade_level": "Grade 7", "section": "JASMIN"},
    {"lrn": "118026190020", "full_name": "Trisha Mae Evangelista", "grade_level": "Grade 7", "section": "JASMIN"},
    {"lrn": "118026190021", "full_name": "Aaron James Bernardo", "grade_level": "Grade 7", "section": "TULIP"},
    {"lrn": "118026190022", "full_name": "Bianca Louise Panganiban", "grade_level": "Grade 7", "section": "TULIP"},
    {"lrn": "118026190023", "full_name": "Cedric Paolo Ferrer", "grade_level": "Grade 7", "section": "TULIP"},
    {"lrn": "118026190024", "full_name": "Delia Rosa Buenaventura", "grade_level": "Grade 7", "section": "TULIP"},
    {"lrn": "118026190025", "full_name": "Edgar Andrei Valencia", "grade_level": "Grade 7", "section": "TULIP"},
    {"lrn": "118026190026", "full_name": "Francesca Mae Hernandez", "grade_level": "Grade 7", "section": "TULIP"},
    {"lrn": "118026190027", "full_name": "Gerald Rey Villafuerte", "grade_level": "Grade 7", "section": "TULIP"},
    {"lrn": "118026190028", "full_name": "Hazel Joy Salazar", "grade_level": "Grade 7", "section": "TULIP"},
    {"lrn": "118026190029", "full_name": "Ian Carlo Espinosa", "grade_level": "Grade 7", "section": "TULIP"},
    {"lrn": "118026190030", "full_name": "Jasmine Claire De Leon", "grade_level": "Grade 7", "section": "TULIP"},
    {"lrn": "118026190031", "full_name": "Kyle Martin Cabrera", "grade_level": "Grade 7", "section": "TULIP"},
    {"lrn": "118026190032", "full_name": "Leah Christine Ocampo", "grade_level": "Grade 7", "section": "TULIP"},
    {"lrn": "118026190033", "full_name": "Mario Rafael Dela Vega", "grade_level": "Grade 7", "section": "TULIP"},
    {"lrn": "118026190034", "full_name": "Noelle Patricia Aguilar", "grade_level": "Grade 7", "section": "TULIP"},
    {"lrn": "118026190035", "full_name": "Oliver James Morales", "grade_level": "Grade 7", "section": "TULIP"},
    {"lrn": "118026190036", "full_name": "Pamela Rose Mercado", "grade_level": "Grade 7", "section": "TULIP"},
    {"lrn": "118026190037", "full_name": "Quincy Andrei Abad", "grade_level": "Grade 7", "section": "TULIP"},
    {"lrn": "118026190038", "full_name": "Rina Marie Castaneda", "grade_level": "Grade 7", "section": "TULIP"},
    {"lrn": "118026190039", "full_name": "Stefan Luis Pascual", "grade_level": "Grade 7", "section": "TULIP"},
    {"lrn": "118026190040", "full_name": "Tanya Claire Reyes", "grade_level": "Grade 7", "section": "TULIP"}
  ]'::jsonb;
BEGIN
  FOR v_student IN SELECT * FROM jsonb_to_recordset(v_students) AS x(lrn text, full_name text, grade_level text, section text)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM users WHERE lrn = v_student.lrn) THEN
      v_user_id := gen_random_uuid();
      v_profile_id := gen_random_uuid();
      v_role_id := gen_random_uuid();

      INSERT INTO users (id, lrn, password_hash, full_name, must_change_password)
      VALUES (v_user_id, v_student.lrn, crypt(v_student.lrn, gen_salt('bf', 10)), v_student.full_name, true);

      INSERT INTO profiles (id, user_id, full_name, grade_level, section, archived, has_voted)
      VALUES (v_profile_id, v_user_id, v_student.full_name, v_student.grade_level, v_student.section, false, false);

      INSERT INTO user_roles (id, user_id, role)
      VALUES (v_role_id, v_user_id, 'voter');
    END IF;
  END LOOP;
END;
$$;

-- Verification query
SELECT grade_level, section, count(*) 
FROM profiles 
WHERE grade_level = 'Grade 7' 
GROUP BY grade_level, section 
ORDER BY section;
