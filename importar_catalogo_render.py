#!/usr/bin/env python3
"""
Script para importar el catálogo DURTRON 2025 vía API REST
Usar DESPUÉS de desplegar en Render
"""

import requests
import json

# CAMBIAR ESTA URL por la que te dé Render
API_URL = "https://durtron-sistema.onrender.com/api"

# Catálogo completo DURTRON 2025
productos = [
    # QUEBRADORAS DE QUIJADA
    {
        'codigo': 'JC-150X250',
        'nombre': 'Quebradora de Quijadas JC-150X250',
        'marca': 'DURTRON',
        'modelo': 'JC-150X250',
        'categoria': 'Quebradoras de Quijada',
        'precio_lista': 109900,
        'precio_minimo': 98910,
        'precio_costo': 87920,
        'especificaciones': 'Entrada: 150x250mm | Salida: 10-40mm | Capacidad: 1-2 T/H',
        'potencia_motor': '5HP (3.7Kw)',
        'capacidad': '1-2 T/H',
        'dimensiones': '150x250mm',
        'ubicacion': 'Bodega Principal',
        'estado': 'Disponible',
        'cantidad_disponible': 3
    },
    {
        'codigo': 'JC-200X300',
        'nombre': 'Quebradora de Quijadas JC-200X300',
        'marca': 'DURTRON',
        'modelo': 'JC-200X300',
        'categoria': 'Quebradoras de Quijada',
        'precio_lista': 163900,
        'precio_minimo': 147510,
        'precio_costo': 131120,
        'especificaciones': 'Entrada: 200x300mm | Salida: 10-40mm | Capacidad: 2-5 T/H',
        'potencia_motor': '7.5HP (5.5Kw)',
        'capacidad': '2-5 T/H',
        'dimensiones': '200x300mm',
        'ubicacion': 'Bodega Principal',
        'estado': 'Disponible',
        'cantidad_disponible': 2
    },
    {
        'codigo': 'JC-250X400',
        'nombre': 'Quebradora de Quijadas JC-250X400',
        'marca': 'DURTRON',
        'modelo': 'JC-250X400',
        'categoria': 'Quebradoras de Quijada',
        'precio_lista': 328900,
        'precio_minimo': 296010,
        'precio_costo': 263120,
        'especificaciones': 'Entrada: 250x400mm | Salida: 25-60mm | Capacidad: 5-12 T/H',
        'potencia_motor': '15HP (11Kw)',
        'capacidad': '5-12 T/H',
        'dimensiones': '250x400mm',
        'ubicacion': 'Bodega Principal',
        'estado': 'Disponible',
        'cantidad_disponible': 1
    },
    {
        'codigo': 'JC-400X600',
        'nombre': 'Quebradora de Quijadas JC-400X600',
        'marca': 'DURTRON',
        'modelo': 'JC-400X600',
        'categoria': 'Quebradoras de Quijada',
        'precio_lista': 599900,
        'precio_minimo': 539910,
        'precio_costo': 479920,
        'especificaciones': 'Entrada: 400x600mm | Salida: 40-100mm | Capacidad: 15-25 T/H',
        'potencia_motor': '40HP (30Kw)',
        'capacidad': '15-25 T/H',
        'dimensiones': '400x600mm',
        'ubicacion': 'Piso de Venta - Showroom',
        'estado': 'Disponible',
        'cantidad_disponible': 1
    },
    
    # PULVERIZADORES DE MARTILLOS
    {
        'codigo': 'HM-200X300',
        'nombre': 'Pulverizador de Martillos HM-200X300',
        'marca': 'DURTRON',
        'modelo': 'HM-200X300',
        'categoria': 'Pulverizadores de Martillos',
        'precio_lista': 78900,
        'precio_minimo': 71010,
        'precio_costo': 63120,
        'especificaciones': 'Rotor: 200x300mm | Salida: 1-5mm | Capacidad: 0.5-1 T/H',
        'potencia_motor': '5HP (3.7Kw)',
        'capacidad': '0.5-1 T/H',
        'dimensiones': '200x300mm',
        'ubicacion': 'Bodega Principal',
        'estado': 'Disponible',
        'cantidad_disponible': 2
    },
    {
        'codigo': 'HM-240X450',
        'nombre': 'Pulverizador de Martillos HM-240X450',
        'marca': 'DURTRON',
        'modelo': 'HM-240X450',
        'categoria': 'Pulverizadores de Martillos',
        'precio_lista': 109900,
        'precio_minimo': 98910,
        'precio_costo': 87920,
        'especificaciones': 'Rotor: 240x450mm | Salida: 1-5mm | Capacidad: 1-2 T/H',
        'potencia_motor': '7.5HP (5.5Kw)',
        'capacidad': '1-2 T/H',
        'dimensiones': '240x450mm',
        'ubicacion': 'Bodega Principal',
        'estado': 'Disponible',
        'cantidad_disponible': 2
    },
    {
        'codigo': 'HM-400X600',
        'nombre': 'Pulverizador de Martillos HM-400X600',
        'marca': 'DURTRON',
        'modelo': 'HM-400X600',
        'categoria': 'Pulverizadores de Martillos',
        'precio_lista': 218900,
        'precio_minimo': 197010,
        'precio_costo': 175120,
        'especificaciones': 'Rotor: 400x600mm | Salida: 1-5mm | Capacidad: 2-5 T/H',
        'potencia_motor': '15HP (11Kw)',
        'capacidad': '2-5 T/H',
        'dimensiones': '400x600mm',
        'ubicacion': 'Bodega Principal',
        'estado': 'Disponible',
        'cantidad_disponible': 1
    },
    
    # MOLINOS DE BOLAS
    {
        'codigo': 'BM-3X4',
        'nombre': 'Molino de Bolas BM-3X4',
        'marca': 'DURTRON',
        'modelo': 'BM-3X4',
        'categoria': 'Molinos de Bolas',
        'precio_lista': 295000,
        'precio_minimo': 265500,
        'precio_costo': 236000,
        'especificaciones': 'Dimensiones: 3x4 pies | Volumen: 1.2m³ | Salida: 74-200 mesh',
        'potencia_motor': '15HP (11Kw)',
        'capacidad': '0.5-1 T/H',
        'dimensiones': '3x4 pies',
        'peso': '3,500 kg',
        'ubicacion': 'Bodega Principal',
        'estado': 'Disponible',
        'cantidad_disponible': 1
    },
    {
        'codigo': 'BM-3X6',
        'nombre': 'Molino de Bolas BM-3X6',
        'marca': 'DURTRON',
        'modelo': 'BM-3X6',
        'categoria': 'Molinos de Bolas',
        'precio_lista': 369000,
        'precio_minimo': 332100,
        'precio_costo': 295200,
        'especificaciones': 'Dimensiones: 3x6 pies | Volumen: 1.8m³ | Salida: 74-200 mesh',
        'potencia_motor': '20HP (15Kw)',
        'capacidad': '1-1.5 T/H',
        'dimensiones': '3x6 pies',
        'peso': '4,800 kg',
        'ubicacion': 'Bodega Principal',
        'estado': 'Disponible',
        'cantidad_disponible': 1
    },
    {
        'codigo': 'BM-3X8',
        'nombre': 'Molino de Bolas BM-3X8',
        'marca': 'DURTRON',
        'modelo': 'BM-3X8',
        'categoria': 'Molinos de Bolas',
        'precio_lista': 395000,
        'precio_minimo': 355500,
        'precio_costo': 316000,
        'especificaciones': 'Dimensiones: 3x8 pies | Volumen: 2.4m³ | Salida: 74-200 mesh',
        'potencia_motor': '25HP (18.5Kw)',
        'capacidad': '1.5-2 T/H',
        'dimensiones': '3x8 pies',
        'peso': '6,200 kg',
        'ubicacion': 'Bodega Principal',
        'estado': 'Disponible',
        'cantidad_disponible': 1
    },
    {
        'codigo': 'BM-4X4',
        'nombre': 'Molino de Bolas BM-4X4',
        'marca': 'DURTRON',
        'modelo': 'BM-4X4',
        'categoria': 'Molinos de Bolas',
        'precio_lista': 349000,
        'precio_minimo': 314100,
        'precio_costo': 279200,
        'especificaciones': 'Dimensiones: 4x4 pies | Volumen: 2.1m³ | Salida: 74-200 mesh',
        'potencia_motor': '20HP (15Kw)',
        'capacidad': '1-1.5 T/H',
        'dimensiones': '4x4 pies',
        'peso': '5,200 kg',
        'ubicacion': 'Piso de Venta - Showroom',
        'estado': 'Disponible',
        'cantidad_disponible': 1
    },
    {
        'codigo': 'BM-4X6',
        'nombre': 'Molino de Bolas BM-4X6',
        'marca': 'DURTRON',
        'modelo': 'BM-4X6',
        'categoria': 'Molinos de Bolas',
        'precio_lista': 579000,
        'precio_minimo': 521100,
        'precio_costo': 463200,
        'especificaciones': 'Dimensiones: 4x6 pies | Volumen: 3.2m³ | Salida: 74-200 mesh',
        'potencia_motor': '30HP (22Kw)',
        'capacidad': '2-3 T/H',
        'dimensiones': '4x6 pies',
        'peso': '7,500 kg',
        'ubicacion': 'Bodega Principal',
        'estado': 'Disponible',
        'cantidad_disponible': 1
    },
    {
        'codigo': 'BM-4X8',
        'nombre': 'Molino de Bolas BM-4X8',
        'marca': 'DURTRON',
        'modelo': 'BM-4X8',
        'categoria': 'Molinos de Bolas',
        'precio_lista': 795000,
        'precio_minimo': 715500,
        'precio_costo': 636000,
        'especificaciones': 'Dimensiones: 4x8 pies | Volumen: 4.3m³ | Salida: 74-200 mesh',
        'potencia_motor': '40HP (30Kw)',
        'capacidad': '3-4 T/H',
        'dimensiones': '4x8 pies',
        'peso': '9,800 kg',
        'ubicacion': 'Piso de Venta - Showroom',
        'estado': 'Disponible',
        'cantidad_disponible': 1
    },
    
    # BANDAS TRANSPORTADORAS
    {
        'codigo': 'MCB-6M',
        'nombre': 'Banda Transportadora MCB-6M',
        'marca': 'DURTRON',
        'modelo': 'MCB-6M',
        'categoria': 'Bandas Transportadoras',
        'precio_lista': 79900,
        'precio_minimo': 71910,
        'precio_costo': 63920,
        'especificaciones': 'Longitud: 6 metros | Ancho: 450mm | Capacidad: 5-10 T/H',
        'potencia_motor': '2HP (1.5Kw)',
        'capacidad': '5-10 T/H',
        'dimensiones': '6m x 450mm',
        'ubicacion': 'Bodega Principal',
        'estado': 'Disponible',
        'cantidad_disponible': 2
    },
    {
        'codigo': 'MCB-9M',
        'nombre': 'Banda Transportadora MCB-9M',
        'marca': 'DURTRON',
        'modelo': 'MCB-9M',
        'categoria': 'Bandas Transportadoras',
        'precio_lista': 97900,
        'precio_minimo': 88110,
        'precio_costo': 78320,
        'especificaciones': 'Longitud: 9 metros | Ancho: 450mm | Capacidad: 5-10 T/H',
        'potencia_motor': '3HP (2.2Kw)',
        'capacidad': '5-10 T/H',
        'dimensiones': '9m x 450mm',
        'ubicacion': 'Bodega Principal',
        'estado': 'Disponible',
        'cantidad_disponible': 2
    },
    {
        'codigo': 'MCB-12M',
        'nombre': 'Banda Transportadora MCB-12M',
        'marca': 'DURTRON',
        'modelo': 'MCB-12M',
        'categoria': 'Bandas Transportadoras',
        'precio_lista': 129000,
        'precio_minimo': 116100,
        'precio_costo': 103200,
        'especificaciones': 'Longitud: 12 metros | Ancho: 600mm | Capacidad: 10-15 T/H',
        'potencia_motor': '5HP (3.7Kw)',
        'capacidad': '10-15 T/H',
        'dimensiones': '12m x 600mm',
        'ubicacion': 'Bodega Principal',
        'estado': 'Disponible',
        'cantidad_disponible': 1
    },
    
    # TOLVAS
    {
        'codigo': 'FH-2',
        'nombre': 'Tolva de Alimentación FH-2',
        'marca': 'DURTRON',
        'modelo': 'FH-2',
        'categoria': 'Tolvas',
        'precio_lista': 47900,
        'precio_minimo': 43110,
        'precio_costo': 38320,
        'especificaciones': 'Capacidad: 2m³ | Alimentación con banda vibratoria',
        'potencia_motor': '1HP (0.75Kw)',
        'capacidad': '2 m³',
        'dimensiones': '2m³',
        'ubicacion': 'Bodega Principal',
        'estado': 'Disponible',
        'cantidad_disponible': 3
    },
    {
        'codigo': 'FH-2P',
        'nombre': 'Tolva de Alimentación FH-2P (con motor)',
        'marca': 'DURTRON',
        'modelo': 'FH-2P',
        'categoria': 'Tolvas',
        'precio_lista': 69900,
        'precio_minimo': 62910,
        'precio_costo': 55920,
        'especificaciones': 'Capacidad: 2m³ | Alimentación con banda vibratoria motorizada',
        'potencia_motor': '2HP (1.5Kw)',
        'capacidad': '2 m³',
        'dimensiones': '2m³',
        'ubicacion': 'Bodega Principal',
        'estado': 'Disponible',
        'cantidad_disponible': 2
    },
    
    # TANQUES AGITADORES
    {
        'codigo': 'AT-600',
        'nombre': 'Tanque Agitador AT-600L',
        'marca': 'DURTRON',
        'modelo': 'AT-600',
        'categoria': 'Tanques Agitadores',
        'precio_lista': 49900,
        'precio_minimo': 44910,
        'precio_costo': 39920,
        'especificaciones': 'Capacidad: 600 litros | Con agitador mecánico',
        'potencia_motor': '1HP (0.75Kw)',
        'capacidad': '600 L',
        'dimensiones': '600 litros',
        'ubicacion': 'Bodega Principal',
        'estado': 'Disponible',
        'cantidad_disponible': 2
    },
    {
        'codigo': 'AT-1300',
        'nombre': 'Tanque Agitador AT-1300L',
        'marca': 'DURTRON',
        'modelo': 'AT-1300',
        'categoria': 'Tanques Agitadores',
        'precio_lista': 67900,
        'precio_minimo': 61110,
        'precio_costo': 54320,
        'especificaciones': 'Capacidad: 1,300 litros | Con agitador mecánico',
        'potencia_motor': '1.5HP (1.1Kw)',
        'capacidad': '1,300 L',
        'dimensiones': '1,300 litros',
        'ubicacion': 'Bodega Principal',
        'estado': 'Disponible',
        'cantidad_disponible': 2
    },
    {
        'codigo': 'AT-3000',
        'nombre': 'Tanque Agitador AT-3000L',
        'marca': 'DURTRON',
        'modelo': 'AT-3000',
        'categoria': 'Tanques Agitadores',
        'precio_lista': 119900,
        'precio_minimo': 107910,
        'precio_costo': 95920,
        'especificaciones': 'Capacidad: 3,000 litros | Con agitador mecánico',
        'potencia_motor': '3HP (2.2Kw)',
        'capacidad': '3,000 L',
        'dimensiones': '3,000 litros',
        'ubicacion': 'Bodega Principal',
        'estado': 'Disponible',
        'cantidad_disponible': 1
    },
    
    # MESAS DE CONCENTRACIÓN
    {
        'codigo': 'SHT-D01',
        'nombre': 'Mesa de Concentración Doble SHT-D01',
        'marca': 'DURTRON',
        'modelo': 'SHT-D01',
        'categoria': 'Mesas de Concentración',
        'precio_lista': 69900,
        'precio_minimo': 62910,
        'precio_costo': 55920,
        'especificaciones': 'Mesa vibratoria doble para concentración de minerales',
        'potencia_motor': '1HP (0.75Kw)',
        'capacidad': '0.5 T/H',
        'dimensiones': 'Mesa doble',
        'ubicacion': 'Piso de Venta - Showroom',
        'estado': 'Disponible',
        'cantidad_disponible': 1
    },
    {
        'codigo': 'SHT-T01',
        'nombre': 'Mesa de Concentración Triple SHT-T01',
        'marca': 'DURTRON',
        'modelo': 'SHT-T01',
        'categoria': 'Mesas de Concentración',
        'precio_lista': 169900,
        'precio_minimo': 152910,
        'precio_costo': 135920,
        'especificaciones': 'Mesa vibratoria triple para concentración de minerales',
        'potencia_motor': '2HP (1.5Kw)',
        'capacidad': '1 T/H',
        'dimensiones': 'Mesa triple',
        'ubicacion': 'Bodega Principal',
        'estado': 'Disponible',
        'cantidad_disponible': 1
    },
    
    # CONCENTRADORES CENTRÍFUGOS
    {
        'codigo': 'CC-TF5',
        'nombre': 'Concentrador Centrífugo CC-TF5',
        'marca': 'DURTRON',
        'modelo': 'CC-TF5',
        'categoria': 'Concentradores Centrífugos',
        'precio_lista': 149000,
        'precio_minimo': 134100,
        'precio_costo': 119200,
        'especificaciones': 'Concentrador centrífugo para recuperación de oro fino',
        'potencia_motor': '3HP (2.2Kw)',
        'capacidad': '1-2 T/H',
        'dimensiones': 'TF5',
        'ubicacion': 'Piso de Venta - Showroom',
        'estado': 'Disponible',
        'cantidad_disponible': 1
    },
    {
        'codigo': 'CC-TF16',
        'nombre': 'Concentrador Centrífugo CC-TF16',
        'marca': 'DURTRON',
        'modelo': 'CC-TF16',
        'categoria': 'Concentradores Centrífugos',
        'precio_lista': 229000,
        'precio_minimo': 206100,
        'precio_costo': 183200,
        'especificaciones': 'Concentrador centrífugo para recuperación de oro fino',
        'potencia_motor': '5HP (3.7Kw)',
        'capacidad': '2-4 T/H',
        'dimensiones': 'TF16',
        'ubicacion': 'Bodega Principal',
        'estado': 'Disponible',
        'cantidad_disponible': 1
    },
    
    # EQUIPO DE LABORATORIO
    {
        'codigo': 'JC-L01',
        'nombre': 'Quebradora de Laboratorio JC-L01',
        'marca': 'DURTRON',
        'modelo': 'JC-L01',
        'categoria': 'Equipo de Laboratorio',
        'precio_lista': 49900,
        'precio_minimo': 44910,
        'precio_costo': 39920,
        'especificaciones': 'Quebradora de quijadas para laboratorio y muestras',
        'potencia_motor': '1HP (0.75Kw)',
        'capacidad': 'Muestras',
        'dimensiones': 'Compacto',
        'ubicacion': 'Piso de Venta - Showroom',
        'estado': 'Disponible',
        'cantidad_disponible': 2
    },
    {
        'codigo': 'HM-L01',
        'nombre': 'Pulverizador de Laboratorio HM-L01',
        'marca': 'DURTRON',
        'modelo': 'HM-L01',
        'categoria': 'Equipo de Laboratorio',
        'precio_lista': 69900,
        'precio_minimo': 62910,
        'precio_costo': 55920,
        'especificaciones': 'Pulverizador de martillos para laboratorio y muestras',
        'potencia_motor': '2HP (1.5Kw)',
        'capacidad': 'Muestras',
        'dimensiones': 'Compacto',
        'ubicacion': 'Piso de Venta - Showroom',
        'estado': 'Disponible',
        'cantidad_disponible': 2
    },
    {
        'codigo': 'SHT-L01',
        'nombre': 'Mesa de Laboratorio SHT-L01',
        'marca': 'DURTRON',
        'modelo': 'SHT-L01',
        'categoria': 'Equipo de Laboratorio',
        'precio_lista': 49900,
        'precio_minimo': 44910,
        'precio_costo': 39920,
        'especificaciones': 'Mesa de concentración para laboratorio y muestras',
        'potencia_motor': '0.5HP (0.37Kw)',
        'capacidad': 'Muestras',
        'dimensiones': 'Compacto',
        'ubicacion': 'Piso de Venta - Showroom',
        'estado': 'Disponible',
        'cantidad_disponible': 1
    }
]

