import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// ─── Students per section (10 each) ─────────────────────────────
// LRN format: 12 digits, unique per student
const voters = [

  // ── Grade 7 · Gold ────────────────────────────────────────────
  { lrn: '700100000001', full_name: 'Alonzo Miguel Reyes',        grade_level: 'Grade 7', section: 'Gold' },
  { lrn: '700100000002', full_name: 'Beatriz Anne Santos',        grade_level: 'Grade 7', section: 'Gold' },
  { lrn: '700100000003', full_name: 'Carlo James Dela Cruz',      grade_level: 'Grade 7', section: 'Gold' },
  { lrn: '700100000004', full_name: 'Diana Marie Flores',         grade_level: 'Grade 7', section: 'Gold' },
  { lrn: '700100000005', full_name: 'Emilio Jose Ramos',          grade_level: 'Grade 7', section: 'Gold' },
  { lrn: '700100000006', full_name: 'Faith Angela Torres',        grade_level: 'Grade 7', section: 'Gold' },
  { lrn: '700100000007', full_name: 'Gabriel Luis Navarro',       grade_level: 'Grade 7', section: 'Gold' },
  { lrn: '700100000008', full_name: 'Hannah Rose Mendoza',        grade_level: 'Grade 7', section: 'Gold' },
  { lrn: '700100000009', full_name: 'Ivan Rey Castillo',          grade_level: 'Grade 7', section: 'Gold' },
  { lrn: '700100000010', full_name: 'Jana Claire Villanueva',     grade_level: 'Grade 7', section: 'Gold' },

  // ── Grade 7 · Silver ─────────────────────────────────────────
  { lrn: '700200000001', full_name: 'Karl Martin Aquino',         grade_level: 'Grade 7', section: 'Silver' },
  { lrn: '700200000002', full_name: 'Lara Nicole Bautista',       grade_level: 'Grade 7', section: 'Silver' },
  { lrn: '700200000003', full_name: 'Marc Angelo Lim',            grade_level: 'Grade 7', section: 'Silver' },
  { lrn: '700200000004', full_name: 'Nina Patricia Rivera',       grade_level: 'Grade 7', section: 'Silver' },
  { lrn: '700200000005', full_name: 'Oscar Rafael Garcia',        grade_level: 'Grade 7', section: 'Silver' },
  { lrn: '700200000006', full_name: 'Paula Kristine Soriano',     grade_level: 'Grade 7', section: 'Silver' },
  { lrn: '700200000007', full_name: 'Quentin Jose Padilla',       grade_level: 'Grade 7', section: 'Silver' },
  { lrn: '700200000008', full_name: 'Rachel Anne Magalona',       grade_level: 'Grade 7', section: 'Silver' },
  { lrn: '700200000009', full_name: 'Samuel Diego Peralta',       grade_level: 'Grade 7', section: 'Silver' },
  { lrn: '700200000010', full_name: 'Trisha Mae Evangelista',     grade_level: 'Grade 7', section: 'Silver' },

  // ── Grade 7 · Bronze ─────────────────────────────────────────
  { lrn: '700300000001', full_name: 'Ulysses John Cruz',          grade_level: 'Grade 7', section: 'Bronze' },
  { lrn: '700300000002', full_name: 'Vanessa Joy Manahan',        grade_level: 'Grade 7', section: 'Bronze' },
  { lrn: '700300000003', full_name: 'Warren Luis Santiago',       grade_level: 'Grade 7', section: 'Bronze' },
  { lrn: '700300000004', full_name: 'Xyra Anne Tolentino',        grade_level: 'Grade 7', section: 'Bronze' },
  { lrn: '700300000005', full_name: 'Yvan Gabriel Domingo',       grade_level: 'Grade 7', section: 'Bronze' },
  { lrn: '700300000006', full_name: 'Zoey Marie Quirino',         grade_level: 'Grade 7', section: 'Bronze' },
  { lrn: '700300000007', full_name: 'Aaron James Bernardo',       grade_level: 'Grade 7', section: 'Bronze' },
  { lrn: '700300000008', full_name: 'Bianca Louise Panganiban',   grade_level: 'Grade 7', section: 'Bronze' },
  { lrn: '700300000009', full_name: 'Cedric Paolo Ferrer',        grade_level: 'Grade 7', section: 'Bronze' },
  { lrn: '700300000010', full_name: 'Delia Rosa Buenaventura',    grade_level: 'Grade 7', section: 'Bronze' },

  // ── Grade 8 · Pearl ──────────────────────────────────────────
  { lrn: '800100000001', full_name: 'Edgar Andrei Valencia',      grade_level: 'Grade 8', section: 'Pearl' },
  { lrn: '800100000002', full_name: 'Francesca Mae Hernandez',    grade_level: 'Grade 8', section: 'Pearl' },
  { lrn: '800100000003', full_name: 'Gerald Rey Villafuerte',     grade_level: 'Grade 8', section: 'Pearl' },
  { lrn: '800100000004', full_name: 'Hazel Joy Salazar',          grade_level: 'Grade 8', section: 'Pearl' },
  { lrn: '800100000005', full_name: 'Ian Carlo Espinosa',         grade_level: 'Grade 8', section: 'Pearl' },
  { lrn: '800100000006', full_name: 'Jasmine Claire De Leon',     grade_level: 'Grade 8', section: 'Pearl' },
  { lrn: '800100000007', full_name: 'Kyle Martin Cabrera',        grade_level: 'Grade 8', section: 'Pearl' },
  { lrn: '800100000008', full_name: 'Leah Christine Ocampo',      grade_level: 'Grade 8', section: 'Pearl' },
  { lrn: '800100000009', full_name: 'Mario Rafael Dela Vega',     grade_level: 'Grade 8', section: 'Pearl' },
  { lrn: '800100000010', full_name: 'Noelle Patricia Aguilar',    grade_level: 'Grade 8', section: 'Pearl' },

  // ── Grade 8 · Ruby ───────────────────────────────────────────
  { lrn: '800200000001', full_name: 'Oliver James Morales',       grade_level: 'Grade 8', section: 'Ruby' },
  { lrn: '800200000002', full_name: 'Pamela Rose Mercado',        grade_level: 'Grade 8', section: 'Ruby' },
  { lrn: '800200000003', full_name: 'Quincy Andrei Abad',         grade_level: 'Grade 8', section: 'Ruby' },
  { lrn: '800200000004', full_name: 'Rina Marie Castaneda',       grade_level: 'Grade 8', section: 'Ruby' },
  { lrn: '800200000005', full_name: 'Stefan Luis Pascual',        grade_level: 'Grade 8', section: 'Ruby' },
  { lrn: '800200000006', full_name: 'Tanya Claire Reyes',         grade_level: 'Grade 8', section: 'Ruby' },
  { lrn: '800200000007', full_name: 'Uriel Jose Macaraeg',        grade_level: 'Grade 8', section: 'Ruby' },
  { lrn: '800200000008', full_name: 'Vera Anne Pangilinan',       grade_level: 'Grade 8', section: 'Ruby' },
  { lrn: '800200000009', full_name: 'Wilbert Anton Dizon',        grade_level: 'Grade 8', section: 'Ruby' },
  { lrn: '800200000010', full_name: 'Ximena Joy Alvarez',         grade_level: 'Grade 8', section: 'Ruby' },

  // ── Grade 8 · Diamond ────────────────────────────────────────
  { lrn: '800300000001', full_name: 'Yannis Roque Batungbakal',   grade_level: 'Grade 8', section: 'Diamond' },
  { lrn: '800300000002', full_name: 'Zara Nicole Ibarra',         grade_level: 'Grade 8', section: 'Diamond' },
  { lrn: '800300000003', full_name: 'Adrian Miguel Corpus',       grade_level: 'Grade 8', section: 'Diamond' },
  { lrn: '800300000004', full_name: 'Bella Anne Constantino',     grade_level: 'Grade 8', section: 'Diamond' },
  { lrn: '800300000005', full_name: 'Cristian Jay De Guzman',     grade_level: 'Grade 8', section: 'Diamond' },
  { lrn: '800300000006', full_name: 'Dina Rose Valdez',           grade_level: 'Grade 8', section: 'Diamond' },
  { lrn: '800300000007', full_name: 'Enrique Paolo Atienza',      grade_level: 'Grade 8', section: 'Diamond' },
  { lrn: '800300000008', full_name: 'Fiona Mae Villareal',        grade_level: 'Grade 8', section: 'Diamond' },
  { lrn: '800300000009', full_name: 'Gregorio Luis Mateo',        grade_level: 'Grade 8', section: 'Diamond' },
  { lrn: '800300000010', full_name: 'Harriet Joy Sabino',         grade_level: 'Grade 8', section: 'Diamond' },

  // ── Grade 9 · Wisdom ─────────────────────────────────────────
  { lrn: '900100000001', full_name: 'Ignacio Rey Acosta',         grade_level: 'Grade 9', section: 'Wisdom' },
  { lrn: '900100000002', full_name: 'Juliana Rose Alcantara',     grade_level: 'Grade 9', section: 'Wisdom' },
  { lrn: '900100000003', full_name: 'Kevin James Dela Peña',      grade_level: 'Grade 9', section: 'Wisdom' },
  { lrn: '900100000004', full_name: 'Lena Patricia Badillo',      grade_level: 'Grade 9', section: 'Wisdom' },
  { lrn: '900100000005', full_name: 'Manuel Andrei Concepcion',   grade_level: 'Grade 9', section: 'Wisdom' },
  { lrn: '900100000006', full_name: 'Nadia Claire Galang',        grade_level: 'Grade 9', section: 'Wisdom' },
  { lrn: '900100000007', full_name: 'Orlando Jose Tan',           grade_level: 'Grade 9', section: 'Wisdom' },
  { lrn: '900100000008', full_name: 'Portia Anne Zabala',         grade_level: 'Grade 9', section: 'Wisdom' },
  { lrn: '900100000009', full_name: 'Quirico Luis Sarmiento',     grade_level: 'Grade 9', section: 'Wisdom' },
  { lrn: '900100000010', full_name: 'Renata Joy Cordova',         grade_level: 'Grade 9', section: 'Wisdom' },

  // ── Grade 9 · Excellence ──────────────────────────────────────
  { lrn: '900200000001', full_name: 'Sergio Miguel Arenas',       grade_level: 'Grade 9', section: 'Excellence' },
  { lrn: '900200000002', full_name: 'Tina Nicole Guinto',         grade_level: 'Grade 9', section: 'Excellence' },
  { lrn: '900200000003', full_name: 'Umberto Jay Hipolito',       grade_level: 'Grade 9', section: 'Excellence' },
  { lrn: '900200000004', full_name: 'Valeria Rose Ilagan',        grade_level: 'Grade 9', section: 'Excellence' },
  { lrn: '900200000005', full_name: 'Wesley Andrei Javellana',    grade_level: 'Grade 9', section: 'Excellence' },
  { lrn: '900200000006', full_name: 'Xenia Claire Lazaro',        grade_level: 'Grade 9', section: 'Excellence' },
  { lrn: '900200000007', full_name: 'Yolanda Mae Macapagal',      grade_level: 'Grade 9', section: 'Excellence' },
  { lrn: '900200000008', full_name: 'Zachariah Luis Nieva',       grade_level: 'Grade 9', section: 'Excellence' },
  { lrn: '900200000009', full_name: 'Abigail Joy Obispo',         grade_level: 'Grade 9', section: 'Excellence' },
  { lrn: '900200000010', full_name: 'Bernard Rey Paguio',         grade_level: 'Grade 9', section: 'Excellence' },

  // ── Grade 9 · Integrity ──────────────────────────────────────
  { lrn: '900300000001', full_name: 'Clarice Anne Quilang',       grade_level: 'Grade 9', section: 'Integrity' },
  { lrn: '900300000002', full_name: 'Danton Jose Regalado',       grade_level: 'Grade 9', section: 'Integrity' },
  { lrn: '900300000003', full_name: 'Estrella Mae Salcedo',       grade_level: 'Grade 9', section: 'Integrity' },
  { lrn: '900300000004', full_name: 'Ferdie Luis Tamayo',         grade_level: 'Grade 9', section: 'Integrity' },
  { lrn: '900300000005', full_name: 'Gloria Rose Umali',          grade_level: 'Grade 9', section: 'Integrity' },
  { lrn: '900300000006', full_name: 'Hernan Miguel Velasquez',    grade_level: 'Grade 9', section: 'Integrity' },
  { lrn: '900300000007', full_name: 'Irene Patricia Yap',         grade_level: 'Grade 9', section: 'Integrity' },
  { lrn: '900300000008', full_name: 'Jerome Jay Zulueta',         grade_level: 'Grade 9', section: 'Integrity' },
  { lrn: '900300000009', full_name: 'Katrina Anne Abello',        grade_level: 'Grade 9', section: 'Integrity' },
  { lrn: '900300000010', full_name: 'Lorenzo Miguel Baluyot',     grade_level: 'Grade 9', section: 'Integrity' },

  // ── Grade 10 · Fortitude ─────────────────────────────────────
  { lrn: '100100000001', full_name: 'Mabel Joy Camacho',          grade_level: 'Grade 10', section: 'Fortitude' },
  { lrn: '100100000002', full_name: 'Nathan Rey Dimayuga',        grade_level: 'Grade 10', section: 'Fortitude' },
  { lrn: '100100000003', full_name: 'Olive Anne Enriquez',        grade_level: 'Grade 10', section: 'Fortitude' },
  { lrn: '100100000004', full_name: 'Pedro Luis Fajardo',         grade_level: 'Grade 10', section: 'Fortitude' },
  { lrn: '100100000005', full_name: 'Queenie Mae Gatmaitan',      grade_level: 'Grade 10', section: 'Fortitude' },
  { lrn: '100100000006', full_name: 'Ramon Miguel Herrera',       grade_level: 'Grade 10', section: 'Fortitude' },
  { lrn: '100100000007', full_name: 'Susana Claire Iguban',       grade_level: 'Grade 10', section: 'Fortitude' },
  { lrn: '100100000008', full_name: 'Teodoro Jay Jurado',         grade_level: 'Grade 10', section: 'Fortitude' },
  { lrn: '100100000009', full_name: 'Ursula Rose Lacson',         grade_level: 'Grade 10', section: 'Fortitude' },
  { lrn: '100100000010', full_name: 'Vicente Andrei Manalang',    grade_level: 'Grade 10', section: 'Fortitude' },

  // ── Grade 10 · Resilience ────────────────────────────────────
  { lrn: '100200000001', full_name: 'Wendy Patricia Natividad',   grade_level: 'Grade 10', section: 'Resilience' },
  { lrn: '100200000002', full_name: 'Xavier Jose Olaes',          grade_level: 'Grade 10', section: 'Resilience' },
  { lrn: '100200000003', full_name: 'Yvette Anne Paraiso',        grade_level: 'Grade 10', section: 'Resilience' },
  { lrn: '100200000004', full_name: 'Zandro Miguel Quizon',       grade_level: 'Grade 10', section: 'Resilience' },
  { lrn: '100200000005', full_name: 'Alma Joy Rodrigo',           grade_level: 'Grade 10', section: 'Resilience' },
  { lrn: '100200000006', full_name: 'Baldo Rey Samson',           grade_level: 'Grade 10', section: 'Resilience' },
  { lrn: '100200000007', full_name: 'Carmen Anne Trinidad',       grade_level: 'Grade 10', section: 'Resilience' },
  { lrn: '100200000008', full_name: 'Dino Luis Urbano',           grade_level: 'Grade 10', section: 'Resilience' },
  { lrn: '100200000009', full_name: 'Elena Mae Vasquez',          grade_level: 'Grade 10', section: 'Resilience' },
  { lrn: '100200000010', full_name: 'Florencio Jay Wenceslao',    grade_level: 'Grade 10', section: 'Resilience' },

  // ── Grade 10 · Leadership ────────────────────────────────────
  { lrn: '100300000001', full_name: 'Gloria Claire Xavier',       grade_level: 'Grade 10', section: 'Leadership' },
  { lrn: '100300000002', full_name: 'Homer Miguel Yanga',         grade_level: 'Grade 10', section: 'Leadership' },
  { lrn: '100300000003', full_name: 'Ingrid Rose Zarate',         grade_level: 'Grade 10', section: 'Leadership' },
  { lrn: '100300000004', full_name: 'Jaime Luis Abalos',          grade_level: 'Grade 10', section: 'Leadership' },
  { lrn: '100300000005', full_name: 'Karen Anne Baldon',          grade_level: 'Grade 10', section: 'Leadership' },
  { lrn: '100300000006', full_name: 'Leonardo Jay Calixto',       grade_level: 'Grade 10', section: 'Leadership' },
  { lrn: '100300000007', full_name: 'Maricela Mae Dalisay',       grade_level: 'Grade 10', section: 'Leadership' },
  { lrn: '100300000008', full_name: 'Nestor Miguel Espejo',       grade_level: 'Grade 10', section: 'Leadership' },
  { lrn: '100300000009', full_name: 'Ophelia Rose Feliciano',     grade_level: 'Grade 10', section: 'Leadership' },
  { lrn: '100300000010', full_name: 'Patricio Luis Guzman',       grade_level: 'Grade 10', section: 'Leadership' },

  // ── Grade 11 · ICT ───────────────────────────────────────────
  { lrn: '110100000001', full_name: 'Quezon Anne Hilario',        grade_level: 'Grade 11', section: 'ICT' },
  { lrn: '110100000002', full_name: 'Renaldo Jay Ilano',          grade_level: 'Grade 11', section: 'ICT' },
  { lrn: '110100000003', full_name: 'Shaina Rose Jacinto',        grade_level: 'Grade 11', section: 'ICT' },
  { lrn: '110100000004', full_name: 'Teodore Miguel Kaw',         grade_level: 'Grade 11', section: 'ICT' },
  { lrn: '110100000005', full_name: 'Ursula Claire Lapuz',        grade_level: 'Grade 11', section: 'ICT' },
  { lrn: '110100000006', full_name: 'Victor Luis Macaraeg',       grade_level: 'Grade 11', section: 'ICT' },
  { lrn: '110100000007', full_name: 'Winona Joy Nacpil',          grade_level: 'Grade 11', section: 'ICT' },
  { lrn: '110100000008', full_name: 'Xander Rey Oliveros',        grade_level: 'Grade 11', section: 'ICT' },
  { lrn: '110100000009', full_name: 'Yolanda Anne Pacheco',       grade_level: 'Grade 11', section: 'ICT' },
  { lrn: '110100000010', full_name: 'Zenaida Mae Quero',          grade_level: 'Grade 11', section: 'ICT' },

  // ── Grade 11 · Cookery ───────────────────────────────────────
  { lrn: '110200000001', full_name: 'Alfredo Jay Ricafort',       grade_level: 'Grade 11', section: 'Cookery' },
  { lrn: '110200000002', full_name: 'Bernardita Rose Salonga',    grade_level: 'Grade 11', section: 'Cookery' },
  { lrn: '110200000003', full_name: 'Celso Miguel Tamondong',     grade_level: 'Grade 11', section: 'Cookery' },
  { lrn: '110200000004', full_name: 'Daisy Anne Umipig',          grade_level: 'Grade 11', section: 'Cookery' },
  { lrn: '110200000005', full_name: 'Ernesto Luis Villena',       grade_level: 'Grade 11', section: 'Cookery' },
  { lrn: '110200000006', full_name: 'Florinda Joy Wagan',         grade_level: 'Grade 11', section: 'Cookery' },
  { lrn: '110200000007', full_name: 'Gilberto Rey Ybanez',        grade_level: 'Grade 11', section: 'Cookery' },
  { lrn: '110200000008', full_name: 'Hilda Anne Zamora',          grade_level: 'Grade 11', section: 'Cookery' },
  { lrn: '110200000009', full_name: 'Isagani Miguel Abaya',       grade_level: 'Grade 11', section: 'Cookery' },
  { lrn: '110200000010', full_name: 'Jovita Rose Bacolod',        grade_level: 'Grade 11', section: 'Cookery' },

  // ── Grade 11 · Tourism ───────────────────────────────────────
  { lrn: '110300000001', full_name: 'Kristoffer Jay Cano',        grade_level: 'Grade 11', section: 'Tourism' },
  { lrn: '110300000002', full_name: 'Lolita Anne Dano',           grade_level: 'Grade 11', section: 'Tourism' },
  { lrn: '110300000003', full_name: 'Maximo Miguel Evangelio',    grade_level: 'Grade 11', section: 'Tourism' },
  { lrn: '110300000004', full_name: 'Norma Rose Falco',           grade_level: 'Grade 11', section: 'Tourism' },
  { lrn: '110300000005', full_name: 'Onofre Luis Galo',           grade_level: 'Grade 11', section: 'Tourism' },
  { lrn: '110300000006', full_name: 'Perpetua Joy Habana',        grade_level: 'Grade 11', section: 'Tourism' },
  { lrn: '110300000007', full_name: 'Quirino Rey Ibanez',         grade_level: 'Grade 11', section: 'Tourism' },
  { lrn: '110300000008', full_name: 'Rosalinda Anne Jara',        grade_level: 'Grade 11', section: 'Tourism' },
  { lrn: '110300000009', full_name: 'Salvador Miguel Kalaw',      grade_level: 'Grade 11', section: 'Tourism' },
  { lrn: '110300000010', full_name: 'Teresita Joy Labrador',      grade_level: 'Grade 11', section: 'Tourism' },

  // ── Grade 12 · ICT ───────────────────────────────────────────
  { lrn: '120100000001', full_name: 'Urbano Rey Maceda',          grade_level: 'Grade 12', section: 'ICT' },
  { lrn: '120100000002', full_name: 'Visitacion Anne Nardo',      grade_level: 'Grade 12', section: 'ICT' },
  { lrn: '120100000003', full_name: 'Wilfredo Miguel Obiena',     grade_level: 'Grade 12', section: 'ICT' },
  { lrn: '120100000004', full_name: 'Ximena Rose Padua',          grade_level: 'Grade 12', section: 'ICT' },
  { lrn: '120100000005', full_name: 'Yosef Luis Quinio',          grade_level: 'Grade 12', section: 'ICT' },
  { lrn: '120100000006', full_name: 'Zosima Joy Retuya',          grade_level: 'Grade 12', section: 'ICT' },
  { lrn: '120100000007', full_name: 'Arsenio Rey Suarez',         grade_level: 'Grade 12', section: 'ICT' },
  { lrn: '120100000008', full_name: 'Bonifacia Anne Tan',         grade_level: 'Grade 12', section: 'ICT' },
  { lrn: '120100000009', full_name: 'Catalino Miguel Ureta',      grade_level: 'Grade 12', section: 'ICT' },
  { lrn: '120100000010', full_name: 'Dolores Rose Vargas',        grade_level: 'Grade 12', section: 'ICT' },

  // ── Grade 12 · Cookery ───────────────────────────────────────
  { lrn: '120200000001', full_name: 'Edmundo Jay Wagas',          grade_level: 'Grade 12', section: 'Cookery' },
  { lrn: '120200000002', full_name: 'Felicitas Anne Ybañez',      grade_level: 'Grade 12', section: 'Cookery' },
  { lrn: '120200000003', full_name: 'Gregoria Miguel Zamudio',    grade_level: 'Grade 12', section: 'Cookery' },
  { lrn: '120200000004', full_name: 'Honesto Rey Abando',         grade_level: 'Grade 12', section: 'Cookery' },
  { lrn: '120200000005', full_name: 'Iluminada Rose Bacani',      grade_level: 'Grade 12', section: 'Cookery' },
  { lrn: '120200000006', full_name: 'Jacinto Luis Cadayona',      grade_level: 'Grade 12', section: 'Cookery' },
  { lrn: '120200000007', full_name: 'Katalina Joy Dagunan',       grade_level: 'Grade 12', section: 'Cookery' },
  { lrn: '120200000008', full_name: 'Laureano Rey Ebuenga',       grade_level: 'Grade 12', section: 'Cookery' },
  { lrn: '120200000009', full_name: 'Magdalena Anne Fabricante',  grade_level: 'Grade 12', section: 'Cookery' },
  { lrn: '120200000010', full_name: 'Narciso Miguel Gervacio',    grade_level: 'Grade 12', section: 'Cookery' },

  // ── Grade 12 · Tourism ───────────────────────────────────────
  { lrn: '120300000001', full_name: 'Ofelia Rose Hondrade',       grade_level: 'Grade 12', section: 'Tourism' },
  { lrn: '120300000002', full_name: 'Porfirio Jay Ignacio',       grade_level: 'Grade 12', section: 'Tourism' },
  { lrn: '120300000003', full_name: 'Quirina Anne Jumalon',       grade_level: 'Grade 12', section: 'Tourism' },
  { lrn: '120300000004', full_name: 'Rizalino Miguel Kiamco',     grade_level: 'Grade 12', section: 'Tourism' },
  { lrn: '120300000005', full_name: 'Salvacion Joy Lapinig',      grade_level: 'Grade 12', section: 'Tourism' },
  { lrn: '120300000006', full_name: 'Telesforo Rey Mabasa',       grade_level: 'Grade 12', section: 'Tourism' },
  { lrn: '120300000007', full_name: 'Ulyssa Anne Nadala',         grade_level: 'Grade 12', section: 'Tourism' },
  { lrn: '120300000008', full_name: 'Venancio Luis Olazo',        grade_level: 'Grade 12', section: 'Tourism' },
  { lrn: '120300000009', full_name: 'Wilhelmina Rose Pineda',     grade_level: 'Grade 12', section: 'Tourism' },
  { lrn: '120300000010', full_name: 'Xanthus Jay Quibod',         grade_level: 'Grade 12', section: 'Tourism' },
];

