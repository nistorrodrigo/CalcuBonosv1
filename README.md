# 📊 Latin Securities — Bond Total Return Calculator

Calculadora de total return en ARS y USD para bonos argentinos, con escenarios macroeconómicos configurables.

## Features

- **25 bonos pre-cargados**: Lecaps, CER (TX/DICP/PARP/CUAP), TAMAR, Globales / Bonares hard dollar, Bopreal
- **3 escenarios** (Base / Bull / Bear) con pesos ajustables — CPI, TAMAR, BADLAR, FX y Δspread independientes
- **Retorno ponderado** automático por escenario
- **Horizonte flexible**: 3m, 6m, 9m, 1a, 1.5a, 2a, 3a
- **Motor por tipo de instrumento**:
  - `LECAP`: compounding mensual al TEM (TNA÷12)
  - `CER`: retorno real × (1 + CPI acumulado) ± efecto duración
  - `TAMAR / BADLAR`: tasa flotante compuesta mensual + spread
  - `USD`: carry TIR + efecto duración; conversión a ARS vía FX proyectado
- **Cashflow proyectado** por bono y escenario (click en la fila)
- **Agregar / eliminar bonos** dinámicamente
- Filtros por tipo, ordenamiento por ARS/USD ponderado o base

## Stack

React + Vite · Zero dependencias externas de UI

## Uso local

```bash
npm install
npm run dev
```

## Build producción

```bash
npm run build
```

## Paleta Latin Securities

| Rol | Hex |
|-----|-----|
| Navy | `#000039` |
| Blue 1 | `#1e5ab0` |
| Blue 2 | `#3399ff` |
| Teal | `#23a29e` |

---
*Latin Securities © 2026*
