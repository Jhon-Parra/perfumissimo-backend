import { Router } from 'express';
import {
    getProducts,
    getPublicCatalog,
    getNewestProducts,
    getProductById,
    createProduct,
    updateProduct,
    deleteProduct,
    importProductsFromSpreadsheet,
    downloadProductImportTemplate,
    getLowStockProducts,
    getRelatedProducts
} from '../controllers/product.controller';
import { uploadSingleImage, uploadSingleSpreadsheet } from '../middleware/upload.middleware';
import { verifyToken, requireRole, optionalVerifyToken } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { createProductSchema, updateProductSchema } from '../schemas/product.schema';

const router = Router();

router.get('/catalog', optionalVerifyToken, getPublicCatalog);
router.get('/newest', optionalVerifyToken, getNewestProducts);
router.get('/', getProducts);

router.get('/low-stock', verifyToken, requireRole(['SUPERADMIN', 'ADMIN', 'VENTAS', 'PRODUCTOS']), getLowStockProducts);

router.get('/import/template', verifyToken, requireRole(['SUPERADMIN', 'ADMIN', 'PRODUCTOS']), downloadProductImportTemplate);

router.get('/:id/related', optionalVerifyToken, getRelatedProducts);
router.get('/:id', optionalVerifyToken, getProductById);

router.post('/', verifyToken, requireRole(['SUPERADMIN', 'ADMIN', 'PRODUCTOS']), uploadSingleImage, validate(createProductSchema), createProduct);
router.post('/import', verifyToken, requireRole(['SUPERADMIN', 'ADMIN', 'PRODUCTOS']), uploadSingleSpreadsheet, importProductsFromSpreadsheet);
router.put('/:id', verifyToken, requireRole(['SUPERADMIN', 'ADMIN', 'PRODUCTOS']), uploadSingleImage, validate(updateProductSchema), updateProduct);
router.delete('/:id', verifyToken, requireRole(['SUPERADMIN', 'ADMIN', 'PRODUCTOS']), deleteProduct);

export default router;
