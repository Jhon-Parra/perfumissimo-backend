import { z } from 'zod';

const stringOptional = z.string().optional();
const stringMin2Optional = z.string().min(2).optional();
const stringMin10Optional = z.string().min(10).optional();

export const createProductSchema = z.object({
    nombre: z.string().min(2, 'Nombre debe tener al menos 2 caracteres').max(200),
    genero: z.enum(['mujer', 'hombre', 'unisex']).optional(),
    descripcion: z.string().min(10, 'Descripción debe tener al menos 10 caracteres'),
    notas_olfativas: stringOptional,
    notas: stringOptional,
    precio: z.coerce.number().min(0, 'Precio debe ser positivo'),
    stock: z.coerce.number().int().min(0, 'Stock no puede ser negativo').optional(),
    unidades_vendidas: z.coerce.number().int().min(0).optional()
});

export const updateProductSchema = z.object({
    nombre: stringMin2Optional,
    genero: z.enum(['mujer', 'hombre', 'unisex']).optional(),
    descripcion: stringMin10Optional.or(z.literal('')),
    notas_olfativas: stringOptional,
    notas: stringOptional,
    precio: z.coerce.number().min(0).optional(),
    stock: z.coerce.number().int().min(0).optional()
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
