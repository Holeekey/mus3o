import { MuseumSchema, type Museum } from '@mus3o/shared'

// Museo plantilla generado con Aris a partir de apuntes reales de pediatría (Infecciones osteoarticulares).
// Se guarda tal cual salió (8 salas): abrirlo no gasta IA, y con los apuntes de origen cada concepto muestra su cita.

export const osteoarticularNotes = "INFECCIONES OSTEOARTICULARES EN PEDIATRÍA\n\n1. Introducción y Justificación Clínica\nLas infecciones osteoarticulares (IOA) constituyen un grupo de afecciones inflamatorias de origen infeccioso que comprometen el sistema musculoesquelético durante la infancia. Representan un desafío crítico en la práctica pediátrica debido a:\n- Dificultad de reconocimiento precoz: Sus manifestaciones iniciales pueden ser sutiles o inespecíficas, retrasando el diagnóstico.\n- Alta tasa de hospitalización: Requieren un manejo multidisciplinario prolongado y monitorización estricta en el ámbito intrahospitalario.\n- Elevado porcentaje de secuelas limitantes: El retraso terapéutico puede conducir a la destrucción del cartílago de crecimiento, deformidades óseas crónicas y discapacidad funcional permanente.\n\nEpidemiología General\n- Distribución por edad: El 50% de los casos ocurre en niños menores de 5 años, y de este porcentaje, la mitad (el 25% del total general) se concentra en menores de 2 años.\n- Localización anatómica: Existe un claro predominio por los huesos largos de las extremidades inferiores. El orden de frecuencia es Fémur, seguido de la Tibia y, en tercer lugar, el Húmero.\n- Presentación: Habitualmente son infecciones unifocales.\n- Antecedentes: El 30% de los pacientes presenta el antecedente de un traumatismo local previo.\n- Recurrencia: Se reporta una tasa de recurrencia o reactivación que oscila entre el 5% y el 10%.\n\n2. Clasificación y Patogenia de las Entidades Clínicas\nOsteomielitis\nDefinida como la inflamación del tejido óseo provocada por un agente infeccioso (bacteriano, fúngico, micobacteriano o parasitario). Su clasificación evolutiva se establece según el tiempo de duración de los síntomas:\n- Aguda: Menos de 2 semanas de evolución.\n- Subaguda: De 2 semanas a 3 meses de evolución.\n- Crónica: Más de 3 meses de evolución.\n\nOsteoartritis\nSe caracteriza por el compromiso simultáneo del tejido óseo y del espacio articular.\n- Es característica de niños menores de 18 meses debido a la anatomía de la irrigación ósea en esta etapa.\n- Se acompaña frecuentemente de síntomas sistémicos graves.\n- Las articulaciones con mayor susceptibilidad de afectación simultánea son la cadera y el hombro.\n\nArtritis Séptica\nEs el resultado directo de la invasión y proliferación de microorganismos patógenos dentro del espacio intraarticular.\n- Población de alto riesgo: Neonatos, pacientes inmunosuprimidos y pacientes con hemofilia.\n- Sitios de afectación (en orden decreciente): Rodilla, Cadera, Tobillo, Codo, Hombro y Vértebras.\n- Pronóstico: El factor pronóstico más determinante es el tiempo transcurrido entre el inicio de los síntomas y la instauración del tratamiento; a menor tiempo, mejor pronóstico funcional.\n- Dolor severo. Inflamación. Imposibilidad deambular. Signos inflamatorios y limitación funcional.\n- Duración de tratamiento 3-4 semanas. 5 días VEV y resolución quirúrgica.\n- Artrotomía: líquido sinovial denso, patógenos agresivos SAMR, parámetros inflamatorios muy elevados, mayor tiempo de evolución.\n\nMecanismos de Transmisión y Patogenia\n- Vía Hematógena: Es la principal vía en pediatría, propiciada por la rica vascularización metafisaria.\n- Por Contigüidad: Extensión directa desde un foco infeccioso adyacente (partes blandas o articulación vecina).\n- Invasión o Penetración Directa: Inoculación por traumas penetrantes, heridas punzantes o procedimientos quirúrgicos.\n\nDinámica de la Irrigación Ósea según la Edad\n- Lactantes menores de 18 meses: Existen vasos transperiféricos que comunican directamente la metáfisis con la epífisis, atravesando el cartílago de crecimiento. Esto explica por qué en esta edad la osteomielitis progresa rápidamente a osteoartritis y artritis séptica de la articulación adyacente.\n- Niños mayores de 2 años: La circulación de la metáfisis y de la epífisis se vuelve independiente. El cartílago de crecimiento actúa como una barrera mecánica y vascular, aislando la infección en la metáfisis y protegiendo la articulación.\n\n3. Fisiopatología y Hallazgos Anatomopatológicos en la Cronicidad\n1. Se inicia una osteítis con invasión de las trabéculas óseas en la región metafisaria.\n2. La acumulación de material purulento genera un absceso que drena a través de la cortical hacia el espacio subperióstico, comprometiendo la irrigación del hueso.\n3. Se producen fenómenos estructurales característicos de la osteomielitis crónica:\n- Secuestro óseo: Fragmento de tejido óseo necrótico que se ha quedado desprovisto de flujo sanguíneo y se separa por completo del hueso sano circundante. Funciona como un nido que perpetúa la infección al impedir la llegada de antibióticos.\n- Involucro: Capa de hueso nuevo, viable y reactivo (esclerosado) que se forma alrededor del secuestro óseo como un intento del organismo por estabilizar la zona.\n- Cloaca: Solución de continuidad o agujero que se forma en el involucro, a través del cual el material purulento busca salida desde el interior del hueso hacia la cortical.\n- Fístula: Trayecto o vía de drenaje anómala que comunica el involucro y el absceso intraóseo con las partes blandas superficiales, la piel o los órganos internos.\nEn el espacio articular (Artritis Séptica), la acumulación de bacterias induce la liberación de enzimas proteolíticas. El pus acumulado eleva drásticamente la presión intraarticular, lo que colapsa los vasos sanguíneos locales e induce una injuria irreversible del cartílago y del hueso subyacente si no se drena con rapidez.\n\n4. Manifestaciones Clínicas y Examen Físico\n- Fiebre (frecuentemente elevada en fases agudas).\n- Dolor localizado e intenso.\n- Limitación funcional, claudicación (cojera), rechazo a la deambulación o al apoyo de la extremidad.\n- Eritema, calor local y aumento de volumen (edema inflamatorio) en la zona afectada.\n- Pseudoparálisis: Actitud de inmovilidad absoluta del miembro afectado en lactantes pequeños para evitar el dolor provocado por el movimiento.\nPosiciones antiálgicas en artritis séptica:\n- Cadera: Posición en flexión, abducción y rotación externa.\n- Hombro: Miembro abducido y en rotación interna.\n- Tobillos, Rodillas y Codos: Se mantienen preferentemente en flexión.\n\n5. Abordaje Diagnóstico\n- Hematología Completa: La leucocitosis se evidencia en menos de la mitad de los casos de osteomielitis.\n- Velocidad de Sedimentación Globular (VSG): alcanza su pico máximo entre los 3 y 5 días; tarda entre 3 y 5 semanas en normalizarse.\n- Proteína C Reactiva (PCR): Es el marcador más sensible y dinámico. Se eleva en las primeras 24 a 48 horas y se normaliza en 7 a 10 días tras un tratamiento efectivo.\n- Hemocultivos y Cultivos Óseos/Sinoviales: Fundamentales para el aislamiento del patógeno y el antibiograma.\n- Radiología Simple: normal en etapas tempranas; los cambios óseos aparecen entre 7 y 15 días después.\n- Ultrasonografía: método de elección inicial ante la sospecha de artritis séptica.\n- Resonancia Magnética Nuclear (RMN): Gold Standard. El Gadolinio diferencia el edema óseo de un absceso (Absceso de Brodie).\nCriterios de Kocher modificados (sensibilidad del 93%): celularidad sinovial > 50.000 células/ml, leucocitos > 12.000/mm³, VSG > 40 mm/hora, fiebre > 38,5 °C, imposibilidad de soportar peso.\nArtrocentesis: procedimiento diagnóstico y terapéutico. Líquido séptico: purulento, > 50.000 cel/ml, > 75% neutrófilos, glucosa disminuida, cultivo positivo.\nDiagnóstico diferencial: brucelosis, gonorrea, leucemias, osteosarcoma, sarcoma de Ewing, neuroblastoma, anemia drepanocítica, maltrato infantil.\n\n6. Microbiología por Grupos de Edad\nEl agente más común es Staphylococcus aureus.\n- 0 a 3 meses: Staphylococcus aureus, Streptococcus agalactiae y enterobacterias.\n- 3 meses a 5 años: Staphylococcus aureus, Streptococcus pyogenes, Kingella kingae, Streptococcus pneumoniae y Haemophilus influenzae tipo b.\n- Mayores de 5 años: Staphylococcus aureus, Streptococcus pyogenes y Neisseria gonorrhoeae.\nSituaciones especiales: herida punzante en el pie (Pseudomonas aeruginosa), varicela (Streptococcus pyogenes), anemia drepanocítica (Salmonella), déficit de complemento (Neisseria meningitidis).\n\n7. Tratamiento Antimicrobiano\n- Vía endovenosa los primeros 2 a 5 días; paso a vía oral con mejoría clínica y descenso de la PCR mayor al 30%.\n- Osteomielitis aguda: 4 a 6 semanas. Artritis séptica: mínimo 14 días. Osteomielitis crónica: 6 a 12 meses.\n- Menores de 1 mes: Oxacilina + Cefotaxima. De 3 meses a 5 años: Oxacilina + Aminoglucósido. Mayores de 5 años: Oxacilina + Aminoglucósido.\n- SAMR: Clindamicina, Vancomicina o Linezolid. SASM: Cefadroxilo oral.\n\n8. Tratamiento Quirúrgico\n- Indicaciones: sin mejoría tras 72 horas de antibioterapia, secuestro óseo o absceso drenable; la artritis séptica es una emergencia traumatológica.\n- Artrocentesis evacuadora y artrotomía cuando el líquido es denso o el patógeno es agresivo.\n"

