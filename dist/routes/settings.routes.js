"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const settings_controller_1 = require("../controllers/settings.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const validation_middleware_1 = require("../middleware/validation.middleware");
const settings_schema_1 = require("../schemas/settings.schema");
const upload_middleware_1 = __importDefault(require("../middleware/upload.middleware"));
const router = (0, express_1.Router)();
router.get('/', settings_controller_1.getSettings);
router.put('/', auth_middleware_1.verifyToken, (0, auth_middleware_1.requireRole)(['SUPERADMIN', 'ADMIN']), upload_middleware_1.default.fields([
    { name: 'hero_image', maxCount: 1 },
    { name: 'logo_image', maxCount: 1 }
]), (0, validation_middleware_1.validate)(settings_schema_1.updateSettingsSchema), settings_controller_1.updateSettings);
exports.default = router;
