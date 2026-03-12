"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateProductSchema = exports.createProductSchema = void 0;
const zod_1 = require("zod");
const stringOptional = zod_1.z.string().optional();
const stringMin2Optional = zod_1.z.string().min(2).optional();
const stringMin10Optional = zod_1.z.string().min(10).optional();
exports.createProductSchema = zod_1.z.object({
    nombre: zod_1.z.string().min(2, 'Nombre debe tener al menos 2 caracteres').max(200),
    genero: zod_1.z.enum(['mujer', 'hombre', 'unisex']).optional(),
    descripcion: zod_1.z.string().min(10, 'Descripción debe tener al menos 10 caracteres'),
    notas_olfativas: stringOptional,
    notas: stringOptional,
    precio: zod_1.z.coerce.number().min(0, 'Precio debe ser positivo'),
    stock: zod_1.z.coerce.number().int().min(0, 'Stock no puede ser negativo').optional(),
    unidades_vendidas: zod_1.z.coerce.number().int().min(0).optional()
});
exports.updateProductSchema = zod_1.z.object({
    nombre: stringMin2Optional,
    genero: zod_1.z.enum(['mujer', 'hombre', 'unisex']).optional(),
    descripcion: stringMin10Optional.or(zod_1.z.literal('')),
    notas_olfativas: stringOptional,
    notas: stringOptional,
    precio: zod_1.z.coerce.number().min(0).optional(),
    stock: zod_1.z.coerce.number().int().min(0).optional()
});