export const osteoarticularMuseum: Museum = MuseumSchema.parse({
  "title": "Infecciones osteoarticulares pediátricas",
  "theme": {
    "palette": [
      "#fbbf24",
      "#1c1203"
    ],
    "ambience": "cathedral"
  },
  "rooms": [
    {
      "id": "intro",
      "name": "Infecciones osteoarticulares",
      "description": "Exhibición temática de Infecciones osteoarticulares",
      "pieces": [
        {
          "id": "intro-p1",
          "title": "Importancia clínica",
          "text": "Son difíciles de reconocer, exigen hospitalización prolongada y pueden dejar secuelas como destrucción del cartílago de crecimiento.",
          "fact": "Una alarma gigante en un hospital infantil que suena tarde y deja huesos deformados",
          "mnemonicCue": "Una alarma gigante en un hospital infantil que suena tarde y deja huesos deformados",
          "model": {
            "type": "procedural",
            "parts": [
              {
                "shape": "cylinder",
                "args": [
                  0.2,
                  0.8,
                  0.9,
                  20
                ],
                "pos": [
                  0,
                  0.65,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#d4a017"
              },
              {
                "shape": "cylinder",
                "args": [
                  0.85,
                  0.85,
                  0.08,
                  20
                ],
                "pos": [
                  0,
                  0.2,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#b8860b"
              },
              {
                "shape": "sphere",
                "args": [
                  0.2,
                  10,
                  8
                ],
                "pos": [
                  0,
                  0.15,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#5c3a1e"
              },
              {
                "shape": "sphere",
                "args": [
                  0.15,
                  10,
                  8
                ],
                "pos": [
                  0,
                  1.2,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#d4a017"
              },
              {
                "shape": "box",
                "args": [
                  0.12,
                  0.3,
                  0.12
                ],
                "pos": [
                  0,
                  1.4,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#5c3a1e"
              }
            ]
          },
          "searchKeyword": "alarm bell",
          "imageSearch": {
            "wikiTitle": "Importancia clínica",
            "lang": "es",
            "context": "Infecciones osteoarticulares · Infecciones osteoarticulares pediátricas"
          },
          "source": {
            "quote": "- Elevado porcentaje de secuelas limitantes: El retraso terapéutico puede conducir a la destrucción del cartílago de crecimiento, deformidades óseas crónicas y discapacidad funcional permanente.",
            "line": 8
          }
        },
        {
          "id": "intro-p2",
          "title": "Distribución por edad",
          "text": "El 50% de los casos ocurre en menores de 5 años y el 25% del total en menores de 2 años.",
          "fact": "Cinco globos de cumpleaños, dos de ellos con pañales",
          "mnemonicCue": "Cinco globos de cumpleaños, dos de ellos con pañales",
          "model": {
            "type": "procedural",
            "parts": [
              {
                "shape": "sphere",
                "args": [
                  0.6,
                  16,
                  16
                ],
                "pos": [
                  0,
                  1.3,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#e63946"
              },
              {
                "shape": "cone",
                "args": [
                  0.12,
                  0.2,
                  8
                ],
                "pos": [
                  0,
                  0.65,
                  0
                ],
                "rot": [
                  3.14159,
                  0,
                  0
                ],
                "color": "#c1121f"
              },
              {
                "shape": "box",
                "args": [
                  0.3,
                  0.2,
                  0.3
                ],
                "pos": [
                  0,
                  0.1,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#8b5a2b"
              },
              {
                "shape": "cylinder",
                "args": [
                  0.01,
                  0.01,
                  0.4,
                  6
                ],
                "pos": [
                  0.12,
                  0.4,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0.3
                ],
                "color": "#444444"
              },
              {
                "shape": "cylinder",
                "args": [
                  0.01,
                  0.01,
                  0.4,
                  6
                ],
                "pos": [
                  -0.12,
                  0.4,
                  0
                ],
                "rot": [
                  0,
                  0,
                  -0.3
                ],
                "color": "#444444"
              }
            ]
          },
          "searchKeyword": "balloon",
          "imageSearch": {
            "wikiTitle": "Distribución por edad",
            "lang": "es",
            "context": "Infecciones osteoarticulares · Infecciones osteoarticulares pediátricas"
          },
          "source": {
            "quote": "- Distribución por edad: El 50% de los casos ocurre en niños menores de 5 años, y de este porcentaje, la mitad (el 25% del total general) se concentra en menores de 2 años.",
            "line": 11
          }
        },
        {
          "id": "intro-p3",
          "title": "Localización anatómica",
          "text": "Predominan los huesos largos de las piernas, en orden: fémur, tibia y húmero; suelen ser unifocales.",
          "fact": "Un podio con tres medallas óseas: fémur de oro, tibia de plata y húmero de bronce",
          "mnemonicCue": "Un podio con tres medallas óseas: fémur de oro, tibia de plata y húmero de bronce",
          "model": {
            "type": "procedural",
            "parts": [
              {
                "shape": "box",
                "args": [
                  1.6,
                  0.4,
                  1
                ],
                "pos": [
                  0,
                  0.2,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#d9a441"
              },
              {
                "shape": "box",
                "args": [
                  1.2,
                  0.4,
                  0.7
                ],
                "pos": [
                  0,
                  0.6,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#c8553d"
              },
              {
                "shape": "box",
                "args": [
                  0.8,
                  0.4,
                  0.45
                ],
                "pos": [
                  0,
                  1,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#588b8b"
              },
              {
                "shape": "cylinder",
                "args": [
                  0.18,
                  0.18,
                  0.5,
                  12
                ],
                "pos": [
                  0,
                  1.4,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#e8e2d6"
              },
              {
                "shape": "sphere",
                "args": [
                  0.28,
                  12,
                  8
                ],
                "pos": [
                  0,
                  1.8,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#6b7fd7"
              }
            ]
          },
          "searchKeyword": "podium",
          "imageSearch": {
            "wikiTitle": "Localización anatómica",
            "lang": "es",
            "context": "Infecciones osteoarticulares · Infecciones osteoarticulares pediátricas"
          },
          "source": {
            "quote": "- Localización anatómica: Existe un claro predominio por los huesos largos de las extremidades inferiores. El orden de frecuencia es Fémur, seguido de la Tibia y, en tercer lugar, el Húmero.",
            "line": 12
          }
        },
        {
          "id": "intro-p4",
          "title": "Antecedente de traumatismo",
          "text": "El 30% de los pacientes tiene el antecedente de un traumatismo local previo.",
          "fact": "Un niño que tropieza y deja caer un martillo de cristal con un 30 grabado",
          "mnemonicCue": "Un niño que tropieza y deja caer un martillo de cristal con un 30 grabado",
          "model": {
            "type": "procedural",
            "parts": [
              {
                "shape": "cylinder",
                "args": [
                  0.06,
                  0.07,
                  1.5,
                  10
                ],
                "pos": [
                  0,
                  0.75,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#8d6e63"
              },
              {
                "shape": "box",
                "args": [
                  0.9,
                  0.35,
                  0.35
                ],
                "pos": [
                  0,
                  1.6,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#607d8b"
              },
              {
                "shape": "box",
                "args": [
                  0.1,
                  0.4,
                  0.4
                ],
                "pos": [
                  0.5,
                  1.6,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#455a64"
              },
              {
                "shape": "box",
                "args": [
                  0.1,
                  0.4,
                  0.4
                ],
                "pos": [
                  -0.5,
                  1.6,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#455a64"
              }
            ]
          },
          "searchKeyword": "hammer",
          "imageSearch": {
            "wikiTitle": "Antecedente de traumatismo",
            "lang": "es",
            "context": "Infecciones osteoarticulares · Infecciones osteoarticulares pediátricas"
          },
          "source": {
            "quote": "- Antecedentes: El 30% de los pacientes presenta el antecedente de un traumatismo local previo.",
            "line": 14
          }
        },
        {
          "id": "intro-p5",
          "title": "Recurrencia",
          "text": "La tasa de recurrencia o reactivación oscila entre el 5% y el 10%.",
          "fact": "Un boomerang infeccioso que vuelve a la rodilla entre un 5 y un 10 por ciento de las veces",
          "mnemonicCue": "Un boomerang infeccioso que vuelve a la rodilla entre un 5 y un 10 por ciento de las veces",
          "model": {
            "type": "procedural",
            "parts": [
              {
                "shape": "box",
                "args": [
                  1.6,
                  0.25,
                  0.3
                ],
                "pos": [
                  0,
                  1,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0.6
                ],
                "color": "#c8553d"
              },
              {
                "shape": "box",
                "args": [
                  0.3,
                  0.25,
                  1.4
                ],
                "pos": [
                  0,
                  1,
                  0
                ],
                "rot": [
                  0,
                  0.6,
                  0
                ],
                "color": "#d9a441"
              },
              {
                "shape": "box",
                "args": [
                  1.6,
                  0.25,
                  0.3
                ],
                "pos": [
                  0,
                  1,
                  0
                ],
                "rot": [
                  0,
                  0,
                  -0.4
                ],
                "color": "#588b8b"
              },
              {
                "shape": "cylinder",
                "args": [
                  0.14,
                  0.14,
                  0.3,
                  12
                ],
                "pos": [
                  -0.9,
                  1.1,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#e8e2d6"
              },
              {
                "shape": "sphere",
                "args": [
                  0.16,
                  12,
                  8
                ],
                "pos": [
                  0.9,
                  0.6,
                  0.3
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#6b7fd7"
              }
            ]
          },
          "searchKeyword": "boomerang",
          "imageSearch": {
            "wikiTitle": "Recurrencia",
            "lang": "es",
            "context": "Infecciones osteoarticulares · Infecciones osteoarticulares pediátricas"
          },
          "source": {
            "quote": "- Recurrencia: Se reporta una tasa de recurrencia o reactivación que oscila entre el 5% y el 10%.",
            "line": 15
          }
        }
      ],
      "theme": "cathedral",
      "palette": {
        "primary": "#fbbf24",
        "fogColor": "#1c1203"
      },
      "monument": "dodecahedron",
      "imageSearch": {
        "wikiTitle": "Infecciones osteoarticulares",
        "lang": "es",
        "context": "Infecciones osteoarticulares pediátricas"
      }
    },
    {
      "id": "entidades",
      "name": "Entidades clínicas",
      "description": "Exhibición temática de Entidades clínicas",
      "pieces": [
        {
          "id": "entidades-p1",
          "title": "Osteomielitis",
          "text": "Inflamación del tejido óseo causada por un agente infeccioso bacteriano, fúngico, micobacteriano o parasitario.",
          "fact": "Un hueso de cristal con un enjambre de bacterias dentro",
          "mnemonicCue": "Un hueso de cristal con un enjambre de bacterias dentro",
          "model": {
            "type": "procedural",
            "parts": [
              {
                "shape": "cylinder",
                "args": [
                  0.22,
                  0.22,
                  1.4,
                  12
                ],
                "pos": [
                  0,
                  0.8,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#e8e2d6"
              },
              {
                "shape": "sphere",
                "args": [
                  0.36,
                  12,
                  8
                ],
                "pos": [
                  0,
                  1.5,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#e8e2d6"
              },
              {
                "shape": "sphere",
                "args": [
                  0.36,
                  12,
                  8
                ],
                "pos": [
                  0,
                  0.1,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#e8e2d6"
              },
              {
                "shape": "sphere",
                "args": [
                  0.22,
                  12,
                  8
                ],
                "pos": [
                  0.5,
                  0.15,
                  0.2
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#c8553d"
              },
              {
                "shape": "sphere",
                "args": [
                  0.22,
                  12,
                  8
                ],
                "pos": [
                  0.5,
                  1.55,
                  -0.2
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#c8553d"
              }
            ]
          },
          "searchKeyword": "bone",
          "imageSearch": {
            "wikiTitle": "Osteomielitis",
            "lang": "es",
            "context": "Entidades clínicas · Infecciones osteoarticulares pediátricas"
          },
          "source": {
            "quote": "Definida como la inflamación del tejido óseo provocada por un agente infeccioso (bacteriano, fúngico, micobacteriano o parasitario). Su clasificación evolutiva se establece según el tiempo de duración de los síntomas:",
            "line": 19
          }
        },
        {
          "id": "entidades-p2",
          "title": "Clasificación evolutiva",
          "text": "Aguda menos de 2 semanas, subaguda de 2 semanas a 3 meses y crónica más de 3 meses.",
          "fact": "Un reloj de arena con tres cámaras: dos semanas, tres meses y más",
          "mnemonicCue": "Un reloj de arena con tres cámaras: dos semanas, tres meses y más",
          "model": {
            "type": "procedural",
            "parts": [
              {
                "shape": "cylinder",
                "args": [
                  0.55,
                  0.55,
                  0.1,
                  20
                ],
                "pos": [
                  0,
                  0.05,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#5d4037"
              },
              {
                "shape": "cone",
                "args": [
                  0.45,
                  0.85,
                  20
                ],
                "pos": [
                  0,
                  0.52,
                  0
                ],
                "rot": [
                  3.14159,
                  0,
                  0
                ],
                "color": "#b3e5fc"
              },
              {
                "shape": "cone",
                "args": [
                  0.45,
                  0.85,
                  20
                ],
                "pos": [
                  0,
                  1.38,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#b3e5fc"
              },
              {
                "shape": "cone",
                "args": [
                  0.3,
                  0.5,
                  16
                ],
                "pos": [
                  0,
                  0.25,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#ffcc80"
              },
              {
                "shape": "cylinder",
                "args": [
                  0.55,
                  0.55,
                  0.1,
                  20
                ],
                "pos": [
                  0,
                  1.85,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#5d4037"
              }
            ]
          },
          "searchKeyword": "hourglass",
          "imageSearch": {
            "wikiTitle": "Clasificación evolutiva",
            "lang": "es",
            "context": "Entidades clínicas · Infecciones osteoarticulares pediátricas"
          },
          "source": {
            "quote": "Definida como la inflamación del tejido óseo provocada por un agente infeccioso (bacteriano, fúngico, micobacteriano o parasitario). Su clasificación evolutiva se establece según el tiempo de duración de los síntomas:",
            "line": 19
          }
        },
        {
          "id": "entidades-p3",
          "title": "Osteoartritis",
          "text": "Compromiso simultáneo del hueso y del espacio articular, típico de menores de 18 meses, sobre todo en cadera y hombro.",
          "fact": "Un hueso y una bisagra de puerta soldados y ardiendo juntos",
          "mnemonicCue": "Un hueso y una bisagra de puerta soldados y ardiendo juntos",
          "model": {
            "type": "procedural",
            "parts": [
              {
                "shape": "cylinder",
                "args": [
                  0.3,
                  0.3,
                  0.4,
                  12
                ],
                "pos": [
                  0,
                  0.2,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#588b8b"
              },
              {
                "shape": "box",
                "args": [
                  1.2,
                  0.2,
                  0.4
                ],
                "pos": [
                  0,
                  0.5,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#d9a441"
              },
              {
                "shape": "box",
                "args": [
                  0.2,
                  1,
                  0.3
                ],
                "pos": [
                  0.5,
                  1,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#c8553d"
              },
              {
                "shape": "cylinder",
                "args": [
                  0.12,
                  0.12,
                  0.5,
                  12
                ],
                "pos": [
                  -0.5,
                  0.5,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#e8e2d6"
              },
              {
                "shape": "sphere",
                "args": [
                  0.15,
                  12,
                  8
                ],
                "pos": [
                  0,
                  1.7,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#6b7fd7"
              }
            ]
          },
          "searchKeyword": "hinge",
          "imageSearch": {
            "wikiTitle": "Osteoartritis",
            "lang": "es",
            "context": "Entidades clínicas · Infecciones osteoarticulares pediátricas"
          },
          "source": {
            "quote": "- Lactantes menores de 18 meses: Existen vasos transperiféricos que comunican directamente la metáfisis con la epífisis, atravesando el cartílago de crecimiento. Esto explica por qué en esta edad la osteomielitis progresa rápidamente a oste",
            "line": 45
          }
        },
        {
          "id": "entidades-p4",
          "title": "Artritis séptica",
          "text": "Invasión y proliferación de microorganismos en el espacio intraarticular; afecta a neonatos, inmunosuprimidos y hemofílicos.",
          "fact": "Una articulación convertida en una piscina de pus invadida por microbios nadadores",
          "mnemonicCue": "Una articulación convertida en una piscina de pus invadida por microbios nadadores",
          "model": {
            "type": "procedural",
            "parts": [
              {
                "shape": "box",
                "args": [
                  2,
                  0.1,
                  1.2
                ],
                "pos": [
                  0,
                  0.05,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#588b8b"
              },
              {
                "shape": "box",
                "args": [
                  2,
                  0.8,
                  0.1
                ],
                "pos": [
                  0,
                  0.4,
                  0.6
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#6b7fd7"
              },
              {
                "shape": "box",
                "args": [
                  2,
                  0.8,
                  0.1
                ],
                "pos": [
                  0,
                  0.4,
                  -0.6
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#6b7fd7"
              },
              {
                "shape": "box",
                "args": [
                  0.1,
                  0.8,
                  1.2
                ],
                "pos": [
                  1,
                  0.4,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#6b7fd7"
              },
              {
                "shape": "box",
                "args": [
                  0.1,
                  0.8,
                  1.2
                ],
                "pos": [
                  -1,
                  0.4,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#6b7fd7"
              },
              {
                "shape": "box",
                "args": [
                  1.6,
                  0.02,
                  0.9
                ],
                "pos": [
                  0,
                  0.02,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#e8e2d6"
              }
            ]
          },
          "searchKeyword": "swimming pool",
          "imageSearch": {
            "wikiTitle": "Artritis séptica",
            "lang": "es",
            "context": "Entidades clínicas · Infecciones osteoarticulares pediátricas"
          },
          "source": {
            "quote": "En el espacio articular (Artritis Séptica), la acumulación de bacterias induce la liberación de enzimas proteolíticas. El pus acumulado eleva drásticamente la presión intraarticular, lo que colapsa los vasos sanguíneos locales e induce una ",
            "line": 56
          }
        },
        {
          "id": "entidades-p5",
          "title": "Sitios de la artritis séptica",
          "text": "Orden decreciente de afectación: rodilla, cadera, tobillo, codo, hombro y vértebras.",
          "fact": "Una escalera descendente: rodilla, cadera, tobillo, codo, hombro y vértebras",
          "mnemonicCue": "Una escalera descendente: rodilla, cadera, tobillo, codo, hombro y vértebras",
          "model": {
            "type": "procedural",
            "parts": [
              {
                "shape": "box",
                "args": [
                  1.6,
                  0.25,
                  0.6
                ],
                "pos": [
                  0,
                  0.125,
                  -0.6
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#d9a441"
              },
              {
                "shape": "box",
                "args": [
                  1.6,
                  0.25,
                  0.6
                ],
                "pos": [
                  0,
                  0.375,
                  -0.3
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#c8553d"
              },
              {
                "shape": "box",
                "args": [
                  1.6,
                  0.25,
                  0.6
                ],
                "pos": [
                  0,
                  0.625,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#d9a441"
              },
              {
                "shape": "box",
                "args": [
                  1.6,
                  0.25,
                  0.6
                ],
                "pos": [
                  0,
                  0.875,
                  0.3
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#c8553d"
              },
              {
                "shape": "box",
                "args": [
                  1.6,
                  0.25,
                  0.6
                ],
                "pos": [
                  0,
                  1.125,
                  0.6
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#d9a441"
              },
              {
                "shape": "box",
                "args": [
                  0.3,
                  0.3,
                  0.3
                ],
                "pos": [
                  0.6,
                  0.9,
                  0.2
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#6b7fd7"
              }
            ]
          },
          "searchKeyword": "stairs",
          "imageSearch": {
            "wikiTitle": "Sitios de la artritis séptica",
            "lang": "es",
            "context": "Entidades clínicas · Infecciones osteoarticulares pediátricas"
          },
          "source": {
            "quote": "- Sitios de afectación (en orden decreciente): Rodilla, Cadera, Tobillo, Codo, Hombro y Vértebras.",
            "line": 33
          }
        },
        {
          "id": "entidades-p6",
          "title": "Factor pronóstico",
          "text": "Lo más determinante es el tiempo entre el inicio de los síntomas y el tratamiento: a menor tiempo, mejor pronóstico funcional.",
          "fact": "Un cronómetro gigante que corre antes de que llegue la ambulancia",
          "mnemonicCue": "Un cronómetro gigante que corre antes de que llegue la ambulancia",
          "model": {
            "type": "procedural",
            "parts": [
              {
                "shape": "cylinder",
                "args": [
                  0.8,
                  0.8,
                  0.12,
                  16
                ],
                "pos": [
                  0,
                  0.06,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#6b7fd7"
              },
              {
                "shape": "cylinder",
                "args": [
                  0.6,
                  0.6,
                  0.5,
                  16
                ],
                "pos": [
                  0,
                  0.37,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#e8e2d6"
              },
              {
                "shape": "cylinder",
                "args": [
                  0.52,
                  0.52,
                  0.06,
                  16
                ],
                "pos": [
                  0,
                  0.65,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#d9a441"
              },
              {
                "shape": "box",
                "args": [
                  0.12,
                  0.2,
                  0.12
                ],
                "pos": [
                  0,
                  0.92,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#c8553d"
              },
              {
                "shape": "box",
                "args": [
                  0.08,
                  0.5,
                  0.08
                ],
                "pos": [
                  0.42,
                  0.45,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0.5
                ],
                "color": "#588b8b"
              },
              {
                "shape": "sphere",
                "args": [
                  0.1,
                  12,
                  8
                ],
                "pos": [
                  0,
                  1.1,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#d9a441"
              }
            ]
          },
          "searchKeyword": "stopwatch",
          "imageSearch": {
            "wikiTitle": "Factor pronóstico",
            "lang": "es",
            "context": "Entidades clínicas · Infecciones osteoarticulares pediátricas"
          },
          "source": {
            "quote": "- Pronóstico: El factor pronóstico más determinante es el tiempo transcurrido entre el inicio de los síntomas y la instauración del tratamiento; a menor tiempo, mejor pronóstico funcional.",
            "line": 34
          }
        }
      ],
      "theme": "organic",
      "palette": {
        "primary": "#34d399",
        "fogColor": "#052e1b"
      },
      "monument": "ring_system",
      "imageSearch": {
        "wikiTitle": "Entidades clínicas",
        "lang": "es",
        "context": "Infecciones osteoarticulares pediátricas"
      }
    },
    {
      "id": "patogenia",
      "name": "Vías de infección e irrigación ósea",
      "description": "Exhibición temática de Vías de infección e irrigación ósea",
      "pieces": [
        {
          "id": "patogenia-p1",
          "title": "Vía hematógena",
          "text": "Es la principal vía en pediatría, favorecida por la rica vascularización metafisaria.",
          "fact": "Un río rojo que arrastra barcos bacterianos hasta la metáfisis",
          "mnemonicCue": "Un río rojo que arrastra barcos bacterianos hasta la metáfisis",
          "model": {
            "type": "procedural",
            "parts": [
              {
                "shape": "box",
                "args": [
                  2,
                  0.04,
                  0.5
                ],
                "pos": [
                  0,
                  0.02,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#588b8b"
              },
              {
                "shape": "box",
                "args": [
                  0.4,
                  0.3,
                  0.4
                ],
                "pos": [
                  -0.8,
                  0.15,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#c8553d"
              },
              {
                "shape": "box",
                "args": [
                  0.5,
                  0.2,
                  0.4
                ],
                "pos": [
                  0.7,
                  0.1,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#d9a441"
              },
              {
                "shape": "cylinder",
                "args": [
                  0.08,
                  0.08,
                  1.2,
                  12
                ],
                "pos": [
                  0.1,
                  0.3,
                  0.2
                ],
                "rot": [
                  0,
                  0,
                  1.2
                ],
                "color": "#6b7fd7"
              },
              {
                "shape": "cylinder",
                "args": [
                  0.08,
                  0.08,
                  0.9,
                  12
                ],
                "pos": [
                  -0.2,
                  0.25,
                  -0.2
                ],
                "rot": [
                  0,
                  0,
                  -0.9
                ],
                "color": "#e8e2d6"
              },
              {
                "shape": "sphere",
                "args": [
                  0.12,
                  12,
                  8
                ],
                "pos": [
                  0.6,
                  0.5,
                  0.2
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#c8553d"
              }
            ]
          },
          "searchKeyword": "river",
          "imageSearch": {
            "wikiTitle": "Vía hematógena",
            "lang": "es",
            "context": "Vías de infección e irrigación ósea · Infecciones osteoarticulares pediátricas"
          },
          "source": {
            "quote": "- Vía Hematógena: Es la principal vía en pediatría, propiciada por la rica vascularización metafisaria.",
            "line": 40
          }
        },
        {
          "id": "patogenia-p2",
          "title": "Contigüidad",
          "text": "Extensión directa desde un foco adyacente, como partes blandas o una articulación vecina.",
          "fact": "Un incendio que salta de una casa vecina a la articulación",
          "mnemonicCue": "Un incendio que salta de una casa vecina a la articulación",
          "model": {
            "type": "procedural",
            "parts": [
              {
                "shape": "box",
                "args": [
                  1.4,
                  0.12,
                  1.4
                ],
                "pos": [
                  0,
                  0.06,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#d9a441"
              },
              {
                "shape": "cone",
                "args": [
                  0.35,
                  0.9,
                  12
                ],
                "pos": [
                  0,
                  0.6,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#c8553d"
              },
              {
                "shape": "cone",
                "args": [
                  0.25,
                  0.7,
                  12
                ],
                "pos": [
                  -0.35,
                  0.45,
                  0.2
                ],
                "rot": [
                  0,
                  0,
                  0.2
                ],
                "color": "#e8a33d"
              },
              {
                "shape": "cone",
                "args": [
                  0.22,
                  0.6,
                  12
                ],
                "pos": [
                  0.35,
                  0.4,
                  -0.15
                ],
                "rot": [
                  0,
                  0,
                  -0.2
                ],
                "color": "#e8a33d"
              },
              {
                "shape": "sphere",
                "args": [
                  0.15,
                  12,
                  8
                ],
                "pos": [
                  0,
                  1.1,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#d9a441"
              }
            ]
          },
          "searchKeyword": "fire",
          "imageSearch": {
            "wikiTitle": "Contigüidad",
            "lang": "es",
            "context": "Vías de infección e irrigación ósea · Infecciones osteoarticulares pediátricas"
          },
          "source": {
            "quote": "- Por Contigüidad: Extensión directa desde un foco infeccioso adyacente (partes blandas o articulación vecina).",
            "line": 41
          }
        },
        {
          "id": "patogenia-p3",
          "title": "Penetración directa",
          "text": "Inoculación por traumas penetrantes, heridas punzantes o procedimientos quirúrgicos.",
          "fact": "Una flecha clavada en el pie que inocula microbios",
          "mnemonicCue": "Una flecha clavada en el pie que inocula microbios",
          "model": {
            "type": "procedural",
            "parts": [
              {
                "shape": "cylinder",
                "args": [
                  0.04,
                  0.04,
                  1.6,
                  12
                ],
                "pos": [
                  0,
                  0.8,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#d9a441"
              },
              {
                "shape": "cone",
                "args": [
                  0.12,
                  0.35,
                  12
                ],
                "pos": [
                  0,
                  1.78,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#b8c2cc"
              },
              {
                "shape": "box",
                "args": [
                  0.3,
                  0.12,
                  0.04
                ],
                "pos": [
                  0,
                  0.1,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#c8553d"
              },
              {
                "shape": "box",
                "args": [
                  0.04,
                  0.25,
                  0.3
                ],
                "pos": [
                  0,
                  0.12,
                  0.12
                ],
                "rot": [
                  0.5,
                  0,
                  0
                ],
                "color": "#c8553d"
              },
              {
                "shape": "box",
                "args": [
                  0.04,
                  0.25,
                  0.3
                ],
                "pos": [
                  0,
                  0.12,
                  -0.12
                ],
                "rot": [
                  -0.5,
                  0,
                  0
                ],
                "color": "#c8553d"
              },
              {
                "shape": "box",
                "args": [
                  0.5,
                  0.04,
                  0.04
                ],
                "pos": [
                  0,
                  0.8,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#588b8b"
              }
            ]
          },
          "searchKeyword": "arrow",
          "imageSearch": {
            "wikiTitle": "Penetración directa",
            "lang": "es",
            "context": "Vías de infección e irrigación ósea · Infecciones osteoarticulares pediátricas"
          },
          "source": {
            "quote": "- Invasión o Penetración Directa: Inoculación por traumas penetrantes, heridas punzantes o procedimientos quirúrgicos.",
            "line": 42
          }
        },
        {
          "id": "patogenia-p4",
          "title": "Vasos transperiféricos",
          "text": "En menores de 18 meses comunican la metáfisis con la epífisis y explican la progresión rápida a osteoartritis y artritis séptica.",
          "fact": "Puentes colgantes que cruzan el cartílago y conectan metáfisis con epífisis en un bebé",
          "mnemonicCue": "Puentes colgantes que cruzan el cartílago y conectan metáfisis con epífisis en un bebé",
          "model": {
            "type": "procedural",
            "parts": [
              {
                "shape": "box",
                "args": [
                  2,
                  0.15,
                  0.6
                ],
                "pos": [
                  0,
                  0.6,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#8d6e63"
              },
              {
                "shape": "box",
                "args": [
                  0.3,
                  0.6,
                  0.5
                ],
                "pos": [
                  -0.8,
                  0.3,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#78909c"
              },
              {
                "shape": "box",
                "args": [
                  0.3,
                  0.6,
                  0.5
                ],
                "pos": [
                  0.8,
                  0.3,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#78909c"
              },
              {
                "shape": "box",
                "args": [
                  1.9,
                  0.08,
                  0.05
                ],
                "pos": [
                  0,
                  0.9,
                  0.28
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#5d4037"
              },
              {
                "shape": "box",
                "args": [
                  1.9,
                  0.08,
                  0.05
                ],
                "pos": [
                  0,
                  0.9,
                  -0.28
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#5d4037"
              }
            ]
          },
          "searchKeyword": "suspension bridge",
          "imageSearch": {
            "wikiTitle": "Vasos transperiféricos",
            "lang": "es",
            "context": "Vías de infección e irrigación ósea · Infecciones osteoarticulares pediátricas"
          },
          "source": {
            "quote": "- Lactantes menores de 18 meses: Existen vasos transperiféricos que comunican directamente la metáfisis con la epífisis, atravesando el cartílago de crecimiento. Esto explica por qué en esta edad la osteomielitis progresa rápidamente a oste",
            "line": 45
          }
        },
        {
          "id": "patogenia-p5",
          "title": "Cartílago de crecimiento como barrera",
          "text": "Desde los 2 años la circulación de metáfisis y epífisis es independiente y el cartílago aísla la infección en la metáfisis.",
          "fact": "Una muralla de caramelo que frena la infección en mayores de 2 años",
          "mnemonicCue": "Una muralla de caramelo que frena la infección en mayores de 2 años",
          "model": {
            "type": "procedural",
            "parts": [
              {
                "shape": "box",
                "args": [
                  2,
                  0.5,
                  0.4
                ],
                "pos": [
                  0,
                  0.25,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#e8e2d6"
              },
              {
                "shape": "box",
                "args": [
                  0.4,
                  0.5,
                  0.45
                ],
                "pos": [
                  -0.8,
                  0.85,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#d9a441"
              },
              {
                "shape": "box",
                "args": [
                  0.4,
                  0.5,
                  0.45
                ],
                "pos": [
                  0.8,
                  0.85,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#d9a441"
              },
              {
                "shape": "box",
                "args": [
                  0.5,
                  0.45,
                  0.42
                ],
                "pos": [
                  0,
                  0.72,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#c8553d"
              },
              {
                "shape": "box",
                "args": [
                  0.4,
                  0.25,
                  0.42
                ],
                "pos": [
                  0,
                  1.2,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#588b8b"
              },
              {
                "shape": "cylinder",
                "args": [
                  0.15,
                  0.15,
                  0.1,
                  12
                ],
                "pos": [
                  0,
                  0.5,
                  0.25
                ],
                "rot": [
                  1.5708,
                  0,
                  0
                ],
                "color": "#6b7fd7"
              }
            ]
          },
          "searchKeyword": "castle wall",
          "imageSearch": {
            "wikiTitle": "Cartílago de crecimiento como barrera",
            "lang": "es",
            "context": "Vías de infección e irrigación ósea · Infecciones osteoarticulares pediátricas"
          },
          "source": {
            "quote": "- Niños mayores de 2 años: La circulación de la metáfisis y de la epífisis se vuelve independiente. El cartílago de crecimiento actúa como una barrera mecánica y vascular, aislando la infección en la metáfisis y protegiendo la articulación.",
            "line": 46
          }
        },
        {
          "id": "patogenia-p6",
          "title": "Presión intraarticular",
          "text": "El pus eleva la presión, colapsa los vasos e induce injuria irreversible de cartílago y hueso si no se drena con rapidez.",
          "fact": "Una olla a presión de pus con enzimas que muerden el cartílago",
          "mnemonicCue": "Una olla a presión de pus con enzimas que muerden el cartílago",
          "model": {
            "type": "procedural",
            "parts": [
              {
                "shape": "cylinder",
                "args": [
                  0.45,
                  0.5,
                  1.1,
                  16
                ],
                "pos": [
                  0,
                  0.55,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#b8c2cc"
              },
              {
                "shape": "sphere",
                "args": [
                  0.48,
                  12,
                  8
                ],
                "pos": [
                  0,
                  1.1,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#c8553d"
              },
              {
                "shape": "cylinder",
                "args": [
                  0.12,
                  0.12,
                  0.25,
                  12
                ],
                "pos": [
                  0,
                  1.35,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#d9a441"
              },
              {
                "shape": "box",
                "args": [
                  0.6,
                  0.1,
                  0.1
                ],
                "pos": [
                  0,
                  1.5,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#e8e2d6"
              },
              {
                "shape": "box",
                "args": [
                  0.5,
                  0.1,
                  0.1
                ],
                "pos": [
                  0,
                  1.6,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#e8e2d6"
              },
              {
                "shape": "cylinder",
                "args": [
                  0.05,
                  0.05,
                  0.5,
                  12
                ],
                "pos": [
                  0.55,
                  0.5,
                  0
                ],
                "rot": [
                  0,
                  0,
                  1.2
                ],
                "color": "#588b8b"
              },
              {
                "shape": "box",
                "args": [
                  0.25,
                  0.15,
                  0.25
                ],
                "pos": [
                  -0.5,
                  0.2,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#6b7fd7"
              }
            ]
          },
          "searchKeyword": "pressure cooker",
          "imageSearch": {
            "wikiTitle": "Presión intraarticular",
            "lang": "es",
            "context": "Vías de infección e irrigación ósea · Infecciones osteoarticulares pediátricas"
          },
          "source": {
            "quote": "En el espacio articular (Artritis Séptica), la acumulación de bacterias induce la liberación de enzimas proteolíticas. El pus acumulado eleva drásticamente la presión intraarticular, lo que colapsa los vasos sanguíneos locales e induce una ",
            "line": 56
          }
        }
      ],
      "theme": "ancient",
      "palette": {
        "primary": "#f87171",
        "fogColor": "#1f0a0a"
      },
      "monument": "torus",
      "imageSearch": {
        "wikiTitle": "Vías de infección e irrigación ósea",
        "lang": "es",
        "context": "Infecciones osteoarticulares pediátricas"
      }
    },
    {
      "id": "cronicidad",
      "name": "Osteomielitis crónica",
      "description": "Exhibición temática de Osteomielitis crónica",
      "pieces": [
        {
          "id": "cronicidad-p1",
          "title": "Osteítis metafisaria",
          "text": "Se inicia con invasión de las trabéculas óseas en la región metafisaria.",
          "fact": "Termitas que perforan las vigas de una metáfisis de madera",
          "mnemonicCue": "Termitas que perforan las vigas de una metáfisis de madera",
          "model": {
            "type": "procedural",
            "parts": [
              {
                "shape": "cone",
                "args": [
                  0.6,
                  1.6,
                  12
                ],
                "pos": [
                  0,
                  0.8,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#d9a441"
              },
              {
                "shape": "sphere",
                "args": [
                  0.35,
                  12,
                  8
                ],
                "pos": [
                  0,
                  1.7,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#c8553d"
              },
              {
                "shape": "box",
                "args": [
                  0.9,
                  0.25,
                  0.5
                ],
                "pos": [
                  0,
                  0.12,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#588b8b"
              },
              {
                "shape": "sphere",
                "args": [
                  0.08,
                  12,
                  8
                ],
                "pos": [
                  -0.12,
                  1.75,
                  0.3
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#e8e2d6"
              },
              {
                "shape": "sphere",
                "args": [
                  0.08,
                  12,
                  8
                ],
                "pos": [
                  0.12,
                  1.75,
                  0.3
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#e8e2d6"
              }
            ]
          },
          "searchKeyword": "termite",
          "imageSearch": {
            "wikiTitle": "Osteítis metafisaria",
            "lang": "es",
            "context": "Osteomielitis crónica · Infecciones osteoarticulares pediátricas"
          },
          "source": {
            "quote": "1. Se inicia una osteítis con invasión de las trabéculas óseas en la región metafisaria.",
            "line": 49
          }
        },
        {
          "id": "cronicidad-p2",
          "title": "Absceso subperióstico",
          "text": "El pus drena a través de la cortical hacia el espacio subperióstico y compromete la irrigación del hueso.",
          "fact": "Un globo de pus que revienta la cortical y se infla bajo una funda",
          "mnemonicCue": "Un globo de pus que revienta la cortical y se infla bajo una funda",
          "model": {
            "type": "procedural",
            "parts": [
              {
                "shape": "sphere",
                "args": [
                  0.6,
                  16,
                  16
                ],
                "pos": [
                  0,
                  1.3,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#e63946"
              },
              {
                "shape": "cone",
                "args": [
                  0.12,
                  0.2,
                  8
                ],
                "pos": [
                  0,
                  0.65,
                  0
                ],
                "rot": [
                  3.14159,
                  0,
                  0
                ],
                "color": "#c1121f"
              },
              {
                "shape": "box",
                "args": [
                  0.3,
                  0.2,
                  0.3
                ],
                "pos": [
                  0,
                  0.1,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#8b5a2b"
              },
              {
                "shape": "cylinder",
                "args": [
                  0.01,
                  0.01,
                  0.4,
                  6
                ],
                "pos": [
                  0.12,
                  0.4,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0.3
                ],
                "color": "#444444"
              },
              {
                "shape": "cylinder",
                "args": [
                  0.01,
                  0.01,
                  0.4,
                  6
                ],
                "pos": [
                  -0.12,
                  0.4,
                  0
                ],
                "rot": [
                  0,
                  0,
                  -0.3
                ],
                "color": "#444444"
              }
            ]
          },
          "searchKeyword": "balloon",
          "imageSearch": {
            "wikiTitle": "Absceso subperióstico",
            "lang": "es",
            "context": "Osteomielitis crónica · Infecciones osteoarticulares pediátricas"
          },
          "source": {
            "quote": "2. La acumulación de material purulento genera un absceso que drena a través de la cortical hacia el espacio subperióstico, comprometiendo la irrigación del hueso.",
            "line": 50
          }
        },
        {
          "id": "cronicidad-p3",
          "title": "Secuestro óseo",
          "text": "Fragmento de hueso necrótico sin flujo sanguíneo, separado del hueso sano; perpetúa la infección al impedir la llegada de antibióticos.",
          "fact": "Un fragmento negro de hueso muerto atrincherado como un nido que repele a los antibióticos",
          "mnemonicCue": "Un fragmento negro de hueso muerto atrincherado como un nido que repele a los antibióticos",
          "model": {
            "type": "procedural",
            "parts": [
              {
                "shape": "box",
                "args": [
                  1.8,
                  0.9,
                  1.4
                ],
                "pos": [
                  0,
                  0.45,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#6b7fd7"
              },
              {
                "shape": "box",
                "args": [
                  1.2,
                  0.7,
                  0.2
                ],
                "pos": [
                  0,
                  0.35,
                  0.8
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#d9a441"
              },
              {
                "shape": "box",
                "args": [
                  0.5,
                  0.5,
                  0.1
                ],
                "pos": [
                  0.5,
                  0.7,
                  0.73
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#e8e2d6"
              },
              {
                "shape": "cylinder",
                "args": [
                  0.08,
                  0.08,
                  0.6,
                  12
                ],
                "pos": [
                  -0.6,
                  1.2,
                  0.4
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#c8553d"
              },
              {
                "shape": "box",
                "args": [
                  2,
                  0.12,
                  1.6
                ],
                "pos": [
                  0,
                  0.06,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#588b8b"
              }
            ]
          },
          "searchKeyword": "bunker",
          "imageSearch": {
            "wikiTitle": "Secuestro óseo",
            "lang": "es",
            "context": "Osteomielitis crónica · Infecciones osteoarticulares pediátricas"
          },
          "source": {
            "quote": "- Secuestro óseo: Fragmento de tejido óseo necrótico que se ha quedado desprovisto de flujo sanguíneo y se separa por completo del hueso sano circundante. Funciona como un nido que perpetúa la infección al impedir la llegada de antibióticos",
            "line": 52
          }
        },
        {
          "id": "cronicidad-p4",
          "title": "Involucro",
          "text": "Capa de hueso nuevo, reactivo y esclerosado alrededor del secuestro, que intenta estabilizar la zona.",
          "fact": "Una armadura de hueso nuevo y duro que envuelve al secuestro",
          "mnemonicCue": "Una armadura de hueso nuevo y duro que envuelve al secuestro",
          "model": {
            "type": "procedural",
            "parts": [
              {
                "shape": "sphere",
                "args": [
                  0.8,
                  16,
                  12
                ],
                "pos": [
                  0,
                  1,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#8a9bb3"
              },
              {
                "shape": "cylinder",
                "args": [
                  0.55,
                  0.7,
                  0.6,
                  16
                ],
                "pos": [
                  0,
                  0.3,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#c8553d"
              },
              {
                "shape": "box",
                "args": [
                  0.5,
                  0.25,
                  0.15
                ],
                "pos": [
                  0,
                  1.1,
                  0.72
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#d9a441"
              },
              {
                "shape": "cylinder",
                "args": [
                  0.12,
                  0.12,
                  0.2,
                  12
                ],
                "pos": [
                  0.9,
                  0.95,
                  0
                ],
                "rot": [
                  0,
                  0,
                  1.5708
                ],
                "color": "#e8e2d6"
              },
              {
                "shape": "cylinder",
                "args": [
                  0.12,
                  0.12,
                  0.2,
                  12
                ],
                "pos": [
                  -0.9,
                  0.95,
                  0
                ],
                "rot": [
                  0,
                  0,
                  1.5708
                ],
                "color": "#e8e2d6"
              }
            ]
          },
          "searchKeyword": "armor",
          "imageSearch": {
            "wikiTitle": "Involucro",
            "lang": "es",
            "context": "Osteomielitis crónica · Infecciones osteoarticulares pediátricas"
          },
          "source": {
            "quote": "- Involucro: Capa de hueso nuevo, viable y reactivo (esclerosado) que se forma alrededor del secuestro óseo como un intento del organismo por estabilizar la zona.",
            "line": 53
          }
        },
        {
          "id": "cronicidad-p5",
          "title": "Cloaca",
          "text": "Agujero en el involucro por donde el material purulento busca salida desde el interior del hueso.",
          "fact": "Una alcantarilla abierta en la armadura por donde sale el pus",
          "mnemonicCue": "Una alcantarilla abierta en la armadura por donde sale el pus",
          "model": {
            "type": "procedural",
            "parts": [
              {
                "shape": "cylinder",
                "args": [
                  0.7,
                  0.7,
                  0.15,
                  16
                ],
                "pos": [
                  0,
                  0.08,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#6b7fd7"
              },
              {
                "shape": "cylinder",
                "args": [
                  0.6,
                  0.6,
                  0.1,
                  16
                ],
                "pos": [
                  0,
                  0.2,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#d9a441"
              },
              {
                "shape": "box",
                "args": [
                  0.25,
                  0.04,
                  0.25
                ],
                "pos": [
                  0.25,
                  0.28,
                  0.2
                ],
                "rot": [
                  0,
                  0,
                  0.3
                ],
                "color": "#588b8b"
              },
              {
                "shape": "box",
                "args": [
                  0.25,
                  0.04,
                  0.25
                ],
                "pos": [
                  -0.3,
                  0.28,
                  -0.1
                ],
                "rot": [
                  0,
                  0.8,
                  0
                ],
                "color": "#588b8b"
              },
              {
                "shape": "box",
                "args": [
                  0.25,
                  0.04,
                  0.25
                ],
                "pos": [
                  0.05,
                  0.28,
                  -0.3
                ],
                "rot": [
                  0,
                  0.4,
                  0
                ],
                "color": "#588b8b"
              },
              {
                "shape": "cylinder",
                "args": [
                  0.9,
                  0.9,
                  0.1,
                  16
                ],
                "pos": [
                  0,
                  0.02,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#e8e2d6"
              }
            ]
          },
          "searchKeyword": "manhole",
          "imageSearch": {
            "wikiTitle": "Cloaca",
            "lang": "es",
            "context": "Osteomielitis crónica · Infecciones osteoarticulares pediátricas"
          },
          "source": {
            "quote": "- Cloaca: Solución de continuidad o agujero que se forma en el involucro, a través del cual el material purulento busca salida desde el interior del hueso hacia la cortical.",
            "line": 54
          }
        },
        {
          "id": "cronicidad-p6",
          "title": "Fístula",
          "text": "Trayecto anómalo de drenaje que comunica el involucro y el absceso intraóseo con partes blandas, piel u órganos.",
          "fact": "Un túnel de metro que conecta el absceso con la piel",
          "mnemonicCue": "Un túnel de metro que conecta el absceso con la piel",
          "model": {
            "type": "procedural",
            "parts": [
              {
                "shape": "box",
                "args": [
                  2,
                  0.6,
                  0.6
                ],
                "pos": [
                  0,
                  0.4,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#c8553d"
              },
              {
                "shape": "box",
                "args": [
                  2,
                  0.1,
                  0.6
                ],
                "pos": [
                  0,
                  0.05,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#588b8b"
              },
              {
                "shape": "box",
                "args": [
                  0.9,
                  0.15,
                  0.6
                ],
                "pos": [
                  0,
                  0.72,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#d9a441"
              },
              {
                "shape": "cylinder",
                "args": [
                  0.3,
                  0.3,
                  2,
                  12
                ],
                "pos": [
                  0,
                  0.7,
                  0
                ],
                "rot": [
                  0,
                  0,
                  1.5708
                ],
                "color": "#e8e2d6"
              },
              {
                "shape": "box",
                "args": [
                  0.3,
                  0.15,
                  0.6
                ],
                "pos": [
                  0.6,
                  0.6,
                  0.5
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#6b7fd7"
              }
            ]
          },
          "searchKeyword": "subway tunnel",
          "imageSearch": {
            "wikiTitle": "Fístula",
            "lang": "es",
            "context": "Osteomielitis crónica · Infecciones osteoarticulares pediátricas"
          },
          "source": {
            "quote": "- Fístula: Trayecto o vía de drenaje anómala que comunica el involucro y el absceso intraóseo con las partes blandas superficiales, la piel o los órganos internos.",
            "line": 55
          }
        }
      ],
      "theme": "void",
      "palette": {
        "primary": "#a78bfa",
        "fogColor": "#0f0a1f"
      },
      "monument": "crystal",
      "imageSearch": {
        "wikiTitle": "Osteomielitis crónica",
        "lang": "es",
        "context": "Infecciones osteoarticulares pediátricas"
      }
    },
    {
      "id": "clinica",
      "name": "Manifestaciones clínicas",
      "description": "Exhibición temática de Manifestaciones clínicas",
      "pieces": [
        {
          "id": "clinica-p1",
          "title": "Fiebre y dolor localizado",
          "text": "Fiebre frecuentemente elevada en fases agudas y dolor localizado e intenso.",
          "fact": "Un termómetro ardiente clavado como una lanza en el muslo",
          "mnemonicCue": "Un termómetro ardiente clavado como una lanza en el muslo",
          "model": {
            "type": "procedural",
            "parts": [
              {
                "shape": "sphere",
                "args": [
                  0.3,
                  12,
                  8
                ],
                "pos": [
                  0,
                  0.3,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#c8553d"
              },
              {
                "shape": "cylinder",
                "args": [
                  0.14,
                  0.14,
                  1.5,
                  12
                ],
                "pos": [
                  0,
                  1.15,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#cfe8f0"
              },
              {
                "shape": "cylinder",
                "args": [
                  0.08,
                  0.08,
                  1.1,
                  12
                ],
                "pos": [
                  0,
                  0.95,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#d9433a"
              },
              {
                "shape": "sphere",
                "args": [
                  0.14,
                  12,
                  8
                ],
                "pos": [
                  0,
                  1.9,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#cfe8f0"
              },
              {
                "shape": "box",
                "args": [
                  0.12,
                  0.08,
                  0.1
                ],
                "pos": [
                  0.2,
                  1.5,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#e8e2d6"
              },
              {
                "shape": "box",
                "args": [
                  0.12,
                  0.08,
                  0.1
                ],
                "pos": [
                  0.2,
                  1.2,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#e8e2d6"
              },
              {
                "shape": "box",
                "args": [
                  0.12,
                  0.08,
                  0.1
                ],
                "pos": [
                  0.2,
                  0.9,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#e8e2d6"
              }
            ]
          },
          "searchKeyword": "thermometer",
          "imageSearch": {
            "wikiTitle": "Fiebre y dolor localizado",
            "lang": "es",
            "context": "Manifestaciones clínicas · Infecciones osteoarticulares pediátricas"
          },
          "source": {
            "quote": "- Fiebre (frecuentemente elevada en fases agudas).",
            "line": 59
          }
        },
        {
          "id": "clinica-p2",
          "title": "Limitación funcional",
          "text": "Claudicación, rechazo a la deambulación o al apoyo de la extremidad afectada.",
          "fact": "Un niño cojeando que se niega a pisar una alfombra de brasas",
          "mnemonicCue": "Un niño cojeando que se niega a pisar una alfombra de brasas",
          "model": {
            "type": "procedural",
            "parts": [
              {
                "shape": "box",
                "args": [
                  0.14,
                  1.8,
                  0.14
                ],
                "pos": [
                  0,
                  0.9,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#d9a441"
              },
              {
                "shape": "box",
                "args": [
                  0.14,
                  1.8,
                  0.14
                ],
                "pos": [
                  0.5,
                  0.9,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#d9a441"
              },
              {
                "shape": "box",
                "args": [
                  0.7,
                  0.12,
                  0.14
                ],
                "pos": [
                  0.25,
                  1.8,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#c8553d"
              },
              {
                "shape": "box",
                "args": [
                  0.7,
                  0.1,
                  0.14
                ],
                "pos": [
                  0.25,
                  1.5,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#588b8b"
              },
              {
                "shape": "box",
                "args": [
                  0.9,
                  0.08,
                  0.5
                ],
                "pos": [
                  0.25,
                  0.04,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#e8e2d6"
              }
            ]
          },
          "searchKeyword": "crutch",
          "imageSearch": {
            "wikiTitle": "Limitación funcional",
            "lang": "es",
            "context": "Manifestaciones clínicas · Infecciones osteoarticulares pediátricas"
          },
          "source": {
            "quote": "- Limitación funcional, claudicación (cojera), rechazo a la deambulación o al apoyo de la extremidad.",
            "line": 61
          }
        },
        {
          "id": "clinica-p3",
          "title": "Signos inflamatorios",
          "text": "Eritema, calor local y aumento de volumen por edema inflamatorio en la zona afectada.",
          "fact": "Un muslo rojo, hirviendo e hinchado como un globo",
          "mnemonicCue": "Un muslo rojo, hirviendo e hinchado como un globo",
          "model": {
            "type": "procedural",
            "parts": [
              {
                "shape": "sphere",
                "args": [
                  0.7,
                  12,
                  8
                ],
                "pos": [
                  0,
                  0.8,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#d9a441"
              },
              {
                "shape": "box",
                "args": [
                  0.5,
                  0.3,
                  0.25
                ],
                "pos": [
                  0,
                  1.7,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#c8553d"
              },
              {
                "shape": "cylinder",
                "args": [
                  0.25,
                  0.25,
                  0.12,
                  12
                ],
                "pos": [
                  0,
                  1.9,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#e8e2d6"
              },
              {
                "shape": "cylinder",
                "args": [
                  0.08,
                  0.08,
                  0.4,
                  12
                ],
                "pos": [
                  0,
                  0.2,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#c8553d"
              }
            ]
          },
          "searchKeyword": "hot water bottle",
          "imageSearch": {
            "wikiTitle": "Signos inflamatorios",
            "lang": "es",
            "context": "Manifestaciones clínicas · Infecciones osteoarticulares pediátricas"
          },
          "source": {
            "quote": "- Eritema, calor local y aumento de volumen (edema inflamatorio) en la zona afectada.",
            "line": 62
          }
        },
        {
          "id": "clinica-p4",
          "title": "Pseudoparálisis",
          "text": "Inmovilidad absoluta del miembro en lactantes pequeños para evitar el dolor del movimiento.",
          "fact": "Un bebé convertido en estatua inmóvil por miedo al dolor",
          "mnemonicCue": "Un bebé convertido en estatua inmóvil por miedo al dolor",
          "model": {
            "type": "procedural",
            "parts": [
              {
                "shape": "cylinder",
                "args": [
                  0.3,
                  0.4,
                  0.6,
                  12
                ],
                "pos": [
                  0,
                  0.3,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#e8e2d6"
              },
              {
                "shape": "box",
                "args": [
                  0.9,
                  0.12,
                  0.5
                ],
                "pos": [
                  0,
                  0.66,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#d9a441"
              },
              {
                "shape": "cylinder",
                "args": [
                  0.2,
                  0.22,
                  0.9,
                  12
                ],
                "pos": [
                  0,
                  1.2,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#e8e2d6"
              },
              {
                "shape": "sphere",
                "args": [
                  0.25,
                  12,
                  8
                ],
                "pos": [
                  0,
                  1.8,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#e8e2d6"
              },
              {
                "shape": "box",
                "args": [
                  0.25,
                  0.7,
                  0.25
                ],
                "pos": [
                  -0.45,
                  1.3,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0.3
                ],
                "color": "#e8e2d6"
              },
              {
                "shape": "box",
                "args": [
                  0.25,
                  0.7,
                  0.25
                ],
                "pos": [
                  0.45,
                  1.1,
                  0
                ],
                "rot": [
                  0,
                  0,
                  -0.2
                ],
                "color": "#e8e2d6"
              }
            ]
          },
          "searchKeyword": "statue",
          "imageSearch": {
            "wikiTitle": "Pseudoparálisis",
            "lang": "es",
            "context": "Manifestaciones clínicas · Infecciones osteoarticulares pediátricas"
          },
          "source": {
            "quote": "- Pseudoparálisis: Actitud de inmovilidad absoluta del miembro afectado en lactantes pequeños para evitar el dolor provocado por el movimiento.",
            "line": 63
          }
        },
        {
          "id": "clinica-p5",
          "title": "Posición antiálgica de cadera",
          "text": "En la cadera: flexión, abducción y rotación externa.",
          "fact": "Una bailarina con la pierna flexionada, abierta y girada hacia afuera",
          "mnemonicCue": "Una bailarina con la pierna flexionada, abierta y girada hacia afuera",
          "model": {
            "type": "procedural",
            "parts": [
              {
                "shape": "cylinder",
                "args": [
                  0.08,
                  0.08,
                  0.9,
                  12
                ],
                "pos": [
                  0,
                  0.9,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#c8553d"
              },
              {
                "shape": "cone",
                "args": [
                  0.45,
                  0.5,
                  16
                ],
                "pos": [
                  0,
                  0.3,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#d9a441"
              },
              {
                "shape": "sphere",
                "args": [
                  0.2,
                  12,
                  8
                ],
                "pos": [
                  0,
                  1.45,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#e8e2d6"
              },
              {
                "shape": "cylinder",
                "args": [
                  0.07,
                  0.07,
                  0.8,
                  12
                ],
                "pos": [
                  0.35,
                  1,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0.9
                ],
                "color": "#6b7fd7"
              },
              {
                "shape": "cylinder",
                "args": [
                  0.07,
                  0.07,
                  0.8,
                  12
                ],
                "pos": [
                  -0.35,
                  1,
                  0
                ],
                "rot": [
                  0,
                  0,
                  -0.4
                ],
                "color": "#6b7fd7"
              }
            ]
          },
          "searchKeyword": "ballerina",
          "imageSearch": {
            "wikiTitle": "Posición antiálgica de cadera",
            "lang": "es",
            "context": "Manifestaciones clínicas · Infecciones osteoarticulares pediátricas"
          },
          "source": {
            "quote": "- Cadera: Posición en flexión, abducción y rotación externa.",
            "line": 65
          }
        },
        {
          "id": "clinica-p6",
          "title": "Posición antiálgica de hombro",
          "text": "En el hombro: miembro abducido y en rotación interna.",
          "fact": "Un brazo de maniquí levantado a un lado y girado hacia adentro",
          "mnemonicCue": "Un brazo de maniquí levantado a un lado y girado hacia adentro",
          "model": {
            "type": "procedural",
            "parts": [
              {
                "shape": "sphere",
                "args": [
                  0.22,
                  12,
                  8
                ],
                "pos": [
                  0,
                  1.75,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#e8e2d6"
              },
              {
                "shape": "box",
                "args": [
                  0.5,
                  0.7,
                  0.3
                ],
                "pos": [
                  0,
                  1.2,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#588b8b"
              },
              {
                "shape": "box",
                "args": [
                  0.15,
                  0.8,
                  0.15
                ],
                "pos": [
                  -0.4,
                  1.2,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0.5
                ],
                "color": "#e8e2d6"
              },
              {
                "shape": "box",
                "args": [
                  0.15,
                  0.8,
                  0.15
                ],
                "pos": [
                  0.4,
                  1.2,
                  0
                ],
                "rot": [
                  0,
                  0,
                  -0.5
                ],
                "color": "#e8e2d6"
              },
              {
                "shape": "box",
                "args": [
                  0.3,
                  0.6,
                  0.3
                ],
                "pos": [
                  0,
                  0.5,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#6b7fd7"
              },
              {
                "shape": "cylinder",
                "args": [
                  0.12,
                  0.12,
                  0.2,
                  12
                ],
                "pos": [
                  0,
                  0.1,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#d9a441"
              }
            ]
          },
          "searchKeyword": "mannequin",
          "imageSearch": {
            "wikiTitle": "Posición antiálgica de hombro",
            "lang": "es",
            "context": "Manifestaciones clínicas · Infecciones osteoarticulares pediátricas"
          },
          "source": {
            "quote": "- Hombro: Miembro abducido y en rotación interna.",
            "line": 66
          }
        },
        {
          "id": "clinica-p7",
          "title": "Rodillas, tobillos y codos",
          "text": "Tobillos, rodillas y codos se mantienen preferentemente en flexión.",
          "fact": "Tres resortes doblados que no quieren estirarse",
          "mnemonicCue": "Tres resortes doblados que no quieren estirarse",
          "model": {
            "type": "procedural",
            "parts": [
              {
                "shape": "cylinder",
                "args": [
                  0.22,
                  0.22,
                  1.6,
                  16
                ],
                "pos": [
                  0,
                  0.8,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#d9a441"
              },
              {
                "shape": "cylinder",
                "args": [
                  0.14,
                  0.14,
                  1.6,
                  16
                ],
                "pos": [
                  0,
                  0.8,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#c8553d"
              },
              {
                "shape": "box",
                "args": [
                  0.4,
                  0.1,
                  0.4
                ],
                "pos": [
                  0,
                  0.05,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#6b7fd7"
              },
              {
                "shape": "box",
                "args": [
                  0.4,
                  0.1,
                  0.4
                ],
                "pos": [
                  0,
                  1.65,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#6b7fd7"
              },
              {
                "shape": "cylinder",
                "args": [
                  0.08,
                  0.08,
                  0.3,
                  12
                ],
                "pos": [
                  0.5,
                  0.2,
                  0
                ],
                "rot": [
                  0,
                  0,
                  1.2
                ],
                "color": "#588b8b"
              }
            ]
          },
          "searchKeyword": "spring",
          "imageSearch": {
            "wikiTitle": "Rodillas, tobillos y codos",
            "lang": "es",
            "context": "Manifestaciones clínicas · Infecciones osteoarticulares pediátricas"
          },
          "source": {
            "quote": "- Tobillos, Rodillas y Codos: Se mantienen preferentemente en flexión.",
            "line": 67
          }
        }
      ],
      "theme": "organic",
      "palette": {
        "primary": "#fb923c",
        "fogColor": "#1f1005"
      },
      "monument": "ring_system",
      "imageSearch": {
        "wikiTitle": "Manifestaciones clínicas",
        "lang": "es",
        "context": "Infecciones osteoarticulares pediátricas"
      }
    },
    {
      "id": "diagnostico",
      "name": "Abordaje diagnóstico",
      "description": "Exhibición temática de Abordaje diagnóstico",
      "pieces": [
        {
          "id": "diagnostico-p1",
          "title": "Velocidad de sedimentación globular",
          "text": "Alcanza su pico entre los 3 y 5 días y tarda entre 3 y 5 semanas en normalizarse.",
          "fact": "Un tubo de ensayo donde los glóbulos caen lentamente y tardan semanas en asentarse",
          "mnemonicCue": "Un tubo de ensayo donde los glóbulos caen lentamente y tardan semanas en asentarse",
          "model": {
            "type": "procedural",
            "parts": [
              {
                "shape": "cylinder",
                "args": [
                  0.22,
                  0.22,
                  1.6,
                  20
                ],
                "pos": [
                  0,
                  0.95,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#bfe6f5"
              },
              {
                "shape": "sphere",
                "args": [
                  0.22,
                  20,
                  12
                ],
                "pos": [
                  0,
                  0.15,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#bfe6f5"
              },
              {
                "shape": "cylinder",
                "args": [
                  0.26,
                  0.26,
                  0.08,
                  20
                ],
                "pos": [
                  0,
                  1.78,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#9ccfe3"
              },
              {
                "shape": "cylinder",
                "args": [
                  0.19,
                  0.19,
                  0.6,
                  20
                ],
                "pos": [
                  0,
                  0.4,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#9b59b6"
              }
            ]
          },
          "searchKeyword": "test tube",
          "imageSearch": {
            "wikiTitle": "Velocidad de sedimentación globular",
            "lang": "es",
            "context": "Abordaje diagnóstico · Infecciones osteoarticulares pediátricas"
          },
          "source": {
            "quote": "- Velocidad de Sedimentación Globular (VSG): alcanza su pico máximo entre los 3 y 5 días; tarda entre 3 y 5 semanas en normalizarse.",
            "line": 71
          }
        },
        {
          "id": "diagnostico-p2",
          "title": "Proteína C reactiva",
          "text": "Es el marcador más sensible y dinámico: sube en 24 a 48 horas y se normaliza en 7 a 10 días con tratamiento efectivo.",
          "fact": "Un velocista veloz que sube en 24 horas y baja en una semana",
          "mnemonicCue": "Un velocista veloz que sube en 24 horas y baja en una semana",
          "model": {
            "type": "procedural",
            "parts": [
              {
                "shape": "sphere",
                "args": [
                  0.25,
                  12,
                  8
                ],
                "pos": [
                  0,
                  1.5,
                  0.1
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#c8553d"
              },
              {
                "shape": "cylinder",
                "args": [
                  0.2,
                  0.25,
                  0.7,
                  12
                ],
                "pos": [
                  0,
                  0.95,
                  0
                ],
                "rot": [
                  0.2,
                  0,
                  0
                ],
                "color": "#588b8b"
              },
              {
                "shape": "box",
                "args": [
                  0.18,
                  0.7,
                  0.18
                ],
                "pos": [
                  0.3,
                  0.9,
                  -0.3
                ],
                "rot": [
                  -0.9,
                  0,
                  0
                ],
                "color": "#e8e2d6"
              },
              {
                "shape": "box",
                "args": [
                  0.18,
                  0.7,
                  0.18
                ],
                "pos": [
                  -0.3,
                  0.9,
                  0.35
                ],
                "rot": [
                  0.9,
                  0,
                  0
                ],
                "color": "#e8e2d6"
              },
              {
                "shape": "box",
                "args": [
                  0.18,
                  0.6,
                  0.18
                ],
                "pos": [
                  0.2,
                  0.3,
                  -0.25
                ],
                "rot": [
                  -0.3,
                  0,
                  0
                ],
                "color": "#d9a441"
              },
              {
                "shape": "box",
                "args": [
                  0.18,
                  0.6,
                  0.18
                ],
                "pos": [
                  -0.2,
                  0.3,
                  0.25
                ],
                "rot": [
                  0.3,
                  0,
                  0
                ],
                "color": "#d9a441"
              }
            ]
          },
          "searchKeyword": "sprinter",
          "imageSearch": {
            "wikiTitle": "Proteína C reactiva",
            "lang": "es",
            "context": "Abordaje diagnóstico · Infecciones osteoarticulares pediátricas"
          },
          "source": {
            "quote": "- Proteína C Reactiva (PCR): Es el marcador más sensible y dinámico. Se eleva en las primeras 24 a 48 horas y se normaliza en 7 a 10 días tras un tratamiento efectivo.",
            "line": 72
          }
        },
        {
          "id": "diagnostico-p3",
          "title": "Radiología simple",
          "text": "Es normal en etapas tempranas; los cambios óseos aparecen entre 7 y 15 días después.",
          "fact": "Una radiografía en blanco que revela grietas solo después de dos semanas",
          "mnemonicCue": "Una radiografía en blanco que revela grietas solo después de dos semanas",
          "model": {
            "type": "procedural",
            "parts": [
              {
                "shape": "box",
                "args": [
                  1.3,
                  0.2,
                  1.3
                ],
                "pos": [
                  0,
                  0.1,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#4a4540"
              },
              {
                "shape": "box",
                "args": [
                  1,
                  1,
                  1
                ],
                "pos": [
                  0,
                  0.7,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#4f9d69"
              },
              {
                "shape": "box",
                "args": [
                  1.1,
                  0.12,
                  1.1
                ],
                "pos": [
                  0,
                  1.26,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#d9a441"
              }
            ]
          },
          "searchKeyword": "ray",
          "imageSearch": {
            "wikiTitle": "Radiología simple",
            "lang": "es",
            "context": "Abordaje diagnóstico · Infecciones osteoarticulares pediátricas"
          },
          "source": {
            "quote": "- Radiología Simple: normal en etapas tempranas; los cambios óseos aparecen entre 7 y 15 días después.",
            "line": 74
          }
        },
        {
          "id": "diagnostico-p4",
          "title": "Ultrasonografía",
          "text": "Es el método de elección inicial ante la sospecha de artritis séptica.",
          "fact": "Un delfín que sondea la articulación con ecos",
          "mnemonicCue": "Un delfín que sondea la articulación con ecos",
          "model": {
            "type": "procedural",
            "parts": [
              {
                "shape": "cylinder",
                "args": [
                  0.5,
                  0.6,
                  0.3,
                  12
                ],
                "pos": [
                  0,
                  0.15,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#4a4540"
              },
              {
                "shape": "sphere",
                "args": [
                  0.75,
                  12,
                  8
                ],
                "pos": [
                  0,
                  1.05,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#e07a5f"
              },
              {
                "shape": "sphere",
                "args": [
                  0.25,
                  12,
                  8
                ],
                "pos": [
                  0,
                  1.45,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#e07a5f"
              }
            ]
          },
          "searchKeyword": "dolphin",
          "imageSearch": {
            "wikiTitle": "Ultrasonografía",
            "lang": "es",
            "context": "Abordaje diagnóstico · Infecciones osteoarticulares pediátricas"
          },
          "source": {
            "quote": "- Ultrasonografía: método de elección inicial ante la sospecha de artritis séptica.",
            "line": 75
          }
        },
        {
          "id": "diagnostico-p5",
          "title": "Resonancia magnética",
          "text": "Es el gold standard; el gadolinio diferencia el edema óseo de un absceso, como el absceso de Brodie.",
          "fact": "Un anillo gigante dorado que distingue agua de pus con tinta de gadolinio",
          "mnemonicCue": "Un anillo gigante dorado que distingue agua de pus con tinta de gadolinio",
          "model": {
            "type": "procedural",
            "parts": [
              {
                "shape": "cylinder",
                "args": [
                  0.6,
                  0.7,
                  0.25,
                  12
                ],
                "pos": [
                  0,
                  0.125,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#4a4540"
              },
              {
                "shape": "cone",
                "args": [
                  0.75,
                  1.3,
                  3
                ],
                "pos": [
                  0,
                  0.9,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#588b8b"
              },
              {
                "shape": "sphere",
                "args": [
                  0.12,
                  12,
                  8
                ],
                "pos": [
                  0,
                  1.7200000000000002,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#c8553d"
              }
            ]
          },
          "searchKeyword": "mri scanner",
          "imageSearch": {
            "wikiTitle": "Resonancia magnética",
            "lang": "es",
            "context": "Abordaje diagnóstico · Infecciones osteoarticulares pediátricas"
          },
          "source": {
            "quote": "- Resonancia Magnética Nuclear (RMN): Gold Standard. El Gadolinio diferencia el edema óseo de un absceso (Absceso de Brodie).",
            "line": 76
          }
        },
        {
          "id": "diagnostico-p6",
          "title": "Criterios de Kocher modificados",
          "text": "Celularidad sinovial mayor de 50.000, leucocitos mayores de 12.000, VSG mayor de 40, fiebre mayor de 38,5 °C e imposibilidad de cargar peso; sensibilidad del 93%.",
          "fact": "Cinco sellos en una lista: células, leucocitos, VSG, fiebre y cojera",
          "mnemonicCue": "Cinco sellos en una lista: células, leucocitos, VSG, fiebre y cojera",
          "model": {
            "type": "procedural",
            "parts": [
              {
                "shape": "cylinder",
                "args": [
                  0.55,
                  0.65,
                  0.25,
                  12
                ],
                "pos": [
                  0,
                  0.125,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#4a4540"
              },
              {
                "shape": "cylinder",
                "args": [
                  0.5,
                  0.65,
                  0.5,
                  5
                ],
                "pos": [
                  0,
                  0.5,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#c8553d"
              },
              {
                "shape": "cylinder",
                "args": [
                  0.65,
                  0.5,
                  0.5,
                  5
                ],
                "pos": [
                  0,
                  1,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#8a9a5b"
              }
            ]
          },
          "searchKeyword": "rubber stamp",
          "imageSearch": {
            "wikiTitle": "Criterios de Kocher modificados",
            "lang": "es",
            "context": "Abordaje diagnóstico · Infecciones osteoarticulares pediátricas"
          },
          "source": {
            "quote": "Criterios de Kocher modificados (sensibilidad del 93%): celularidad sinovial > 50.000 células/ml, leucocitos > 12.000/mm3, VSG > 40 mm/hora, fiebre > 38,5 °C, imposibilidad de soportar peso.",
            "line": 77
          }
        },
        {
          "id": "diagnostico-p7",
          "title": "Artrocentesis",
          "text": "Es diagnóstica y terapéutica; el líquido séptico es purulento, con más de 50.000 células/ml, más de 75% de neutrófilos, glucosa baja y cultivo positivo.",
          "fact": "Una jeringa gigante que extrae pus turbio y salva la articulación",
          "mnemonicCue": "Una jeringa gigante que extrae pus turbio y salva la articulación",
          "model": {
            "type": "procedural",
            "parts": [
              {
                "shape": "cylinder",
                "args": [
                  0.22,
                  0.22,
                  1.2,
                  16
                ],
                "pos": [
                  0,
                  0.9,
                  0
                ],
                "rot": [
                  0,
                  0,
                  1.5708
                ],
                "color": "#cfe8f0"
              },
              {
                "shape": "cylinder",
                "args": [
                  0.15,
                  0.15,
                  0.5,
                  12
                ],
                "pos": [
                  0.1,
                  0.9,
                  0
                ],
                "rot": [
                  0,
                  0,
                  1.5708
                ],
                "color": "#c8553d"
              },
              {
                "shape": "cylinder",
                "args": [
                  0.07,
                  0.07,
                  0.9,
                  12
                ],
                "pos": [
                  -0.95,
                  0.9,
                  0
                ],
                "rot": [
                  0,
                  0,
                  1.5708
                ],
                "color": "#e8e2d6"
              },
              {
                "shape": "cylinder",
                "args": [
                  0.3,
                  0.3,
                  0.1,
                  16
                ],
                "pos": [
                  -1.45,
                  0.9,
                  0
                ],
                "rot": [
                  0,
                  0,
                  1.5708
                ],
                "color": "#6b7fd7"
              },
              {
                "shape": "box",
                "args": [
                  0.1,
                  0.7,
                  0.3
                ],
                "pos": [
                  -0.5,
                  0.9,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#6b7fd7"
              },
              {
                "shape": "cone",
                "args": [
                  0.14,
                  0.3,
                  12
                ],
                "pos": [
                  0.75,
                  0.9,
                  0
                ],
                "rot": [
                  0,
                  0,
                  -1.5708
                ],
                "color": "#d9a441"
              },
              {
                "shape": "cylinder",
                "args": [
                  0.04,
                  0.04,
                  0.5,
                  12
                ],
                "pos": [
                  1.15,
                  0.9,
                  0
                ],
                "rot": [
                  0,
                  0,
                  1.5708
                ],
                "color": "#c0c8d0"
              }
            ]
          },
          "searchKeyword": "syringe",
          "imageSearch": {
            "wikiTitle": "Artrocentesis",
            "lang": "es",
            "context": "Abordaje diagnóstico · Infecciones osteoarticulares pediátricas"
          },
          "source": {
            "quote": "Artrocentesis: procedimiento diagnóstico y terapéutico. Líquido séptico: purulento, > 50.000 cel/ml, > 75% neutrófilos, glucosa disminuida, cultivo positivo.",
            "line": 78
          }
        }
      ],
      "theme": "cyberpunk",
      "palette": {
        "primary": "#22d3ee",
        "fogColor": "#0b1020"
      },
      "monument": "crystal",
      "imageSearch": {
        "wikiTitle": "Abordaje diagnóstico",
        "lang": "es",
        "context": "Infecciones osteoarticulares pediátricas"
      }
    },
    {
      "id": "microbiologia",
      "name": "Microbiología",
      "description": "Exhibición temática de Microbiología",
      "pieces": [
        {
          "id": "microbiologia-p1",
          "title": "Staphylococcus aureus",
          "text": "Es el agente más común en todos los grupos de edad.",
          "fact": "Un racimo de uvas doradas que reina como rey en todas las edades",
          "mnemonicCue": "Un racimo de uvas doradas que reina como rey en todas las edades",
          "model": {
            "type": "procedural",
            "parts": [
              {
                "shape": "cylinder",
                "args": [
                  0.5,
                  0.6,
                  0.3,
                  12
                ],
                "pos": [
                  0,
                  0.15,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#4a4540"
              },
              {
                "shape": "sphere",
                "args": [
                  0.75,
                  12,
                  8
                ],
                "pos": [
                  0,
                  1.05,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#6b7fd7"
              },
              {
                "shape": "sphere",
                "args": [
                  0.25,
                  12,
                  8
                ],
                "pos": [
                  0,
                  1.45,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#d9a441"
              }
            ]
          },
          "searchKeyword": "grapes",
          "imageSearch": {
            "wikiTitle": "Staphylococcus aureus",
            "lang": "es",
            "context": "Microbiología · Infecciones osteoarticulares pediátricas"
          },
          "source": {
            "quote": "El agente más común es Staphylococcus aureus.",
            "line": 82
          }
        },
        {
          "id": "microbiologia-p2",
          "title": "Microbios de 0 a 3 meses",
          "text": "En este grupo predominan Staphylococcus aureus, Streptococcus agalactiae y enterobacterias.",
          "fact": "Un neonato sosteniendo una bacteria dorada, una cadena y un intestino",
          "mnemonicCue": "Un neonato sosteniendo una bacteria dorada, una cadena y un intestino",
          "model": {
            "type": "procedural",
            "parts": [
              {
                "shape": "sphere",
                "args": [
                  0.55,
                  12,
                  8
                ],
                "pos": [
                  0,
                  0.55,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#e07a5f"
              },
              {
                "shape": "cylinder",
                "args": [
                  0.18,
                  0.28,
                  0.5,
                  12
                ],
                "pos": [
                  0,
                  1.25,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#6b7fd7"
              },
              {
                "shape": "cylinder",
                "args": [
                  0.2,
                  0.2,
                  0.12,
                  12
                ],
                "pos": [
                  0,
                  1.56,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#4a4540"
              }
            ]
          },
          "searchKeyword": "baby bottle",
          "imageSearch": {
            "wikiTitle": "Microbios de 0 a 3 meses",
            "lang": "es",
            "context": "Microbiología · Infecciones osteoarticulares pediátricas"
          },
          "source": {
            "quote": "- 0 a 3 meses: Staphylococcus aureus, Streptococcus agalactiae y enterobacterias.",
            "line": 83
          }
        },
        {
          "id": "microbiologia-p3",
          "title": "Microbios de 3 meses a 5 años",
          "text": "Staphylococcus aureus, Streptococcus pyogenes, Kingella kingae, Streptococcus pneumoniae y Haemophilus influenzae tipo b.",
          "fact": "Una guardería donde juegan seis microbios, entre ellos Kingella kingae",
          "mnemonicCue": "Una guardería donde juegan seis microbios, entre ellos Kingella kingae",
          "model": {
            "type": "procedural",
            "parts": [
              {
                "shape": "box",
                "args": [
                  1.3,
                  0.2,
                  1.3
                ],
                "pos": [
                  0,
                  0.1,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#4a4540"
              },
              {
                "shape": "box",
                "args": [
                  1,
                  1,
                  1
                ],
                "pos": [
                  0,
                  0.7,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#588b8b"
              },
              {
                "shape": "box",
                "args": [
                  1.1,
                  0.12,
                  1.1
                ],
                "pos": [
                  0,
                  1.26,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#b07aa1"
              }
            ]
          },
          "searchKeyword": "toy blocks",
          "imageSearch": {
            "wikiTitle": "Microbios de 3 meses a 5 años",
            "lang": "es",
            "context": "Microbiología · Infecciones osteoarticulares pediátricas"
          },
          "source": {
            "quote": "- 3 meses a 5 años: Staphylococcus aureus, Streptococcus pyogenes, Kingella kingae, Streptococcus pneumoniae y Haemophilus influenzae tipo b.",
            "line": 84
          }
        },
        {
          "id": "microbiologia-p4",
          "title": "Microbios en mayores de 5 años",
          "text": "Staphylococcus aureus, Streptococcus pyogenes y Neisseria gonorrhoeae.",
          "fact": "Un escolar con mochila y tres microbios, uno de ellos gonocócico",
          "mnemonicCue": "Un escolar con mochila y tres microbios, uno de ellos gonocócico",
          "model": {
            "type": "procedural",
            "parts": [
              {
                "shape": "cylinder",
                "args": [
                  0.6,
                  0.7,
                  0.3,
                  12
                ],
                "pos": [
                  0,
                  0.15,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#4a4540"
              },
              {
                "shape": "cylinder",
                "args": [
                  0.7,
                  0.7,
                  0.18,
                  20
                ],
                "pos": [
                  0,
                  0.39,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#8a9a5b"
              },
              {
                "shape": "cylinder",
                "args": [
                  0.38,
                  0.38,
                  0.2,
                  20
                ],
                "pos": [
                  0,
                  0.39,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#4a4540"
              },
              {
                "shape": "sphere",
                "args": [
                  0.22,
                  12,
                  8
                ],
                "pos": [
                  0,
                  0.77,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#e07a5f"
              }
            ]
          },
          "searchKeyword": "backpack",
          "imageSearch": {
            "wikiTitle": "Microbios en mayores de 5 años",
            "lang": "es",
            "context": "Microbiología · Infecciones osteoarticulares pediátricas"
          },
          "source": {
            "quote": "- Mayores de 5 años: Staphylococcus aureus, Streptococcus pyogenes y Neisseria gonorrhoeae.",
            "line": 85
          }
        },
        {
          "id": "microbiologia-p5",
          "title": "Situaciones especiales",
          "text": "Herida punzante en el pie: Pseudomonas; varicela: S. pyogenes; drepanocitosis: Salmonella; déficit de complemento: Neisseria meningitidis.",
          "fact": "Un botiquín con cinco etiquetas: clavo, varicela, células falciformes y complemento",
          "mnemonicCue": "Un botiquín con cinco etiquetas: clavo, varicela, células falciformes y complemento",
          "model": {
            "type": "procedural",
            "parts": [
              {
                "shape": "cylinder",
                "args": [
                  0.55,
                  0.65,
                  0.25,
                  12
                ],
                "pos": [
                  0,
                  0.125,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#4a4540"
              },
              {
                "shape": "cylinder",
                "args": [
                  0.5,
                  0.65,
                  0.5,
                  5
                ],
                "pos": [
                  0,
                  0.5,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#4f9d69"
              },
              {
                "shape": "cylinder",
                "args": [
                  0.65,
                  0.5,
                  0.5,
                  5
                ],
                "pos": [
                  0,
                  1,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#4f9d69"
              }
            ]
          },
          "searchKeyword": "first aid kit",
          "imageSearch": {
            "wikiTitle": "Situaciones especiales",
            "lang": "es",
            "context": "Microbiología · Infecciones osteoarticulares pediátricas"
          },
          "source": {
            "quote": "Situaciones especiales: herida punzante en el pie (Pseudomonas aeruginosa), varicela (Streptococcus pyogenes), anemia drepanocítica (Salmonella), déficit de complemento (Neisseria meningitidis).",
            "line": 86
          }
        },
        {
          "id": "microbiologia-p6",
          "title": "Diagnóstico diferencial",
          "text": "Brucelosis, gonorrea, leucemias, osteosarcoma, sarcoma de Ewing, neuroblastoma, anemia drepanocítica y maltrato infantil.",
          "fact": "Una rueda de sospechosos: brucelosis, leucemia, sarcomas, neuroblastoma y maltrato",
          "mnemonicCue": "Una rueda de sospechosos: brucelosis, leucemia, sarcomas, neuroblastoma y maltrato",
          "model": {
            "type": "procedural",
            "parts": [
              {
                "shape": "cylinder",
                "args": [
                  0.6,
                  0.7,
                  0.25,
                  12
                ],
                "pos": [
                  0,
                  0.125,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#4a4540"
              },
              {
                "shape": "cone",
                "args": [
                  0.75,
                  1.3,
                  3
                ],
                "pos": [
                  0,
                  0.9,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#d9a441"
              },
              {
                "shape": "sphere",
                "args": [
                  0.12,
                  12,
                  8
                ],
                "pos": [
                  0,
                  1.7200000000000002,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#c8553d"
              }
            ]
          },
          "searchKeyword": "lineup",
          "imageSearch": {
            "wikiTitle": "Diagnóstico diferencial",
            "lang": "es",
            "context": "Microbiología · Infecciones osteoarticulares pediátricas"
          },
          "source": {
            "quote": "Diagnóstico diferencial: brucelosis, gonorrea, leucemias, osteosarcoma, sarcoma de Ewing, neuroblastoma, anemia drepanocítica, maltrato infantil.",
            "line": 79
          }
        }
      ],
      "theme": "void",
      "palette": {
        "primary": "#4ade80",
        "fogColor": "#04180c"
      },
      "monument": "torus",
      "imageSearch": {
        "wikiTitle": "Microbiología",
        "lang": "es",
        "context": "Infecciones osteoarticulares pediátricas"
      }
    },
    {
      "id": "tratamiento",
      "name": "Tratamiento antimicrobiano y quirúrgico",
      "description": "Exhibición temática de Tratamiento antimicrobiano y quirúrgico",
      "pieces": [
        {
          "id": "tratamiento-p1",
          "title": "Vía endovenosa a vía oral",
          "text": "Se usa vía endovenosa 2 a 5 días; pasa a oral con mejoría clínica y descenso de la PCR mayor al 30%.",
          "fact": "Un puente de goteo que cambia a pastillas cuando la PCR cae más del 30%",
          "mnemonicCue": "Un puente de goteo que cambia a pastillas cuando la PCR cae más del 30%",
          "model": {
            "type": "procedural",
            "parts": [
              {
                "shape": "box",
                "args": [
                  1.3,
                  0.2,
                  1.3
                ],
                "pos": [
                  0,
                  0.1,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#4a4540"
              },
              {
                "shape": "box",
                "args": [
                  1,
                  1,
                  1
                ],
                "pos": [
                  0,
                  0.7,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#6b7fd7"
              },
              {
                "shape": "box",
                "args": [
                  1.1,
                  0.12,
                  1.1
                ],
                "pos": [
                  0,
                  1.26,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#b07aa1"
              }
            ]
          },
          "searchKeyword": "drip bag",
          "imageSearch": {
            "wikiTitle": "Vía endovenosa a vía oral",
            "lang": "es",
            "context": "Tratamiento antimicrobiano y quirúrgico · Infecciones osteoarticulares pediátricas"
          },
          "source": {
            "quote": "- Vía endovenosa los primeros 2 a 5 días; paso a vía oral con mejoría clínica y descenso de la PCR mayor al 30%.",
            "line": 89
          }
        },
        {
          "id": "tratamiento-p2",
          "title": "Duración del tratamiento",
          "text": "Artritis séptica mínimo 14 días, osteomielitis aguda 4 a 6 semanas y osteomielitis crónica 6 a 12 meses.",
          "fact": "Un calendario con tres hojas: 14 días, 4 a 6 semanas y 6 a 12 meses",
          "mnemonicCue": "Un calendario con tres hojas: 14 días, 4 a 6 semanas y 6 a 12 meses",
          "model": {
            "type": "procedural",
            "parts": [
              {
                "shape": "cylinder",
                "args": [
                  0.8,
                  0.8,
                  0.2,
                  20
                ],
                "pos": [
                  0,
                  0.7,
                  0
                ],
                "rot": [
                  1.5707963267948966,
                  0,
                  0
                ],
                "color": "#e8e2d6"
              },
              {
                "shape": "cylinder",
                "args": [
                  0.9,
                  0.9,
                  0.12,
                  20
                ],
                "pos": [
                  0,
                  0.6599999999999999,
                  -0.02
                ],
                "rot": [
                  1.5707963267948966,
                  0,
                  0
                ],
                "color": "#e07a5f"
              },
              {
                "shape": "box",
                "args": [
                  0.07,
                  0.5,
                  0.06
                ],
                "pos": [
                  0,
                  0.85,
                  0.12
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#4a4540"
              },
              {
                "shape": "box",
                "args": [
                  0.35,
                  0.07,
                  0.06
                ],
                "pos": [
                  0.15,
                  0.635,
                  0.12
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#4a4540"
              },
              {
                "shape": "cylinder",
                "args": [
                  0.3,
                  0.45,
                  0.2,
                  12
                ],
                "pos": [
                  0,
                  0.1,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#4a4540"
              }
            ]
          },
          "searchKeyword": "calendar",
          "imageSearch": {
            "wikiTitle": "Duración del tratamiento",
            "lang": "es",
            "context": "Tratamiento antimicrobiano y quirúrgico · Infecciones osteoarticulares pediátricas"
          },
          "source": {
            "quote": "- Osteomielitis aguda: 4 a 6 semanas. Artritis séptica: mínimo 14 días. Osteomielitis crónica: 6 a 12 meses.",
            "line": 90
          }
        },
        {
          "id": "tratamiento-p3",
          "title": "Esquema empírico por edad",
          "text": "Menores de 1 mes: oxacilina más cefotaxima; de 3 meses en adelante: oxacilina más aminoglucósido.",
          "fact": "Un cofre con oxacilina que cambia de acompañante según la edad del paciente",
          "mnemonicCue": "Un cofre con oxacilina que cambia de acompañante según la edad del paciente",
          "model": {
            "type": "procedural",
            "parts": [
              {
                "shape": "sphere",
                "args": [
                  0.55,
                  12,
                  8
                ],
                "pos": [
                  0,
                  0.55,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#588b8b"
              },
              {
                "shape": "cylinder",
                "args": [
                  0.18,
                  0.28,
                  0.5,
                  12
                ],
                "pos": [
                  0,
                  1.25,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#4f9d69"
              },
              {
                "shape": "cylinder",
                "args": [
                  0.2,
                  0.2,
                  0.12,
                  12
                ],
                "pos": [
                  0,
                  1.56,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#4a4540"
              }
            ]
          },
          "searchKeyword": "medicine bottle",
          "imageSearch": {
            "wikiTitle": "Esquema empírico por edad",
            "lang": "es",
            "context": "Tratamiento antimicrobiano y quirúrgico · Infecciones osteoarticulares pediátricas"
          },
          "source": {
            "quote": "- Menores de 1 mes: Oxacilina + Cefotaxima. De 3 meses a 5 años: Oxacilina + Aminoglucósido. Mayores de 5 años: Oxacilina + Aminoglucósido.",
            "line": 91
          }
        },
        {
          "id": "tratamiento-p4",
          "title": "SAMR y SASM",
          "text": "SAMR: clindamicina, vancomicina o linezolid; SASM: cefadroxilo oral.",
          "fact": "Un caballero resistente con tres armas contra SAMR y un arquero oral para SASM",
          "mnemonicCue": "Un caballero resistente con tres armas contra SAMR y un arquero oral para SASM",
          "model": {
            "type": "procedural",
            "parts": [
              {
                "shape": "box",
                "args": [
                  0.14,
                  1.3,
                  0.04
                ],
                "pos": [
                  0,
                  1.15,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#cfd8dc"
              },
              {
                "shape": "cone",
                "args": [
                  0.07,
                  0.2,
                  4
                ],
                "pos": [
                  0,
                  1.9,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#cfd8dc"
              },
              {
                "shape": "box",
                "args": [
                  0.6,
                  0.08,
                  0.1
                ],
                "pos": [
                  0,
                  0.5,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#fbc02d"
              },
              {
                "shape": "cylinder",
                "args": [
                  0.04,
                  0.04,
                  0.4,
                  8
                ],
                "pos": [
                  0,
                  0.28,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#5d4037"
              },
              {
                "shape": "sphere",
                "args": [
                  0.08,
                  8,
                  8
                ],
                "pos": [
                  0,
                  0.05,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#fbc02d"
              }
            ]
          },
          "searchKeyword": "sword",
          "imageSearch": {
            "wikiTitle": "SAMR y SASM",
            "lang": "es",
            "context": "Tratamiento antimicrobiano y quirúrgico · Infecciones osteoarticulares pediátricas"
          },
          "source": {
            "quote": "- SAMR: Clindamicina, Vancomicina o Linezolid. SASM: Cefadroxilo oral.",
            "line": 92
          }
        },
        {
          "id": "tratamiento-p5",
          "title": "Indicaciones quirúrgicas",
          "text": "Sin mejoría tras 72 horas, secuestro óseo o absceso drenable; la artritis séptica es una emergencia traumatológica.",
          "fact": "Una sala de urgencias con el reloj marcando 72 horas y un absceso listo",
          "mnemonicCue": "Una sala de urgencias con el reloj marcando 72 horas y un absceso listo",
          "model": {
            "type": "procedural",
            "parts": [
              {
                "shape": "cylinder",
                "args": [
                  0.8,
                  0.8,
                  0.2,
                  12
                ],
                "pos": [
                  0,
                  0.1,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#4a4540"
              },
              {
                "shape": "cone",
                "args": [
                  0.7,
                  1.4,
                  6
                ],
                "pos": [
                  0,
                  0.8999999999999999,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#4f9d69"
              },
              {
                "shape": "sphere",
                "args": [
                  0.12,
                  12,
                  8
                ],
                "pos": [
                  0,
                  1.77,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#588b8b"
              }
            ]
          },
          "searchKeyword": "operating table",
          "imageSearch": {
            "wikiTitle": "Indicaciones quirúrgicas",
            "lang": "es",
            "context": "Tratamiento antimicrobiano y quirúrgico · Infecciones osteoarticulares pediátricas"
          },
          "source": {
            "quote": "- Indicaciones: sin mejoría tras 72 horas de antibioterapia, secuestro óseo o absceso drenable; la artritis séptica es una emergencia traumatológica.",
            "line": 95
          }
        },
        {
          "id": "tratamiento-p6",
          "title": "Artrocentesis evacuadora y artrotomía",
          "text": "Se indica cuando el líquido es denso o el patógeno es agresivo, como SAMR.",
          "fact": "Un bisturí que abre la articulación cuando el pus es denso como miel",
          "mnemonicCue": "Un bisturí que abre la articulación cuando el pus es denso como miel",
          "model": {
            "type": "procedural",
            "parts": [
              {
                "shape": "cylinder",
                "args": [
                  0.6,
                  0.7,
                  0.25,
                  12
                ],
                "pos": [
                  0,
                  0.125,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#4a4540"
              },
              {
                "shape": "cone",
                "args": [
                  0.75,
                  1.3,
                  3
                ],
                "pos": [
                  0,
                  0.9,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#d9a441"
              },
              {
                "shape": "sphere",
                "args": [
                  0.12,
                  12,
                  8
                ],
                "pos": [
                  0,
                  1.7200000000000002,
                  0
                ],
                "rot": [
                  0,
                  0,
                  0
                ],
                "color": "#6b7fd7"
              }
            ]
          },
          "searchKeyword": "scalpel",
          "imageSearch": {
            "wikiTitle": "Artrocentesis evacuadora y artrotomía",
            "lang": "es",
            "context": "Tratamiento antimicrobiano y quirúrgico · Infecciones osteoarticulares pediátricas"
          },
          "source": {
            "quote": "- Artrocentesis evacuadora y artrotomía cuando el líquido es denso o el patógeno es agresivo.",
            "line": 96
          }
        }
      ],
      "theme": "cathedral",
      "palette": {
        "primary": "#f472b6",
        "fogColor": "#1f0713"
      },
      "monument": "dodecahedron",
      "imageSearch": {
        "wikiTitle": "Tratamiento antimicrobiano y quirúrgico",
        "lang": "es",
        "context": "Infecciones osteoarticulares pediátricas"
      }
    }
  ],
  "mode": "exploration",
  "graph": {
    "start": "intro",
    "edges": [
      {
        "from": "intro",
        "to": "entidades",
        "kind": "related"
      },
      {
        "from": "intro",
        "to": "patogenia",
        "kind": "related"
      },
      {
        "from": "patogenia",
        "to": "cronicidad",
        "kind": "related"
      },
      {
        "from": "entidades",
        "to": "clinica",
        "kind": "related"
      },
      {
        "from": "clinica",
        "to": "diagnostico",
        "kind": "related"
      },
      {
        "from": "diagnostico",
        "to": "microbiologia",
        "kind": "related"
      },
      {
        "from": "diagnostico",
        "to": "tratamiento",
        "kind": "related"
      },
      {
        "from": "clinica",
        "to": "entidades",
        "kind": "related"
      },
      {
        "from": "entidades",
        "to": "patogenia",
        "kind": "related"
      },
      {
        "from": "diagnostico",
        "to": "cronicidad",
        "kind": "related"
      },
      {
        "from": "diagnostico",
        "to": "clinica",
        "kind": "related"
      },
      {
        "from": "cronicidad",
        "to": "diagnostico",
        "kind": "related"
      },
      {
        "from": "tratamiento",
        "to": "diagnostico",
        "kind": "related"
      },
      {
        "from": "tratamiento",
        "to": "microbiologia",
        "kind": "related"
      },
      {
        "from": "cronicidad",
        "to": "tratamiento",
        "kind": "related"
      }
    ]
  },
  "sourceTextHash": "348fb46e2addee044a80ab3a5b42b897d260044baabfcfb9679e08b7d05aa5eb"
})
