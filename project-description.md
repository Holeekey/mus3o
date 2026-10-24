# mus3o

mus3o convierte apuntes de estudio, o un tema, en un **palacio de la memoria 3D** que recorres en primera persona. Usa el método de Loci: asociar cada idea a un lugar concreto del espacio.

## Cómo funciona

- **Salas y piezas:** cada tema es una sala; cada concepto es una pieza con un objeto 3D que lo representa.
- **Generación con IA:** pegas tus apuntes o un tema y Claude propone el palacio. Cada concepto cita un fragmento de tus apuntes, y el servidor comprueba que esa cita exista de verdad.
- **Diorama:** en las salas más representables, el cuadro principal es una ventana a una maqueta 3D que puedes explorar.
- **Memoria y examen:** marcas lo que ya memorizaste. Un modelo de olvido te dice qué repasar. Al memorizar todas las piezas de una sala ganas su llave, que abre sus puertas de salida.
- **Aris:** un compañero de estudio que te orienta dentro del palacio.

## Por qué funciona

Estudiar texto plano sobrecarga la memoria. Un espacio conocido, con cada idea en su lugar, aprovecha la memoria espacial para recordarla.

## Stack

React + React Three Fiber en el frontend; Express y Claude en el servidor; contrato de datos con Zod compartido entre ambos.

Documentación técnica completa en [`docs/`](./docs/README.md).
