"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const wompi_controller_1 = require("../controllers/wompi.controller");
const security_middleware_1 = require("../middleware/security.middleware");
const router = (0, express_1.Router)();
// Public endpoints (solo para poblar UI)
router.get('/wompi/merchant', wompi_controller_1.WompiController.getMerchant);
router.get('/wompi/pse/banks', wompi_controller_1.WompiController.getPseBanks);
// Checkout (requiere sesion)
router.post('/wompi/pse/checkout', security_middleware_1.createOrderLimiter, auth_middleware_1.verifyToken, wompi_controller_1.WompiController.createPseCheckout);
// Webhook (Wompi)
router.post('/wompi/webhook', wompi_controller_1.WompiController.webhook);
exports.default = router;
