import { Router } from 'express';
import { verifyToken } from '../middleware/auth.middleware';
import { WompiController } from '../controllers/wompi.controller';
import { createOrderLimiter } from '../middleware/security.middleware';

const router = Router();

// Public endpoints (solo para poblar UI)
router.get('/wompi/merchant', WompiController.getMerchant);
router.get('/wompi/pse/banks', WompiController.getPseBanks);

// Checkout (requiere sesion)
router.post('/wompi/pse/checkout', createOrderLimiter, verifyToken, WompiController.createPseCheckout);

// Webhook (Wompi)
router.post('/wompi/webhook', WompiController.webhook);

export default router;