// ─── Candidates (updated to use correct new sections) ────────────
const candidatesByPosition = {
  'President': [
    { name: 'Andrei Jose Villanueva',   grade_level: 'Grade 12', section: 'ICT',        party_list: 'Bagong Pag-asa', motto: 'Together we rise, united we thrive.' },
    { name: 'Sofia Marie Navarro',      grade_level: 'Grade 11', section: 'ICT',        party_list: 'Pagbabago',     motto: 'A voice for every student, every day.' },
  ],
  'Vice President': [
    { name: 'Marco Rafael Dela Vega',   grade_level: 'Grade 11', section: 'Cookery',    party_list: 'Bagong Pag-asa', motto: 'Service above self.' },
    { name: 'Jasmine Elise Reyes',      grade_level: 'Grade 12', section: 'Cookery',    party_list: 'Kabataan',      motto: 'Lead with heart, serve with purpose.' },
  ],
  'Secretary': [
    { name: 'Nina Patricia Castillo',   grade_level: 'Grade 10', section: 'Leadership', party_list: 'Pagbabago',     motto: 'Organized, dedicated, transparent.' },
    { name: 'Carlo James Buenaventura', grade_level: 'Grade 11', section: 'Tourism',    party_list: 'Bagong Pag-asa', motto: 'Every word counts, every record matters.' },
  ],
  'Treasurer': [
    { name: 'Angela Faith Cruz',        grade_level: 'Grade 11', section: 'ICT',        party_list: 'Kabataan',      motto: 'Wise stewards of our shared resources.' },
    { name: 'Renz Alberto Magalona',    grade_level: 'Grade 10', section: 'Resilience', party_list: 'Pagbabago',     motto: 'Integrity in every centavo.' },
  ],
  'Auditor': [
    { name: 'Bianca Marie Tolentino',   grade_level: 'Grade 12', section: 'ICT',        party_list: 'Bagong Pag-asa', motto: 'Truth and accountability always.' },
    { name: 'Edison Andre Lim',         grade_level: 'Grade 11', section: 'Tourism',    party_list: 'Kabataan',      motto: "Numbers don't lie — and neither do I." },
  ],
  'Public Information Officer': [
    { name: 'Kyla Denise Soriano',      grade_level: 'Grade 10', section: 'Leadership', party_list: 'Pagbabago',     motto: 'Connecting students through communication.' },
    { name: 'James Ryan Evangelista',   grade_level: 'Grade 11', section: 'ICT',        party_list: 'Kabataan',      motto: 'Your news, your voice, your school.' },
    { name: 'Patricia Anne Bernardo',   grade_level: 'Grade 12', section: 'Cookery',    party_list: 'Bagong Pag-asa', motto: 'Transparency builds trust.' },
  ],
  'Peace Officer': [
    { name: 'Vincent Raul Padilla',     grade_level: 'Grade 12', section: 'Tourism',    party_list: 'Bagong Pag-asa', motto: 'Peace starts with one step.' },
    { name: 'Ella Joy Domingo',         grade_level: 'Grade 11', section: 'Cookery',    party_list: 'Pagbabago',     motto: 'A safer school for everyone.' },
    { name: 'Miguel Santos Cruz',       grade_level: 'Grade 10', section: 'Fortitude',  party_list: 'Kabataan',      motto: 'Discipline with compassion.' },
  ],
  'Grade 7 Representative': [
    { name: 'Leo Gabriel Bernardo',     grade_level: 'Grade 7',  section: 'Gold',       party_list: 'Kabataan',      motto: 'The future begins in Grade 7.' },
    { name: 'Trisha Mae Bautista',      grade_level: 'Grade 7',  section: 'Silver',     party_list: 'Pagbabago',     motto: 'Small steps, big dreams.' },
  ],
  'Grade 8 Representative': [
    { name: 'Mark Angelo Salazar',      grade_level: 'Grade 8',  section: 'Pearl',      party_list: 'Bagong Pag-asa', motto: 'Rising stronger in Grade 8.' },
    { name: 'Kaye Louise Villafuerte',  grade_level: 'Grade 8',  section: 'Ruby',       party_list: 'Kabataan',      motto: 'For a brighter Grade 8.' },
  ],
  'Grade 9 Representative': [
    { name: 'Jared Elijah Aquino',      grade_level: 'Grade 9',  section: 'Wisdom',     party_list: 'Pagbabago',     motto: 'Grade 9: Stronger, Smarter, Together.' },
    { name: 'Angie Rose Quirino',       grade_level: 'Grade 9',  section: 'Excellence', party_list: 'Bagong Pag-asa', motto: 'Empowering every Grade 9 student.' },
  ],
  'Grade 10 Representative': [
    { name: 'Rico Manuel Manahan',      grade_level: 'Grade 10', section: 'Fortitude',  party_list: 'Kabataan',      motto: 'Grade 10: Leading the way.' },
    { name: 'Ysabelle Joy Castro',      grade_level: 'Grade 10', section: 'Resilience', party_list: 'Pagbabago',     motto: 'A rep who truly represents.' },
  ],
  'Grade 11 Representative': [
    { name: 'Paolo Andrei Miranda',     grade_level: 'Grade 11', section: 'ICT',        party_list: 'Bagong Pag-asa', motto: 'Senior high, senior values.' },
    { name: 'Fatima Denise Peralta',    grade_level: 'Grade 11', section: 'Cookery',    party_list: 'Kabataan',      motto: 'Grade 11 voices heard and respected.' },
  ],
  'Grade 12 Representative': [
    { name: 'Dominic Miguel Santiago',  grade_level: 'Grade 12', section: 'ICT',        party_list: 'Pagbabago',     motto: 'Leaving a legacy for those behind us.' },
    { name: 'Rhea Christine Fernandez', grade_level: 'Grade 12', section: 'Tourism',    party_list: 'Bagong Pag-asa', motto: 'The final year, the greatest impact.' },
  ],
};