def importar():
    """Importar productos vía API REST"""
    print("\n" + "="*60)
    print("  IMPORTANDO CATÁLOGO DURTRON 2025")
    print("="*60)
    print(f"\nAPI URL: {API_URL}")
    print(f"Total de productos: {len(productos)}")
    print("\n" + "-"*60 + "\n")
    
    exitosos = 0
    errores = 0
    
    for i, producto in enumerate(productos, 1):
        try:
            response = requests.post(
                f"{API_URL}/equipos",
                json=producto,
                timeout=10
            )
            
            if response.status_code == 201:
                print(f"✅ [{i:2d}/32] {producto['codigo']:12s} - {producto['nombre'][:40]}")
                exitosos += 1
            else:
                print(f"❌ [{i:2d}/32] {producto['codigo']:12s} - ERROR: {response.text[:50]}")
                errores += 1
                
        except requests.exceptions.RequestException as e:
            print(f"❌ [{i:2d}/32] {producto['codigo']:12s} - ERROR DE CONEXIÓN: {str(e)[:50]}")
            errores += 1
    
    print("\n" + "-"*60)
    print("\n📊 RESUMEN:")
    print(f"  ✅ Exitosos: {exitosos}")
    print(f"  ❌ Errores:  {errores}")
    print(f"  📦 Total:    {len(productos)}")
    print("\n" + "="*60 + "\n")

if __name__ == '__main__':
    print("\n⚠️  IMPORTANTE: Cambia la URL en la línea 8 del script")
    print("   Por la URL que te dio Render")
    print()
    
    respuesta = input("¿Ya cambiaste la URL? (s/n): ")
    
    if respuesta.lower() == 's':
        importar()
    else:
        print("\n❌ Cambia la URL primero y vuelve a ejecutar el script")