async function seed() {
  console.log('🌱 Starting seed with new sections...\n');

  // ─── 1. Fetch positions ───────────────────────────────────────
  const { data: positions, error: posError } = await supabase
    .from('positions')
    .select('id, title')
    .order('display_order');

  if (posError) { console.error('Failed to fetch positions:', posError); return; }
  console.log(`✅ Found ${positions.length} positions`);

  const posMap = {};
  for (const p of positions) posMap[p.title] = p.id;

  // ─── 2. Delete all old voters, candidates, votes ─────────────
  console.log('\n🗑️  Clearing old data...');
  await supabase.from('votes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('candidates').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('users').delete().neq('lrn', 'admin');
  console.log('  ✅ Old voters, candidates and votes cleared');

  // ─── 3. Insert new voters ─────────────────────────────────────
  // ─── 3. Insert new voters in batches ───────────────────────────
  console.log(`\n📋 Creating ${voters.length} voters...`);
  
  // Fast password hashing for seed data (6 salt rounds)
  const passwordHashMap = {};
  for (const v of voters) {
    if (!passwordHashMap[v.lrn]) {
      passwordHashMap[v.lrn] = bcrypt.hashSync(v.lrn, 6);
    }
  }

  const userBatch = [];
  const profileBatch = [];
  const roleBatch = [];
  const voterIds = [];

  for (const v of voters) {
    const id = uuidv4();
    userBatch.push({
      id,
      lrn: v.lrn,
      password_hash: passwordHashMap[v.lrn],
      full_name: v.full_name,
      must_change_password: false,
    });
    profileBatch.push({
      id: uuidv4(),
      user_id: id,
      full_name: v.full_name,
      grade_level: v.grade_level,
      section: v.section,
    });
    roleBatch.push({
      id: uuidv4(),
      user_id: id,
      role: 'voter',
    });
    voterIds.push({ id, ...v });
  }

  const { error: usersErr } = await supabase.from('users').insert(userBatch);
  if (usersErr) { console.error('  ❌ Users batch insert error:', usersErr.message); return; }
  
  const { error: profErr } = await supabase.from('profiles').insert(profileBatch);
  if (profErr) { console.error('  ❌ Profiles batch insert error:', profErr.message); return; }

  const { error: roleErr } = await supabase.from('user_roles').insert(roleBatch);
  if (roleErr) { console.error('  ❌ User roles batch insert error:', roleErr.message); return; }

  console.log(`  ✅ Successfully created ${voters.length} voters across all sections!`);

  // ─── 4. Insert candidates ─────────────────────────────────────
  console.log('\n🏅 Creating candidates...');
  const candidateRecords = {};
  const candidateBatch = [];
  const candMetaList = [];

  for (const [posTitle, cands] of Object.entries(candidatesByPosition)) {
    const posId = posMap[posTitle];
    if (!posId) { console.error(`  ❌ Position "${posTitle}" not found`); continue; }

    candidateRecords[posTitle] = [];

    for (const c of cands) {
      const id = uuidv4();
      const candObj = {
        id, name: c.name, position_id: posId,
        grade_level: c.grade_level, section: c.section,
        party_list: c.party_list, motto: c.motto,
      };
      candidateBatch.push(candObj);
      candidateRecords[posTitle].push(candObj);
      candMetaList.push({ posTitle, name: c.name, party_list: c.party_list });
    }
  }

  const { error: candErr } = await supabase.from('candidates').insert(candidateBatch);
  if (candErr) { console.error('  ❌ Candidates batch insert error:', candErr.message); return; }

  for (const c of candMetaList) {
    console.log(`  ✅ ${c.posTitle}: ${c.name} (${c.party_list})`);
  }

  // ─── 5. Generate votes (first 80 voters vote) ────────────────
  const votingVoters = voterIds.slice(0, Math.min(80, voterIds.length));
  console.log(`\n🗳️  Generating votes for ${votingVoters.length} voters...`);

  for (const voter of votingVoters) {
    const voteRecords = [];

    for (const [posTitle, cands] of Object.entries(candidateRecords)) {
      if (!cands || cands.length === 0) continue;

      // Grade representatives: only vote for your own grade
      if (posTitle.includes('Representative')) {
        const gradeNum = voter.grade_level.replace('Grade ', '');
        if (!posTitle.includes(`Grade ${gradeNum}`)) continue;
      }

      const posId = posMap[posTitle];
      const maxVotes = (posTitle === 'Public Information Officer' || posTitle === 'Peace Officer') ? 2 : 1;
      const numVotes = Math.min(maxVotes, cands.length);

      const shuffled = [...cands];
      if (Math.random() > 0.4) { /* keep order */ } else { shuffled.reverse(); }

      for (let i = 0; i < numVotes; i++) {
        voteRecords.push({ candidate_id: shuffled[i].id, position_id: posId });
      }
    }

    const { error: rpcErr } = await supabase.rpc('submit_votes', {
      p_voter_id: voter.id,
      p_votes: voteRecords,
    });

    if (rpcErr) console.error(`  ❌ Votes for ${voter.full_name}:`, rpcErr.message);
  }
  console.log(`  ✅ ${votingVoters.length} voters cast their votes successfully!`);

  // ─── 6. Summary ───────────────────────────────────────────────
  const { count: totalVoters }     = await supabase.from('user_roles').select('*', { count: 'exact', head: true }).eq('role', 'voter');
  const { count: totalVoted }      = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('has_voted', true);
  const { count: totalVotes }      = await supabase.from('votes').select('*', { count: 'exact', head: true });
  const { count: totalCandidates } = await supabase.from('candidates').select('*', { count: 'exact', head: true });

  console.log('\n─────────────────────────────────');
  console.log('🎉 SEED COMPLETE!');
  console.log(`   Sections:   G7 (Gold/Silver/Bronze) · G8 (Pearl/Ruby/Diamond)`);
  console.log(`              G9 (Wisdom/Excellence/Integrity) · G10 (Fortitude/Resilience/Leadership)`);
  console.log(`              G11 & G12 (ICT/Cookery/Tourism)`);
  console.log(`   Voters:     ${totalVoters}`);
  console.log(`   Voted:      ${totalVoted}`);
  console.log(`   Candidates: ${totalCandidates}`);
  console.log(`   Total Votes: ${totalVotes}`);
  console.log('─────────────────────────────────\n');
}

seed().catch(err => console.error('Seed failed:', err));
